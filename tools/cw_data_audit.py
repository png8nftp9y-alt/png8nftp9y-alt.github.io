"""Read-only remote data-presence audit. Never calls FITP or logs raw data.
Reports are candidate indicators, never legal findings or incident attribution.
"""
import argparse, collections, contextlib, datetime as dt, gzip, hashlib, io
import json, os, pathlib, re, sqlite3, tempfile, time, zipfile
import urllib.parse
import requests

REPO = 'png8nftp9y-alt/png8nftp9y-alt.github.io'
DB_ID = 'cc3b23ac-7f90-4a4d-9ec3-44f0f22e6fda'
MAX_BYTES = 512 * 1024 * 1024
MAX_EXPANDED = 1024 * 1024 * 1024
GROUPS = {
 'phone': re.compile(r'phone|telephone|telefono|cellular|cellulare|mobilenumber', re.I),
 'email': re.compile(r'email|emailaddress|mailaddress', re.I),
 'fiscal_code': re.compile(r'codicefiscale|fiscalcode|taxcode|taxid', re.I),
 'medical': re.compile(r'medical|certificat|health|sanitari', re.I),
 'birth': re.compile(r'dateofbirth|birthdate|birthyear|datanascita|annonascita|nascita|^dob$', re.I),
 'residence': re.compile(r'residen|homeaddress|residentialaddress', re.I),
}
VALUES = {
 'email_candidate': re.compile(r'(?<![\w.+-])[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}(?![\w.-])'),
 'italian_mobile_candidate': re.compile(r'(?<!\d)(?:\+39[ .-]?)?3\d{2}[ .-]?\d{3}[ .-]?\d{4}(?!\d)'),
 'fiscal_code_candidate': re.compile(r'\b[A-Z]{6}\d{2}[ABCDEHLMPRST]\d{2}[A-Z]\d{3}[A-Z]\b'),
}
class Incomplete(Exception): pass

def fingerprint(value):
 return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()

def category(key):
 key=re.sub('[^a-z0-9]', '', str(key).lower())
 return next((name for name, rx in GROUPS.items() if rx.search(key)), None)

