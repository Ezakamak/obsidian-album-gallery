import fs from 'node:fs';

const VERSION = '0.6.7';

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
const oldToolbarActions = `\t\tconst deleteButton = toolbar.createEl('button', {
\t\t\tcls: 'clickable-icon album-gallery-lightbox-delete',
\t\t\tattr: { type: 'button', 'aria-label': 'Delete media item' },
\t\t});
\t\tsetIcon(deleteButton, 'trash-2');
\t\tdeleteButton.addEventListener('click', () => {
\t\t\tconst reference = this.references[this.index];
\t\t\tif (!reference) return;
\t\t\tthis.close();
\t\t\tthis.onRequestDelete(reference);
\t\t});`;
const newToolbarActions = `\t\tconst toolbarActions = toolbar.createDiv({ cls: 'album-gallery-lightbox-actions' });
\t\tconst deleteButton = toolbarActions.createEl('button', {
\t\t\tcls: 'clickable-icon album-gallery-lightbox-delete',
\t\t\tattr: { type: 'button', 'aria-label': 'Delete media item' },
\t\t});
\t\tsetIcon(deleteButton, 'trash-2');
\t\tdeleteButton.addEventListener('click', () => {
\t\t\tconst reference = this.references[this.index];
\t\t\tif (!reference) return;
\t\t\tthis.close();
\t\t\tthis.onRequestDelete(reference);
\t\t});
\t\tconst closeButton = toolbarActions.createEl('button', {
\t\t\tcls: 'clickable-icon album-gallery-lightbox-close',
\t\t\tattr: { type: 'button', 'aria-label': 'Close media viewer' },
\t\t});
\t\tsetIcon(closeButton, 'x');
\t\tcloseButton.addEventListener('click', () => this.close());`;
support = replaceOnce(support, oldToolbarActions, newToolbarActions, 'the lightbox toolbar action block');
write('src/media-support.ts', support);

