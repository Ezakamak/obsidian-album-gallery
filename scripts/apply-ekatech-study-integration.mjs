import { readFile, writeFile } from 'node:fs/promises';

function replaceOnce(source, search, replacement, label) {
	if (!source.includes(search)) {
		throw new Error(`Could not find ${label}`);
	}
	return source.replace(search, replacement);
}

async function updateJSON(path, mutate, indent = 2) {
	const value = JSON.parse(await readFile(path, 'utf8'));
	mutate(value);
	await writeFile(path, `${JSON.stringify(value, null, indent)}\n`);
}

let model = await readFile('src/model.ts', 'utf8');
model = replaceOnce(
	model,
	"export type GallerySort = 'added-desc' | 'added-asc' | 'name-asc' | 'name-desc';",
	"export type GallerySort = 'added-desc' | 'added-asc' | 'name-asc' | 'name-desc';\nexport type GalleryAlbumKind = 'standard' | 'ekatech-study-mistakes';",
	'gallery album kind type',
);
model = replaceOnce(
	model,
	"\tcoverImageId?: string;\n\tcreatedAt: number;",
	"\tcoverImageId?: string;\n\tkind?: GalleryAlbumKind;\n\tcreatedAt: number;",
	'gallery album kind field',
);
model = replaceOnce(
	model,
	"export function createGalleryAlbum(name: string): GalleryAlbum {\n\tconst now = Date.now();\n\treturn {\n\t\tid: createId(),\n\t\tname,\n\t\timages: [],\n\t\tcreatedAt: now,\n\t\tupdatedAt: now,\n\t};\n}",
	"export function createGalleryAlbum(name: string, kind: GalleryAlbumKind = 'standard'): GalleryAlbum {\n\tconst now = Date.now();\n\treturn {\n\t\tid: createId(),\n\t\tname,\n\t\timages: [],\n\t\t...(kind !== 'standard' ? { kind } : {}),\n\t\tcreatedAt: now,\n\t\tupdatedAt: now,\n\t};\n}",
	'createGalleryAlbum implementation',
);
model = replaceOnce(
	model,
	"\tconst coverImageId = readNonEmptyString(value.coverImageId);\n\n\treturn {\n\t\tid,\n\t\tname,\n\t\timages,\n\t\t...(coverImageId ? { coverImageId } : {}),",
	"\tconst coverImageId = readNonEmptyString(value.coverImageId);\n\tconst kindValue = readNonEmptyString(value.kind);\n\tconst kind: GalleryAlbumKind = kindValue === 'ekatech-study-mistakes'\n\t\t? 'ekatech-study-mistakes'\n\t\t: 'standard';\n\n\treturn {\n\t\tid,\n\t\tname,\n\t\timages,\n\t\t...(coverImageId ? { coverImageId } : {}),\n\t\t...(kind !== 'standard' ? { kind } : {}),",
	'album kind parsing',
);
await writeFile('src/model.ts', model);

let settings = await readFile('src/settings.ts', 'utf8');
settings = replaceOnce(
	settings,
	"export interface AlbumGallerySettings {\n\tbatchSize: number;\n\tdefaultTab: GalleryDefaultTab;\n}",
	"export interface AlbumGallerySettings {\n\tbatchSize: number;\n\tdefaultTab: GalleryDefaultTab;\n\tekatechStudyLinked: boolean;\n\tekatechStudyAccountLabel: string;\n\tekatechStudyPendingNonce: string;\n}",
	'settings interface',
);
settings = replaceOnce(
	settings,
	"export const DEFAULT_SETTINGS: AlbumGallerySettings = {\n\tbatchSize: 100,\n\tdefaultTab: 'photos',\n};",
	"export const DEFAULT_SETTINGS: AlbumGallerySettings = {\n\tbatchSize: 100,\n\tdefaultTab: 'photos',\n\tekatechStudyLinked: false,\n\tekatechStudyAccountLabel: '',\n\tekatechStudyPendingNonce: '',\n};",
	'default settings',
);
settings = replaceOnce(
	settings,
	"\t\tnew Setting(this.containerEl)\n\t\t\t.setName('Default tab')",
	"\t\tnew Setting(this.containerEl)\n\t\t\t.setName('Ekatech Study')\n\t\t\t.setDesc(this.plugin.settings.ekatechStudyLinked\n\t\t\t\t? `Connected${this.plugin.settings.ekatechStudyAccountLabel ? ` as ${this.plugin.settings.ekatechStudyAccountLabel}` : ''}. Photos are handed to Study locally through iOS; they are not uploaded by this plugin.`\n\t\t\t\t: 'Connect the Ekatech Study app to create a managed Hata Defteri album and transfer selected questions locally.')\n\t\t\t.addButton((button) => button\n\t\t\t\t.setButtonText(this.plugin.settings.ekatechStudyLinked ? 'Reconnect' : 'Connect')\n\t\t\t\t.onClick(() => this.plugin.beginEkatechStudyLink()));\n\n\t\tnew Setting(this.containerEl)\n\t\t\t.setName('Default tab')",
	'settings connection control',
);
await writeFile('src/settings.ts', settings);

