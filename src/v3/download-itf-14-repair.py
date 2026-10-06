import hashlib,json,os,pathlib,subprocess
import boto3
s3=boto3.client('s3',endpoint_url='https://'+os.environ['R2_ACCOUNT_ID']+'.r2.cloudflarestorage.com',region_name='auto')
bucket=os.environ['R2_BUCKET']
out=pathlib.Path('/tmp/itf-14-source');out.mkdir(parents=True,exist_ok=True)
coverage_path='/tmp/itf-14-coverage.json'
s3.download_file(bucket,'itf/audits/official-draw-parity/coverage-v3-current.json',coverage_path)
coverage=json.loads(pathlib.Path(coverage_path).read_text())
raw=subprocess.check_output(['node','--input-type=module','-e',"import {targets} from './src/v3/prepare-itf-14-repair.mjs';console.log(JSON.stringify(targets))"],text=True)
needed=set(tuple(t) for t in json.loads(raw))
for cid,event in list(needed):
 if '-S-Q-' not in event:continue
 row=next((t for t in coverage.get('tournaments',[]) if t.get('competitionId')==cid),{})
 for e in row.get('events',[]):
  if e.get('family')==event[0]+'-S-M':needed.add((cid,e['event']))
count=0
for cid,event in sorted(needed):
 prefix=f'itf/live-draws/tournaments/{cid}/{event}/'
 for page in s3.get_paginator('list_objects_v2').paginate(Bucket=bucket,Prefix=prefix):
  for item in page.get('Contents',[]):
   key=item['Key']
   if not key.endswith('.json.gz'):continue
   data=s3.get_object(Bucket=bucket,Key=key)['Body'].read()
   expected=key.rsplit('/',1)[1].removesuffix('.json.gz')
   if hashlib.sha256(data).hexdigest()!=expected:raise RuntimeError('R2 compressed checksum mismatch: '+key)
   (out/(str(count)+'.json.gz')).write_bytes(data);count+=1
print(json.dumps({'requestedTaskPrefixes':len(needed),'downloadedVersions':count,'scope':'14 targets plus same-sex main evidence; no full R2 scan or ITF request'}))
