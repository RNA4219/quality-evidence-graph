import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../fixtures/', import.meta.url));
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
const json = value => JSON.stringify(value, null, 2) + '\n';
const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
let count = 0;
for (const fixture of manifest.fixtures) {
  if (!/^[a-z0-9-]+$/.test(fixture.name)) throw new Error(`Invalid fixture name ${fixture.name}`);
  const dir = resolve(root, fixture.name);
  const path = join(dir, 'gate-input.json');
  const input = JSON.parse(await readFile(path, 'utf8'));
  if (input.policy.inputContract) continue;
  const sourceRefs = [{ id: `qeg:fixture-contract-${fixture.name}`, path: 'gate-input.json', label: '/policy/inputContract' }];
  if (input.graph.nodes.length === 0) input.graph.nodes.push({
    id: `qeg:fixture-context-${fixture.name}`, kind: 'requirement', title: `Fixture context: ${fixture.name}`,
    acceptanceCriteriaIds: [], sourceArtifactIds: input.metadata.inputArtifacts.map(a => a.id),
    traceability: { sourceRefs, confidence: 'high', assumptions: ['The negative oracle concerns the named contract, independently of empty-input rejection.'] },
  });
  const artifactIds = new Set(input.metadata.inputArtifacts.map(a => a.id));
  const missingIds = [...new Set(input.graph.nodes.flatMap(n => n.sourceArtifactIds))].filter(id => !artifactIds.has(id));
  if (missingIds.length || !input.metadata.inputArtifacts.length) {
    const body = json({ fixture: fixture.name, mode: 'native_graph', purpose: 'Explicit native graph model for contract regression', nodeIds: input.graph.nodes.map(n => n.id) });
    await mkdir(join(dir, 'artifacts'), { recursive: true });
    await writeFile(join(dir, 'artifacts/native-contract.json'), body, { flag: 'wx' });
    for (const id of missingIds.length ? missingIds : [`qeg:native-model-${fixture.name}`]) {
      const raw = input.graph.nodes.find(n => n.kind === 'execution_evidence' && n.rawArtifactRef?.id === id)?.rawArtifactRef;
      input.metadata.inputArtifacts.push({ id, adapter: 'qeg-native', kind: raw ? 'execution_evidence' : 'test_model',
        path: raw?.path ?? 'artifacts/native-contract.json', contentHash: raw?.contentHash ?? hash(body),
        revision: raw?.revision ?? input.metadata.headRef ?? 'refs/heads/main' });
    }
  }
  const requiredArtifacts = [...new Map(input.metadata.inputArtifacts.filter(a => a.adapter === 'qeg-native').map(a => [`${a.adapter}/${a.kind}`, { adapter: a.adapter, kind: a.kind }])).values()];
  if (!requiredArtifacts.length) throw new Error(`Fixture has no explicit native contract: ${fixture.name}`);
  input.policy.inputContract = { mode: 'native_graph', requiredArtifacts, evaluationScope: { kind: 'fixture', target: fixture.name,
    notEvaluated: ['Upstream producer ingestion', 'Real deployment', 'Release approval'] }, requireExecutedTests: false, sourceRefs };
  input.metadata.requiredConnectorStatus = { ...input.metadata.requiredConnectorStatus, 'qeg-native': 'success' };
  for (const metadata of [input.graph.metadata, input.placementPlan?.metadata, input.evidencePackage?.metadata].filter(Boolean)) {
    metadata.inputArtifacts = input.metadata.inputArtifacts;
    metadata.requiredConnectorStatus = input.metadata.requiredConnectorStatus;
  }
  if (input.evidencePackage?.gatePolicy) input.evidencePackage.gatePolicy.inputContract = input.policy.inputContract;
  await writeFile(path, json(input));
  count++;
}
console.log(`Migrated ${count} fixtures to explicit native contracts; expected verdicts were not changed.`);
