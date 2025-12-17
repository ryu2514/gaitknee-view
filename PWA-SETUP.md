# PWA セットアップガイド

## 概要
GaitKnee-ViewはPWA（Progressive Web App）として動作します。

## 実装済み機能

### ✅ 完了
- [x] manifest.json の作成
- [x] Service Worker の実装
- [x] オフライン対応
- [x] インストールプロンプト

### ⚠️ 未完了（必要な作業）

#### PWAアイコンの作成
以下のアイコン画像を作成して、`public/`ディレクトリに配置してください：

1. **icon-192.png** (192x192px)
2. **icon-512.png** (512x512px)

**デザインガイドライン：**
- 背景色: `#1a365d` (プライマリーカラー)
- 膝関節や歩行を連想させるシンプルなアイコン
- マスカブル対応（セーフエリアに注意）

#### 簡易的なアイコン作成方法

オンラインツールを使用：
- [favicon.io](https://favicon.io/)
- [realfavicongenerator.net](https://realfavicongenerator.net/)

または、以下のコマンドでプレースホルダーを作成：

```bash
# ImageMagickを使用（要インストール）
convert -size 192x192 xc:#1a365d -gravity center \
  -pointsize 48 -fill white -annotate +0+0 "GK" \
  public/icon-192.png

convert -size 512x512 xc:#1a365d -gravity center \
  -pointsize 128 -fill white -annotate +0+0 "GK" \
  public/icon-512.png
```

## PWAとしてインストール

### デスクトップ（Chrome/Edge）
1. アプリにアクセス
2. アドレスバーの右側にインストールアイコンが表示
3. クリックしてインストール

### モバイル（iOS Safari）
1. アプリにアクセス
2. 共有ボタンをタップ
3. 「ホーム画面に追加」を選択

### モバイル（Android Chrome）
1. アプリにアクセス
2. メニュー → 「ホーム画面に追加」

## Service Worker の動作

### キャッシュ戦略
- **キャッシュファースト**: HTML, CSS, JS
- **ネットワークファースト**: MediaPipe WASMファイル
- **ネットワークのみ**: クロスオリジンリクエスト

### 更新
- Service Workerは1分ごとに更新をチェック
- 新しいバージョンがあれば自動更新

## デバッグ

### Chrome DevTools
1. F12で開発者ツールを開く
2. Application タブ
3. Service Workers セクション

### 強制更新
```javascript
// コンソールで実行
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(registration => registration.unregister())
})
```

## 本番デプロイ時の注意

1. **HTTPS必須**: Service WorkerはHTTPSでのみ動作
2. **キャッシュバージョン管理**: `CACHE_NAME`を更新
3. **アイコン確認**: すべてのサイズが揃っているか確認
4. **manifest.json確認**: `start_url`などのURLが正しいか確認

## テスト

### PWA検証ツール
- Chrome DevTools → Lighthouse → Progressive Web App
- [web.dev/measure](https://web.dev/measure/)

### 確認項目
- [ ] HTTPSで動作
- [ ] アイコンが正しく表示
- [ ] オフラインで基本機能が動作
- [ ] インストール可能
- [ ] ホーム画面から起動できる
