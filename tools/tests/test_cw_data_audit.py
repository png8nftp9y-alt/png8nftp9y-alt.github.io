import contextlib, gzip, importlib.util, io, json, os, pathlib, sqlite3
import tempfile, unittest, zipfile
from unittest.mock import patch

ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('cw_audit',ROOT/'tools/cw_data_audit.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class AuditTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
  self.a=m.Audit('github',self.temp.name,600)
 def test_nested_json_detects_without_values(self):
  secret='3331234567';email='fixture.person@example.test'
  value={'payload':json.dumps({'phone':secret,'email':email,'TaxCode':'RSSMRA80A01H501U','medicalCertificateExpiry':'2026-01-01'})}
  self.a.scan(json.dumps(value).encode(),'data.json','source-1');self.a.save()
  report=(pathlib.Path(self.temp.name)/'report.json').read_text()
  self.assertNotIn(secret,report);self.assertNotIn(email,report);self.assertNotIn('RSSMRA80A01H501U',report)
  self.assertEqual(self.a.report['indicators']['field_phone_nonempty'],1)
  self.assertEqual(self.a.report['indicators']['field_medical_nonempty'],1)
 def test_empty_field_not_nonempty(self):
  self.a.scan(b'{"phone":null}','a.json','source');self.assertNotIn('field_phone_nonempty',self.a.report['indicators'])
 def test_compressed_nested_archive(self):
  buf=io.BytesIO()
  with zipfile.ZipFile(buf,'w') as z:z.writestr('private-name.json.gz',gzip.compress(b'{"email":"fixture@example.test"}'))
  self.a.scan(buf.getvalue(),'outer.zip','archive')
  self.assertEqual(self.a.report['indicators']['field_email_nonempty'],1)
  self.assertNotIn('private-name',json.dumps(self.a.report))
 def test_binary_and_corruption_are_gaps(self):
  self.a.scan(b'\0\xff\0','image.bin','binary');self.a.scan(b'\x1f\x8bbad','bad.gz','gzip')
  self.assertIn('unsupported_binary',self.a.report['gaps']);self.assertIn('gzip_unreadable',self.a.report['gaps'])
 def test_sqlite_and_sql_data(self):
  dump='CREATE TABLE people(payload TEXT);INSERT INTO people VALUES(\'{"phone":"3331234567"}\');'
  self.a.scan(dump.encode(),'backup.sql','sql')
  self.assertEqual(self.a.report['indicators']['field_phone_nonempty'],1)
  dbfile=pathlib.Path(self.temp.name)/'file.sqlite'
  with sqlite3.connect(dbfile) as db:db.executescript(dump)
  self.a.scan(dbfile.read_bytes(),'backup.db','sqlite')
  self.assertEqual(self.a.report['indicators']['field_phone_nonempty'],2)
 def test_sql_cannot_attach(self):
  self.a.scan(b"ATTACH DATABASE '/tmp/do-not-create-cw-audit' AS other;",'bad.sql','source')
  self.assertIn('sql_import_failed',self.a.report['gaps'])
 def test_resource_limit_never_clean(self):
  with patch.object(m,'MAX_BYTES',3):self.a.scan(b'{"phone":123}','a','source')
  self.assertIn('item_size_limit',self.a.report['gaps'])
 def test_checkpoint_resume_no_values(self):
  self.a.done.add('run-10-attempt-1');self.a.state['pending']=[{'id':11,'attempts':1,'status':'completed'}]
  self.a.gap('time_budget');self.a.save()
  state=json.loads((pathlib.Path(self.temp.name)/'checkpoint.json').read_text())
  report=json.loads((pathlib.Path(self.temp.name)/'report.json').read_text())
  target=m.Audit('github',self.temp.name,600);target.resume({'checkpoint':state,'report':report})
  self.assertIn('run-10-attempt-1',target.done);self.assertNotIn('time_budget',target.report['gaps'])
 def test_cross_scope_checkpoint_rejected(self):
  with self.assertRaises(m.Incomplete):self.a.resume({'checkpoint':{'scope':'r2','version':1},'report':{}})
 def test_timeout_propagates_from_gzip(self):
  self.a.deadline=0
  with self.assertRaises(m.Incomplete):self.a.scan(gzip.compress(b'{}'),'a.gz','source')
 def test_http_guard_blocks_source_and_token_leaks(self):
  h=m.HTTP(self.a)
  with self.assertRaises(m.Incomplete):h.request('https://www.fitp.it/')
  with self.assertRaises(m.Incomplete):h.request('https://example.com/',token='SENTINEL')
  with self.assertRaises(m.Incomplete):h.request('http://api.github.com/')
 def test_redirect_drops_authorization(self):
  class Response:
   def __init__(self,status,headers,data):self.status_code=status;self.headers=headers;self.data=data;self.ok=status<400
   def __enter__(self):return self
   def __exit__(self,*args):pass
   def iter_content(self,*args):yield self.data
  calls=[]
  def request(method,url,**kwargs):
   calls.append((url,kwargs['headers']))
   return Response(302,{'Location':'https://fixture.blob.core.windows.net/archive'},b'') if len(calls)==1 else Response(200,{},b'zip')
  with patch.object(m.requests,'request',side_effect=request):
   result=m.HTTP(self.a).request('https://api.github.com/archive',token='SENTINEL',download=True)
  self.assertEqual(result,b'zip');self.assertNotIn('Authorization',calls[1][1])
 def test_d1_uses_export_only_and_download_without_token(self):
  calls=[]
  class H:
   def request(inner,url,token=None,body=None,download=False):
    calls.append((url,token,body))
    if download:return b'CREATE TABLE sample(payload TEXT); INSERT INTO sample VALUES(\'{"phone":null}\');'
    return {'result':{'status':'complete','result':{'signed_url':'https://fixture.r2.cloudflarestorage.com/dump'}}}
  with patch.dict(os.environ,{'R2_ACCOUNT_ID':'a'*32,'CLOUDFLARE_API_TOKEN':'SENTINEL'}):m.audit_d1(self.a,H())
  self.assertTrue(calls[0][0].endswith('/export'));self.assertIsNone(calls[1][1])
  self.assertEqual(self.a.report['coverage']['rows'],1)

if __name__=='__main__':unittest.main()
