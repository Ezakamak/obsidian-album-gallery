import fs from 'node:fs';

const VERSION = '0.6.8';

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
	if (content.indexOf(before, first + before.length) >= 0) throw new Error(`${label} appears more than once.`);
	return `${content.slice(0, first)}${after}${content.slice(first + before.length)}`;
}

let support = read('src/media-support.ts');
support = replaceOnce(
	support,
	`\tprivate subtitleElement: HTMLElement | null = null;\n\tprivate touchStartX: number | null = null;`,
	`\tprivate subtitleElement: HTMLElement | null = null;\n\tprivate touchStartX: number | null = null;\n\tprivate nativeCloseObserver: MutationObserver | null = null;`,
	'the lightbox field list',
);
support = replaceOnce(
	support,
	`\tonOpen(): void {\n\t\tthis.modalEl.addClass('album-gallery-lightbox-modal');\n\t\tconst shell = this.contentEl.createDiv({ cls: 'album-gallery-lightbox' });`,
	`\tonOpen(): void {\n\t\tthis.modalEl.addClass('album-gallery-lightbox-modal');\n\t\tthis.containerEl.addClass('album-gallery-lightbox-container');\n\t\tthis.removeNativeCloseControl();\n\t\tthis.nativeCloseObserver = new MutationObserver(() => this.removeNativeCloseControl());\n\t\tthis.nativeCloseObserver.observe(this.containerEl, { childList: true, subtree: true });\n\t\trequestAnimationFrame(() => this.removeNativeCloseControl());\n\t\tconst shell = this.contentEl.createDiv({ cls: 'album-gallery-lightbox' });`,
	'the lightbox onOpen prologue',
);
support = replaceOnce(
	support,
	`\tonClose(): void {\n\t\tthis.releaseVideo();\n\t\tthis.mediaHost = null;`,
	`\tonClose(): void {\n\t\tthis.nativeCloseObserver?.disconnect();\n\t\tthis.nativeCloseObserver = null;\n\t\tthis.releaseVideo();\n\t\tthis.mediaHost = null;`,
	'the lightbox onClose prologue',
);
support = replaceOnce(
	support,
	`\tprivate releaseVideo(): void {`,
	`\tprivate removeNativeCloseControl(): void {\n\t\tfor (const closeButton of this.containerEl.querySelectorAll<HTMLElement>('.modal-close-button')) {\n\t\t\tcloseButton.remove();\n\t\t}\n\t}\n\n\tprivate releaseVideo(): void {`,
	'the releaseVideo method anchor',
);
write('src/media-support.ts', support);

let styles = read('src/media-styles.ts');
styles = replaceOnce(
	styles,
	`.album-gallery-lightbox-modal .modal-close-button {\n\tdisplay: none !important;\n}`,
	`.album-gallery-lightbox-container .modal-close-button,\n.album-gallery-lightbox-modal .modal-close-button {\n\tdisplay: none !important;\n}`,
	'the native close-button hiding selector',
);
write('src/media-styles.ts', styles);

const manifest = readJson('manifest.json');
manifest.version = VERSION;
writeJson('manifest.json', manifest);

const pkg = readJson('package.json');
pkg.version = VERSION;
writeJson('package.json', pkg);

const versions = readJson('versions.json');
versions[VERSION] = manifest.minAppVersion;
writeJson('versions.json', versions);

const validator = `import fs from 'node:fs';

const styles = fs.readFileSync('src/media-styles.ts', 'utf8');
const support = fs.readFileSync('src/media-support.ts', 'utf8');

const requiredStyles = [
	'.album-gallery-lightbox-container .modal-close-button',
	'.album-gallery-lightbox-modal .modal-close-button',
	'display: none !important',
	'.album-gallery-lightbox-actions',
	'.album-gallery-lightbox-close',
	'padding-top: 72px !important',
	'flex-direction: column',
	'text-overflow: ellipsis',
	'white-space: nowrap',
	'.album-gallery-lightbox-previous',
	'left: 8px',
	'.album-gallery-lightbox-next',
	'right: 8px',
	'top: 50%',
	'transform: translateY(-50%)',
	'grid-column: 1',
	'grid-row: 1',
];
for (const token of requiredStyles) {
	if (!styles.includes(token)) throw new Error(\`Mobile lightbox contract is missing: \${token}\`);
}

const requiredSource = [
	"this.containerEl.addClass('album-gallery-lightbox-container')",
	"new MutationObserver(() => this.removeNativeCloseControl())",
	"this.nativeCloseObserver.observe(this.containerEl, { childList: true, subtree: true })",
	"querySelectorAll<HTMLElement>('.modal-close-button')",
	'closeButton.remove()',
	"cls: 'album-gallery-lightbox-actions'",
	"cls: 'clickable-icon album-gallery-lightbox-close'",
	"setIcon(closeButton, 'x')",
	"closeButton.addEventListener('click', () => this.close())",
];
for (const token of requiredSource) {
	if (!support.includes(token)) throw new Error(\`Native/custom close-control contract is missing: \${token}\`);
}

if (styles.includes('124px) !important')) {
	throw new Error('The excessive mobile lightbox top padding returned.');
}

console.log('Album Gallery native modal X removal validation passed.');
`;
write('scripts/validate-lightbox.mjs', validator);

let changelog = read('CHANGELOG.md');
const entry = `## 0.6.8\n\n### Fixed\n\n- Removed Obsidian's native modal close element from the Album Gallery lightbox DOM instead of relying on an incorrectly scoped CSS selector\n- Added a container-level fallback rule and a MutationObserver so the native status-bar X cannot return\n- Kept the Album Gallery-owned toolbar close button, corrected two-column grid, and left/right navigation unchanged\n\n`;
if (!changelog.includes('## 0.6.8')) {
	changelog = replaceOnce(changelog, '## 0.6.7\n', `${entry}## 0.6.7\n`, 'the 0.6.7 changelog heading');
}
write('CHANGELOG.md', changelog);

console.log('Applied Album Gallery 0.6.8 native-X removal repair.');
