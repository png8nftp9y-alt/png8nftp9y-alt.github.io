"""Validate manifest, bytes, hashes and counts before extracting R2 archives."""
import hashlib
import json
import pathlib
import tarfile

manifest = json.loads(pathlib.Path('/tmp/itf-manifest.json').read_text())
blocks = manifest.get('blocks', [])
assert manifest.get('status') == 'itf_history_draw_archive_complete'
assert isinstance(manifest.get('complete'), int) and manifest['complete'] > 0
assert manifest.get('expected') == manifest['complete']
assert all(manifest.get(key) == 0 for key in ('missing', 'retry', 'unreadable'))
assert blocks and sum(b['count'] for b in blocks) == manifest['complete']
assert len({b['block'] for b in blocks}) == len(blocks)
actual = list(pathlib.Path('/tmp/itf-blocks').glob('*.tar.gz'))
assert len(actual) == len(blocks)
for block in blocks:
    block_id = block['block']
    assert isinstance(block_id, str) and block_id.isdigit()
    archive = pathlib.Path('/tmp/itf-blocks') / f'block-{block_id}.tar.gz'
    assert archive.stat().st_size == block['sizeBytes']
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == block['sha256']
    destination = pathlib.Path('/tmp/itf-draw-archive') / block_id
    destination.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive, 'r:gz') as tar:
        members = tar.getmembers()
        documents = [m for m in members if m.isfile() and m.name.endswith('.json.gz')]
        assert len(documents) == block['count']
        assert all(m.isdir() or m in documents for m in members)
        tar.extractall(destination, filter='data')
assert len(list(pathlib.Path('/tmp/itf-draw-archive').rglob('*.json.gz'))) == manifest['complete']
print(f"ITF_R2_ARCHIVE_VERIFIED={manifest['complete']}")
