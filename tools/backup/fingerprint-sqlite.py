#!/usr/bin/env python3
import argparse
import hashlib
import json
import sqlite3
from pathlib import Path


def qident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def feed_value(h, value):
    if value is None:
        h.update(b'N;')
    elif isinstance(value, bytes):
        h.update(b'B')
        h.update(str(len(value)).encode())
        h.update(b':')
        h.update(value)
        h.update(b';')
    elif isinstance(value, int):
        data = str(value).encode()
        h.update(b'I' + str(len(data)).encode() + b':' + data + b';')
    elif isinstance(value, float):
        data = repr(value).encode()
        h.update(b'F' + str(len(data)).encode() + b':' + data + b';')
    else:
        data = str(value).encode('utf-8')
        h.update(b'T' + str(len(data)).encode() + b':' + data + b';')


def fingerprint_table(conn, table):
    columns = conn.execute(f'PRAGMA table_info({qident(table)})').fetchall()
    names = [row[1] for row in columns]
    h = hashlib.sha256()
    h.update(('TABLE:' + table + '\n').encode())
    for row in columns:
        h.update(json.dumps(list(row), ensure_ascii=False, separators=(',', ':')).encode('utf-8'))
        h.update(b'\n')
    if names:
        order = ','.join(qident(name) for name in names)
        cursor = conn.execute(f'SELECT * FROM {qident(table)} ORDER BY {order}')
    else:
        cursor = conn.execute(f'SELECT * FROM {qident(table)}')
    count = 0
    for row in cursor:
        h.update(b'R[')
        for value in row:
            feed_value(h, value)
        h.update(b']\n')
        count += 1
    return {'rows': count, 'sha256': h.hexdigest()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('database')
    parser.add_argument('--output')
    args = parser.parse_args()
    db = Path(args.database)
    if not db.is_file():
        raise SystemExit(f'Database not found: {db}')
    conn = sqlite3.connect(f'file:{db}?mode=ro', uri=True)
    try:
        integrity = conn.execute('PRAGMA integrity_check').fetchone()[0]
        if integrity != 'ok':
            raise SystemExit(f'SQLite integrity check failed: {integrity}')
        tables = [row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_cf_KV' ORDER BY name")]
        result = {'status': 'green', 'integrity': 'ok', 'applicationTableCount': len(tables), 'tables': {}}
        global_hash = hashlib.sha256()
        for table in tables:
            fp = fingerprint_table(conn, table)
            result['tables'][table] = fp
            global_hash.update(table.encode('utf-8') + b'\0' + fp['sha256'].encode() + b'\n')
        result['globalSha256'] = global_hash.hexdigest()
    finally:
        conn.close()
    text = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        Path(args.output).write_text(text, encoding='utf-8')
    else:
        print(text, end='')


if __name__ == '__main__':
    main()