let main = await readFile('src/main.ts', 'utf8');
main = main.replace("\tnormalizePath,\n} from 'obsidian';", "\tnormalizePath,\n\topenExternal,\n} from 'obsidian';");
main = main.replace(
	"import { createGalleryDocument, serializeGalleryDocument } from './model';",
	"import { createGalleryDocument, serializeGalleryDocument } from './model';\nimport {\n\tcreateEkatechStudyConnectURL,\n\tcreateEkatechStudyLinkNonce,\n} from './ekatech-study';",
);
main = replaceOnce(
	main,
	"\t\tthis.registerExtensions([GALLERY_EXTENSION], GALLERY_VIEW_TYPE);\n",
	"\t\tthis.registerExtensions([GALLERY_EXTENSION], GALLERY_VIEW_TYPE);\n\t\tthis.registerObsidianProtocolHandler('ekatech-study-link', (params) => {\n\t\t\tvoid this.completeEkatechStudyLink(params);\n\t\t});\n",
	'protocol handler registration',
);
main = replaceOnce(
	main,
	"\tasync saveSettings(): Promise<void> {\n\t\tawait this.saveData(this.settings);\n\t}\n\n\trefreshOpenGalleryViews(): void {",
	"\tasync saveSettings(): Promise<void> {\n\t\tawait this.saveData(this.settings);\n\t}\n\n\tbeginEkatechStudyLink(): void {\n\t\tconst nonce = createEkatechStudyLinkNonce();\n\t\tthis.settings.ekatechStudyPendingNonce = nonce;\n\t\tvoid this.saveSettings();\n\t\topenExternal(createEkatechStudyConnectURL(nonce));\n\t\tnew Notice('Ekatech Study opened. Approve the connection in the app.');\n\t}\n\n\tprivate async completeEkatechStudyLink(params: Record<string, string>): Promise<void> {\n\t\tconst nonce = params.nonce?.trim() ?? '';\n\t\tif (!nonce || nonce !== this.settings.ekatechStudyPendingNonce) {\n\t\t\tnew Notice('Ekatech Study connection could not be verified. Try connecting again.');\n\t\t\treturn;\n\t\t}\n\t\tif (params.status !== 'connected') {\n\t\t\tnew Notice(params.message || 'Ekatech Study connection was not completed.');\n\t\t\treturn;\n\t\t}\n\n\t\tthis.settings.ekatechStudyLinked = true;\n\t\tthis.settings.ekatechStudyAccountLabel = params.account?.trim() ?? '';\n\t\tthis.settings.ekatechStudyPendingNonce = '';\n\t\tawait this.saveSettings();\n\n\t\tfor (const leaf of this.app.workspace.getLeavesOfType(GALLERY_VIEW_TYPE)) {\n\t\t\tif (leaf.view instanceof AlbumGalleryView) {\n\t\t\t\tleaf.view.ensureEkatechStudyAlbum();\n\t\t\t}\n\t\t}\n\t\tnew Notice('Ekatech Study connected. Hata Defteri album is ready.');\n\t}\n\n\trefreshOpenGalleryViews(): void {",
	'plugin connection methods',
);
await writeFile('src/main.ts', main);

