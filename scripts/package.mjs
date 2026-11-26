import archiver from 'archiver';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const manifest = JSON.parse(await readFile('dist/extension/manifest.json', 'utf8'));
if (manifest.version !== version) {
  throw new Error(`Phiên bản manifest ${manifest.version} không khớp package ${version}.`);
}
await mkdir('release', { recursive: true });
async function zip(name, fill) {
  const output = createWriteStream(`release/${name}`);
  const archive = archiver('zip', { zlib: { level: 9 } });
  const done = new Promise((res, rej) => {
    output.on('close', res);
    output.on('error', rej);
    archive.on('error', rej);
  });
  archive.pipe(output);
  fill(archive);
  await archive.finalize();
  await done;
  console.log(`release/${name}`);
}
await zip(`Classroom-Manager-${version}.zip`, (a) => {
  a.directory('dist/extension', 'Classroom-Manager');
  a.file('docs/CAI-DAT.md', { name: 'HUONG-DAN-CAI-DAT.md' });
  a.directory('docs', 'Tai-lieu');
});
await zip(`Classroom-Manager-${version}-source.zip`, (a) => {
  for (const d of ['apps', 'packages', 'scripts', 'tests', 'docs', '.github']) a.directory(d, d);
  for (const f of [
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'vite.config.ts',
    'vitest.config.ts',
    'playwright.config.ts',
    'index.html',
    'class.py',
    'README.md',
    '.gitignore',
    '.prettierrc.json',
    '.prettierignore',
  ])
    a.file(f, { name: f });
});
const checksums = [];
for (const name of (await readdir('release'))
  .filter((name) => /^Classroom-Manager-.*\.zip$/.test(name))
  .sort()) {
  const hash = createHash('sha256')
    .update(await readFile(`release/${name}`))
    .digest('hex');
  checksums.push(`${hash}  ${name}`);
}
await writeFile('release/SHA256SUMS.txt', checksums.join('\n') + '\n');
