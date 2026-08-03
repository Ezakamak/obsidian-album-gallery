import {
	App,
	Menu,
	Modal,
	Notice,
	TFile,
	TFolder,
	TextFileView,
	WorkspaceLeaf,
	normalizePath,
	setIcon,
} from 'obsidian';
import {
	ASSET_ROOT_FOLDER,
	FILE_PICKER_ACCEPT,
	GALLERY_VIEW_TYPE,
	SUPPORTED_IMAGE_EXTENSIONS,
} from './constants';
import {
	GalleryAlbum,
	GalleryDocument,
	GalleryImage,
	createGalleryAlbum,
	createGalleryDocument,
	createGalleryImage,
	isGalleryDocumentV2,
	parseGalleryDocument,
	serializeGalleryDocument,
	sortImages,
} from './model';
import {
	EKATECH_STUDY_ALBUM_KIND,
	EKATECH_STUDY_ALBUM_NAME,
	EKATECH_STUDY_IMPORT_EXTENSION,
	EKATECH_STUDY_IMPORT_MIME,
	EKATECH_STUDY_IMPORT_TYPE,
	EKATECH_STUDY_MAX_IMAGE_BYTES,
	EKATECH_STUDY_MAX_PACKAGE_SOURCE_BYTES,
	EkatechStudyImportPackage,
	arrayBufferToBase64,
	mimeTypeForImageName,
	safeExportFilename,
} from './ekatech-study';
import type AlbumGalleryPlugin from './main';
import type { GalleryDefaultTab } from './settings';

interface GalleryImageReference {
	albumId: string;
	albumName: string;
	image: GalleryImage;
}

