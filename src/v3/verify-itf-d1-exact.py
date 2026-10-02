import json,sqlite3,subprocess,sys,datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]

def canonical(value):
    if isinstance(value,str):value=json.loads(value)
    return json.dumps(value,sort_keys=True,ensure_ascii=False,separators=(',',':'))

def compare(table,expected,actual):
    issues=[]
    columns={'tournaments':['circuit','source_tournament_id'], 'matches':['tournament_id','circuit','played_date','payload'], 'results':['tournament_id','match_id','circuit','played_date','payload']}[table]
    for key,e in expected.items():
        a=actual.get(key)
        if a is None:issues.append({'table':table,'id':key,'reason':'missing_row'});continue
        differences=[c for c in columns if (canonical(e[c])!=canonical(a[c]) if c=='payload' else e[c]!=a[c])]
        if differences:issues.append({'table':table,'id':key,'reason':'content_mismatch','columns':differences})
    return issues

def verify():
    schema='''CREATE TABLE tournaments(id TEXT PRIMARY KEY,circuit TEXT,source_tournament_id TEXT,start_date TEXT,end_date TEXT,payload TEXT);
CREATE TABLE matches(id TEXT PRIMARY KEY,tournament_id TEXT,circuit TEXT,played_date TEXT,payload TEXT);
CREATE TABLE results(id TEXT PRIMARY KEY,tournament_id TEXT,match_id TEXT,circuit TEXT,played_date TEXT,payload TEXT);'''
    db=sqlite3.connect(':memory:');db.row_factory=sqlite3.Row;db.executescript(schema)
    files=sorted((ROOT/'seed-itf-draws').glob('*.sql'))
    if not files:raise RuntimeError('Expected SQL seed is empty')
    for file in files:db.executescript(file.read_text())
    scope=json.loads((ROOT/'dist/v3/audits/itf-d1-exact-scope.json').read_text())
    issues=[];counts={};draws={d['key']:{**d,'expectedMatches':0,'remoteMatches':0,'missingMatches':0,'mismatchedMatches':0,'expectedResults':0,'missingResults':0,'mismatchedResults':0} for d in scope['selected']}
    for table in ['tournaments','matches','results']:
        expected={r['id']:dict(r) for r in db.execute('SELECT * FROM '+table)}
        actual={};last='';remote_count=0
        while True:
            literal="'"+last.replace("'","''")+"'"
            query=f"SELECT * FROM {table} WHERE circuit='itf' AND id>{literal} ORDER BY id LIMIT 1000"
            run=subprocess.run(['npx','wrangler','d1','execute','courtwatch-app','--remote','--config','wrangler.generated.jsonc','--json','--command',query],cwd=ROOT/'cloudflare/app-api',capture_output=True,text=True)
            if run.returncode:raise RuntimeError('D1 read failed: '+run.stderr[-1500:])
            parsed=json.loads(run.stdout)
            if not isinstance(parsed,list) or any(r.get('success') is False for r in parsed):raise RuntimeError('D1 response invalid')
            rows=[row for r in parsed for row in r.get('results',[])]
            remote_count+=len(rows)
            for row in rows:
                if row['id'] in expected:actual[row['id']]=row
            if len(rows)<1000:break
            next_last=rows[-1]['id']
            if next_last<=last:raise RuntimeError('D1 pagination did not advance')
            last=next_last
        errors=compare(table,expected,actual);issues.extend(errors)
        counts[table]={'expected':len(expected),'found':len(actual),'remoteItfRows':remote_count,'missing':sum(i['reason']=='missing_row' for i in errors),'mismatched':sum(i['reason']=='content_mismatch' for i in errors)}
        error_map={i['id']:i for i in errors}
        if table in ['matches','results']:
            for key,row in expected.items():
                payload=json.loads(row['payload']);draw=draws.get(payload['competitionId']+'|'+payload['event'])
                if not draw:raise RuntimeError('Expected row outside selected draw scope')
                if table=='matches':
                    draw['expectedMatches']+=1;draw['remoteMatches']+=int(key in actual)
                    if key in error_map:draw['missingMatches' if error_map[key]['reason']=='missing_row' else 'mismatchedMatches']+=1
                else:
                    draw['expectedResults']+=1
                    if key in error_map:draw['missingResults' if error_map[key]['reason']=='missing_row' else 'mismatchedResults']+=1
    artifacts_ok=not(scope['missingDocuments'] or scope['unreadable'] or scope['pending'])
    parity_ok=artifacts_ok and not issues
    report={'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'readOnlyD1':True,'databaseParity': 'verified' if parity_ok else 'failed','fullPeriodCertified':False,'scope':scope,'counts':counts,'draws':list(draws.values()),'issues':issues,'limitation':scope['periodLimitation']}
    path=ROOT/'dist/v3/audits/itf-d1-exact-verification.json';path.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps({'databaseParity':report['databaseParity'],'fullPeriodCertified':False,'counts':counts,'missingDocuments':len(scope['missingDocuments']),'pending':len(scope['pending']),'firstTournamentStart':scope['firstTournamentStart']}))
    if not parity_ok:sys.exit(2)

if __name__=='__main__':verify()
