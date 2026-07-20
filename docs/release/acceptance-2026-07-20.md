---
intent_id: INT-QEG-RELEASE-ACCEPTANCE-20260720
owner: quality-evidence-graph
status: verified
last_reviewed_at: 2026-07-20
next_review_due: 2026-10-20
---

# QEG repository completion acceptance — 2026-07-20

## Decision

QEG本体はfeature completeであり、repository内のrelease candidateとして`go`とする。code-bearing commitとevidence-record docs-only commitのNode 20 / 24 CIはすべて成功した。

この判定は、実cluster、実fault injection、実サービスのresilience、Lakda real acceptance、tag、publish、release approvalを含まない。

## Gate Summary

| Gate | Verdict | Evidence |
|---|---|---|
| Scope completion | go | adapter、graph、placement、DQ-01〜DQ-21、BLK-REL-01〜04、waiver、record / report / snapshot、normalizerを実装済み |
| Contract compatibility | go | legacy assignability、public discriminator union、`qegVersion=0.2`、wire shapeを維持 |
| Provenance conflict hardening | go | `evidenced_by`矛盾をDQ-18にし、runtime testと`negative-resilience-evidenced-by-conflict`で固定 |
| Fixture regression | go | 53 fixture、うちReliability / Resilience 22件 |
| Package smoke | go | clean tarball install、CLI / library、packed public type contract、dry-run 714 files |
| Documentation consistency | go | requirements、blueprint、task ledger、evaluation、spec、fixture契約を現行状態へ同期 |
| Isolated consumer acceptance | go | Node 24.15.0 / npm 11.12.1の一時git repoへpacked tarballをfresh install |
| Node 20 / 24 CI | go | code-bearing run 29717279305、evidence-record run 29717490349で両job SUCCESS |
| External real-environment acceptance | not_evaluated | 本作業の範囲外 |
| Publish approval | separate_decision | tag / publish / releaseを実行しない |

## `evidenced_by` Contract Closure

- 判定用join keyはevidenceの`testId`とする。
- canonical provenanceは`test --evidenced_by--> execution_evidence`とする。
- edge欠落は許可する。
- edgeが存在する場合、source test集合は`{evidence.testId}`と一致しなければならない。同一endpointの重複edgeは許可する。
- 矛盾、non-test source、複数test sourceはDQ-18とする。
- 最新candidateが矛盾している場合、古い整合passへフォールバックしない。

この契約は`docs/requirements.md`、Reliability正本仕様、selection実装、runtime test、on-disk fixtureへ同時反映した。PR #3の履歴threadはmerge済みPR上に残るが、指摘内容は後続修正で解消する。

## Isolated Consumer Evidence

2026-07-20、workspace外の一時git repoへcandidate tarballをinstallし、package内部のCLIだけで次を確認した。

| Check | Result |
|---|---|
| package install | success、audit vulnerability 0 |
| `qeg init` | `.qeg/gate-input.json`、baseline、workflowを生成 |
| initialized graph | `go` / exit 0 |
| missing approval evidence | `disqualified`、DQ-15 / exit 2 |
| failure report artifact | exit 2後もJSON reportが存在し、再parse成功 |
| baseline | `baseline_accepted` / exit 0、baseline audit `pass` |
| report diff | new DQ-15を1件検出し、report artifactを保持 |
| changed-only unrelated | `no_relevant_changes` / exit 0 |
| changed-only selected | targetを1件選択し、DQ-15 / exit 2 |
| Action artifact contract | packed Actionに`if: always() && inputs.upload-artifact == 'true'`を確認 |

Candidate tarball SHA-256: `7be2be3431280cf5ee1d7803baad0a09827f38e95e8a28954757822976472dba`。

これは同一マシン上の隔離consumer smokeであり、別マシン、GitHub-hosted consumer CI、実clusterの受入実績ではない。

## Release Boundary

- repositoryには既存のannotated tag `v0.2.0`があり、tagged commitは`876408a98ea6f5d6045bf024b261b87d38dfb9d4`である。現在sourceより前のcommitなので再利用・付け替えをしない。
- GitHub Releaseは`v0.1.0`のみ、npm registryの`@quality-harness/quality-evidence-graph`は2026-07-20時点で未公開だった。
- 本hardening作業は既定契約どおり`package.json=0.2.0` / `qegVersion=0.2`を変更しない。ただし現在HEADを既存`v0.2.0`として公開してはならない。
- Reliability / Resilienceのpublic contractがtag後に追加されているため、次の公開版は`0.3.0`を推奨する。version bump、Action参照更新、CHANGELOG確定、tag、release、publishは別のrelease作業とする。

## Final Evidence

| Evidence | Value | Status |
|---|---|---|
| Code-bearing commit | `b54a64e12fb333f342dfb5289d00df2a11191e76` | success |
| Draft PR | [#4](https://github.com/RNA4219/quality-evidence-graph/pull/4) | open / draft |
| Local full gate | `npm ci`、35 runtime、53 fixture、22 reliability E2E、package / schema / enum / Birdseye / operational CLI / dry-run | success |
| Code-bearing `quality (20)` | [run 29717279305 / job 88272902466](https://github.com/RNA4219/quality-evidence-graph/actions/runs/29717279305/job/88272902466) | SUCCESS |
| Code-bearing `quality (24)` | [run 29717279305 / job 88272902498](https://github.com/RNA4219/quality-evidence-graph/actions/runs/29717279305/job/88272902498) | SUCCESS |
| Evidence-record commit | `e875855d8a38889aee7b8082dbf22d5cd2cb15ab` | success |
| Evidence-record `quality (20)` | [run 29717490349 / job 88273508984](https://github.com/RNA4219/quality-evidence-graph/actions/runs/29717490349/job/88273508984) | SUCCESS |
| Evidence-record `quality (24)` | [run 29717490349 / job 88273508988](https://github.com/RNA4219/quality-evidence-graph/actions/runs/29717490349/job/88273508988) | SUCCESS |

この文書を`verified`へ変更する最終seal commitのCIは、自己参照を避けるためPRのlatest checkとして外部確認する。seal commitで本文へそのcommit自身のSHA / Run URLを追記しない。