export class AlbumGalleryView extends TextFileView {
	private readonly plugin: AlbumGalleryPlugin;
	private document: GalleryDocument = createGalleryDocument('Untitled gallery');
	private activeAlbumId: string | null = null;
	private activeTab: GalleryDefaultTab;
	private observer: IntersectionObserver | null = null;
	private refreshTimer: number | null = null;
	private importingAlbumId: string | null = null;
	private exportingAlbumId: string | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: AlbumGalleryPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.activeTab = plugin.settings.defaultTab;
	}

	getViewType(): string {
		return GALLERY_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.file?.basename ?? 'Album Gallery';
	}

	getIcon(): string {
		return 'images';
	}

	getViewData(): string {
		return serializeGalleryDocument(this.document);
	}

	setViewData(data: string, clear: boolean): void {
		if (clear) {
			this.clear();
		}

		this.data = data;
		const fallbackTitle = this.file?.basename ?? 'Untitled gallery';
		this.document = parseGalleryDocument(data, fallbackTitle);

		let shouldSave = !isGalleryDocumentV2(data);
		if (this.file && this.document.title !== this.file.basename) {
			this.document.title = this.file.basename;
			shouldSave = true;
		}
		if (this.plugin.settings.ekatechStudyLinked && !this.findEkatechStudyAlbum()) {
			this.document.albums.unshift(createGalleryAlbum(EKATECH_STUDY_ALBUM_NAME, EKATECH_STUDY_ALBUM_KIND));
			shouldSave = true;
		}

		this.render();
		if (shouldSave) {
			window.setTimeout(() => this.requestSave(), 0);
		}
	}

	clear(): void {
		this.disconnectObserver();
		this.contentEl.empty();
	}

	async onClose(): Promise<void> {
		if (this.refreshTimer !== null) {
			window.clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}
		this.disconnectObserver();
		await super.onClose();
	}

	requestVaultRefresh(): void {
		if (this.importingAlbumId) {
			return;
		}
		if (this.refreshTimer !== null) {
			window.clearTimeout(this.refreshTimer);
		}
		this.refreshTimer = window.setTimeout(() => {
			this.refreshTimer = null;
			this.render();
		}, 180);
	}

	private render(): void {
		this.disconnectObserver();
		this.contentEl.empty();
		this.contentEl.addClass('album-gallery-view');

		const activeAlbum = this.activeAlbumId
			? this.document.albums.find((album) => album.id === this.activeAlbumId)
			: undefined;

		if (activeAlbum) {
			this.renderAlbum(activeAlbum);
			return;
		}

		this.activeAlbumId = null;
		this.renderLibrary();
	}

	private renderLibrary(): void {
		const allImages = this.getAllImages();
		const header = this.contentEl.createDiv({ cls: 'album-gallery-library-header' });
		const titleGroup = header.createDiv({ cls: 'album-gallery-title-group' });
		titleGroup.createEl('h1', { text: this.document.title });
		titleGroup.createDiv({
			cls: 'album-gallery-library-summary',
			text: `${allImages.length} ${allImages.length === 1 ? 'photo' : 'photos'} · ${this.document.albums.length} ${this.document.albums.length === 1 ? 'album' : 'albums'}`,
		});

		const headerActions = header.createDiv({ cls: 'album-gallery-library-actions' });
		const studyButton = headerActions.createEl('button', {
			cls: `album-gallery-study-button${this.plugin.settings.ekatechStudyLinked ? ' is-connected' : ''}`,
			attr: {
				type: 'button',
				'aria-label': this.plugin.settings.ekatechStudyLinked ? 'Open Study Hata Defteri' : 'Connect Ekatech Study',
			},
		});
		setIcon(studyButton, this.plugin.settings.ekatechStudyLinked ? 'badge-check' : 'graduation-cap');
		studyButton.createSpan({ text: this.plugin.settings.ekatechStudyLinked ? 'Study' : 'Connect Study' });
		studyButton.addEventListener('click', () => {
			if (!this.plugin.settings.ekatechStudyLinked) {
				this.plugin.beginEkatechStudyLink();
				return;
			}
			const album = this.ensureEkatechStudyAlbum();
			this.activeTab = 'albums';
			this.activeAlbumId = album.id;
			this.render();
		});

		const createButton = headerActions.createEl('button', {
			cls: 'album-gallery-round-button mod-cta',
			attr: { type: 'button', 'aria-label': 'Create album' },
		});
		setIcon(createButton, 'folder-plus');
		createButton.addEventListener('click', () => this.openCreateAlbumModal());

		this.renderTabBar(allImages.length);
		if (this.activeTab === 'photos') {
			this.renderAllPhotos(allImages);
		} else {
			this.renderAlbums();
		}
	}

	private renderTabBar(photoCount: number): void {
		const tabBar = this.contentEl.createDiv({
			cls: 'album-gallery-tab-bar',
			attr: { role: 'tablist', 'aria-label': 'Gallery sections' },
		});
		this.renderTabButton(tabBar, 'photos', 'Photos', 'images', photoCount);
		this.renderTabButton(tabBar, 'albums', 'Albums', 'folder-heart', this.document.albums.length);
	}

	private renderTabButton(
		container: HTMLElement,
		tab: GalleryDefaultTab,
		label: string,
		iconName: string,
		count: number,
	): void {
		const isActive = this.activeTab === tab;
		const button = container.createEl('button', {
			cls: `album-gallery-tab${isActive ? ' is-active' : ''}`,
			attr: {
				type: 'button',
				role: 'tab',
				'aria-selected': isActive ? 'true' : 'false',
				'aria-current': isActive ? 'page' : 'false',
			},
		});
		button.disabled = isActive;
		const icon = button.createSpan({ cls: 'album-gallery-tab-icon' });
		setIcon(icon, iconName);
		button.createSpan({ cls: 'album-gallery-tab-label', text: label });
		button.createSpan({ cls: 'album-gallery-tab-count', text: String(count) });

		if (!isActive) {
			button.addEventListener('click', () => {
				this.activeTab = tab;
				this.render();
			});
		}
	}

	private renderAllPhotos(references: GalleryImageReference[]): void {
		if (references.length === 0) {
			this.renderEmptyState(
				'images',
				'No photos yet',
				'Create an album, then choose photos. Album Gallery stores them automatically inside the vault.',
				'Create album',
				() => this.openCreateAlbumModal(),
			);
			return;
		}

		const section = this.contentEl.createDiv({ cls: 'album-gallery-section' });
		const sectionHeader = section.createDiv({ cls: 'album-gallery-section-heading' });
		sectionHeader.createEl('h2', { text: 'Photos' });
		sectionHeader.createDiv({ cls: 'album-gallery-section-count', text: `${references.length}` });
		this.renderPhotoGrid(section, references);
	}

	private renderAlbums(): void {
		if (this.document.albums.length === 0) {
			this.renderEmptyState(
				'folder-heart',
				'No albums yet',
				'Create an album and add photos directly from your iPhone. No folder setup is required.',
				'New album',
				() => this.openCreateAlbumModal(),
			);
			return;
		}

		const section = this.contentEl.createDiv({ cls: 'album-gallery-section' });
		const sectionHeader = section.createDiv({ cls: 'album-gallery-section-heading' });
		sectionHeader.createEl('h2', { text: 'Albums' });
		sectionHeader.createDiv({
			cls: 'album-gallery-section-count',
			text: `${this.document.albums.length}`,
		});

		const grid = section.createDiv({ cls: 'album-gallery-album-grid' });
		for (const album of this.document.albums) {
			this.renderAlbumCard(grid, album);
		}
	}

	private renderAlbumCard(container: HTMLElement, album: GalleryAlbum): void {
		const isStudyAlbum = album.kind === EKATECH_STUDY_ALBUM_KIND;
		const card = container.createDiv({
			cls: `album-gallery-album-card${isStudyAlbum ? ' album-gallery-study-album-card' : ''}`,
		});
		card.setAttr('role', 'button');
		card.setAttr('tabindex', '0');
		card.setAttr('aria-label', `Open ${album.name}`);
		const coverArea = card.createDiv({ cls: 'album-gallery-album-cover' });
		const cover = this.getAlbumCover(album);
		if (cover) {
			this.renderImageElement(coverArea, cover, '');
		} else {
			const placeholder = coverArea.createDiv({ cls: 'album-gallery-cover-placeholder' });
			setIcon(placeholder, 'images');
		}

		const details = card.createDiv({ cls: 'album-gallery-album-details' });
		const nameRow = details.createDiv({ cls: 'album-gallery-album-name-row' });
		nameRow.createEl('h3', { text: album.name });
		if (isStudyAlbum) {
			const badge = nameRow.createSpan({ cls: 'album-gallery-study-badge', text: 'Study' });
			badge.setAttr('aria-label', 'Ekatech Study Hata Defteri');
		}
		details.createDiv({
			cls: 'album-gallery-album-count',
			text: `${album.images.length} ${album.images.length === 1 ? 'photo' : 'photos'}`,
		});

		const openAlbum = (): void => {
			this.activeAlbumId = album.id;
			this.render();
		};
		card.addEventListener('click', openAlbum);
		card.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				openAlbum();
			}
		});
	}

	private renderAlbum(album: GalleryAlbum): void {
		const references = this.getAlbumReferences(album);
		const header = this.contentEl.createDiv({ cls: 'album-gallery-album-header' });
		const leading = header.createDiv({ cls: 'album-gallery-album-leading' });
		const backButton = leading.createEl('button', {
			cls: 'clickable-icon album-gallery-back-button',
			attr: { type: 'button', 'aria-label': 'Back to library' },
		});
		setIcon(backButton, 'chevron-left');
		backButton.addEventListener('click', () => {
			this.activeAlbumId = null;
			this.activeTab = 'albums';
			this.render();
		});

		const titleGroup = leading.createDiv({ cls: 'album-gallery-title-group' });
		titleGroup.createEl('h1', { text: album.name });
		titleGroup.createDiv({
			cls: 'album-gallery-library-summary',
			text: `${album.images.length} ${album.images.length === 1 ? 'photo' : 'photos'}`,
		});

		const actions = header.createDiv({ cls: 'album-gallery-album-actions' });
		if (album.kind === EKATECH_STUDY_ALBUM_KIND) {
			const exportButton = actions.createEl('button', {
				cls: 'album-gallery-export-study-button mod-cta',
				attr: { type: 'button', 'aria-label': 'Send questions to Ekatech Study' },
			});
			setIcon(exportButton, this.exportingAlbumId === album.id ? 'loader-circle' : 'send');
			exportButton.createSpan({ text: this.exportingAlbumId === album.id ? 'Preparing…' : 'Send to Study' });
			exportButton.disabled = this.exportingAlbumId !== null;
			exportButton.addEventListener('click', () => {
				void this.exportAlbumToEkatechStudy(album);
			});
		}
		const addButton = actions.createEl('button', {
			cls: 'album-gallery-add-photos-button mod-cta',
			attr: { type: 'button' },
		});
		setIcon(addButton, 'image-plus');
		addButton.createSpan({ text: 'Add photos' });
		addButton.addEventListener('click', () => this.openPhotoPicker(album.id));

		const menuButton = actions.createEl('button', {
			cls: 'clickable-icon',
			attr: { type: 'button', 'aria-label': 'Album options' },
		});
		setIcon(menuButton, 'ellipsis');
		menuButton.addEventListener('click', (event) => this.openAlbumMenu(event, album));

		if (this.importingAlbumId === album.id) {
			const importing = this.contentEl.createDiv({ cls: 'album-gallery-importing' });
			const spinner = importing.createDiv({ cls: 'album-gallery-spinner' });
			setIcon(spinner, 'loader-circle');
			importing.createSpan({ text: 'Importing photos…' });
		}

		if (references.length === 0) {
			this.renderEmptyState(
				'image-plus',
				'Add photos to this album',
				'Choose one or many photos. The plugin creates and manages the storage folder automatically.',
				'Choose photos',
				() => this.openPhotoPicker(album.id),
			);
			return;
		}

		const section = this.contentEl.createDiv({ cls: 'album-gallery-section album-gallery-album-section' });
		this.renderPhotoGrid(section, references);
	}

	private renderPhotoGrid(container: HTMLElement, references: GalleryImageReference[]): void {
		const grid = container.createDiv({ cls: 'album-gallery-photo-grid' });
		grid.setCssProps({
			'--album-gallery-thumbnail-size': `${this.document.layout.thumbnailSize}px`,
			'--album-gallery-gap': `${this.document.layout.gap}px`,
		});

		let renderedCount = 0;
		const appendBatch = (): void => {
			const end = Math.min(renderedCount + this.plugin.settings.batchSize, references.length);
			for (let index = renderedCount; index < end; index += 1) {
				const reference = references[index];
				if (reference) {
					this.renderPhotoCard(grid, reference, references, index);
				}
			}
			renderedCount = end;
		};

		appendBatch();
		if (renderedCount >= references.length) {
			return;
		}

		const sentinel = container.createDiv({
			cls: 'album-gallery-load-sentinel',
			text: 'Loading more photos…',
		});
		this.observer = new IntersectionObserver((entries) => {
			if (!entries.some((entry) => entry.isIntersecting)) {
				return;
			}
			appendBatch();
			if (renderedCount >= references.length) {
				this.disconnectObserver();
				sentinel.remove();
			}
		}, { root: this.contentEl, rootMargin: '700px' });
		this.observer.observe(sentinel);
	}

	private renderPhotoCard(
		container: HTMLElement,
		reference: GalleryImageReference,
		references: GalleryImageReference[],
		index: number,
	): void {
		const button = container.createEl('button', {
			cls: 'album-gallery-photo-card',
			attr: { type: 'button', 'aria-label': `Open ${reference.image.name}` },
		});
		this.renderImageElement(button, reference.image, reference.image.name);
		button.addEventListener('click', () => {
			new ImageLightboxModal(
				this.app,
				references,
				index,
				(item) => this.confirmDeleteImage(item),
			).open();
		});
	}

	private renderImageElement(container: HTMLElement, image: GalleryImage, alt: string): void {
		const file = this.app.vault.getFileByPath(image.path);
		if (!file) {
			const placeholder = container.createDiv({ cls: 'album-gallery-missing-photo' });
			setIcon(placeholder, 'image-off');
			return;
		}

		const element = container.createEl('img', {
			attr: { alt, loading: 'lazy', decoding: 'async' },
		});
		element.src = this.app.vault.getResourcePath(file);
		element.addEventListener('error', () => {
			element.addClass('is-broken');
		});
	}

	private renderEmptyState(
		iconName: string,
		title: string,
		description: string,
		buttonText: string,
		onClick: () => void,
	): void {
		const empty = this.contentEl.createDiv({ cls: 'album-gallery-empty' });
		const icon = empty.createDiv({ cls: 'album-gallery-empty-icon' });
		setIcon(icon, iconName);
		empty.createEl('h2', { text: title });
		empty.createEl('p', { text: description });
		const button = empty.createEl('button', {
			cls: 'mod-cta album-gallery-empty-button',
			text: buttonText,
			attr: { type: 'button' },
		});
		button.addEventListener('click', onClick);
	}

	private openCreateAlbumModal(): void {
		new AlbumNameModal(this.app, {
			title: 'New album',
			submitText: 'Create',
			onSubmit: (name) => {
				const album = createGalleryAlbum(name);
				this.document.albums.unshift(album);
				this.activeAlbumId = album.id;
				this.activeTab = 'albums';
				this.requestSave();
				this.render();
			},
		}).open();
	}

	private openRenameAlbumModal(album: GalleryAlbum): void {
		new AlbumNameModal(this.app, {
			title: 'Rename album',
			initialValue: album.name,
			submitText: 'Save',
			onSubmit: (name) => {
				album.name = name;
				album.updatedAt = Date.now();
				this.requestSave();
				this.render();
			},
		}).open();
	}

	private openAlbumMenu(event: MouseEvent, album: GalleryAlbum): void {
		const menu = new Menu();
		menu.addItem((item) => item
			.setTitle('Add photos')
			.setIcon('image-plus')
			.onClick(() => this.openPhotoPicker(album.id)));
		if (album.kind === EKATECH_STUDY_ALBUM_KIND) {
			menu.addItem((item) => item
				.setTitle('Send to Ekatech Study')
				.setIcon('send')
				.onClick(() => { void this.exportAlbumToEkatechStudy(album); }));
		} else {
			menu.addItem((item) => item
				.setTitle('Rename album')
				.setIcon('pencil')
				.onClick(() => this.openRenameAlbumModal(album)));
			menu.addSeparator();
			menu.addItem((item) => item
				.setTitle('Delete album')
				.setIcon('trash-2')
				.onClick(() => this.confirmDeleteAlbum(album)));
		}
		menu.showAtMouseEvent(event);
	}

	public ensureEkatechStudyAlbum(): GalleryAlbum {
		const existing = this.findEkatechStudyAlbum();
		if (existing) {
			return existing;
		}
		const album = createGalleryAlbum(EKATECH_STUDY_ALBUM_NAME, EKATECH_STUDY_ALBUM_KIND);
		this.document.albums.unshift(album);
		this.requestSave();
		this.render();
		return album;
	}

	private findEkatechStudyAlbum(): GalleryAlbum | undefined {
		return this.document.albums.find((album) => album.kind === EKATECH_STUDY_ALBUM_KIND);
	}

	private async exportAlbumToEkatechStudy(album: GalleryAlbum): Promise<void> {
		if (!this.plugin.settings.ekatechStudyLinked) {
			this.plugin.beginEkatechStudyLink();
			return;
		}
		if (album.kind !== EKATECH_STUDY_ALBUM_KIND) {
			new Notice('Only the Hata Defteri album can be sent to Ekatech Study.');
			return;
		}
		const references = this.getAlbumReferences(album);
		if (references.length === 0) {
			new Notice('Add at least one question photo before sending.');
			return;
		}
		if (this.exportingAlbumId !== null) {
			return;
		}

		this.exportingAlbumId = album.id;
		this.render();
		try {
			let sourceBytes = 0;
			const questions: EkatechStudyImportPackage['questions'] = [];
			for (let index = 0; index < references.length; index += 1) {
				const reference = references[index];
				if (!reference) {
					continue;
				}
				const file = this.app.vault.getFileByPath(reference.image.path);
				if (!file) {
					throw new Error(`Missing photo: ${reference.image.name}`);
				}
				if (file.stat.size > EKATECH_STUDY_MAX_IMAGE_BYTES) {
					throw new Error(`${file.name} is larger than the 20 MB local transfer limit.`);
				}
				sourceBytes += file.stat.size;
				if (sourceBytes > EKATECH_STUDY_MAX_PACKAGE_SOURCE_BYTES) {
					throw new Error('The selected questions exceed the 120 MB local transfer limit. Send them in smaller groups.');
				}
				const data = await this.app.vault.readBinary(file);
				questions.push({
					id: reference.image.id,
					title: `Soru ${index + 1}`,
					originalName: reference.image.name,
					mimeType: mimeTypeForImageName(reference.image.name),
					dataBase64: arrayBufferToBase64(data),
				});
			}

			const payload: EkatechStudyImportPackage = {
				version: 1,
				type: EKATECH_STUDY_IMPORT_TYPE,
				source: 'obsidian-album-gallery',
				createdAt: new Date().toISOString(),
				gallery: {
					id: this.document.id,
					title: this.document.title,
					fileName: this.file?.name ?? `${this.document.title}.gallery`,
				},
				album: { id: album.id, name: album.name },
				defaults: {
					examType: 'TYT',
					lessonID: '',
					topicID: '',
					sourceName: 'Obsidian ile aktarıldı',
					questionNote: 'Obsidian ile aktarıldı',
					reviewIntervalDays: 7,
				},
				questions,
			};

			const filename = `${safeExportFilename(this.document.title)}.${EKATECH_STUDY_IMPORT_EXTENSION}`;
			const json = JSON.stringify(payload);
			const transferFile = new File([json], filename, { type: EKATECH_STUDY_IMPORT_MIME });
			const shareData: ShareData = {
				files: [transferFile],
				title: 'Ekatech Study Hata Defteri',
				text: `${questions.length} soru Ekatech Study için hazır.`,
			};
			const canShare = typeof navigator.share === 'function'
				&& (typeof navigator.canShare !== 'function' || navigator.canShare(shareData));
			if (canShare) {
				await navigator.share(shareData);
				new Notice(`${questions.length} question${questions.length === 1 ? '' : 's'} handed to Ekatech Study locally.`);
			} else {
				const exportFolder = 'Album Gallery Exports';
				await this.ensureFolder(exportFolder);
				const exportPath = normalizePath(`${exportFolder}/${filename}`);
				const existing = this.app.vault.getAbstractFileByPath(exportPath);
				if (existing) {
					await this.app.fileManager.trashFile(existing);
				}
				const encoded = new TextEncoder().encode(json);
				const binary = Uint8Array.from(encoded).buffer;
				await this.app.vault.createBinary(exportPath, binary);
				new Notice(`Local transfer package saved to ${exportPath}. Share it with Ekatech Study.`);
			}
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return;
			}
			console.error('Album Gallery could not prepare the Ekatech Study transfer', error);
			new Notice(error instanceof Error ? error.message : 'Ekatech Study transfer could not be prepared.');
		} finally {
			this.exportingAlbumId = null;
			this.render();
		}
	}

	private openPhotoPicker(albumId: string): void {
		if (this.importingAlbumId) {
			new Notice('Please wait for the current import to finish.');
			return;
		}

		const input = this.contentEl.ownerDocument.createElement('input');
		input.type = 'file';
		input.accept = FILE_PICKER_ACCEPT;
		input.multiple = true;
		input.addClass('album-gallery-file-input');
		this.contentEl.ownerDocument.body.appendChild(input);

		input.addEventListener('change', () => {
			const files = Array.from(input.files ?? []);
			input.remove();
			if (files.length > 0) {
				void this.importPhotos(albumId, files);
			}
		}, { once: true });

		input.click();
	}

	private async importPhotos(albumId: string, files: File[]): Promise<void> {
		const album = this.document.albums.find((item) => item.id === albumId);
		if (!album) {
			new Notice('Album no longer exists.');
			return;
		}

		const accepted = files.filter((file) => this.isSupportedImageFile(file));
		if (accepted.length === 0) {
			new Notice('No supported image files were selected.');
			return;
		}

		this.importingAlbumId = albumId;
		this.render();
		new Notice(`Importing ${accepted.length} ${accepted.length === 1 ? 'photo' : 'photos'}…`);

		let imported = 0;
		let failed = 0;
		try {
			const albumFolder = normalizePath(`${ASSET_ROOT_FOLDER}/${this.document.id}/${album.id}`);
			await this.ensureFolder(albumFolder);

			for (let index = 0; index < accepted.length; index += 1) {
				const source = accepted[index];
				if (!source) {
					continue;
				}
				try {
					const filename = this.createSafeFilename(source, albumFolder);
					const path = normalizePath(`${albumFolder}/${filename}`);
					const data = await source.arrayBuffer();
					await this.app.vault.createBinary(path, data);
					album.images.push(createGalleryImage(path, source.name || filename, Date.now() + index));
					imported += 1;
				} catch (error) {
					console.error('Album Gallery failed to import a photo', error);
					failed += 1;
				}
			}

			album.images = sortImages(album.images, this.document.layout.sort);
			album.updatedAt = Date.now();
			this.requestSave();
		} finally {
			this.importingAlbumId = null;
			this.render();
		}

		if (imported > 0) {
			new Notice(`${imported} ${imported === 1 ? 'photo' : 'photos'} added to ${album.name}.`);
		}
		if (failed > 0) {
			new Notice(`${failed} ${failed === 1 ? 'photo could' : 'photos could'} not be imported.`);
		}
	}

	private isSupportedImageFile(file: File): boolean {
		if (file.type.toLowerCase().startsWith('image/')) {
			return true;
		}
		const extension = this.getExtension(file.name);
		return extension !== null && SUPPORTED_IMAGE_EXTENSIONS.has(extension);
	}

	private createSafeFilename(file: File, folderPath: string): string {
		const original = file.name.trim() || `Photo ${Date.now()}`;
		const extension = this.getExtension(original) ?? this.extensionFromMime(file.type) ?? 'jpg';
		const withoutExtension = original.replace(new RegExp(`\\.${extension}$`, 'i'), '');
		const safeBase = withoutExtension
			.replace(/[\\/:*?"<>|\u0000-\u001F]/g, '-')
			.replace(/\s+/g, ' ')
			.replace(/^\.+|\.+$/g, '')
			.trim()
			.slice(0, 120) || 'Photo';

		let suffix = 0;
		while (true) {
			const filename = suffix === 0
				? `${safeBase}.${extension.toLowerCase()}`
				: `${safeBase} ${suffix + 1}.${extension.toLowerCase()}`;
			const candidate = normalizePath(`${folderPath}/${filename}`);
			if (!this.app.vault.getAbstractFileByPath(candidate)) {
				return filename;
			}
			suffix += 1;
		}
	}

	private getExtension(filename: string): string | null {
		const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
		return match?.[1] ?? null;
	}

	private extensionFromMime(mime: string): string | null {
		const normalized = mime.toLowerCase();
		const mapping: Record<string, string> = {
			'image/avif': 'avif',
			'image/bmp': 'bmp',
			'image/gif': 'gif',
			'image/heic': 'heic',
			'image/heif': 'heif',
			'image/jpeg': 'jpg',
			'image/png': 'png',
			'image/svg+xml': 'svg',
			'image/tiff': 'tiff',
			'image/webp': 'webp',
		};
		return mapping[normalized] ?? null;
	}

	private async ensureFolder(path: string): Promise<void> {
		const normalized = normalizePath(path);
		const parts = normalized.split('/').filter(Boolean);
		let current = '';
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			const existing = this.app.vault.getAbstractFileByPath(current);
			if (!existing) {
				await this.app.vault.createFolder(current);
			} else if (!(existing instanceof TFolder)) {
				throw new Error(`Cannot create folder because a file exists at ${current}`);
			}
		}
	}

	private confirmDeleteImage(reference: GalleryImageReference): void {
		new ConfirmActionModal(this.app, {
			title: 'Delete photo?',
			description: `“${reference.image.name}” will be moved to the trash and removed from this album.`,
			confirmText: 'Delete photo',
			onConfirm: async () => this.deleteImage(reference),
		}).open();
	}

	private async deleteImage(reference: GalleryImageReference): Promise<void> {
		const album = this.document.albums.find((item) => item.id === reference.albumId);
		if (!album) {
			return;
		}

		const file = this.app.vault.getFileByPath(reference.image.path);
		if (file) {
			try {
				await this.app.fileManager.trashFile(file);
			} catch (error) {
				console.error('Album Gallery failed to trash a photo', error);
				new Notice('The photo could not be moved to the trash.');
				return;
			}
		}

		album.images = album.images.filter((image) => image.id !== reference.image.id);
		if (album.coverImageId === reference.image.id) {
			delete album.coverImageId;
		}
		album.updatedAt = Date.now();
		this.requestSave();
		this.render();
		new Notice('Photo deleted.');
	}

	private confirmDeleteAlbum(album: GalleryAlbum): void {
		new ConfirmActionModal(this.app, {
			title: 'Delete album?',
			description: `“${album.name}” and its ${album.images.length} ${album.images.length === 1 ? 'photo' : 'photos'} will be moved to the trash.`,
			confirmText: 'Delete album',
			onConfirm: async () => this.deleteAlbum(album),
		}).open();
	}

	private async deleteAlbum(album: GalleryAlbum): Promise<void> {
		const folderPath = normalizePath(`${ASSET_ROOT_FOLDER}/${this.document.id}/${album.id}`);
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (folder) {
			try {
				await this.app.fileManager.trashFile(folder);
			} catch (error) {
				console.error('Album Gallery failed to trash an album folder', error);
				new Notice('The album folder could not be moved to the trash.');
				return;
			}
		}

		this.document.albums = this.document.albums.filter((item) => item.id !== album.id);
		this.activeAlbumId = null;
		this.activeTab = 'albums';
		this.requestSave();
		this.render();
		new Notice('Album deleted.');
	}

	private getAllImages(): GalleryImageReference[] {
		const references = this.document.albums.flatMap((album) => this.getAlbumReferences(album));
		return references.sort((left, right) => {
			switch (this.document.layout.sort) {
				case 'name-asc':
					return left.image.name.localeCompare(right.image.name);
				case 'name-desc':
					return right.image.name.localeCompare(left.image.name);
				case 'added-asc':
					return left.image.addedAt - right.image.addedAt;
				case 'added-desc':
					return right.image.addedAt - left.image.addedAt;
			}
		});
	}

	private getAlbumReferences(album: GalleryAlbum): GalleryImageReference[] {
		return sortImages(album.images, this.document.layout.sort).map((image) => ({
			albumId: album.id,
			albumName: album.name,
			image,
		}));
	}

	private getAlbumCover(album: GalleryAlbum): GalleryImage | null {
		if (album.coverImageId) {
			const cover = album.images.find((image) => image.id === album.coverImageId);
			if (cover) {
				return cover;
			}
		}
		return sortImages(album.images, 'added-desc')[0] ?? null;
	}

	private disconnectObserver(): void {
		this.observer?.disconnect();
		this.observer = null;
	}
}

