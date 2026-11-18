import { createHash } from "node:crypto";
import { access, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { dirname, posix, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const root = dirname(dirname(fileURLToPath(import.meta.url)));
const indexName = "docs/birdseye/index.json";
const capsules = "docs/birdseye/caps/";
const json = (v) => JSON.stringify(v, null, 2) + "\n";
export const contentHash = (v) => "sha256:" + createHash("sha256").update(v.replace(/\r\n/g, "\n")).digest("hex");
const capsuleName = (path) => capsules + path.replaceAll("/", ".") + ".json";
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

async function exists(path) {
  try { await access(resolve(root, path)); return true; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

async function walk(path) {
  const files = [];
  for (const entry of await readdir(resolve(root, path), { withFileTypes: true })) {
    const child = path + "/" + entry.name;
    if (entry.isDirectory()) files.push(...await walk(child));
    else if (entry.isFile()) files.push(child);
  }
  return files.sort(compare);
}

export async function runtimeFiles() {
  return [
    "Cargo.toml", "Cargo.lock", "build.rs", "package.json", "tools/build-native.mjs", "tools/native-notices.mjs",
    "qeg-report-action/report.sh", "examples/transaction-probe.rs", "tests/native.rs",
    ...await walk("src-rust"), ...await walk("bindings"),
  ];
}

const connections = [
  ["README.md", "Cargo.toml"], ["README_JA.md", "Cargo.toml"], ["README_EN.md", "Cargo.toml"],
  ["Cargo.toml", "Cargo.lock"], ["Cargo.toml", "build.rs"], ["Cargo.toml", "src-rust/lib.rs"], ["Cargo.toml", "src-rust/main.rs"],
  ["src-rust/main.rs", "src-rust/cli.rs"], ["src-rust/assets.rs", "build.rs"], ["src-rust/runtime.rs", "schemas/gate-input.schema.json"],
  ["package.json", "bindings/cli.mjs"], ["package.json", "bindings/api.mjs"], ["package.json", "bindings/index.d.ts"],
  ["bindings/cli.mjs", "bindings/native.mjs"], ["bindings/api.mjs", "bindings/native.mjs"], ["bindings/native.mjs", "src-rust/cli.rs"],
  ["bindings/index.d.ts", "src/types.ts"], [".github/workflows/ci.yml", "Cargo.toml"], ["qeg-report-action/action.yml", "src-rust/cli.rs"],
  ["tools/birdseye-check.mjs", "tools/update-birdseye.mjs"],
  ["package.json", "tools/build-native.mjs"], ["tools/build-native.mjs", "bindings/native.mjs"],
  ["qeg-report-action/action.yml", "qeg-report-action/report.sh"], ["qeg-report-action/report.sh", "src-rust/cli.rs"],
  ["tests/native.rs", "src-rust/lib.rs"], ["examples/transaction-probe.rs", "src-rust/probe.rs"],
];
const summaries = {
  "Cargo.toml": "Rustライブラリとqeg実行ファイルの依存関係、ビルド対象、配布物を定義する。",
  "Cargo.lock": "配布物をビルドするRustクレートのバージョンを固定する。",
  "build.rs": "schemaと初期化用ランタイムをバイナリへ組み込む。",
  "package.json": "npm公開API、CLI入口、検証コマンドを定義する。",
  "src-rust/assets.rs": "組み込んだソースとschemaをconsumerのローカルActionに展開する。",
  "src-rust/main.rs": "qegプロセスの終了コードと標準エラー出力を扱う。",
  "src-rust/cli.rs": "qegコマンドとnpmからのAPI呼び出しをRust実装に渡す。",
  "src-rust/lib.rs": "品質ゲート、グラフ構築、証跡処理のRust APIを公開する。",
  "src-rust/runtime.rs": "入力と出力をschemaで検証し、証跡の事前確認とGate評価を実行する。",
  "src-rust/storage.rs": "世代ごとの証跡を保存し、並行書き込みと中断復旧を制御する。",
  "src-rust/gate.rs": "失格理由、ブロッカー、残存リスク、人間の確認から最終判定を作る。",
  "src-rust/graph.rs": "producerの入力をグラフのノードとエッジへ変換する。",
  "src-rust/commands.rs": "レポート、診断、初期化、証跡正規化などの補助コマンドを選択する。",
  "src-rust/evidence.rs": "参照された証跡の存在、リビジョン、ハッシュを検証する。",
  "src-rust/record.rs": "判定、配置計画、グラフを監査用の証跡レコードへまとめる。",
  "src-rust/migration.rs": "consumerの旧入力を診断し、明示設定を使って移行する。",
  "bindings/api.mjs": "公開JavaScript APIの引数と返り値をRustランタイムへ接続する。",
  "bindings/cli.mjs": "npmのqegコマンドを起動する。",
  "bindings/native.mjs": "JavaScriptからRust実行ファイルを呼び出す。",
  "bindings/index.d.ts": "npm APIのTypeScript型を公開する。",
};

export async function update() {
  const previous = JSON.parse(await readFile(resolve(root, indexName), "utf8"));
  const currentFiles = new Set(await runtimeFiles());
  for (const path of Object.keys(previous.nodes)) if (await exists(path)) currentFiles.add(path);
  const paths = [...currentFiles].sort(compare);
  const nodes = {};
  const docs = new Map();
  const edges = new Map();
  const edge = (from, to) => {
    if (from === to || ![from, to].every(p => currentFiles.has(p) || p === indexName)) return;
    edges.set(JSON.stringify([from, to]), [from, to]);
  };
  for (const [from, to] of previous.edges) edge(from, to);
  for (const [from, to] of connections) edge(from, to);
  for (const path of paths) {
    const text = await readFile(resolve(root, path), "utf8");
    const existing = previous.nodes[path];
    const role = existing?.role ?? (path.endsWith(".rs") ? "rust-module" : path.startsWith("bindings/") ? "npm-binding" : "distribution-contract");
    // Sources declare their child modules; Cargo's lib.rs and foo.rs use different module roots.
    if (path.endsWith(".rs")) {
      const moduleRoot = /\/(?:lib|main|mod)\.rs$/.test(path) ? posix.dirname(path) : path.slice(0, -3);
      for (const [, name] of text.matchAll(/^\s*(?:pub(?:\([^)]*\))?\s+)?mod\s+(\w+)\s*;/gm)) {
        edge(path, moduleRoot + "/" + name + ".rs");
        edge(path, moduleRoot + "/" + name + "/mod.rs");
      }
      for (const [, name] of text.matchAll(/crate::(\w+)/g)) edge(path, "src-rust/" + name + ".rs");
    }
    const caps = existing?.caps ?? capsuleName(path);
    const hash = contentHash(text);
    nodes[path] = { ...existing, role, caps, contentHash: hash };
    const previousCapsule = await exists(caps) ? JSON.parse(await readFile(resolve(root, caps), "utf8")) : {};
    docs.set(path, {
      id: path, role, public_api: [], summary: summaries[path] ?? (path + " の入出力と依存関係。"),
      risks: [], tests: [path.startsWith("bindings/") ? "npm test" : "cargo test --locked"], ...previousCapsule, contentHash: hash,
    });
  }
  const sorted = [...edges.values()].sort((a,b) => compare(a[0],b[0]) || compare(a[1],b[1]));
  const changed = paths.length !== Object.keys(previous.nodes).length ||
    paths.some(p => nodes[p].contentHash !== previous.nodes[p]?.contentHash) || JSON.stringify(sorted) !== JSON.stringify(previous.edges);
  const generation = changed ? String(Number(previous.generated_at) + 1).padStart(5, "0") : previous.generated_at;
  const outgoing = new Map(), incoming = new Map();
  for (const [a,b] of sorted) {
    if (!outgoing.has(a)) outgoing.set(a, []);
    if (!incoming.has(b)) incoming.set(b, []);
    outgoing.get(a).push(b); incoming.get(b).push(a);
  }
  for (const [path, capsule] of docs) {
    const node = nodes[path];
    node.mtime = generation;
    node.depsOut = outgoing.get(path) ?? [];
    if (node.depsIn) node.depsIn = incoming.get(path) ?? [];
    capsule.generation = generation;
    capsule.deps_out = node.depsOut;
    capsule.deps_in = incoming.get(path) ?? [];
    const content = json(capsule);
    if (!await exists(node.caps) || await readFile(resolve(root, node.caps), "utf8") !== content) {
      await writeFile(resolve(root, node.caps), content);
    }
  }
  const retained = new Set(Object.values(nodes).map(node => node.caps));
  for (const [path,node] of Object.entries(previous.nodes)) {
    if (nodes[path] || retained.has(node.caps)) continue;
    if (!node.caps.startsWith(capsules) || posix.dirname(node.caps) !== capsules.slice(0,-1)) throw Error("Invalid capsule path: " + node.caps);
    if (await exists(node.caps)) await unlink(resolve(root,node.caps));
  }
  await writeFile(resolve(root,indexName), json({generated_at:generation,nodes,edges:sorted}));
  console.log("Birdseye generation " + generation + ": " + paths.length + " files indexed");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await update();
