import { readFile, stat } from 'node:fs/promises';

const requiredFiles = [
  'README.md',
  'LICENSE',
  'PRIVACY.md',
  'RELEASING.md',
  'CHANGELOG.md',
  'SECURITY.md',
  'main.js',
  'manifest.json',
  'styles.css',
  'package.json',
  'versions.json',
];

function fail(message) {
  throw new Error(`Release validation failed: ${message}`);
}

async function readText(path) {
  const value = await readFile(path, 'utf8');
  if (!value.trim()) fail(`${path} is empty.`);
  return value;
}

async function readJson(path) {
  try {
    return JSON.parse(await readText(path));
  } catch (error) {
    fail(`${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

for (const path of requiredFiles) {
  try {
    const info = await stat(path);
    if (!info.isFile() || info.size === 0) fail(`${path} is missing or empty.`);
  } catch {
    fail(`${path} is missing.`);
  }
}

const manifest = await readJson('manifest.json');
const packageJson = await readJson('package.json');
const versions = await readJson('versions.json');
const main = await readText('main.js');
const styles = await readText('styles.css');
const readme = await readText('README.md');
const privacy = await readText('PRIVACY.md');
const releasing = await readText('RELEASING.md');

const semverPattern = /^\d+\.\d+\.\d+$/;
const pluginIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

if (!pluginIdPattern.test(manifest.id ?? '')) fail('manifest.id must use lowercase letters, numbers, and single hyphens.');
if (String(manifest.id).includes('obsidian')) fail('manifest.id must not contain “obsidian”.');
if (String(manifest.id).endsWith('-plugin')) fail('manifest.id must not end with “-plugin”.');
if (!semverPattern.test(manifest.version ?? '')) fail('manifest.version must be x.y.z without a v prefix.');
if (!semverPattern.test(manifest.minAppVersion ?? '')) fail('manifest.minAppVersion must be x.y.z.');
if (manifest.version !== packageJson.version) fail('manifest.json and package.json versions do not match.');
if (versions[manifest.version] !== manifest.minAppVersion) fail('versions.json must map the current plugin version to manifest.minAppVersion.');
if (manifest.isDesktopOnly !== false) fail('The manifest must explicitly keep mobile support enabled.');
if (packageJson.name !== 'obsidian-album-gallery') fail('package.json has an unexpected package name.');
if (packageJson.license !== 'MIT') fail('package.json must declare the MIT license.');
if (!String(packageJson.packageManager ?? '').startsWith('npm@')) fail('package.json must pin the npm package manager.');
if (!packageJson.engines?.node) fail('package.json must declare the supported Node.js version.');

for (const [name, version] of Object.entries(packageJson.devDependencies ?? {})) {
  if (!semverPattern.test(String(version))) fail(`Development dependency ${name} must use an exact version.`);
}

for (const key of ['id', 'name', 'version', 'minAppVersion', 'description', 'author']) {
  if (typeof manifest[key] !== 'string' || !manifest[key].trim()) fail(`manifest.${key} is required.`);
}

const runtimeMarkers = [
  `Album Gallery ${manifest.version}`,
  'module.exports',
  'Hata Defteri',
  'video/mp4',
  'video/quicktime',
  'video/webm',
];
for (const marker of runtimeMarkers) {
  if (!main.includes(marker)) fail(`main.js is missing runtime marker: ${marker}`);
}
if (main.includes("require('./media-runtime.js')")) fail('main.js still depends on the removed mobile runtime file.');

const styleMarkers = [
  'safe-area-inset-top',
  'safe-area-inset-bottom',
  'album-gallery-lightbox-modal',
  'Album Gallery · Ekatech',
];
for (const marker of styleMarkers) {
  if (!styles.includes(marker)) fail(`styles.css is missing release marker: ${marker}`);
}

const disclosureMarkers = [
  'Ekatech Study account',
  'some plans or services may be paid',
  'GIFs and videos are always rejected from Hata Defteri',
  'Normal albums, photos, GIFs, and videos remain local',
  'No analytics or telemetry',
];
for (const marker of disclosureMarkers) {
  if (!readme.includes(marker)) fail(`README.md is missing disclosure: ${marker}`);
}
if (!privacy.includes('https://ekatech.net')) fail('PRIVACY.md must disclose the Ekatech Study network host.');
if (!privacy.includes('does not upload normal album content')) fail('PRIVACY.md must disclose that normal albums remain local.');
if (!releasing.includes('main.js') || !releasing.includes('manifest.json') || !releasing.includes('styles.css')) fail('RELEASING.md must list all required release assets.');

console.log(`Album Gallery ${manifest.version} release files are internally consistent.`);
