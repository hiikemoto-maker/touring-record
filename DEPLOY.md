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

- ツーリング記録はブラウザのlocalStorageに保存されます。
- 端末やブラウザが変わると記録は共有されません。
- `AGENTS.md` や `.claude` はVercel/Netlifyでは公開対象から除外します。
