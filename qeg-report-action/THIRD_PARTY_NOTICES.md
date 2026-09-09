# Third-party notices

The bundled QEG CLI includes the following runtime dependencies. Their complete license texts are stored in `licenses/`.

| Component | Version | License | License file |
| --- | --- | --- | --- |
| Ajv | 8.20.0 | MIT | `licenses/ajv.txt` |
| fast-deep-equal | 3.1.3 | MIT | `licenses/fast-deep-equal.txt` |
| fast-uri | 3.1.3 | BSD-3-Clause | `licenses/fast-uri.txt` |
| json-schema-traverse | 1.0.0 | MIT | `licenses/json-schema-traverse.txt` |
| require-from-string | 2.0.2 | MIT | `licenses/require-from-string.txt` |

This notice applies to `qeg-report-action/dist/cli.mjs`. QEG's own license remains in the repository root `LICENSE`.

The bundle also includes version-pinned producer schemas, separately licensed from QEG:

| Component | Source revision | License / retained notices | Modified |
| --- | --- | --- | --- |
| code-to-gate | 53897b912b390914dda145c98dd72d8147ab6b0e | MIT; `licenses/code-to-gate-LICENSE.txt` | no (schema content) |
| manual-bb-test-harness | 76722574298985100b3a6efc730b2dd0f0cb4041 | RNA-TPSAL-1.0; `licenses/manual-bb-test-harness-LICENSE.txt`, `licenses/manual-bb-test-harness-NOTICE.txt` | no (schema content) |

Original developer: RNA4219. Official sources: [code-to-gate](https://github.com/RNA4219/code-to-gate) and [manual-bb-test-harness](https://github.com/RNA4219/manual-bb-test-harness). The schema objects are aggregated for loading; source provenance and individual file hashes are recorded in `docs/spec/producer-schema-provenance.json` in the QEG distribution.
