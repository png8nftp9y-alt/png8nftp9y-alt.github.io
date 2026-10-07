import hashlib,json,os,pathlib,re
from concurrent.futures import ThreadPoolExecutor
import boto3
from botocore.config import Config

def main():
    needed=json.loads(pathlib.Path('/tmp/itf-repair-live-needed.json').read_text())
    selection=json.loads(pathlib.Path('/tmp/itf-original-live-selection.json').read_text())['selected']
    destination=pathlib.Path('/tmp/itf-parity-repair-live');destination.mkdir(exist_ok=True)
    if not needed:
        print('Live R2 downloads: 0 (all exact versions found in archive)',flush=True);return
    client=boto3.client('s3',endpoint_url='https://'+os.environ['R2_ACCOUNT_ID']+'.r2.cloudflarestorage.com',region_name='auto',config=Config(connect_timeout=5,read_timeout=30,max_pool_connections=4,retries={'mode':'standard','total_max_attempts':3}))
    def download(expected):
        d=selection.get(expected['drawKey'])
        if not d:raise ValueError('Exact source absent from original live selection: '+expected['drawKey'])
        sha=d.get('sha256','')
        key=f"tournaments/{expected['competitionId']}/{expected['event']}/{sha}.json.gz"
        if not re.fullmatch('[a-f0-9]{64}',sha) or d.get('key')!=key or d.get('status')!='complete':raise ValueError('Invalid original live source identity')
        response=client.get_object(Bucket=os.environ['R2_BUCKET'],Key='itf/live-draws/'+key)
        body=response['Body']
        try:data=body.read()
        finally:body.close()
        if hashlib.sha256(data).hexdigest()!=sha:raise ValueError('Live compressed source hash mismatch')
        (destination/(sha+'.json.gz')).write_bytes(data)
    with ThreadPoolExecutor(max_workers=4) as pool:
        for i,_ in enumerate(pool.map(download,needed),1):
            if i%10==0 or i==len(needed):print(f'Live exact versions: {i}/{len(needed)}',flush=True)

if __name__=='__main__':main()
