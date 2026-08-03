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
	EKATECH_STUDY_MAX_IMAGE_BYTES,
	isStudyCloudImage,
	type EkatechStudyMistakeDefaults,
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
	private syncingStudyAlbum = false;

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
		if (this.plugin.ekatechStudyConnected && !this.findEkatechStudyAlbum()) {
			this.ensureEkatechStudyAlbum();
			shouldSave = true;
		}

		this.render();
		if (shouldSave) {
			window.setTimeout(() => this.requestSave(), 0);
		}
		if (this.plugin.ekatechStudyConnected) window.setTimeout(() => { void this.syncPendingStudyImages(false); }, 300);
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
			? this.getVisibleAlbums().find((album) => album.id === this.activeAlbumId)
			: undefined;

		if (activeAlbum) {
			this.renderAlbum(activeAlbum);
			return;
		}

		this.activeAlbumId = null;
		this.renderLibrary();
	}

	private renderLibrary(): void {
		const visibleAlbums = this.getVisibleAlbums();
		const allImages = this.getAllImages();
		const header = this.contentEl.createDiv({ cls: 'album-gallery-library-header' });
		const titleGroup = header.createDiv({ cls: 'album-gallery-title-group' });
		titleGroup.createEl('h1', { text: this.document.title });
		titleGroup.createDiv({
			cls: 'album-gallery-library-summary',
			text: `${allImages.length} ${allImages.length === 1 ? 'photo' : 'photos'} · ${visibleAlbums.length} ${visibleAlbums.length === 1 ? 'album' : 'albums'}`,
		});

		const headerActions = header.createDiv({ cls: 'album-gallery-library-actions' });
		const studyButton = headerActions.createEl('button', {
			cls: `album-gallery-study-button${this.plugin.ekatechStudyConnected ? ' is-connected' : ''}`,
			attr: {
				type: 'button',
				'aria-label': this.plugin.ekatechStudyConnected ? 'Open Study Hata Defteri' : 'Connect Ekatech Study',
			},
		});
		setIcon(studyButton, this.plugin.ekatechStudyConnected ? 'badge-check' : 'graduation-cap');
		studyButton.createSpan({ text: this.plugin.ekatechStudyConnected ? 'Study' : 'Study hesabına giriş' });
		studyButton.addEventListener('click', () => {
			if (!this.plugin.ekatechStudyConnected) {
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
		this.renderTabButton(tabBar, 'albums', 'Albums', 'folder-heart', this.getVisibleAlbums().length);
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
		const visibleAlbums = this.getVisibleAlbums();
		if (visibleAlbums.length === 0) {
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
			text: `${visibleAlbums.length}`,
		});

		const grid = section.createDiv({ cls: 'album-gallery-album-grid' });
		for (const album of visibleAlbums) {
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
			const quota = this.plugin.settings.ekatechStudyStatus?.quota;
			const quotaText = quota?.unlimited ? 'Sınırsız' : `${quota?.used ?? 0} / ${quota?.limit ?? 12}`;
			actions.createSpan({ cls: 'album-gallery-study-quota-pill', text: quotaText });
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

		if (album.kind === EKATECH_STUDY_ALBUM_KIND) this.renderStudyControls(album);

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
		if (reference.image.study) this.renderStudySyncBadge(button, reference.image);
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
				.setTitle('Senkronizasyonu yeniden dene')
				.setIcon('refresh-cw')
				.onClick(() => { void this.syncPendingStudyImages(true); }));
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
		const accountId = this.plugin.ekatechStudyAccountId;
		if (!accountId) throw new Error('Study account is not connected.');
		const existing = this.findEkatechStudyAlbum();
		if (existing) return existing;
		const legacy = this.document.albums.find((album) => album.kind === EKATECH_STUDY_ALBUM_KIND && !album.studyAccountId);
		if (legacy) {
			legacy.studyAccountId = accountId;
			legacy.name = EKATECH_STUDY_ALBUM_NAME;
			this.requestSave();
			return legacy;
		}
		const album = createGalleryAlbum(EKATECH_STUDY_ALBUM_NAME, EKATECH_STUDY_ALBUM_KIND, accountId);
		this.document.albums.unshift(album);
		this.requestSave();
		return album;
	}

	public activateEkatechStudyAlbum(): void {
		if (!this.plugin.ekatechStudyConnected) return;
		const album = this.ensureEkatechStudyAlbum();
		this.activeTab = 'albums';
		this.activeAlbumId = album.id;
		this.render();
		void this.syncPendingStudyImages(false);
	}

	private findEkatechStudyAlbum(): GalleryAlbum | undefined {
		const accountId = this.plugin.ekatechStudyAccountId;
		if (!accountId) return undefined;
		return this.document.albums.find((album) => album.kind === EKATECH_STUDY_ALBUM_KIND && album.studyAccountId === accountId)
			?? this.document.albums.find((album) => album.kind === EKATECH_STUDY_ALBUM_KIND && !album.studyAccountId);
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

		const accepted = files.filter((file) => {
			if (!this.isSupportedImageFile(file)) return false;
			if (album.kind !== EKATECH_STUDY_ALBUM_KIND) return true;
			return isStudyCloudImage(file.name, file.type) && file.size <= EKATECH_STUDY_MAX_IMAGE_BYTES;
		});
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
					const defaults = album.kind === EKATECH_STUDY_ALBUM_KIND ? this.plugin.getEkatechStudyDefaults() : null;
					const accountId = album.kind === EKATECH_STUDY_ALBUM_KIND ? this.plugin.ekatechStudyAccountId : null;
					album.images.push(createGalleryImage(
						path,
						source.name || filename,
						Date.now() + index,
						defaults && accountId ? { ...defaults, accountId, syncState: 'pending' } : undefined,
					));
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
		if (imported > 0 && album.kind === EKATECH_STUDY_ALBUM_KIND) void this.syncPendingStudyImages(false);
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

	private renderStudyControls(album: GalleryAlbum): void {
		const status = this.plugin.settings.ekatechStudyStatus;
		const defaults = this.plugin.getEkatechStudyDefaults();
		if (!status || !defaults) return;
		const panel = this.contentEl.createDiv({ cls: 'album-gallery-study-settings' });
		const heading = panel.createDiv({ cls: 'album-gallery-study-settings-heading' });
		const title = heading.createDiv();
		title.createEl('h2', { text: 'Hata ayarları' });
		title.createEl('p', { text: 'Bu ayarlar bundan sonra ekleyeceğin fotoğraflara uygulanır. Swift içinde yeniden form açılmaz.' });
		const quota = status.quota;
		heading.createSpan({
			cls: `album-gallery-study-quota${quota.exhausted ? ' is-exhausted' : ''}`,
			text: quota.unlimited ? `${status.account.plan} · Sınırsız` : `${status.account.plan} · ${quota.used} / ${quota.limit ?? 12}`,
		});

		const grid = panel.createDiv({ cls: 'album-gallery-study-settings-grid' });
		const exam = this.createStudySelect(grid, 'Sınav', status.curriculum.map((item) => ({ value: item.id, label: item.label })), defaults.examType);
		const subject = this.createStudySelect(grid, 'Ders', [], defaults.subjectCode);
		const topic = this.createStudySelect(grid, 'Konu', [], defaults.topicCode);
		const mistake = this.createStudySelect(grid, 'Hata türü', status.mistakeTypes.map((item) => ({ value: item.id, label: item.label })), defaults.mistakeType);
		const interval = this.createStudySelect(grid, 'Tekrar sıklığı', status.reviewIntervals.map((item) => ({ value: String(item.days), label: item.label })), String(defaults.reviewIntervalDays));
		const source = this.createStudyInput(grid, 'Kaynak', defaults.sourceName, 'Örn. Deneme 3');
		const question = this.createStudyInput(grid, 'Soru notu', defaults.questionNote, 'İsteğe bağlı');
		const solution = this.createStudyInput(grid, 'Çözüm notu', defaults.solutionNote, 'İsteğe bağlı');

		const exams = status.curriculum;
		const populateSubjects = (): void => {
			const selectedExam = exams.find((item) => item.id === exam.value) ?? exams[0];
			subject.empty();
			for (const item of selectedExam?.subjects ?? []) subject.createEl('option', { value: item.id, text: item.label });
			if ((selectedExam?.subjects ?? []).some((item) => item.id === defaults.subjectCode)) subject.value = defaults.subjectCode;
			if (!subject.value && subject.options.length > 0) subject.selectedIndex = 0;
		};
		const populateTopics = (): void => {
			const selectedExam = exams.find((item) => item.id === exam.value) ?? exams[0];
			const selectedSubject = selectedExam?.subjects.find((item) => item.id === subject.value) ?? selectedExam?.subjects[0];
			topic.empty();
			for (const item of selectedSubject?.topics ?? []) topic.createEl('option', { value: item.id, text: item.label });
			if ((selectedSubject?.topics ?? []).some((item) => item.id === defaults.topicCode)) topic.value = defaults.topicCode;
			if (!topic.value && topic.options.length > 0) topic.selectedIndex = 0;
		};
		const save = (): void => {
			void this.plugin.updateEkatechStudyDefaults({
				examType: exam.value,
				subjectCode: subject.value,
				topicCode: topic.value,
				mistakeType: mistake.value,
				reviewIntervalDays: Number(interval.value) || 7,
				sourceName: source.value.trim().slice(0, 120),
				questionNote: question.value.trim().slice(0, 1000),
				solutionNote: solution.value.trim().slice(0, 2000),
			});
		};
		populateSubjects();
		populateTopics();
		exam.addEventListener('change', () => { populateSubjects(); populateTopics(); save(); });
		subject.addEventListener('change', () => { populateTopics(); save(); });
		for (const element of [topic, mistake, interval]) element.addEventListener('change', save);
		for (const element of [source, question, solution]) element.addEventListener('change', save);

		if (quota.exhausted) {
			panel.createDiv({
				cls: 'album-gallery-study-limit-warning',
				text: `Aylık 12 yükleme hakkın doldu. Yeni fotoğraflar cihazda kalır ve ${new Date(quota.resetsAt).toLocaleDateString('tr-TR')} tarihinde otomatik devam eder.`,
			});
		}
		const pending = album.images.filter((image) => image.study?.syncState !== 'synced').length;
		if (pending > 0) panel.createDiv({ cls: 'album-gallery-study-pending', text: `${pending} fotoğraf senkronizasyon kuyruğunda.` });
	}

	private createStudySelect(
		container: HTMLElement,
		label: string,
		options: Array<{ value: string; label: string }>,
		value: string,
	): HTMLSelectElement {
		const field = container.createEl('label', { cls: 'album-gallery-study-field' });
		field.createSpan({ text: label });
		const select = field.createEl('select');
		for (const option of options) select.createEl('option', { value: option.value, text: option.label });
		select.value = value;
		return select;
	}

	private createStudyInput(container: HTMLElement, label: string, value: string, placeholder: string): HTMLInputElement {
		const field = container.createEl('label', { cls: 'album-gallery-study-field' });
		field.createSpan({ text: label });
		const input = field.createEl('input', { type: 'text', value, placeholder });
		return input;
	}

	private renderStudySyncBadge(container: HTMLElement, image: GalleryImage): void {
		const state = image.study?.syncState ?? 'pending';
		const labels: Record<string, string> = {
			pending: 'Bekliyor',
			uploading: 'Yükleniyor',
			synced: 'Study ✓',
			failed: 'Tekrar denenecek',
			quota: 'Kota bekliyor',
		};
		container.createSpan({ cls: `album-gallery-study-sync-badge is-${state}`, text: labels[state] ?? state });
	}

	public async syncPendingStudyImages(force: boolean): Promise<void> {
		if (this.syncingStudyAlbum || !this.plugin.ekatechStudyConnected) return;
		if (force) await this.plugin.refreshEkatechStudyStatus(false);
		const album = this.findEkatechStudyAlbum();
		const accountId = this.plugin.ekatechStudyAccountId;
		const quota = this.plugin.settings.ekatechStudyStatus?.quota;
		if (!album || !accountId || !quota) return;
		const now = Date.now();
		const candidates = album.images.filter((image) => {
			const metadata = image.study;
			if (!metadata || metadata.accountId !== accountId || metadata.syncState === 'synced' || metadata.syncState === 'uploading') return false;
			if (metadata.syncState === 'quota' && quota.exhausted) return false;
			if (!force && metadata.syncState === 'failed' && metadata.lastAttemptAt && now - metadata.lastAttemptAt < 30_000) return false;
			return true;
		});
		if (candidates.length === 0 || (quota.exhausted && !quota.unlimited)) return;

		this.syncingStudyAlbum = true;
		let synced = 0;
		let failed = 0;
		try {
			for (const image of candidates) {
				if (!image.study) continue;
				const latestQuota = this.plugin.settings.ekatechStudyStatus?.quota;
				if (latestQuota?.exhausted && !latestQuota.unlimited) {
					image.study.syncState = 'quota';
					continue;
				}
				const file = this.app.vault.getFileByPath(image.path);
				if (!file) {
					image.study.syncState = 'failed';
					image.study.lastError = 'Fotoğraf dosyası bulunamadı.';
					image.study.lastAttemptAt = Date.now();
					failed += 1;
					continue;
				}
				image.study.syncState = 'uploading';
				image.study.lastAttemptAt = Date.now();
				delete image.study.lastError;
				this.requestSave();
				try {
					const result = await this.plugin.uploadEkatechStudyImage(
						file,
						image,
						image.study,
						image.name.replace(/\.[^.]+$/, '').slice(0, 120) || 'Obsidian sorusu',
					);
					image.study.syncState = 'synced';
					image.study.remoteMistakeId = result.mistakeId;
					image.study.syncedAt = Date.now();
					synced += 1;
				} catch (error) {
					const code = error instanceof Error && 'code' in error ? String((error as { code?: string }).code || '') : '';
					image.study.syncState = code === 'OBSIDIAN_MONTHLY_LIMIT_REACHED' ? 'quota' : 'failed';
					image.study.lastError = error instanceof Error ? error.message : 'Yükleme tamamlanamadı.';
					failed += 1;
					if (code === 'OBSIDIAN_MONTHLY_LIMIT_REACHED' || code === 'OBSIDIAN_AUTH_REQUIRED' || code === 'OBSIDIAN_SESSION_EXPIRED') break;
				}
				this.requestSave();
			}
		} finally {
			this.syncingStudyAlbum = false;
			album.updatedAt = Date.now();
			this.requestSave();
			this.render();
		}
		if (synced > 0) new Notice(`${synced} fotoğraf Study Hata Defteri’ne otomatik yüklendi.`);
		if (failed > 0 && synced === 0) new Notice('Bazı Hata Defteri fotoğrafları kuyrukta kaldı; otomatik yeniden denenecek.');
	}

	private getVisibleAlbums(): GalleryAlbum[] {
		const accountId = this.plugin.ekatechStudyAccountId;
		return this.document.albums.filter((album) => {
			if (album.kind !== EKATECH_STUDY_ALBUM_KIND) return true;
			return Boolean(accountId && (album.studyAccountId === accountId || !album.studyAccountId));
		});
	}

	private getAllImages(): GalleryImageReference[] {
		const references = this.getVisibleAlbums().flatMap((album) => this.getAlbumReferences(album));
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