class Audit:
 def __init__(self, scope, output, seconds=18000):
  self.scope=scope; self.output=pathlib.Path(output); self.output.mkdir(parents=True, exist_ok=True)
  self.deadline=time.monotonic()+seconds
  self.state={'version':1,'scope':scope,'done':[], 'pending':[], 'windows':[], 'cutoff':int(time.time())}
  self.report={'version':1,'scope':scope,'status':'running','startedAt':dt.datetime.now(dt.timezone.utc).isoformat(),
   'coverage':{},'indicators':{},'gaps':{},'sources':{},'limitations':[
    'Candidate patterns can match membership cards, fixtures and code examples; findings require review.',
    'No attribution of the FITP incident and no proof of historical non-receipt.',
    'Deleted evidence cannot be recovered; historical GitHub logs are outside this targeted audit.',
    'D1 Time Travel is not restored or inspected; retained R2 backups are inspected.',
    'Files exceeding explicit resource limits, images and encrypted formats are reported as gaps.'
   ]}
  self.done=set()
 def budget(self):
  if time.monotonic()>self.deadline:raise Incomplete('time_budget')
 def gap(self, reason, count=1):
  self.report['gaps'][reason]=self.report['gaps'].get(reason,0)+count
 def save(self):
  self.state['done']=sorted(self.done)
  for name,data in [('report.json',self.report),('checkpoint.json',self.state)]:
   target=self.output/name;temp=self.output/(name+'.tmp');temp.write_text(json.dumps(data,indent=2));temp.replace(target)
 def resume(self, data):
  state=data['checkpoint'];report=data['report']
  if state.get('scope')!=self.scope or state.get('version')!=1:raise Incomplete('checkpoint_scope')
  self.state=state;self.report=report;self.done=set(state.get('done',[]))
  # Preserve all evidence gaps; execution interruptions can be resolved by manual resume.
  self.report['gaps'].pop('time_budget',None);self.report['gaps'].pop('rate_limit',None)
  self.report['status']='running'
 def record(self, source, counts):
  if counts:
   dst=self.report['sources'].setdefault(source,{})
   for key,value in counts.items():
    dst[key]=dst.get(key,0)+value
    self.report['indicators'][key]=self.report['indicators'].get(key,0)+value
 def json_value(self, value, counts, depth=0):
  if depth>80:self.gap('json_depth');return
  if isinstance(value,dict):
   for key,v in value.items():
    group=category(key)
    if group:
     counts['field_'+group+'_present']+=1
     if v is not None and v!='' and v!=[] and v!={}:counts['field_'+group+'_nonempty']+=1
    self.json_value(v,counts,depth+1)
  elif isinstance(value,list):
   for v in value:self.json_value(v,counts,depth+1)
  elif isinstance(value,str):
   if value.strip().startswith(('{','[')):
    try:self.json_value(json.loads(value),counts,depth+1);return
    except (ValueError,RecursionError):pass
   for key,rx in VALUES.items():counts[key]+=len(rx.findall(value))
  elif isinstance(value,bytes):self.bytes(value,'blob',counts,depth+1)
 def bytes(self, data, name, counts, depth=0, expanded=None):
  self.budget()
  expanded=[0] if expanded is None else expanded
  expanded[0]+=len(data)
  if expanded[0]>MAX_EXPANDED:self.gap('expanded_size_limit');return
  if depth>8:self.gap('archive_depth');return
  if len(data)>MAX_BYTES:self.gap('item_size_limit');return
  if data.startswith(b'\x1f\x8b'):
   try:
    with gzip.GzipFile(fileobj=io.BytesIO(data)) as f:raw=f.read(MAX_BYTES+1)
    self.bytes(raw,name.removesuffix('.gz'),counts,depth+1,expanded)
   except Incomplete:raise
   except Exception:self.gap('gzip_unreadable')
   return
  if data.startswith(b'PK\x03\x04'):
   try:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
     for item in z.infolist():
      self.budget()
      if item.is_dir():continue
      if item.flag_bits&1:self.gap('encrypted_archive');continue
      if item.file_size>MAX_BYTES or expanded[0]+item.file_size>MAX_EXPANDED:self.gap('archive_size_limit');continue
      self.bytes(z.read(item),item.filename,counts,depth+1,expanded)
   except Incomplete:raise
   except Exception:self.gap('zip_unreadable')
   return
  if data.startswith(b'SQLite format 3\0'):
   with tempfile.TemporaryDirectory() as temp:
    p=pathlib.Path(temp)/'snapshot.sqlite';p.write_bytes(data)
    with contextlib.closing(sqlite3.connect(p.as_uri()+'?mode=ro',uri=True)) as db:self.database(db,counts)
   return
  if data.startswith(b'%PDF'):
   try:
    from pypdf import PdfReader
    reader=PdfReader(io.BytesIO(data))
    if reader.is_encrypted:self.gap('encrypted_pdf');return
    for page in reader.pages:
     text=page.extract_text() or ''
     if not text.strip():self.gap('pdf_without_text')
     if list(page.images):self.gap('pdf_images_not_ocr')
     self.text(text,counts)
   except Exception:self.gap('pdf_unreadable')
   return
  try:text=data.decode('utf-8-sig')
  except UnicodeDecodeError:
   if data.startswith((b'\xff\xfe',b'\xfe\xff')):text=data.decode('utf-16')
   else:self.gap('unsupported_binary');return
  if '\0' in text:self.gap('unsupported_binary');return
  if name.lower().endswith('.sql'):
   with tempfile.TemporaryDirectory() as temp:
    with contextlib.closing(sqlite3.connect(str(pathlib.Path(temp)/'dump.sqlite'))) as db:
     def auth(action,arg1,arg2,*_):
      if action in (sqlite3.SQLITE_ATTACH,sqlite3.SQLITE_DETACH):return sqlite3.SQLITE_DENY
      if action==sqlite3.SQLITE_FUNCTION and str(arg2).lower() in ('load_extension','readfile','writefile'):return sqlite3.SQLITE_DENY
      return sqlite3.SQLITE_OK
     db.set_authorizer(auth)
     try:db.executescript(text);self.database(db,counts)
     except Incomplete:raise
     except Exception:self.gap('sql_import_failed');self.text(text,counts)
   return
  self.text(text,counts)
 def text(self,text,counts):
  try:self.json_value(json.loads(text),counts)
  except (ValueError,RecursionError):
   for key,rx in VALUES.items():counts[key]+=len(rx.findall(text))
   # Recognize labels in SQL, XML and log text without emitting their values.
   for group,rx in GROUPS.items():counts['text_label_'+group]+=len(rx.findall(text))
 def database(self,db,counts):
  tables=db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
  self.report['coverage']['tables']=self.report['coverage'].get('tables',0)+len(tables)
  for (table,) in tables:
   self.budget();quoted='"'+table.replace('"','""')+'"'
   cursor=db.execute('SELECT * FROM '+quoted);names=[c[0] for c in cursor.description]
   for row in cursor:
    self.budget();self.json_value(dict(zip(names,row)),counts)
    self.report['coverage']['rows']=self.report['coverage'].get('rows',0)+1
 def scan(self,data,name,source):
  counts=collections.Counter();self.bytes(data,name,counts)
  self.record(source,{k:v for k,v in counts.items() if v})
  self.report['coverage']['itemsScanned']=self.report['coverage'].get('itemsScanned',0)+1
 def finish(self):
  self.report['status']='incomplete' if self.report['gaps'] else ('review_candidates' if self.report['indicators'] else 'no_candidates_within_scope')
  self.report['finishedAt']=dt.datetime.now(dt.timezone.utc).isoformat();self.save()
  print(json.dumps({k:self.report[k] for k in ('scope','status','coverage','indicators','gaps')},indent=2))
  summary=os.environ.get('GITHUB_STEP_SUMMARY')
  if summary:
   with open(summary,'a') as f:f.write('## Audit '+self.scope+'\n\n```json\n'+json.dumps({k:self.report[k] for k in ('status','coverage','indicators','gaps')},indent=2)+'\n```\n\nIndicatori da verificare; nessuna certificazione legale o attribuzione incidente.\n')
  return 2 if self.report['gaps'] else (3 if self.report['indicators'] else 0)

