import fs from 'node:fs';

const styles = fs.readFileSync('styles.css', 'utf8');
const startMarker = '/* Album Gallery mobile media grid — restored from proven 0.6.2 */';
const endMarker = '/* End proven mobile media grid */';
const start = styles.indexOf(startMarker);
const end = styles.indexOf(endMarker, start);

if (start < 0 || end < 0) {
	throw new Error('The proven mobile media-grid contract is missing from styles.css.');
}

const block = styles.slice(start, end + endMarker.length);
const required = [
	'repeat(2, minmax(0, 1fr))',
	'aspect-ratio: 1',
	'height: auto',
	'.album-gallery-view button.album-gallery-photo-card > img',
	'.album-gallery-view button.album-gallery-photo-card > video',
	'object-fit: cover',
];

for (const token of required) {
	if (!block.includes(token)) throw new Error(`Mobile media-grid contract is missing: ${token}`);
}

if (/position\s*:\s*absolute/i.test(block)) {
	throw new Error('Media cards must not use the failed absolute-position grid workaround.');
}
if (block.includes('!important')) {
	throw new Error('The mobile media-grid contract must not use !important.');
}
