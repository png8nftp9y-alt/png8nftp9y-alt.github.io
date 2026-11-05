"""Inspect only the three medical-field candidates from the existing R2 audit.
No FITP requests, writes, raw keys, personal values or complete objects in output.
"""
import collections, contextlib, io, json, os, re, zipfile
import cw_data_audit as core

ARTIFACT_ID=13382730403
SAFE_FIELD=re.compile(r'^[A-Za-z_][A-Za-z_0-9]{0,63}$')

class Review(core.Audit):
 def __init__(self, output):
  super().__init__('r2',output,seconds=900)
  self.report['medicalFields']={};self.current_source='unknown'
 def json_value(self,value,counts,depth=0):
  if isinstance(value,dict):
   for key,item in value.items():
    if core.category(key)!='medical':continue
    label=key if SAFE_FIELD.fullmatch(key) else 'unpublished-key-'+core.fingerprint(key)
    source=self.report['medicalFields'].setdefault(self.current_source,{})
    row=source.setdefault(label,{'present':0,'nonempty':0,'valueTypes':{},'dateLikeStrings':0})
    row['present']+=1
    if item is not None and item!='' and item!=[] and item!={}:row['nonempty']+=1
    typename=type(item).__name__;row['valueTypes'][typename]=row['valueTypes'].get(typename,0)+1
    if isinstance(item,str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}(?:[T ].*)?',item):row['dateLikeStrings']+=1
  return super().json_value(value,counts,depth)
 def scan(self,data,name,source):
  self.current_source=source
  return super().scan(data,name,source)

def targets_from_report(report):
 if report.get('scope')!='r2':raise core.Incomplete('wrong_source_report')
 targets={key[3:] for key,value in report.get('sources',{}).items()
          if key.startswith('r2-') and value.get('field_medical_present',0)>0}
 if len(targets)!=3 or any(not re.fullmatch('[a-f0-9]{64}',key) for key in targets):
  raise core.Incomplete('unexpected_target_inventory')
 return targets

def run_review(a,http,client,bucket):
 data=http.gh('/actions/artifacts/'+str(ARTIFACT_ID)+'/zip',download=True)
 with zipfile.ZipFile(io.BytesIO(data)) as z:
  if z.getinfo('report.json').file_size>64*1024*1024:raise core.Incomplete('source_report_size')
  targets=targets_from_report(json.loads(z.read('report.json')))
 a.report['coverage']['targetObjects']=len(targets)
 found={};listed=0
 # Only metadata listing, not the full-bucket content scan.
 for page in client.get_paginator('list_objects_v2').paginate(Bucket=bucket):
  a.budget()
  for obj in page.get('Contents',[]):
   listed+=1
   key=core.fingerprint([obj['Key'],obj.get('ETag'),obj['Size'],obj.get('LastModified')])
   if key in targets:found[key]=obj
  if len(found)==len(targets):break
 a.report['coverage']['inventoryEntriesVisited']=listed
 a.report['coverage']['targetsMatched']=len(found)
 for key in sorted(targets):
  a.budget()
  if key not in found:a.gap('target_missing_or_modified');continue
  obj=found[key]
  if obj['Size']>core.MAX_BYTES:a.gap('target_size_limit');continue
  try:
   response=client.get_object(Bucket=bucket,Key=obj['Key'],IfMatch=obj['ETag'])
   with contextlib.closing(response['Body']) as stream:data=stream.read(core.MAX_BYTES+1)
   if len(data)!=obj['Size'] or len(data)>core.MAX_BYTES:raise core.Incomplete('target_size_mismatch')
   a.scan(data,obj['Key'],'r2-'+key)
  except core.Incomplete:raise
  except Exception:a.gap('target_read_failed')
  a.save()
 a.report['coverage']['originalRun']=41913673787
 a.report['limitations'].append('Targeted review covers exactly the three previous medical-field candidates, not remaining R2 objects or D1.')

def main():
 import boto3
 from botocore.config import Config
 os.umask(0o077);a=Review('field-review-public');a.save()
 try:
  names=['R2_ACCOUNT_ID','R2_BUCKET','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','GH_TOKEN']
  if any(not os.environ.get(key) for key in names):raise core.Incomplete('missing_credentials')
  client=boto3.client('s3',endpoint_url='https://'+os.environ['R2_ACCOUNT_ID']+'.r2.cloudflarestorage.com',region_name='auto',config=Config(retries={'max_attempts':0},connect_timeout=15,read_timeout=90))
  run_review(a,core.HTTP(a),client,os.environ['R2_BUCKET'])
 except core.Incomplete as error:a.gap(str(error))
 except Exception as error:a.gap('execution_'+type(error).__name__)
 # "review_candidates" is expected here: this job exists to identify their fields.
 a.report['reviewStatus']='incomplete' if a.report['gaps'] else 'targeted_fields_identified'
 a.finish()
 summary=os.environ.get('GITHUB_STEP_SUMMARY')
 text=json.dumps({'reviewStatus':a.report['reviewStatus'],'medicalFields':a.report['medicalFields']},indent=2)
 print(text)
 if summary:
  with open(summary,'a') as f:f.write('\n## Field names only; no personal values\n\n```json\n'+text+'\n```\n')
 return 2 if a.report['gaps'] else 0
if __name__=='__main__':raise SystemExit(main())
