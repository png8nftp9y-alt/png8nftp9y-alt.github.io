"""Read R2 manifests, then fetch only the newest populated complete version per wanted draw."""
import hashlib,json,os,pathlib,re,subprocess,sys

def choose(manifests,wanted):
    selected={}
    for manifest in manifests:
        stamp=manifest.get('generatedAt')
        if not isinstance(stamp,str) or not re.match(r'^\d{4}-\d{2}-\d{2}T',stamp):
            raise ValueError('Manifest without timestamp')
        for d in manifest.get('documents',[]):
            identity=d.get('competitionId','')+'|'+d.get('event','')
            if identity not in wanted or d.get('status')!='complete':continue
            if not isinstance(d.get('players'),int) or not isinstance(d.get('matches'),int):
                raise ValueError('Missing manifest document counts')
            if d['players']<=0 or d['matches']<=0:continue
            sha=d.get('sha256','')
            expected=f"tournaments/{d['competitionId']}/{d['event']}/{sha}.json.gz"
            if not re.fullmatch(r'[0-9a-f]{64}',sha) or d.get('key')!=expected:
                raise ValueError('Invalid manifest object identity')
            candidate=(stamp,sha,d)
            if identity not in selected or candidate[:2]>selected[identity][:2]:selected[identity]=candidate
    return {key:value[2] for key,value in selected.items()}

def main():
    endpoint='https://'+os.environ['R2_ACCOUNT_ID']+'.r2.cloudflarestorage.com'
    bucket=os.environ['R2_BUCKET'];base=['aws','--endpoint-url',endpoint]
    def call(*args):return subprocess.check_output(base+list(args),text=True)
    listing=json.loads(call('s3api','list-objects-v2','--bucket',bucket,'--prefix','itf/live-draws/runs/'))
    manifests=[]
    for obj in listing.get('Contents',[]):
        if not re.fullmatch(r'itf/live-draws/runs/[^/]+\.json',obj['Key']):continue
        target='/tmp/itf-parity-manifest.json'
        call('s3api','get-object','--bucket',bucket,'--key',obj['Key'],target)
        manifests.append(json.loads(pathlib.Path(target).read_text()))
    scope=json.loads(pathlib.Path('dist/v3/audits/itf-resolved-parity-scope.json').read_text())
    selected=choose(manifests,{x['drawKey'] for x in scope['wanted']})
    destination=pathlib.Path('/tmp/itf-parity-live');destination.mkdir(parents=True,exist_ok=True)
    for i,(identity,document) in enumerate(sorted(selected.items())):
        target=destination/f'{i}.json.gz'
        call('s3api','get-object','--bucket',bucket,'--key','itf/live-draws/'+document['key'],str(target))
        if hashlib.sha256(target.read_bytes()).hexdigest()!=document['sha256']:raise ValueError('R2 compressed hash mismatch: '+identity)
    pathlib.Path('dist/v3/audits/itf-resolved-parity-live-selection.json').write_text(json.dumps({'manifestsRead':len(manifests),'documentsDownloaded':len(selected),'selected':selected},indent=2)+'\n')
    print(json.dumps({'manifestsRead':len(manifests),'completeVersionsDownloaded':len(selected)}))

if __name__=='__main__':main()
