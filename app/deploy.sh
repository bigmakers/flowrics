#!/usr/bin/env bash
# Flowrics Web を ロリポップ！デプロイナウ (https://flowrics.lolipop-now.app) へデプロイする。
# app/ は素の HTML/JS だけなので framework は static(ビルドなし)。npm も package.json も不要。
#
# PROJECT は 2026-09-10 に作成した flowrics プロジェクト。別プロジェクトへ出すときは LOLIPOP_PROJECT で上書きできる。
# 前提:     npm i -g lolipop (Node 22.12+)。未ログインなら lolipop deploy が自動でブラウザを開く。
set -euo pipefail
cd "$(dirname "$0")"
PROJECT="${LOLIPOP_PROJECT:-01M25DYGHFEFNQ7F9ASN9GQNEW}"
NAME=flowrics
# 未コミットの作業内容を混ぜないため、git HEAD のクリーンな複製からデプロイする
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git -C .. archive HEAD app | tar -x -C "$TMP"
rm -f "$TMP/app/deploy.sh" "$TMP/app/README.md"   # 配信物は index.html だけにする
cd "$TMP/app"
if [ -n "$PROJECT" ]; then
  lolipop deploy --project "$PROJECT"
else
  echo "== PROJECT が未設定なので新規プロジェクト '$NAME' を作成してデプロイします" >&2
  lolipop deploy --name "$NAME" --framework static --domain "$NAME"
  echo "== 表示された project ID を app/deploy.sh の PROJECT に書き込んでください" >&2
fi
echo "== https://$NAME.lolipop-now.app"