class HTTP:
 def __init__(self,audit):self.audit=audit
 def request(self,url,token=None,body=None,download=False,redirects=0):
  self.audit.budget();parsed=urllib.parse.urlsplit(url);host=parsed.hostname or ''
  if redirects>5:raise Incomplete('redirect_limit')
  if parsed.scheme!='https' or parsed.username or parsed.password:raise Incomplete('network_scheme_guard')
  allowed=('github.com','githubusercontent.com','blob.core.windows.net','amazonaws.com','cloudflarestorage.com','r2.dev','storage.googleapis.com','cloudflare.com')
  if not any(host==x or host.endswith('.'+x) for x in allowed):raise Incomplete('network_host_guard')
  if token and host not in ('api.github.com','api.cloudflare.com'):raise Incomplete('credential_host_guard')
  headers={'User-Agent':'CourtWatch-readonly-data-presence-audit'}
  if token:headers['Authorization']='Bearer '+token
  with requests.request('POST' if body is not None else 'GET',url,json=body,headers=headers,timeout=(15,90),allow_redirects=False,stream=True) as r:
   if r.status_code in (301,302,303,307,308):
    location=urllib.parse.urljoin(url,r.headers.get('Location',''))
    if urllib.parse.urlsplit(location).scheme!='https':raise Incomplete('download_scheme')
    return self.request(location,download=download,redirects=redirects+1) # No credentials cross origin.
   if r.status_code in (403,429) and (r.headers.get('X-RateLimit-Remaining')=='0' or r.status_code==429):raise Incomplete('rate_limit')
   if not r.ok:raise Incomplete('http_'+str(r.status_code))
   data=bytearray()
   for chunk in r.iter_content(1024*1024):
    self.audit.budget();data.extend(chunk)
    if len(data)>MAX_BYTES:raise Incomplete('download_size_limit')
   return bytes(data) if download else json.loads(data)
 def gh(self,path,download=False):return self.request('https://api.github.com/repos/'+REPO+path,os.environ['GH_TOKEN'],download=download)

def restore(a,h,run):
 if not run:return
 if not str(run).isdigit():raise Incomplete('resume_run_invalid')
 page=1;found=[]
 while True:
  items=h.gh('/actions/runs/'+str(run)+'/artifacts?per_page=100&page='+str(page))['artifacts']
  found.extend(x for x in items if x['name']=='cw-presence-'+a.scope and not x['expired'])
  if len(items)<100:break
  page+=1
 if len(found)!=1:raise Incomplete('resume_artifact_missing_or_ambiguous')
 data=h.gh('/actions/artifacts/'+str(found[0]['id'])+'/zip',download=True)
 with zipfile.ZipFile(io.BytesIO(data)) as z:
  for name in ['checkpoint.json','report.json']:
   if z.getinfo(name).file_size>64*1024*1024:raise Incomplete('checkpoint_size')
  a.resume({'checkpoint':json.loads(z.read('checkpoint.json')),'report':json.loads(z.read('report.json'))})

