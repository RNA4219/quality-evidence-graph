import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { resolve, basename } from 'node:path';
const [mode, directory, configPath] = process.argv.slice(2);
const root = await fs.realpath(directory);
let paused = false;
async function pause() {
  paused = true;
  process.send({ boundary: mode });
  await new Promise(accept => process.once('message', accept));
}
if (mode === 'place-after-read' || mode === 'record-after-read') {
  const original = fs.readFile;
  fs.readFile = async (...args) => {
    const content = await original(...args);
    if (!paused && typeof args[0] === 'string' && resolve(args[0]) === resolve(root, 'gate-input.json')) await pause();
    return content;
  };
  syncBuiltinESMExports();
  if (mode === 'place-after-read') {
    const { runPlaceTestsCommand } = await import('../../dist/cli/pipeline.js');
    await runPlaceTestsCommand(directory);
  } else {
    const { runRecordCommand } = await import('../../dist/cli/commands.js');
    await runRecordCommand(directory);
  }
} else {
  const original = fs.rename;
  fs.rename = async (from, to) => {
    const name = basename(to);
    if (!paused && mode === 'migration-before-input' && name === 'gate-input.json') await pause();
    const result = await original(from, to);
    if (!paused && (mode === 'migration-after-input' && name === 'gate-input.json' || mode === 'migration-after-pointer' && name === '.qeg-current.json' ||
      mode === 'recover-after-input' && name === 'gate-input.json')) await pause();
    return result;
  };
  syncBuiltinESMExports();
  const api = await import('../../dist/index.js');
  if (mode === 'recover-after-input') await api.recoverOutputs(directory);
  else await api.applyConsumerMigration(directory, JSON.parse(await fs.readFile(configPath, 'utf8')));
}
