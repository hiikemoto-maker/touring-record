#!/usr/bin/env python3
"""CSPハッシュ同期ツール

index.html のインラインスクリプト本文から sha256 を計算し、
index.html / vercel.json / netlify.toml のCSP宣言を同期する。

使い方（リポジトリルートで実行）:
  python3 tools/sync-csp-hash.py          # 3ファイルを実ハッシュへ同期して検証
  python3 tools/sync-csp-hash.py --check  # 検証のみ（不一致なら exit 1）

インラインスクリプトを1文字でも変えたらコミット前に必ず実行すること。
不一致のままデプロイするとブラウザがスクリプト全体を拒否してアプリが起動しない
（.github/workflows/deploy-pages.yml のCIガードも同じ検証で止める）。
"""
import base64
import hashlib
import re
import sys

FILES = ['index.html', 'vercel.json', 'netlify.toml']
HASH_RE = re.compile(rb'sha256-([A-Za-z0-9+/=]+)')


def body_hash():
    html = open('index.html', 'rb').read()
    scripts = re.findall(rb'(?<=<script>)(.*?)(?=</script>)', html, re.DOTALL)
    if len(scripts) != 1:
        sys.exit(f'ERROR: expected 1 inline script, got {len(scripts)}')
    return base64.b64encode(hashlib.sha256(scripts[0]).digest()).decode()


def declared_hashes():
    result = {}
    for f in FILES:
        m = HASH_RE.search(open(f, 'rb').read())
        result[f] = m.group(1).decode() if m else None
    return result


def check():
    actual = body_hash()
    ok = True
    for f, declared in declared_hashes().items():
        status = 'OK' if declared == actual else 'MISMATCH'
        if declared != actual:
            ok = False
        print(f'{f}: {declared} [{status}]')
    print(f'actual body hash: {actual}')
    return ok


def sync():
    actual = body_hash()
    for f, declared in declared_hashes().items():
        if declared is None:
            sys.exit(f'ERROR: no sha256- declaration found in {f}')
        if declared != actual:
            data = open(f, 'r', encoding='utf-8').read()
            open(f, 'w', encoding='utf-8').write(data.replace(declared, actual))
            print(f'{f}: {declared} -> {actual}')
        else:
            print(f'{f}: already in sync')
    # 最終ゲート：ディスクを読み直して body==宣言 を照合する
    if not check():
        sys.exit('ERROR: sync failed verification')


if __name__ == '__main__':
    if '--check' in sys.argv:
        sys.exit(0 if check() else 1)
    sync()
