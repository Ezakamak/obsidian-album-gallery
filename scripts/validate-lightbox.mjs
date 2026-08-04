import fs from 'node:fs';

const styles = fs.readFileSync('styles.css', 'utf8');
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
	if (!styles.includes(token)) throw new Error(`Mobile lightbox contract is missing: ${token}`);
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
	if (!support.includes(token)) throw new Error(`Native/custom close-control contract is missing: ${token}`);
}

if (styles.includes('124px) !important')) {
	throw new Error('The excessive mobile lightbox top padding returned.');
}

console.log('Album Gallery native modal X removal validation passed.');
