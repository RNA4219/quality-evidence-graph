# Contributing

Issueで目的と互換性影響を共有し、焦点を絞ったPull Requestを作成してください。Node.js 20または24を使用します。

    npm ci
    npm test
    npm run typecheck
    npm run schema-check
    npm run enum-check
    npm run birdseye-check

型、schema、requirements、manifest、fixture snapshotは同じ変更で同期してください。
