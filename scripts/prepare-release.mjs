import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
const version = manifest.version;
const outputDirectory = path.join('release', version);
const releaseFiles = ['main.js', 'manifest.json', 'styles.css'];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

const checksums = {};
for (const filename of releaseFiles) {
  const source = await readFile(filename);
  await copyFile(filename, path.join(outputDirectory, filename));
  checksums[filename] = createHash('sha256').update(source).digest('hex');
}

const metadata = {
  pluginId: manifest.id,
  version,
  tag: version,
  releaseFiles,
  sha256: checksums,
};

await writeFile(
  path.join(outputDirectory, 'release-manifest.json'),
  `${JSON.stringify(metadata, null, 2)}\n`,
  'utf8',
);

console.log(`Prepared Album Gallery ${version} in ${outputDirectory}`);
for (const [filename, checksum] of Object.entries(checksums)) {
  console.log(`${checksum}  ${filename}`);
}