interface AlbumNameModalOptions {
	title: string;
	initialValue?: string;
	submitText: string;
	onSubmit: (name: string) => void;
}

class AlbumNameModal extends Modal {
	private readonly options: AlbumNameModalOptions;

	constructor(app: App, options: AlbumNameModalOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		this.contentEl.addClass('album-gallery-name-modal');
		this.contentEl.createEl('h2', { text: this.options.title });
		const input = this.contentEl.createEl('input', {
			cls: 'album-gallery-name-input',
			attr: {
				type: 'text',
				placeholder: 'Album name',
				maxlength: '80',
			},
		});
		input.value = this.options.initialValue ?? '';

		const error = this.contentEl.createDiv({ cls: 'album-gallery-name-error' });
		const actions = this.contentEl.createDiv({ cls: 'modal-button-container' });
		actions.createEl('button', {
			text: 'Cancel',
			attr: { type: 'button' },
		}).addEventListener('click', () => this.close());
		const submit = actions.createEl('button', {
			cls: 'mod-cta',
			text: this.options.submitText,
			attr: { type: 'button' },
		});

		const finish = (): void => {
			const name = input.value.trim();
			if (!name) {
				error.setText('Enter an album name.');
				input.focus();
				return;
			}
			this.options.onSubmit(name);
			this.close();
		};

		submit.addEventListener('click', finish);
		input.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				finish();
			}
		});
		window.setTimeout(() => {
			input.focus();
			input.select();
		}, 0);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

