import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../fixtures/', import.meta.url));
for (const name of ['negative-placement-change-no-evidence', 'negative-placement-change-unreverted', 'positive-placement-change-retirement']) {
  const path = join(root, name, 'gate-input.json');
  const input = JSON.parse(await readFile(path, 'utf8'));
  const retiredId = 'mbb:CASE-login-001';
  if (input.graph.nodes.some(n => n.id === retiredId)) continue;
  if (!input.placementPlan.placement_changes.some(c => c.subject_id === retiredId)) throw new Error(`Missing reviewed retirement anchor: ${name}`);
  input.graph.nodes.push({ id: retiredId, kind: 'test', title: 'Retired login manual case (historical reference)', layer: 'manual-scripted',
    testExecutionMode: 'real', existing: true, deleted: true, sourceArtifactIds: input.metadata.inputArtifacts.map(a => a.id),
    traceability: { sourceRefs: [{ id: 'qeg:retired-case-source', path: 'gate-input.json', label: '/placementPlan/placement_changes/subject_id' }],
      confidence: 'high', assumptions: ['Retired case remains addressable; deletion does not count as an execution or current coverage.'] } });
  await writeFile(path, JSON.stringify(input, null, 2) + '\n');
}
console.log('Retained retired-case nodes in the three reviewed placement-change fixtures.');
