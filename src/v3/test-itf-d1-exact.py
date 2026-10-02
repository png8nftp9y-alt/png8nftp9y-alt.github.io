import unittest,importlib.util,json
from pathlib import Path
spec=importlib.util.spec_from_file_location('verify',Path(__file__).with_name('verify-itf-d1-exact.py'))
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
class TestExact(unittest.TestCase):
 def row(self):return {'id':'m1','tournament_id':'t1','circuit':'itf','played_date':'2026-09-21','payload':json.dumps({'event':'G-S-M-KO','teams':[{'score':'6-2'}]})}
 def test_equal_counts_wrong_id_fails(self):
  e=self.row();self.assertEqual(v.compare('matches',{'m1':e},{'wrong':e})[0]['reason'],'missing_row')
 def test_partial_payload_fails(self):
  e=self.row();a={**e,'payload':json.dumps({'event':'G-S-M-KO','teams':[]})};self.assertEqual(v.compare('matches',{'m1':e},{'m1':a})[0]['columns'],['payload'])
 def test_same_json_different_key_order_passes(self):
  e=self.row();a={**e,'payload':json.dumps({'teams':[{'score':'6-2'}],'event':'G-S-M-KO'})};self.assertEqual(v.compare('matches',{'m1':e},{'m1':a}),[])
 def test_wrong_tournament_fails(self):
  e=self.row();a={**e,'tournament_id':'wrong'};self.assertIn('tournament_id',v.compare('matches',{'m1':e},{'m1':a})[0]['columns'])
 def test_extra_rows_do_not_hide_missing(self):
  e=self.row();self.assertEqual(len(v.compare('matches',{'m1':e},{'extra1':e,'extra2':e})),1)
if __name__=='__main__':unittest.main()