let view = await readFile('src/gallery-view.ts', 'utf8');
view = view.replace(
	"\tsortImages,\n} from './model';",
	"\tsortImages,\n} from './model';\nimport {\n\tEKATECH_STUDY_ALBUM_KIND,\n\tEKATECH_STUDY_ALBUM_NAME,\n\tEKATECH_STUDY_IMPORT_EXTENSION,\n\tEKATECH_STUDY_IMPORT_MIME,\n\tEKATECH_STUDY_IMPORT_TYPE,\n\tEKATECH_STUDY_MAX_IMAGE_BYTES,\n\tEKATECH_STUDY_MAX_PACKAGE_SOURCE_BYTES,\n\tEkatechStudyImportPackage,\n\tarrayBufferToBase64,\n\tmimeTypeForImageName,\n\tsafeExportFilename,\n} from './ekatech-study';",
);
view = replaceOnce(
	view,
	"\tprivate importingAlbumId: string | null = null;",
	"\tprivate importingAlbumId: string | null = null;\n\tprivate exportingAlbumId: string | null = null;",
	'exporting state',
);
view = replaceOnce(
	view,
	"\t\tif (this.file && this.document.title !== this.file.basename) {\n\t\t\tthis.document.title = this.file.basename;\n\t\t\tshouldSave = true;\n\t\t}\n\n\t\tthis.render();",
	"\t\tif (this.file && this.document.title !== this.file.basename) {\n\t\t\tthis.document.title = this.file.basename;\n\t\t\tshouldSave = true;\n\t\t}\n\t\tif (this.plugin.settings.ekatechStudyLinked && !this.findEkatechStudyAlbum()) {\n\t\t\tthis.document.albums.unshift(createGalleryAlbum(EKATECH_STUDY_ALBUM_NAME, EKATECH_STUDY_ALBUM_KIND));\n\t\t\tshouldSave = true;\n\t\t}\n\n\t\tthis.render();",
	'auto-created Study album',
);
view = replaceOnce(
	view,
	"\t\tconst createButton = header.createEl('button', {\n\t\t\tcls: 'album-gallery-round-button mod-cta',\n\t\t\tattr: { type: 'button', 'aria-label': 'Create album' },\n\t\t});\n\t\tsetIcon(createButton, 'folder-plus');\n\t\tcreateButton.addEventListener('click', () => this.openCreateAlbumModal());",
	"\t\tconst headerActions = header.createDiv({ cls: 'album-gallery-library-actions' });\n\t\tconst studyButton = headerActions.createEl('button', {\n\t\t\tcls: `album-gallery-study-button${this.plugin.settings.ekatechStudyLinked ? ' is-connected' : ''}`,\n\t\t\tattr: {\n\t\t\t\ttype: 'button',\n\t\t\t\t'aria-label': this.plugin.settings.ekatechStudyLinked ? 'Open Study Hata Defteri' : 'Connect Ekatech Study',\n\t\t\t},\n\t\t});\n\t\tsetIcon(studyButton, this.plugin.settings.ekatechStudyLinked ? 'badge-check' : 'graduation-cap');\n\t\tstudyButton.createSpan({ text: this.plugin.settings.ekatechStudyLinked ? 'Study' : 'Connect Study' });\n\t\tstudyButton.addEventListener('click', () => {\n\t\t\tif (!this.plugin.settings.ekatechStudyLinked) {\n\t\t\t\tthis.plugin.beginEkatechStudyLink();\n\t\t\t\treturn;\n\t\t\t}\n\t\t\tconst album = this.ensureEkatechStudyAlbum();\n\t\t\tthis.activeTab = 'albums';\n\t\t\tthis.activeAlbumId = album.id;\n\t\t\tthis.render();\n\t\t});\n\n\t\tconst createButton = headerActions.createEl('button', {\n\t\t\tcls: 'album-gallery-round-button mod-cta',\n\t\t\tattr: { type: 'button', 'aria-label': 'Create album' },\n\t\t});\n\t\tsetIcon(createButton, 'folder-plus');\n\t\tcreateButton.addEventListener('click', () => this.openCreateAlbumModal());",
	'library Study action',
);
view = replaceOnce(
	view,
	"\t\tconst card = container.createDiv({ cls: 'album-gallery-album-card' });",
	"\t\tconst isStudyAlbum = album.kind === EKATECH_STUDY_ALBUM_KIND;\n\t\tconst card = container.createDiv({\n\t\t\tcls: `album-gallery-album-card${isStudyAlbum ? ' album-gallery-study-album-card' : ''}`,\n\t\t});",
	'album special class',
);
view = replaceOnce(
	view,
	"\t\tconst details = card.createDiv({ cls: 'album-gallery-album-details' });\n\t\tdetails.createEl('h3', { text: album.name });",
	"\t\tconst details = card.createDiv({ cls: 'album-gallery-album-details' });\n\t\tconst nameRow = details.createDiv({ cls: 'album-gallery-album-name-row' });\n\t\tnameRow.createEl('h3', { text: album.name });\n\t\tif (isStudyAlbum) {\n\t\t\tconst badge = nameRow.createSpan({ cls: 'album-gallery-study-badge', text: 'Study' });\n\t\t\tbadge.setAttr('aria-label', 'Ekatech Study Hata Defteri');\n\t\t}",
	'album Study badge',
);
view = replaceOnce(
	view,
	"\t\tconst actions = header.createDiv({ cls: 'album-gallery-album-actions' });\n\t\tconst addButton = actions.createEl('button', {",
	"\t\tconst actions = header.createDiv({ cls: 'album-gallery-album-actions' });\n\t\tif (album.kind === EKATECH_STUDY_ALBUM_KIND) {\n\t\t\tconst exportButton = actions.createEl('button', {\n\t\t\t\tcls: 'album-gallery-export-study-button mod-cta',\n\t\t\t\tattr: { type: 'button', 'aria-label': 'Send questions to Ekatech Study' },\n\t\t\t});\n\t\t\tsetIcon(exportButton, this.exportingAlbumId === album.id ? 'loader-circle' : 'send');\n\t\t\texportButton.createSpan({ text: this.exportingAlbumId === album.id ? 'Preparing…' : 'Send to Study' });\n\t\t\texportButton.disabled = this.exportingAlbumId !== null;\n\t\t\texportButton.addEventListener('click', () => {\n\t\t\t\tvoid this.exportAlbumToEkatechStudy(album);\n\t\t\t});\n\t\t}\n\t\tconst addButton = actions.createEl('button', {",
	'album export button',
);
view = replaceOnce(
	view,
	"\tprivate openAlbumMenu(event: MouseEvent, album: GalleryAlbum): void {\n\t\tconst menu = new Menu();\n\t\tmenu.addItem((item) => item\n\t\t\t.setTitle('Add photos')\n\t\t\t.setIcon('image-plus')\n\t\t\t.onClick(() => this.openPhotoPicker(album.id)));\n\t\tmenu.addItem((item) => item\n\t\t\t.setTitle('Rename album')\n\t\t\t.setIcon('pencil')\n\t\t\t.onClick(() => this.openRenameAlbumModal(album)));\n\t\tmenu.addSeparator();\n\t\tmenu.addItem((item) => item\n\t\t\t.setTitle('Delete album')\n\t\t\t.setIcon('trash-2')\n\t\t\t.onClick(() => this.confirmDeleteAlbum(album)));\n\t\tmenu.showAtMouseEvent(event);\n\t}",
	"\tprivate openAlbumMenu(event: MouseEvent, album: GalleryAlbum): void {\n\t\tconst menu = new Menu();\n\t\tmenu.addItem((item) => item\n\t\t\t.setTitle('Add photos')\n\t\t\t.setIcon('image-plus')\n\t\t\t.onClick(() => this.openPhotoPicker(album.id)));\n\t\tif (album.kind === EKATECH_STUDY_ALBUM_KIND) {\n\t\t\tmenu.addItem((item) => item\n\t\t\t\t.setTitle('Send to Ekatech Study')\n\t\t\t\t.setIcon('send')\n\t\t\t\t.onClick(() => { void this.exportAlbumToEkatechStudy(album); }));\n\t\t} else {\n\t\t\tmenu.addItem((item) => item\n\t\t\t\t.setTitle('Rename album')\n\t\t\t\t.setIcon('pencil')\n\t\t\t\t.onClick(() => this.openRenameAlbumModal(album)));\n\t\t\tmenu.addSeparator();\n\t\t\tmenu.addItem((item) => item\n\t\t\t\t.setTitle('Delete album')\n\t\t\t\t.setIcon('trash-2')\n\t\t\t\t.onClick(() => this.confirmDeleteAlbum(album)));\n\t\t}\n\t\tmenu.showAtMouseEvent(event);\n\t}",
	'album menu behavior',
);
view = replaceOnce(
	view,
	"\tprivate openPhotoPicker(albumId: string): void {",
	"\tpublic ensureEkatechStudyAlbum(): GalleryAlbum {\n\t\tconst existing = this.findEkatechStudyAlbum();\n\t\tif (existing) {\n\t\t\treturn existing;\n\t\t}\n\t\tconst album = createGalleryAlbum(EKATECH_STUDY_ALBUM_NAME, EKATECH_STUDY_ALBUM_KIND);\n\t\tthis.document.albums.unshift(album);\n\t\tthis.requestSave();\n\t\tthis.render();\n\t\treturn album;\n\t}\n\n\tprivate findEkatechStudyAlbum(): GalleryAlbum | undefined {\n\t\treturn this.document.albums.find((album) => album.kind === EKATECH_STUDY_ALBUM_KIND);\n\t}\n\n\tprivate async exportAlbumToEkatechStudy(album: GalleryAlbum): Promise<void> {\n\t\tif (!this.plugin.settings.ekatechStudyLinked) {\n\t\t\tthis.plugin.beginEkatechStudyLink();\n\t\t\treturn;\n\t\t}\n\t\tif (album.kind !== EKATECH_STUDY_ALBUM_KIND) {\n\t\t\tnew Notice('Only the Hata Defteri album can be sent to Ekatech Study.');\n\t\t\treturn;\n\t\t}\n\t\tconst references = this.getAlbumReferences(album);\n\t\tif (references.length === 0) {\n\t\t\tnew Notice('Add at least one question photo before sending.');\n\t\t\treturn;\n\t\t}\n\t\tif (this.exportingAlbumId !== null) {\n\t\t\treturn;\n\t\t}\n\n\t\tthis.exportingAlbumId = album.id;\n\t\tthis.render();\n\t\ttry {\n\t\t\tlet sourceBytes = 0;\n\t\t\tconst questions: EkatechStudyImportPackage['questions'] = [];\n\t\t\tfor (let index = 0; index < references.length; index += 1) {\n\t\t\t\tconst reference = references[index];\n\t\t\t\tif (!reference) {\n\t\t\t\t\tcontinue;\n\t\t\t\t}\n\t\t\t\tconst file = this.app.vault.getFileByPath(reference.image.path);\n\t\t\t\tif (!file) {\n\t\t\t\t\tthrow new Error(`Missing photo: ${reference.image.name}`);\n\t\t\t\t}\n\t\t\t\tif (file.stat.size > EKATECH_STUDY_MAX_IMAGE_BYTES) {\n\t\t\t\t\tthrow new Error(`${file.name} is larger than the 20 MB local transfer limit.`);\n\t\t\t\t}\n\t\t\t\tsourceBytes += file.stat.size;\n\t\t\t\tif (sourceBytes > EKATECH_STUDY_MAX_PACKAGE_SOURCE_BYTES) {\n\t\t\t\t\tthrow new Error('The selected questions exceed the 120 MB local transfer limit. Send them in smaller groups.');\n\t\t\t\t}\n\t\t\t\tconst data = await this.app.vault.readBinary(file);\n\t\t\t\tquestions.push({\n\t\t\t\t\tid: reference.image.id,\n\t\t\t\t\ttitle: `Soru ${index + 1}`,\n\t\t\t\t\toriginalName: reference.image.name,\n\t\t\t\t\tmimeType: mimeTypeForImageName(reference.image.name),\n\t\t\t\t\tdataBase64: arrayBufferToBase64(data),\n\t\t\t\t});\n\t\t\t}\n\n\t\t\tconst payload: EkatechStudyImportPackage = {\n\t\t\t\tversion: 1,\n\t\t\t\ttype: EKATECH_STUDY_IMPORT_TYPE,\n\t\t\t\tsource: 'obsidian-album-gallery',\n\t\t\t\tcreatedAt: new Date().toISOString(),\n\t\t\t\tgallery: {\n\t\t\t\t\tid: this.document.id,\n\t\t\t\t\ttitle: this.document.title,\n\t\t\t\t\tfileName: this.file?.name ?? `${this.document.title}.gallery`,\n\t\t\t\t},\n\t\t\t\talbum: { id: album.id, name: album.name },\n\t\t\t\tdefaults: {\n\t\t\t\t\texamType: 'TYT',\n\t\t\t\t\tlessonID: '',\n\t\t\t\t\ttopicID: '',\n\t\t\t\t\tsourceName: 'Obsidian ile aktarıldı',\n\t\t\t\t\tquestionNote: 'Obsidian ile aktarıldı',\n\t\t\t\t\treviewIntervalDays: 7,\n\t\t\t\t},\n\t\t\t\tquestions,\n\t\t\t};\n\n\t\t\tconst filename = `${safeExportFilename(this.document.title)}.${EKATECH_STUDY_IMPORT_EXTENSION}`;\n\t\t\tconst json = JSON.stringify(payload);\n\t\t\tconst transferFile = new File([json], filename, { type: EKATECH_STUDY_IMPORT_MIME });\n\t\t\tconst shareData: ShareData = {\n\t\t\t\tfiles: [transferFile],\n\t\t\t\ttitle: 'Ekatech Study Hata Defteri',\n\t\t\t\ttext: `${questions.length} soru Ekatech Study için hazır.`,\n\t\t\t};\n\t\t\tconst canShare = typeof navigator.share === 'function'\n\t\t\t\t&& (typeof navigator.canShare !== 'function' || navigator.canShare(shareData));\n\t\t\tif (canShare) {\n\t\t\t\tawait navigator.share(shareData);\n\t\t\t\tnew Notice(`${questions.length} question${questions.length === 1 ? '' : 's'} handed to Ekatech Study locally.`);\n\t\t\t} else {\n\t\t\t\tconst exportFolder = 'Album Gallery Exports';\n\t\t\t\tawait this.ensureFolder(exportFolder);\n\t\t\t\tconst exportPath = normalizePath(`${exportFolder}/${filename}`);\n\t\t\t\tconst existing = this.app.vault.getAbstractFileByPath(exportPath);\n\t\t\t\tif (existing) {\n\t\t\t\t\tawait this.app.fileManager.trashFile(existing);\n\t\t\t\t}\n\t\t\t\tconst encoded = new TextEncoder().encode(json);\n\t\t\t\tconst binary = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer;\n\t\t\t\tawait this.app.vault.createBinary(exportPath, binary);\n\t\t\t\tnew Notice(`Local transfer package saved to ${exportPath}. Share it with Ekatech Study.`);\n\t\t\t}\n\t\t} catch (error) {\n\t\t\tif (error instanceof DOMException && error.name === 'AbortError') {\n\t\t\t\treturn;\n\t\t\t}\n\t\t\tconsole.error('Album Gallery could not prepare the Ekatech Study transfer', error);\n\t\t\tnew Notice(error instanceof Error ? error.message : 'Ekatech Study transfer could not be prepared.');\n\t\t} finally {\n\t\t\tthis.exportingAlbumId = null;\n\t\t\tthis.render();\n\t\t}\n\t}\n\n\tprivate openPhotoPicker(albumId: string): void {",
	'Study album and export methods',
);
await writeFile('src/gallery-view.ts', view);

