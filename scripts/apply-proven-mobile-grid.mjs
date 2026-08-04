import fs from 'node:fs';

const STYLE_PATH = 'styles.css';
const MANIFEST_PATH = 'manifest.json';
const PACKAGE_PATH = 'package.json';
const VERSIONS_PATH = 'versions.json';
const CHANGELOG_PATH = 'CHANGELOG.md';
const VALIDATOR_PATH = 'scripts/validate-mobile-grid.mjs';
const VERSION = '0.6.5';
const MIN_APP_VERSION = '1.8.0';
const START_MARKER = '/* Album Gallery mobile media grid — restored from proven 0.6.2 */';
const END_MARKER = '/* End proven mobile media grid */';

const restoredGridCss = `${START_MARKER}
.album-gallery-photo-grid {
	width: 100%;
	grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
	align-items: stretch;
}

.album-gallery-photo-card {
	display: block !important;
	width: 100% !important;
	height: auto !important;
	min-width: 0 !important;
	min-height: 0 !important;
	padding: 0 !important;
	aspect-ratio: 1;
	appearance: none;
	-webkit-appearance: none;
	overflow: hidden;
	box-sizing: border-box;
}

.album-gallery-photo-card > img,
.album-gallery-photo-card > video {
	display: block !important;
	width: 100% !important;
	height: 100% !important;
	min-width: 0 !important;
	min-height: 0 !important;
	max-width: none !important;
	max-height: none !important;
	object-fit: cover !important;
}

@media (max-width: 700px) {
	.album-gallery-photo-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 4px;
	}

	.album-gallery-photo-card {
		border-radius: 6px;
	}
}

@media (max-width: 360px) {
	.album-gallery-photo-grid {
		gap: 8px;
	}
}
${END_MARKER}`;

function readJson(path) {
	return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
	fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

let styles = fs.readFileSync(STYLE_PATH, 'utf8').trimEnd();
const previousStart = styles.indexOf(START_MARKER);
if (previousStart >= 0) {
	const previousEnd = styles.indexOf(END_MARKER, previousStart);
	if (previousEnd < 0) throw new Error('Found mobile-grid start marker without its end marker.');
	styles = `${styles.slice(0, previousStart).trimEnd()}\n`;
}
fs.writeFileSync(STYLE_PATH, `${styles}\n\n${restoredGridCss}\n`);

const manifest = readJson(MANIFEST_PATH);
manifest.version = VERSION;
writeJson(MANIFEST_PATH, manifest);

const pkg = readJson(PACKAGE_PATH);
pkg.version = VERSION;
pkg.scripts['validate:grid'] = 'node scripts/validate-mobile-grid.mjs';
pkg.scripts.check = 'npm run lint && npm run build && npm run validate:grid && npm run validate:release';
writeJson(PACKAGE_PATH, pkg);

const versions = readJson(VERSIONS_PATH);
versions[VERSION] = MIN_APP_VERSION;
writeJson(VERSIONS_PATH, versions);

const validator = `import fs from 'node:fs';

const styles = fs.readFileSync('styles.css', 'utf8');
const startMarker = ${JSON.stringify(START_MARKER)};
const endMarker = ${JSON.stringify(END_MARKER)};
const start = styles.indexOf(startMarker);
const end = styles.indexOf(endMarker, start);

if (start < 0 || end < 0) {
	throw new Error('The proven mobile media-grid contract is missing from styles.css.');
}

const block = styles.slice(start, end + endMarker.length);
const required = [
	'repeat(2, minmax(0, 1fr))',
	'aspect-ratio: 1',
	'height: auto !important',
	'.album-gallery-photo-card > img',
	'.album-gallery-photo-card > video',
	'object-fit: cover !important',
];

for (const token of required) {
	if (!block.includes(token)) throw new Error(\`Mobile media-grid contract is missing: \${token}\`);
}

if (/position\\s*:\\s*absolute/i.test(block)) {
	throw new Error('Media cards must not use the failed absolute-position grid workaround.');
}

console.log('Album Gallery proven two-column mobile media grid validation passed.');
`;
fs.writeFileSync(VALIDATOR_PATH, validator);

let changelog = fs.readFileSync(CHANGELOG_PATH, 'utf8');
const releaseNotes = `## 0.6.5\n\n### Fixed\n\n- Restored the proven two-column iPhone media grid from the correctly working 0.6.2 package\n- Restored square photo, GIF, and video cards with full-width cover cropping\n- Prevented Obsidian mobile button and intrinsic media sizing from collapsing previews into strips\n- Added a permanent release validation that rejects removal of the mobile grid contract or the failed absolute-position workaround\n\n`;
if (!changelog.includes('## 0.6.5')) {
	const insertionPoint = changelog.indexOf('## 0.6.4');
	if (insertionPoint < 0) throw new Error('Could not find the 0.6.4 changelog section.');
	changelog = `${changelog.slice(0, insertionPoint)}${releaseNotes}${changelog.slice(insertionPoint)}`;
	fs.writeFileSync(CHANGELOG_PATH, changelog);
}

console.log('Applied the proven 0.6.2 mobile grid contract and prepared Album Gallery 0.6.5.');
