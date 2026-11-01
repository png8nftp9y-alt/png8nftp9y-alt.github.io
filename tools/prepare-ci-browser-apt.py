"""Use the reachable Ubuntu mirror before installing the CI test browser."""
from pathlib import Path
import argparse
import re


def prepare(apt):
    apt = Path(apt)
    sources = [apt / 'sources.list']
    sources += sorted((apt / 'sources.list.d').glob('*.list'))
    sources += sorted((apt / 'sources.list.d').glob('*.sources'))
    changed = 0
    for path in sources:
        if not path.is_file():
            continue
        text = path.read_text()
        updated = re.sub(r'https?://azure\.archive\.ubuntu\.com/ubuntu(?=[/\s]|$)',
                         'https://archive.ubuntu.com/ubuntu', text)
        if updated != text:
            path.write_text(updated)
            changed += 1
    config = apt / 'apt.conf.d' / '99courtwatch-browser-network'
    config.parent.mkdir(parents=True, exist_ok=True)
    value = 'Acquire::Retries "0";\nAcquire::http::Timeout "20";\nAcquire::https::Timeout "20";\n'
    if not config.exists() or config.read_text() != value:
        config.write_text(value)
    return changed


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--apt-dir', default='/etc/apt')
    args = parser.parse_args()
    print('Ubuntu CI mirror files updated:', prepare(args.apt_dir))
