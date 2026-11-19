import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("prepare_browser", Path(__file__).resolve().parents[1] / "prepare-ci-browser-apt.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class BrowserMirrorTest(unittest.TestCase):
    def test_runner_mirrors_and_idempotence(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "sources.list.d").mkdir()
            source = root / "sources.list.d/ubuntu.sources"
            source.write_text("URIs: mirror+file:/etc/apt/apt-mirrors.txt\nSuites: noble noble-updates\nURIs: mirror+file:/etc/apt/apt-mirrors-security.txt\n")
            legacy = root / "sources.list"
            legacy.write_text("deb http://us-east-2.ec2.archive.ubuntu.com/ubuntu noble main\ndeb http://azure.archive.ubuntu.com/ubuntu noble main\ndeb https://packages.microsoft.com/ubuntu/24.04/prod noble main\n")
            self.assertEqual(module.prepare(root), 2)
            self.assertIn("URIs: https://archive.ubuntu.com/ubuntu", source.read_text())
            self.assertIn("URIs: https://security.ubuntu.com/ubuntu", source.read_text())
            self.assertNotIn("ec2.archive", legacy.read_text())
            self.assertNotIn("azure.archive", legacy.read_text())
            self.assertIn("https://packages.microsoft.com", legacy.read_text())
            self.assertIn('Timeout "20"', (root / "apt.conf.d/99courtwatch-browser-network").read_text())
            self.assertEqual(module.prepare(root), 0)

if __name__ == "__main__":
    unittest.main()
