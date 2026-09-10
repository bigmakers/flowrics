# Flowrics Web

YouTube の動画を背景に、LRCLIB の同期歌詞を弾幕風に流す Flowrics のブラウザ版。`index.html` 1 ファイルで完結し、ビルド工程はない。

## 公開先

| 場所 | URL | 反映方法 |
|---|---|---|
| GitHub Pages | https://bigmakers.github.io/flowrics/app/ | `main` に push すると自動 |
| ロリポップ！デプロイナウ | https://flowrics.lolipop-now.app | `./app/deploy.sh` |

デプロイナウへは `lolipop` CLI (`npm i -g lolipop`) で `static` フレームワークとして出す。初回は `deploy.sh` の `PROJECT` を空のまま実行するとプロジェクトが作られるので、表示された project ID を `PROJECT` に書き込む。

## 使い方

1. 右上の ☰ → キューに YouTube の URL(watch / youtu.be / Shorts)を追加
2. 動画タイトルから曲名・アーティストを推定して LRCLIB を検索し、同期歌詞を自動で流す
3. 合わなければ「歌詞」タブで候補を切り替える、曲名を直して再検索する、LRC を貼り付ける、オフセットで微調整する

`?v=ID1,ID2` の形でキューを URL 共有できる。設定とキューは localStorage に保存される。

## 制約

- YouTube の規約上、音声だけの再生はできない。動画をそのまま背景に表示する
- 埋め込みが許可されていない動画(エラー 101/150)は再生できず次の曲へスキップする
- 歌詞は LRCLIB にある曲だけ。YouTube のプレイリスト URL 読み込みとアプリ内 YouTube 検索は未対応
