# デプロイ手順

このアプリは `index.html` だけで動く静的サイトです。

## GitHub Pages

1. GitHubで空のリポジトリを作る
2. このリポジトリにremoteを追加する
   ```sh
   git remote add origin <GitHubのリポジトリURL>
   git push -u origin main
   ```
3. GitHubのリポジトリ設定で Pages のSourceを `GitHub Actions` にする
4. `main` にpushすると `.github/workflows/deploy-pages.yml` が `index.html` だけを公開する

## Vercel

GitHubリポジトリをVercelにImportするだけで公開できます。
CLIを使う場合は、Vercelにログイン後に次を実行します。

```sh
vercel --prod
```

## Netlify

GitHubリポジトリをNetlifyにImportします。
Build commandは空、Publish directoryは `.` です。

## 注意

- ツーリング記録はまずブラウザのlocalStorageに保存されます。
- クラウド同期を使う場合は、Cloudflare Worker + D1 の同期APIを別途公開します。
- 写真データは容量が大きいため、クラウド同期では本文データとメンテナンス記録のみ同期します。
- `AGENTS.md` や `.claude` はVercel/Netlifyでは公開対象から除外します。

## Cloudflare D1 同期API

### npm / wrangler なしで公開する方法

Cloudflareで無料のAPIトークンを作成し、次を実行します。

```sh
CLOUDFLARE_API_TOKEN=... node cloudflare/deploy-sync-api.mjs
```

成功すると同期API URLが表示されます。

### wrangler を使う方法

1. CloudflareでD1データベースを作成する
2. `cloudflare/wrangler.toml.example` を `wrangler.toml` にコピーする
3. `database_id` をD1のIDに差し替える
4. テーブルを作成する
   ```sh
   wrangler d1 execute touring_record_sync --remote --file=cloudflare/schema.sql
   ```
5. Workerを公開する
   ```sh
   wrangler deploy
   ```
6. 公開されたWorker URLを、アプリの「同期API URL」に入力する
7. iPhoneとMacで同じ「同期キー」を入力して「今すぐ同期」を押す

同期キーはWorker側でハッシュ化して扱います。平文の同期キーはD1に保存しません。
