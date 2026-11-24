# utterance-clips

Windows向けデスクトップアプリです。長い音声をバッチで文字起こしし、発話単位の音声クリップにして視聴・編集できます。

## できること

- **処理**: 長無音の短縮 → OpenAI文字起こし → 発話ごとに音声分割＋タイトル
- **視聴**: 一覧表示、上下で1文再生、タイトル編集、削除、結合（結合は新規ファイル）

設計の正本は [`docs/design.md`](docs/design.md) です。

## 必要環境

- Windows 10/11
- Node.js 20+
- OpenAI API キー

## 起動

```bash
npm install
npm start
```

初回起動後、設定画面で OpenAI API キーを保存してください（リポジトリには置きません）。

## デスクトップショートカット（Windows）

リポジトリで `npm install` 済みの状態で:

```bash
npm run shortcut
```

デスクトップに `utterance-clips.lnk` ができます。アプリ専用アイコンは `assets/icon.ico` です（未設定時に見えていた原子マークは Electron の既定アイコンです）。

## 出力フォルダ

```
meeting-YYYY-MM-DD-HHMM/
  meta.json
  audio/
    001.wav
    002.wav
    ...
    _archived/
```
