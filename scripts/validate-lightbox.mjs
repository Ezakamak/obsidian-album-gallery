import fs from 'node:fs';

const styles = fs.readFileSync('src/media-styles.ts', 'utf8');
const required = [
	"position: fixed !important",
	"64px) !important",
	"124px) !important",
	"flex-direction: column",
	"text-overflow: ellipsis",
	"white-space: nowrap",
	".album-gallery-lightbox-previous",
	"left: 8px",
	".album-gallery-lightbox-next",
	"right: 8px",
	"top: 50%",
	"transform: translateY(-50%)",
	"grid-column: 1",
	"grid-row: 1",
];

for (const token of required) {
	if (!styles.includes(token)) {
		throw new Error(`Mobile lightbox contract is missing: ${token}`);
	}
}

const forbidden = [
	'.album-gallery-lightbox-title-group {\n\tdisplay: flex;\n\talign-items: center;',
];
for (const token of forbidden) {
	if (styles.includes(token)) throw new Error(`Broken mobile lightbox rule returned: ${token}`);
}

console.log('Album Gallery mobile lightbox validation passed.');