let styles = await readFile('styles.css', 'utf8');
if (!styles.includes('/* Ekatech Study local handoff */')) {
	styles += `

/* Ekatech Study local handoff */
.album-gallery-library-actions,
.album-gallery-album-name-row,
.album-gallery-study-button,
.album-gallery-export-study-button {
	display: flex;
	align-items: center;
}

.album-gallery-library-actions {
	gap: 8px;
}

.album-gallery-study-button,
.album-gallery-export-study-button {
	min-height: 44px;
	gap: 7px;
	padding: 8px 13px;
	border: 1px solid var(--background-modifier-border);
	border-radius: 999px;
	background: var(--background-secondary);
	color: var(--text-normal);
	font-weight: var(--font-semibold);
}

.album-gallery-study-button.is-connected,
.album-gallery-export-study-button {
	border-color: color-mix(in srgb, var(--interactive-accent) 45%, transparent);
	background: color-mix(in srgb, var(--interactive-accent) 14%, var(--background-secondary));
	color: var(--interactive-accent);
}

.album-gallery-study-button svg,
.album-gallery-export-study-button svg {
	width: 18px;
	height: 18px;
}

.album-gallery-study-album-card .album-gallery-album-cover {
	border-color: color-mix(in srgb, var(--interactive-accent) 45%, var(--background-modifier-border));
}

.album-gallery-album-name-row {
	min-width: 0;
	justify-content: space-between;
	gap: 8px;
}

.album-gallery-album-name-row h3 {
	min-width: 0;
}

.album-gallery-study-badge {
	flex: 0 0 auto;
	padding: 3px 8px;
	border-radius: 999px;
	background: color-mix(in srgb, var(--interactive-accent) 16%, transparent);
	color: var(--interactive-accent);
	font-size: var(--font-ui-smaller);
	font-weight: var(--font-semibold);
}

.album-gallery-export-study-button:disabled svg {
	animation: album-gallery-spin 0.9s linear infinite;
}

@media (max-width: 700px) {
	.album-gallery-library-actions {
		gap: 6px;
	}

	.album-gallery-study-button {
		width: 46px;
		height: 46px;
		padding: 0;
		justify-content: center;
	}

	.album-gallery-study-button span,
	.album-gallery-export-study-button span {
		display: none;
	}

	.album-gallery-export-study-button {
		width: 44px;
		height: 44px;
		padding: 0;
		justify-content: center;
	}
}
`;
}
await writeFile('styles.css', styles);

