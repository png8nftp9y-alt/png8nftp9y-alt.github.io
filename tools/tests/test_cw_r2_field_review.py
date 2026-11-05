import io,json,pathlib,sys,tempfile,unittest,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools'))
import cw_data_audit as core
import cw_r2_field_review as review

class Tests(unittest.TestCase):
 def test_names_types_and_no_personal_values(self):
  with tempfile.TemporaryDirectory() as temp:
   a=review.Review(temp)
   a.scan(json.dumps({'payload':json.dumps({'medicalCertificateExpiry':'2026-12-31','certificationScope':'PRIVATE SENTINEL','health':None})}).encode(),'data.json','source')
   a.save();out=(pathlib.Path(temp)/'report.json').read_text()
   self.assertNotIn('PRIVATE SENTINEL',out);self.assertNotIn('2026-12-31',out)
   self.assertEqual(a.report['medicalFields']['source']['medicalCertificateExpiry']['dateLikeStrings'],1)
   self.assertEqual(a.report['medicalFields']['source']['health']['nonempty'],0)
 def test_only_three_objects_are_downloaded(self):
  objects=[{'Key':'private-'+str(i),'ETag':'etag','Size':2,'LastModified':'2026-01-01'} for i in range(5)]
  targets={core.fingerprint([x['Key'],x['ETag'],x['Size'],x['LastModified']]) for x in objects[1:4]}
  report={'scope':'r2','sources':{'r2-'+x:{'field_medical_present':1} for x in targets}}
  b=io.BytesIO()
  with zipfile.ZipFile(b,'w') as z:z.writestr('report.json',json.dumps(report))
  class H:
   def gh(self,path,download=False):return b.getvalue()
  class Client:
   def __init__(self):self.calls=[]
   def get_paginator(self,name):return self
   def paginate(self,**kwargs):yield {'Contents':objects}
   def get_object(self,**kwargs):self.calls.append(kwargs);return {'Body':io.BytesIO(b'{}')}
  with tempfile.TemporaryDirectory() as temp:
   a=review.Review(temp);client=Client();review.run_review(a,H(),client,'private-bucket')
   self.assertEqual(len(client.calls),3)
   self.assertEqual(a.report['coverage']['targetsMatched'],3)
   self.assertNotIn('private-',json.dumps(a.report))
 def test_wrong_target_count_is_rejected(self):
  with self.assertRaises(core.Incomplete):review.targets_from_report({'scope':'r2','sources':{}})

if __name__=='__main__':unittest.main()