interface ConfirmActionOptions {
	title: string;
	description: string;
	confirmText: string;
	onConfirm: () => Promise<void> | void;
}

class ConfirmActionModal extends Modal {
	private readonly options: ConfirmActionOptions;

	constructor(app: App, options: ConfirmActionOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		this.contentEl.createEl('h2', { text: this.options.title });
		this.contentEl.createEl('p', { text: this.options.description });
		const actions = this.contentEl.createDiv({ cls: 'modal-button-container' });
		actions.createEl('button', {
			text: 'Cancel',
			attr: { type: 'button' },
		}).addEventListener('click', () => this.close());
		const confirm = actions.createEl('button', {
			cls: 'mod-warning',
			text: this.options.confirmText,
			attr: { type: 'button' },
		});
		confirm.addEventListener('click', async () => {
			confirm.disabled = true;
			await this.options.onConfirm();
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

class ImageLightboxModal extends Modal {
	private references: GalleryImageReference[];
	private index: number;
	private readonly onRequestDelete: (reference: GalleryImageReference) => void;
	private imageElement: HTMLImageElement | null = null;
	private titleElement: HTMLElement | null = null;
	private subtitleElement: HTMLElement | null = null;
	private touchStartX: number | null = null;

	constructor(
		app: App,
		references: GalleryImageReference[],
		index: number,
		onRequestDelete: (reference: GalleryImageReference) => void,
	) {
		super(app);
		this.references = [...references];
		this.index = index;
		this.onRequestDelete = onRequestDelete;
	}

	onOpen(): void {
		this.modalEl.addClass('album-gallery-lightbox-modal');
		const shell = this.contentEl.createDiv({ cls: 'album-gallery-lightbox' });
		const toolbar = shell.createDiv({ cls: 'album-gallery-lightbox-toolbar' });
		const titleGroup = toolbar.createDiv({ cls: 'album-gallery-lightbox-title-group' });
		this.titleElement = titleGroup.createDiv({ cls: 'album-gallery-lightbox-title' });
		this.subtitleElement = titleGroup.createDiv({ cls: 'album-gallery-lightbox-subtitle' });
		const deleteButton = toolbar.createEl('button', {
			cls: 'clickable-icon album-gallery-lightbox-delete',
			attr: { type: 'button', 'aria-label': 'Delete photo' },
		});
		setIcon(deleteButton, 'trash-2');
		deleteButton.addEventListener('click', () => {
			const reference = this.references[this.index];
			if (reference) {
				this.close();
				this.onRequestDelete(reference);
			}
		});

		const stage = shell.createDiv({ cls: 'album-gallery-lightbox-stage' });
		const previous = stage.createEl('button', {
			cls: 'clickable-icon album-gallery-lightbox-nav album-gallery-lightbox-previous',
			attr: { type: 'button', 'aria-label': 'Previous photo' },
		});
		setIcon(previous, 'chevron-left');
		previous.addEventListener('click', () => this.move(-1));

		this.imageElement = stage.createEl('img', { attr: { alt: '' } });
		this.imageElement.addEventListener('touchstart', (event) => {
			this.touchStartX = event.changedTouches[0]?.clientX ?? null;
		}, { passive: true });
		this.imageElement.addEventListener('touchend', (event) => {
			const endX = event.changedTouches[0]?.clientX;
			if (this.touchStartX === null || endX === undefined) {
				return;
			}
			const delta = endX - this.touchStartX;
			this.touchStartX = null;
			if (Math.abs(delta) >= 50) {
				this.move(delta > 0 ? -1 : 1);
			}
		}, { passive: true });

		const next = stage.createEl('button', {
			cls: 'clickable-icon album-gallery-lightbox-nav album-gallery-lightbox-next',
			attr: { type: 'button', 'aria-label': 'Next photo' },
		});
		setIcon(next, 'chevron-right');
		next.addEventListener('click', () => this.move(1));

		this.scope.register([], 'ArrowLeft', () => {
			this.move(-1);
			return false;
		});
		this.scope.register([], 'ArrowRight', () => {
			this.move(1);
			return false;
		});

		this.updateImage();
	}

	onClose(): void {
		this.imageElement = null;
		this.titleElement = null;
		this.subtitleElement = null;
		this.contentEl.empty();
	}

	private move(direction: number): void {
		if (this.references.length === 0) {
			return;
		}
		this.index = (this.index + direction + this.references.length) % this.references.length;
		this.updateImage();
	}

	private updateImage(): void {
		const reference = this.references[this.index];
		if (!reference || !this.imageElement || !this.titleElement || !this.subtitleElement) {
			return;
		}
		const file = this.app.vault.getFileByPath(reference.image.path);
		if (file) {
			this.imageElement.src = this.app.vault.getResourcePath(file);
		} else {
			this.imageElement.removeAttribute('src');
		}
		this.imageElement.alt = reference.image.name;
		this.titleElement.setText(reference.image.name);
		this.subtitleElement.setText(`${reference.albumName} · ${this.index + 1} of ${this.references.length}`);
	}
}