let readme = await readFile('README.md', 'utf8');
if (!readme.includes('## Ekatech Study local handoff')) {
	readme = readme.replace('## Local development', `## Ekatech Study local handoff

Album Gallery can connect to the Ekatech Study iOS app without copying account tokens into Obsidian. After approval in Study, each gallery receives a managed **Hata Defteri** album. **Send to Study** packages the album photos locally as numbered questions and opens the iOS share sheet. Ekatech Study imports the package into its existing batch mistake editor, where lesson, topic, mistake information, and review interval remain editable before saving.

The transfer package is passed device-to-device through iOS document sharing. Album Gallery does not upload these photos to a cloud service.

## Local development`);
}
await writeFile('README.md', readme);

let eslint = await readFile('eslint.config.mts', 'utf8');
if (!eslint.includes("scripts/apply-ekatech-study-integration.mjs")) {
	eslint = eslint.replace("\t\t'tsconfig.json',", "\t\t'tsconfig.json',\n\t\t'scripts/apply-ekatech-study-integration.mjs',");
}
await writeFile('eslint.config.mts', eslint);

await updateJSON('manifest.json', (value) => { value.version = '0.3.0'; });
await updateJSON('package.json', (value) => { value.version = '0.3.0'; });
await updateJSON('package-lock.json', (value) => {
	value.version = '0.3.0';
	if (value.packages?.['']) value.packages[''].version = '0.3.0';
}, '\t');
await updateJSON('versions.json', (value) => { value['0.3.0'] = '1.8.0'; });
