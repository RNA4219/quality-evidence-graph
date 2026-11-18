# Contributing

Issueで目的と互換性影響を共有し、焦点を絞ったPull Requestを作成してください。Rustの安定版とCargoを使用します。npm APIと配布パッケージの検証にはNode.js 20または24も必要です。

    cargo test --locked
    npm ci
    npm test
    npm run typecheck
    npm run schema-check
    npm run enum-check
    npm run birdseye-check

型、schema、requirements、manifest、fixture snapshotは同じ変更で同期してください。