def audit_d1(a,h):
 account=os.environ['R2_ACCOUNT_ID'];token=os.environ['CLOUDFLARE_API_TOKEN']
 if not account or not token:raise Incomplete('missing_d1_credentials')
 url='https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database/'+DB_ID+'/export'
 body={'output_format':'polling','dump_options':{'compatibility':'sqlite3_cli_only'}}
 # Wait only for this one export operation; never polls or relaunches workflows.
 for _ in range(120):
  result=h.request(url,token,body)['result']
  if result.get('status')=='complete':break
  if result.get('status')=='error':raise Incomplete('d1_export_failed')
  bookmark=result.get('at_bookmark')
  if not bookmark:raise Incomplete('d1_export_missing_bookmark')
  body['current_bookmark']=bookmark;a.budget();time.sleep(2)
 else:raise Incomplete('d1_export_timeout')
 signed=result['result']['signed_url']
 if urllib.parse.urlsplit(signed).scheme!='https':raise Incomplete('export_download_scheme')
 data=h.request(signed,download=True)
 a.scan(data,'d1-snapshot.sql','d1-snapshot')
 a.report['coverage']['snapshotExported']=True
 a.report['coverage']['timeTravelRestored']=False


def r2_inventory(client,bucket,a):
 result={}
 for page in client.get_paginator('list_objects_v2').paginate(Bucket=bucket):
  a.budget()
  for obj in page.get('Contents',[]):
   key=fingerprint([obj['Key'],obj.get('ETag'),obj['Size'],obj.get('LastModified')])
   result[key]=obj
 return result

def audit_r2(a,h):
 import boto3
 from botocore.config import Config
 account=os.environ['R2_ACCOUNT_ID'];bucket=os.environ['R2_BUCKET']
 if not account or not bucket or not os.environ.get('AWS_ACCESS_KEY_ID') or not os.environ.get('AWS_SECRET_ACCESS_KEY'):raise Incomplete('missing_r2_credentials')
 client=boto3.client('s3',endpoint_url='https://'+account+'.r2.cloudflarestorage.com',region_name='auto',config=Config(retries={'max_attempts':0},connect_timeout=15,read_timeout=90))
 inventory=r2_inventory(client,bucket,a);a.report['coverage']['objectsListed']=len(inventory)
 for key,obj in inventory.items():
  a.budget()
  if key in a.done:continue
  if obj['Size']>MAX_BYTES:a.gap('r2_object_size_limit');continue
  try:
   response=client.get_object(Bucket=bucket,Key=obj['Key'],IfMatch=obj['ETag'])
   with contextlib.closing(response['Body']) as body:data=body.read(MAX_BYTES+1)
   if len(data)>MAX_BYTES:raise Incomplete('item_size_limit')
   if len(data)!=obj['Size']:raise Incomplete('r2_size_mismatch')
   a.scan(data,obj['Key'],'r2-'+key);a.done.add(key)
  except Incomplete:raise
  except Exception:a.gap('r2_object_read_failed')
  if len(a.done)%25==0:a.save();print('R2 objects scanned:',len(a.done),flush=True)
 after=r2_inventory(client,bucket,a)
 if set(inventory)!=set(after):a.gap('r2_inventory_changed_during_scan')
 a.report['coverage']['objectsVerifiedCurrentInventory']=sum(k in a.done for k in inventory)
 a.report['coverage']['includesAllRetainedPrefixes']=True


def main():
 parser=argparse.ArgumentParser();parser.add_argument('--scope',choices=['d1','r2'],required=True)
 parser.add_argument('--output',required=True);parser.add_argument('--resume-run',default='');parser.add_argument('--minutes',type=int,default=300)
 args=parser.parse_args()
 if not 1<=args.minutes<=315:parser.error('minutes must be 1..315')
 os.umask(0o077);a=Audit(args.scope,args.output,args.minutes*60);h=HTTP(a)
 a.save()
 try:
  if args.resume_run and args.scope!='d1':restore(a,h,args.resume_run)
  {'d1':audit_d1,'r2':audit_r2}[args.scope](a,h)
 except Incomplete as e:a.gap(str(e))
 except Exception as e:a.gap('execution_'+type(e).__name__)
 return a.finish()
if __name__=='__main__':raise SystemExit(main())
