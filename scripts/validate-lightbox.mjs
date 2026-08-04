import fs from 'node:fs';

const styles = fs.readFileSync('src/media-styles.ts', 'utf8');
const support = fs.readFileSync('src/media-support.ts', 'utf8');

const requiredStyles = [
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
	if (!styles.includes(token)) throw new Error(`Mobile lightbox contract is missing: ${token}`);
}

const requiredSource = [
	"cls: 'album-gallery-lightbox-actions'",
	"cls: 'clickable-icon album-gallery-lightbox-close'",
	"setIcon(closeButton, 'x')",
	"closeButton.addEventListener('click', () => this.close())",
];
for (const token of requiredSource) {
	if (!support.includes(token)) throw new Error(`Custom lightbox close control is missing: ${token}`);
}

if (/.album-gallery-lightbox-modal .modal-close-button {[sS]*?position:s*fixed/i.test(styles)) {
	throw new Error('The unreliable fixed native Obsidian close-button override returned.');
}
if (styles.includes('124px) !important')) {
	throw new Error('The excessive mobile lightbox top padding returned.');
}

console.log('Album Gallery toolbar-owned mobile close-button validation passed.');
