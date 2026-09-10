import { publishFiles } from '../../dist/output-publication.js';
const [directory, stop, value = 'new'] = process.argv.slice(2);
const files = new Map(['a.json', 'b.json', 'output-manifest.json'].map(name => [name, JSON.stringify({ value }) + '\n']));
try {
  await publishFiles(directory, files, { onBoundary: async boundary => {
    if (boundary !== stop) return;
    process.send?.({ boundary });
    await new Promise(resolve => process.once('message', resolve));
  } });
  process.disconnect?.();
} catch (error) { console.error(String(error)); process.exit(1); }
