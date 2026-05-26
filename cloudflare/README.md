# Cloudflare D1 同期API

このフォルダは、ツーリング記録帳を iPhone と Mac で同期するための無料枠向けAPIです。

## 無料枠で使う構成

- Cloudflare Workers: 同期API
- Cloudflare D1: 記録本文の保存
- `workers.dev`: 無料のAPI URL
- 写真: 初期同期では除外

## デプロイ

Cloudflareで無料のAPIトークンを作り、次を実行します。

```sh
CLOUDFLARE_API_TOKEN=... node cloudflare/deploy-sync-api.mjs
```

成功すると次のURLが表示されます。

```text
https://touring-record-sync.hi-ikemoto.workers.dev
```

このURLをツーリング記録帳の「同期API URL」に入力し、iPhoneとMacで同じ「同期キー」を入力してください。

## 必要なCloudflare権限

- Account: Cloudflare D1 Edit
- Account: Workers Scripts Edit

## 注意

- 同期キーはD1へ平文保存しません。Worker側でハッシュ化して保存します。
- 既存のlocalStorage記録は残ります。
- iPhone側の写真データは容量が大きいため、まずは本文だけ同期します。

