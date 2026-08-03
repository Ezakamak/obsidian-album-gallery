import { readFile, writeFile } from 'node:fs/promises';

function replaceOnce(source, search, replacement, label) {
	if (!source.includes(search)) {
		throw new Error(`Could not find ${label}`);
	}
	return source.replace(search, replacement);
}

const viewPath = 'src/gallery-view.ts';
let view = await readFile(viewPath, 'utf8');

view = replaceOnce(
	view,
	'\t\tthis.renderTabBar();',
	'\t\tthis.renderTabBar(allImages.length);',
	'renderTabBar call',
);

view = replaceOnce(
	view,
`\tprivate renderTabBar(): void {
\t\tconst tabBar = this.contentEl.createDiv({ cls: 'album-gallery-tab-bar' });
\t\tthis.renderTabButton(tabBar, 'photos', 'Photos');
\t\tthis.renderTabButton(tabBar, 'albums', 'Albums');
\t}

\tprivate renderTabButton(container: HTMLElement, tab: GalleryDefaultTab, label: string): void {
\t\tconst button = container.createEl('button', {
\t\t\tcls: \`album-gallery-tab\${this.activeTab === tab ? ' is-active' : ''}\`,
\t\t\ttext: label,
\t\t\tattr: { type: 'button' },
\t\t});
\t\tbutton.addEventListener('click', () => {
\t\t\tthis.activeTab = tab;
\t\t\tthis.render();
\t\t});
\t}
`,
`\tprivate renderTabBar(photoCount: number): void {
\t\tconst tabBar = this.contentEl.createDiv({
\t\t\tcls: 'album-gallery-tab-bar',
\t\t\tattr: { role: 'tablist', 'aria-label': 'Gallery sections' },
\t\t});
\t\tthis.renderTabButton(tabBar, 'photos', 'Photos', 'images', photoCount);
\t\tthis.renderTabButton(tabBar, 'albums', 'Albums', 'folder-heart', this.document.albums.length);
\t}

\tprivate renderTabButton(
\t\tcontainer: HTMLElement,
\t\ttab: GalleryDefaultTab,
\t\tlabel: string,
\t\ticonName: string,
\t\tcount: number,
\t): void {
\t\tconst isActive = this.activeTab === tab;
\t\tconst button = container.createEl('button', {
\t\t\tcls: \`album-gallery-tab\${isActive ? ' is-active' : ''}\`,
\t\t\tattr: {
\t\t\t\ttype: 'button',
\t\t\t\trole: 'tab',
\t\t\t\t'aria-selected': isActive ? 'true' : 'false',
\t\t\t\t'aria-current': isActive ? 'page' : 'false',
\t\t\t},
\t\t});
\t\tbutton.disabled = isActive;
\t\tconst icon = button.createSpan({ cls: 'album-gallery-tab-icon' });
\t\tsetIcon(icon, iconName);
\t\tbutton.createSpan({ cls: 'album-gallery-tab-label', text: label });
\t\tbutton.createSpan({ cls: 'album-gallery-tab-count', text: String(count) });

\t\tif (!isActive) {
\t\t\tbutton.addEventListener('click', () => {
\t\t\t\tthis.activeTab = tab;
\t\t\t\tthis.render();
\t\t\t});
\t\t}
\t}
`,
	'tab navigation implementation',
);

view = replaceOnce(
	view,
`\t\tconst card = container.createEl('button', {
\t\t\tcls: 'album-gallery-album-card',
\t\t\tattr: { type: 'button', 'aria-label': \`Open \${album.name}\` },
\t\t});`,
`\t\tconst card = container.createDiv({ cls: 'album-gallery-album-card' });
\t\tcard.setAttr('role', 'button');
\t\tcard.setAttr('tabindex', '0');
\t\tcard.setAttr('aria-label', \`Open \${album.name}\`);`,
	'album card element',
);

view = replaceOnce(
	view,
`\t\tcard.addEventListener('click', () => {
\t\t\tthis.activeAlbumId = album.id;
\t\t\tthis.render();
\t\t});`,
`\t\tconst openAlbum = (): void => {
\t\t\tthis.activeAlbumId = album.id;
\t\t\tthis.render();
\t\t};
\t\tcard.addEventListener('click', openAlbum);
\t\tcard.addEventListener('keydown', (event) => {
\t\t\tif (event.key === 'Enter' || event.key === ' ') {
\t\t\t\tevent.preventDefault();
\t\t\t\topenAlbum();
\t\t\t}
\t\t});`,
	'album card activation',
);

view = view.replace("sectionHeader.createEl('h2', { text: 'All Photos' });", "sectionHeader.createEl('h2', { text: 'Photos' });");
view = view.replace("sectionHeader.createEl('h2', { text: 'My Albums' });", "sectionHeader.createEl('h2', { text: 'Albums' });");

await writeFile(viewPath, view);