let mediaStyles = read('src/media-styles.ts');
mediaStyles = replaceOnce(
	mediaStyles,
	`.album-gallery-lightbox-toolbar {
\tjustify-content: space-between;
\tgap: 12px;
\tmin-width: 0;
\tpadding-right: 56px;
}`,
	`.album-gallery-lightbox-toolbar {
\tjustify-content: space-between;
\tgap: 12px;
\tmin-width: 0;
\tpadding-right: 0;
}`,
	'the lightbox toolbar layout',
);
mediaStyles = replaceOnce(
	mediaStyles,
	`.album-gallery-lightbox-delete {
\tflex: 0 0 auto;
\tcolor: var(--text-error);
}`,
	`.album-gallery-lightbox-actions {
\tdisplay: flex;
\talign-items: center;
\tflex: 0 0 auto;
\tgap: 8px;
}
.album-gallery-lightbox-delete,
.album-gallery-lightbox-close {
\tdisplay: grid;
\tplace-items: center;
\tflex: 0 0 auto;
\twidth: 44px;
\theight: 44px;
\tmin-width: 44px;
\tmin-height: 44px;
\tmargin: 0;
\tpadding: 0;
\tborder-radius: 999px;
}
.album-gallery-lightbox-delete {
\tcolor: var(--text-error);
}
.album-gallery-lightbox-close {
\tborder: 1px solid rgba(255, 255, 255, 0.14);
\tbackground: rgba(38, 38, 38, 0.9);
\tcolor: #fff;
\tbox-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
\tbackdrop-filter: blur(16px);
\t-webkit-backdrop-filter: blur(16px);
\ttouch-action: manipulation;
}
.album-gallery-lightbox-modal .modal-close-button {
\tdisplay: none !important;
}`,
	'the lightbox delete-button styles',
);
const oldNativeClose = `\t.album-gallery-lightbox-modal .modal-close-button {
\t\tposition: fixed !important;
\t\ttop: max(calc(env(safe-area-inset-top, 0px) + 12px), calc(var(--safe-area-inset-top, 0px) + 12px), 64px) !important;
\t\tright: max(calc(env(safe-area-inset-right, 0px) + 12px), calc(var(--safe-area-inset-right, 0px) + 12px), 12px) !important;
\t\tleft: auto !important;
\t\tdisplay: grid !important;
\t\tplace-items: center;
\t\twidth: 48px !important;
\t\theight: 48px !important;
\t\tmin-width: 48px !important;
\t\tmin-height: 48px !important;
\t\tmargin: 0 !important;
\t\tpadding: 0 !important;
\t\tborder: 1px solid rgba(255, 255, 255, 0.14) !important;
\t\tborder-radius: 50% !important;
\t\tbackground: rgba(38, 38, 38, 0.9) !important;
\t\tcolor: #fff !important;
\t\tbox-shadow: 0 8px 24px rgba(0, 0, 0, 0.32);
\t\tbackdrop-filter: blur(16px);
\t\t-webkit-backdrop-filter: blur(16px);
\t\ttransform: none !important;
\t\tpointer-events: auto !important;
\t\ttouch-action: manipulation;
\t\tz-index: 1000 !important;
\t}`;
mediaStyles = replaceOnce(mediaStyles, oldNativeClose, '', 'the failed native fixed close-button override');
const oldMobileContent = `\t.album-gallery-lightbox-modal .modal-content {
\t\theight: 100% !important;
\t\tpadding-top: max(calc(env(safe-area-inset-top, 0px) + 76px), calc(var(--safe-area-inset-top, 0px) + 76px), 124px) !important;
\t\tpadding-right: 0 !important;
\t\tpadding-bottom: max(calc(env(safe-area-inset-bottom, 0px) + 10px), calc(var(--safe-area-inset-bottom, 0px) + 10px), 10px) !important;
\t\tpadding-left: 0 !important;
\t\tbox-sizing: border-box;
\t}`;
const newMobileContent = `\t.album-gallery-lightbox-modal .modal-content {
\t\theight: 100% !important;
\t\tpadding-top: 72px !important;
\t\tpadding-right: 0 !important;
\t\tpadding-bottom: max(calc(env(safe-area-inset-bottom, 0px) + 10px), 10px) !important;
\t\tpadding-left: 0 !important;
\t\tbox-sizing: border-box;
\t}`;
mediaStyles = replaceOnce(mediaStyles, oldMobileContent, newMobileContent, 'the excessive mobile modal top padding');
mediaStyles = replaceOnce(
	mediaStyles,
	`\t.album-gallery-lightbox-title {
\t\tmax-width: calc(100vw - 92px);
\t}
\t.album-gallery-lightbox-subtitle {
\t\tmax-width: calc(100vw - 92px);
\t}`,
	`\t.album-gallery-lightbox-title {
\t\tmax-width: calc(100vw - 164px);
\t}
\t.album-gallery-lightbox-subtitle {
\t\tmax-width: calc(100vw - 164px);
\t}
\t.album-gallery-lightbox-delete,
\t.album-gallery-lightbox-close {
\t\twidth: 48px;
\t\theight: 48px;
\t\tmin-width: 48px;
\t\tmin-height: 48px;
\t}`,
	'the mobile lightbox title widths',
);
write('src/media-styles.ts', mediaStyles);

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
\t'.album-gallery-lightbox-modal .modal-close-button',
\t'display: none !important',
\t'.album-gallery-lightbox-actions',
\t'.album-gallery-lightbox-close',
\t'padding-top: 72px !important',
\t'flex-direction: column',
\t'text-overflow: ellipsis',
\t'white-space: nowrap',
\t'.album-gallery-lightbox-previous',
\t'left: 8px',
\t'.album-gallery-lightbox-next',
\t'right: 8px',
\t'top: 50%',
\t'transform: translateY(-50%)',
\t'grid-column: 1',
\t'grid-row: 1',
];
for (const token of requiredStyles) {
\tif (!styles.includes(token)) throw new Error(\`Mobile lightbox contract is missing: \${token}\`);
}

const requiredSource = [
\t"cls: 'album-gallery-lightbox-actions'",
\t"cls: 'clickable-icon album-gallery-lightbox-close'",
\t"setIcon(closeButton, 'x')",
\t"closeButton.addEventListener('click', () => this.close())",
];
for (const token of requiredSource) {
\tif (!support.includes(token)) throw new Error(\`Custom lightbox close control is missing: \${token}\`);
}

if (/\.album-gallery-lightbox-modal \.modal-close-button \{[\s\S]*?position:\s*fixed/i.test(styles)) {
\tthrow new Error('The unreliable fixed native Obsidian close-button override returned.');
}
if (styles.includes('124px) !important')) {
\tthrow new Error('The excessive mobile lightbox top padding returned.');
}

console.log('Album Gallery toolbar-owned mobile close-button validation passed.');
`;
write('scripts/validate-lightbox.mjs', validator);

let changelog = read('CHANGELOG.md');
if (!changelog.includes('## 0.6.7')) {
	const notes = `## 0.6.7\n\n### Fixed\n\n- Removed the unreliable native Obsidian lightbox close button from the media viewer\n- Added a toolbar-owned close control that cannot overlap the iPhone battery or status icons\n- Reduced the excessive empty space above the media toolbar while preserving the safe top offset\n- Preserved the corrected two-column media grid and left/right lightbox navigation\n\n`;
	const insertion = changelog.indexOf('## 0.6.6');
	if (insertion < 0) throw new Error('Could not find the 0.6.6 changelog section.');
	changelog = `${changelog.slice(0, insertion)}${notes}${changelog.slice(insertion)}`;
	write('CHANGELOG.md', changelog);
}

console.log('Applied the toolbar-owned lightbox close-button fix for Album Gallery 0.6.7.');
