import fs from 'node:fs';

const VERSION = '0.6.9';

function read(path) {
	return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
	fs.writeFileSync(path, content);
}

function readJson(path) {
	return JSON.parse(read(path));
}

function writeJson(path, value) {
	write(path, `${JSON.stringify(value, null, 2)}\n`);
}

function replaceOnce(content, before, after, label) {
	const first = content.indexOf(before);
	if (first < 0) throw new Error(`Could not find ${label}.`);
	if (content.indexOf(before, first + before.length) >= 0) {
		throw new Error(`${label} appears more than once.`);
	}
	return `${content.slice(0, first)}${after}${content.slice(first + before.length)}`;
}

const runtimeStylesPath = 'src/media-styles.ts';
const runtimeStylesSource = read(runtimeStylesPath);
const cssStartToken = "style.textContent = `\n";
const cssEndToken = "`;\n\tdocument.head.appendChild(style);";
const cssStart = runtimeStylesSource.indexOf(cssStartToken);
const cssEnd = runtimeStylesSource.indexOf(cssEndToken, cssStart + cssStartToken.length);
if (cssStart < 0 || cssEnd < 0) {
	throw new Error('Could not extract the runtime media CSS.');
}

let staticMediaCss = runtimeStylesSource
	.slice(cssStart + cssStartToken.length, cssEnd)
	.replace(
		'\t\theight: 100vh !important;\n\t\theight: 100dvh !important;',
		'\t\tmin-height: 100vh !important;\n\t\theight: 100dvh !important;',
	)
	.trim();

const staticMarker = '/* Album Gallery static media and lightbox styles — Community Plugins compliant */';
let styles = read('styles.css');
styles = styles.replace(
	'\t\theight: 100vh;\n\t\theight: 100dvh;',
	'\t\tmin-height: 100vh;\n\t\theight: 100dvh;',
);
if (!styles.includes(staticMarker)) {
	styles = `${styles.trimEnd()}\n\n${staticMarker}\n${staticMediaCss}\n`;
}
write('styles.css', styles);

let entry = read('src/plugin-entry.ts');
entry = replaceOnce(
	entry,
	"import { installGalleryMediaStyles } from './media-styles';\n",
	'',
	'the runtime media-style import',
);
entry = replaceOnce(
	entry,
	'\t\tinstallGalleryMediaStyles();\n',
	'',
	'the runtime media-style call',
);
write('src/plugin-entry.ts', entry);

let support = read('src/media-support.ts');
support = support.replace(
	'requestAnimationFrame(() => this.removeNativeCloseControl());',
	'window.requestAnimationFrame(() => this.removeNativeCloseControl());',
);
write('src/media-support.ts', support);

let lightboxValidator = read('scripts/validate-lightbox.mjs');
lightboxValidator = replaceOnce(
	lightboxValidator,
	"const styles = fs.readFileSync('src/media-styles.ts', 'utf8');",
	"const styles = fs.readFileSync('styles.css', 'utf8');",
	'the lightbox validator style source',
);
write('scripts/validate-lightbox.mjs', lightboxValidator);

let releaseValidator = read('scripts/validate-release.mjs');
const runtimeInjectionCheck = `\nif (main.includes('document.createElement("style")') || main.includes("document.createElement('style')")) {\n  fail('main.js must not create runtime style elements; use styles.css instead.');\n}\nif (main.includes('album-gallery-media-runtime-styles')) {\n  fail('main.js still contains the removed runtime media-style injector.');\n}\n`;
releaseValidator = replaceOnce(
	releaseValidator,
	"if (main.includes(\"require('./media-runtime.js')\")) fail('main.js still depends on the removed mobile runtime file.');\n",
	"if (main.includes(\"require('./media-runtime.js')\")) fail('main.js still depends on the removed mobile runtime file.');\n" + runtimeInjectionCheck,
	'the release runtime validation anchor',
);
releaseValidator = replaceOnce(
	releaseValidator,
	"  'Album Gallery · Ekatech',\n",
	"  'Album Gallery · Ekatech',\n  'Album Gallery static media and lightbox styles',\n  'album-gallery-lightbox-container',\n",
	'the release style marker list',
);
write('scripts/validate-release.mjs', releaseValidator);

const manifest = readJson('manifest.json');
manifest.version = VERSION;
writeJson('manifest.json', manifest);

const pkg = readJson('package.json');
pkg.version = VERSION;
writeJson('package.json', pkg);

const versions = readJson('versions.json');
versions[VERSION] = manifest.minAppVersion;
writeJson('versions.json', versions);

let changelog = read('CHANGELOG.md');
if (!changelog.includes('## 0.6.9')) {
	const entryText = `## 0.6.9\n\n### Fixed\n\n- Moved all media and mobile lightbox CSS into the static styles.css release asset required by Obsidian\n- Removed runtime style-element creation and the obsolete media-styles module\n- Preserved the proven two-column mobile grid, toolbar close button, and left/right lightbox navigation\n- Switched the lightbox animation-frame call to the active window for popout compatibility\n- Added release validation that rejects future runtime style injection\n\n`;
	changelog = replaceOnce(changelog, '## 0.6.8\n', `${entryText}## 0.6.8\n`, 'the 0.6.8 changelog heading');
}
write('CHANGELOG.md', changelog);

fs.unlinkSync(runtimeStylesPath);

console.log('Applied Album Gallery 0.6.9 Obsidian automated-review fixes.');