const stylesPath = 'styles.css';
let styles = await readFile(stylesPath, 'utf8');
const marker = '/* Mobile gallery clarity redesign */';
if (!styles.includes(marker)) {
	styles += `

${marker}
.album-gallery-view {
	width: 100%;
	box-sizing: border-box;
}

.album-gallery-tab-bar {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	width: 100%;
	max-width: 720px;
	margin: 0 0 28px;
	padding: 0;
	gap: 12px;
	border: 0;
	background: transparent;
}

.album-gallery-tab {
	display: grid;
	grid-template-columns: auto minmax(0, 1fr) auto;
	align-items: center;
	width: 100%;
	min-width: 0;
	min-height: 62px;
	padding: 10px 12px;
	gap: 10px;
	border: 1px solid var(--background-modifier-border);
	border-radius: 16px;
	background: var(--background-secondary);
	color: var(--text-muted);
	text-align: start;
	box-shadow: none;
}

.album-gallery-tab:not(.is-active):hover {
	border-color: var(--background-modifier-border-hover);
	background: var(--background-modifier-hover);
}

.album-gallery-tab.is-active,
.album-gallery-tab.is-active:disabled {
	border-color: var(--interactive-accent);
	background: var(--interactive-accent);
	color: var(--text-on-accent);
	opacity: 1;
	cursor: default;
}

.album-gallery-tab-icon {
	display: grid;
	place-items: center;
	width: 38px;
	height: 38px;
	border-radius: 12px;
	background: var(--background-primary);
	color: var(--interactive-accent);
}

.album-gallery-tab.is-active .album-gallery-tab-icon {
	background: rgba(255, 255, 255, 0.2);
	color: currentColor;
}

.album-gallery-tab-icon svg {
	width: 21px;
	height: 21px;
}

.album-gallery-tab-label {
	min-width: 0;
	font-size: var(--font-ui-medium);
	font-weight: var(--font-semibold);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.album-gallery-tab-count {
	display: grid;
	place-items: center;
	min-width: 28px;
	height: 28px;
	padding: 0 8px;
	border-radius: 999px;
	background: var(--background-primary);
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
	font-variant-numeric: tabular-nums;
}

.album-gallery-tab.is-active .album-gallery-tab-count {
	background: rgba(255, 255, 255, 0.2);
	color: currentColor;
}

.album-gallery-section-heading {
	justify-content: flex-start;
}

.album-gallery-section-count {
	min-width: 0;
	padding: 0;
	background: transparent;
}

.album-gallery-album-grid {
	grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
	align-items: start;
}

.album-gallery-album-card {
	display: block !important;
	width: 100% !important;
	min-width: 0;
	padding: 0 !important;
	border: 0 !important;
	background: transparent !important;
	color: inherit;
	text-align: start;
	box-shadow: none !important;
	cursor: pointer;
}

.album-gallery-album-cover {
	width: 100%;
	aspect-ratio: 4 / 3;
}

.album-gallery-album-details {
	display: block;
	width: 100%;
	box-sizing: border-box;
}

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
	appearance: none;
	-webkit-appearance: none;
}

.album-gallery-photo-card > img,
.album-gallery-album-cover > img {
	width: 100% !important;
	height: 100% !important;
}

@media (max-width: 700px) {
	.album-gallery-view {
		padding-inline: 16px;
	}

	.album-gallery-library-header,
	.album-gallery-album-header {
		margin-bottom: 18px;
	}

	.album-gallery-title-group h1 {
		font-size: 31px;
		line-height: 1.08;
	}

	.album-gallery-tab-bar {
		gap: 8px;
		margin-bottom: 24px;
	}

	.album-gallery-tab {
		grid-template-columns: 1fr auto;
		grid-template-rows: auto auto;
		min-height: 76px;
		padding: 10px;
		gap: 2px 8px;
	}

	.album-gallery-tab-icon {
		grid-column: 1 / -1;
		width: 34px;
		height: 34px;
		margin-bottom: 4px;
	}

	.album-gallery-tab-label {
		font-size: 15px;
	}

	.album-gallery-tab-count {
		min-width: 24px;
		height: 24px;
		padding-inline: 7px;
	}

	.album-gallery-album-grid,
	.album-gallery-photo-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.album-gallery-album-grid {
		gap: 20px 12px;
	}

	.album-gallery-photo-grid {
		gap: 4px;
	}

	.album-gallery-album-cover {
		aspect-ratio: 1;
		border-radius: 14px;
	}

	.album-gallery-photo-card {
		border-radius: 6px;
	}

	.album-gallery-album-leading {
		flex: 1 1 auto;
		min-width: 0;
	}

	.album-gallery-back-button,
	.album-gallery-add-photos-button {
		width: 44px;
		height: 44px;
	}
}

@media (max-width: 360px) {
	.album-gallery-view {
		padding-inline: 12px;
	}

	.album-gallery-tab-label {
		font-size: 14px;
	}

	.album-gallery-album-grid,
	.album-gallery-photo-grid {
		gap: 8px;
	}
}
`;
}
await writeFile(stylesPath, styles);

for (const path of ['manifest.json', 'package.json', 'package-lock.json', 'versions.json']) {
	const document = JSON.parse(await readFile(path, 'utf8'));
	if (path === 'manifest.json' || path === 'package.json') {
		document.version = '0.2.1';
	} else if (path === 'package-lock.json') {
		document.version = '0.2.1';
		if (document.packages?.['']) {
			document.packages[''].version = '0.2.1';
		}
	} else {
		document['0.2.1'] = '1.8.0';
	}
	await writeFile(path, `${JSON.stringify(document, null, path === 'package-lock.json' ? '\t' : 2)}\n`);
}
