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
import { renderStudyAccountButton } from './study-account-button';
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
		if (this.importingAlbumId) return;
		if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
		this.refreshTimer = window.setTimeout(() => {
			this.refreshTimer = null;
			this.render();
		}, 180);
	}

	public activateEkatechStudyAlbum(): void {
		if (!this.plugin.ekatechStudyConnected) return;
		this.activeTab = 'albums';
		this.activeAlbumId = this.ensureEkatechStudyAlbum().id;
		this.render();
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
		renderStudyAccountButton(headerActions, this.plugin);

		const createButton = headerActions.createEl('button', {
			cls: 'album-gallery-round-button mod-cta',
			attr: { type: 'button', 'aria-label': 'Create album' },
		});
		setIcon(createButton, 'folder-plus');
		createButton.addEventListener('click', () => this.openCreateAlbumModal());

		this.renderTabBar(allImages.length);
		if (this.activeTab === 'photos') this.renderAllPhotos(allImages);
		else this.renderAlbums();
	}

	private renderTabBar(photoCount: number): void {
		const tabBar = this.contentEl.createDiv({ cls: 'album-gallery-tab-bar', attr: { role: 'tablist', 'aria-label': 'Gallery sections' } });
		this.renderTabButton(tabBar, 'photos', 'Photos', 'images', photoCount);
		this.renderTabButton(tabBar, 'albums', 'Albums', 'folder-heart', this.getVisibleAlbums().length);
	}

	private renderTabButton(container: HTMLElement, tab: GalleryDefaultTab, label: string, iconName: string, count: number): void {
		const isActive = this.activeTab === tab;
		const button = container.createEl('button', {
			cls: `album-gallery-tab${isActive ? ' is-active' : ''}`,
			attr: { type: 'button', role: 'tab', 'aria-selected': isActive ? 'true' : 'false', 'aria-current': isActive ? 'page' : 'false' },
		});
		button.disabled = isActive;
		const icon = button.createSpan({ cls: 'album-gallery-tab-icon' });
		setIcon(icon, iconName);
		button.createSpan({ cls: 'album-gallery-tab-label', text: label });
		button.createSpan({ cls: 'album-gallery-tab-count', text: String(count) });
		if (!isActive) button.addEventListener('click', () => { this.activeTab = tab; this.render(); });
	}

	private renderAllPhotos(references: GalleryImageReference[]): void {
		if (references.length === 0) {
			this.renderEmptyState('images', 'No photos yet', 'Create an album, then choose photos. Album Gallery stores them automatically inside the vault.', 'Create album', () => this.openCreateAlbumModal());
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
			this.renderEmptyState('folder-heart', 'No albums yet', 'Create an album and add photos directly from your iPhone. No folder setup is required.', 'New album', () => this.openCreateAlbumModal());
			return;
		}
		const section = this.contentEl.createDiv({ cls: 'album-gallery-section' });
		const sectionHeader = section.createDiv({ cls: 'album-gallery-section-heading' });
		sectionHeader.createEl('h2', { text: 'Albums' });
		sectionHeader.createDiv({ cls: 'album-gallery-section-count', text: `${visibleAlbums.length}` });
		const grid = section.createDiv({ cls: 'album-gallery-album-grid' });
		for (const album of visibleAlbums) this.renderAlbumCard(grid, album);
	}

	private renderAlbumCard(container: HTMLElement, album: GalleryAlbum): void {
		const isStudyAlbum = album.kind === EKATECH_STUDY_ALBUM_KIND;
		const card = container.createDiv({ cls: `album-gallery-album-card${isStudyAlbum ? ' album-gallery-study-album-card' : ''}` });
		card.setAttr('role', 'button');
		card.setAttr('tabindex', '0');
		card.setAttr('aria-label', `Open ${album.name}`);
		const coverArea = card.createDiv({ cls: 'album-gallery-album-cover' });
		const cover = this.getAlbumCover(album);
		if (cover) this.renderImageElement(coverArea, cover, '');
		else { const placeholder = coverArea.createDiv({ cls: 'album-gallery-cover-placeholder' }); setIcon(placeholder, 'images'); }
		const details = card.createDiv({ cls: 'album-gallery-album-details' });
		const nameRow = details.createDiv({ cls: 'album-gallery-album-name-row' });
		nameRow.createEl('h3', { text: album.name });
		if (isStudyAlbum) {
			const badge = nameRow.createSpan({ cls: 'album-gallery-study-badge', text: 'Study' });
			badge.setAttr('aria-label', 'Ekatech Study Hata Defteri');
		}
		details.createDiv({ cls: 'album-gallery-album-count', text: `${album.images.length} ${album.images.length === 1 ? 'photo' : 'photos'}` });
		const openAlbum = (): void => { this.activeAlbumId = album.id; this.render(); };
		card.addEventListener('click', openAlbum);
		card.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openAlbum(); } });
	}

	private renderAlbum(album: GalleryAlbum): void {
		const references = this.getAlbumReferences(album);
		const header = this.contentEl.createDiv({ cls: 'album-gallery-album-header' });
		const leading = header.createDiv({ cls: 'album-gallery-album-leading' });
		const backButton = leading.createEl('button', { cls: 'clickable-icon album-gallery-back-button', attr: { type: 'button', 'aria-label': 'Back to library' } });
		setIcon(backButton, 'chevron-left');
		backButton.addEventListener('click', () => { this.activeAlbumId = null; this.activeTab = 'albums'; this.render(); });
		const titleGroup = leading.createDiv({ cls: 'album-gallery-title-group' });
		titleGroup.createEl('h1', { text: album.name });
		titleGroup.createDiv({ cls: 'album-gallery-library-summary', text: `${album.images.length} ${album.images.length === 1 ? 'photo' : 'photos'}` });
		const actions = header.createDiv({ cls: 'album-gallery-album-actions' });
		if (album.kind === EKATECH_STUDY_ALBUM_KIND) {
			const quota = this.plugin.settings.ekatechStudyStatus?.quota;
			actions.createSpan({ cls: 'album-gallery-study-quota-pill', text: quota?.unlimited ? 'Sınırsız' : `${quota?.used ?? 0} / ${quota?.limit ?? 12}` });
		}
		const addButton = actions.createEl('button', { cls: 'album-gallery-add-photos-button mod-cta', attr: { type: 'button' } });
		setIcon(addButton, 'image-plus');
		addButton.createSpan({ text: 'Add photos' });
		addButton.addEventListener('click', () => this.openPhotoPicker(album.id));
		const menuButton = actions.createEl('button', { cls: 'clickable-icon', attr: { type: 'button', 'aria-label': 'Album options' } });
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
			this.renderEmptyState('image-plus', 'Add photos to this album', 'Choose one or many photos. The plugin creates and manages the storage folder automatically.', 'Add photos', () => this.openPhotoPicker(album.id));
			return;
		}
		const section = this.contentEl.createDiv({ cls: 'album-gallery-section' });
		this.renderPhotoGrid(section, references);
	}

	private renderPhotoGrid(container: HTMLElement, references: GalleryImageReference[]): void {
		const grid = container.createDiv({ cls: 'album-gallery-photo-grid' });
		for (const [index, reference] of references.entries()) {
			const button = grid.createEl('button', { cls: 'album-gallery-photo-card', attr: { type: 'button', 'aria-label': reference.image.name } });
			this.renderImageElement(button, reference.image, reference.image.name);
			if (reference.image.study) this.renderStudySyncBadge(button, reference.image);
			button.addEventListener('click', () => new ImageLightboxModal(this.app, references, index, (selected) => this.confirmDeleteImage(selected)).open());
		}
	}

	private renderImageElement(container: HTMLElement, image: GalleryImage, alt: string): HTMLImageElement {
		const element = container.createEl('img', { attr: { alt, loading: 'lazy' } });
		const file = this.app.vault.getFileByPath(image.path);
		if (file) element.src = this.app.vault.getResourcePath(file);
		else element.addClass('is-broken');
		return element;
	}

	private renderEmptyState(iconName: string, title: string, description: string, actionText: string, onAction: () => void): void {
		const empty = this.contentEl.createDiv({ cls: 'album-gallery-empty' });
		const icon = empty.createDiv({ cls: 'album-gallery-empty-icon' });
		setIcon(icon, iconName);
		empty.createEl('h2', { text: title });
		empty.createEl('p', { text: description });
		const action = empty.createEl('button', { cls: 'mod-cta album-gallery-empty-button', text: actionText, attr: { type: 'button' } });
		action.addEventListener('click', onAction);
	}

	private openCreateAlbumModal(): void {
		new AlbumNameModal(this.app, { title: 'New album', submitText: 'Create', onSubmit: (name) => { this.document.albums.push(createGalleryAlbum(name)); this.requestSave(); this.render(); } }).open();
	}

	private openAlbumMenu(event: MouseEvent, album: GalleryAlbum): void {
		const menu = new Menu();
		if (album.kind !== EKATECH_STUDY_ALBUM_KIND) {
			menu.addItem((item) => item.setTitle('Rename album').setIcon('pencil').onClick(() => new AlbumNameModal(this.app, { title: 'Rename album', initialValue: album.name, submitText: 'Save', onSubmit: (name) => { album.name = name; album.updatedAt = Date.now(); this.requestSave(); this.render(); } }).open()));
			menu.addItem((item) => item.setTitle('Delete album').setIcon('trash-2').onClick(() => new ConfirmActionModal(this.app, { title: 'Delete album?', description: 'The album and its managed photos will be deleted from the vault.', confirmText: 'Delete', onConfirm: async () => this.deleteAlbum(album) }).open()));
		} else {
			menu.addItem((item) => item.setTitle('Refresh Study account').setIcon('refresh-cw').onClick(() => { void this.plugin.refreshEkatechStudyStatus(true); }));
		}
		menu.showAtMouseEvent(event);
	}

	private async deleteAlbum(album: GalleryAlbum): Promise<void> {
		for (const image of album.images) {
			const file = this.app.vault.getFileByPath(image.path);
			if (file) await this.app.fileManager.trashFile(file);
		}
		this.document.albums = this.document.albums.filter((candidate) => candidate.id !== album.id);
		this.activeAlbumId = null;
		this.requestSave();
		this.render();
	}

	private confirmDeleteImage(reference: GalleryImageReference): void {
		new ConfirmActionModal(this.app, { title: 'Delete photo?', description: 'This managed photo will be deleted from the vault.', confirmText: 'Delete', onConfirm: async () => this.deleteImage(reference) }).open();
	}

	private async deleteImage(reference: GalleryImageReference): Promise<void> {
		const album = this.document.albums.find((candidate) => candidate.id === reference.albumId);
		if (!album) return;
		const file = this.app.vault.getFileByPath(reference.image.path);
		if (file) await this.app.fileManager.trashFile(file);
		album.images = album.images.filter((candidate) => candidate.id !== reference.image.id);
		album.updatedAt = Date.now();
		this.requestSave();
		this.render();
	}

	private openPhotoPicker(albumId: string): void {
		const input = this.contentEl.createEl('input', { cls: 'album-gallery-file-input', attr: { type: 'file', accept: FILE_PICKER_ACCEPT, multiple: 'true' } });
		input.addEventListener('change', () => { void this.importSelectedFiles(albumId, Array.from(input.files ?? [])); input.remove(); }, { once: true });
		input.click();
	}

	private async importSelectedFiles(albumId: string, files: File[]): Promise<void> {
		const album = this.document.albums.find((candidate) => candidate.id === albumId);
		if (!album || files.length === 0) return;
		this.importingAlbumId = albumId;
		this.render();
		try {
			for (const file of files) {
				const extension = file.name.toLowerCase().split('.').pop() ?? '';
				if (!SUPPORTED_IMAGE_EXTENSIONS.has(extension)) { new Notice(`${file.name} desteklenmiyor.`); continue; }
				if (album.kind === EKATECH_STUDY_ALBUM_KIND && (!isStudyCloudImage(file.name, file.type) || file.size > EKATECH_STUDY_MAX_IMAGE_BYTES)) { new Notice(`${file.name} Study yükleme sınırlarına uygun değil.`); continue; }
				const targetFolder = await this.ensureAlbumAssetFolder(album.id);
				const path = this.findAvailableAssetPath(targetFolder, file.name);
				await this.app.vault.createBinary(path, await file.arrayBuffer());
				const image = createGalleryImage(path, file.name);
				if (album.kind === EKATECH_STUDY_ALBUM_KIND) {
					const defaults = this.plugin.getEkatechStudyDefaults();
					const accountId = this.plugin.ekatechStudyAccountId;
					if (!defaults || !accountId) continue;
					image.study = { ...defaults, accountId, syncState: 'pending' };
				}
				album.images.push(image);
			}
			album.updatedAt = Date.now();
			this.requestSave();
		} finally {
			this.importingAlbumId = null;
			this.render();
		}
		if (album.kind === EKATECH_STUDY_ALBUM_KIND) void this.syncPendingStudyImages(true);
	}

	private async ensureAlbumAssetFolder(albumId: string): Promise<TFolder> {
		const galleryId = this.file?.basename.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase() || 'gallery';
		const path = normalizePath(`${ASSET_ROOT_FOLDER}/${galleryId}/${albumId}`);
		let current = '';
		for (const segment of path.split('/')) {
			current = current ? `${current}/${segment}` : segment;
			if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
		}
		const folder = this.app.vault.getAbstractFileByPath(path);
		if (!(folder instanceof TFolder)) throw new Error('Album folder could not be created.');
		return folder;
	}

	private findAvailableAssetPath(folder: TFolder, filename: string): string {
		const safe = filename.replace(/[\\/:*?"<>|]/g, '-');
		const dot = safe.lastIndexOf('.');
		const base = dot > 0 ? safe.slice(0, dot) : safe;
		const extension = dot > 0 ? safe.slice(dot) : '';
		let index = 0;
		while (true) {
			const candidate = normalizePath(`${folder.path}/${index === 0 ? `${base}${extension}` : `${base} ${index}${extension}`}`);
			if (!this.app.vault.getAbstractFileByPath(candidate)) return candidate;
			index += 1;
		}
	}

	private renderStudyControls(album: GalleryAlbum): void {
		const status = this.plugin.settings.ekatechStudyStatus;
		const defaults = this.plugin.getEkatechStudyDefaults();
		if (!status || !defaults) return;
		const panel = this.contentEl.createDiv({ cls: 'album-gallery-study-controls' });
		const exam = panel.createEl('select');
		for (const item of status.curriculum) exam.createEl('option', { text: item.label, value: item.id });
		exam.value = defaults.examType;
		const subject = panel.createEl('select');
		const topic = panel.createEl('select');
		const mistake = panel.createEl('select');
		const interval = panel.createEl('select');
		const source = panel.createEl('input', { attr: { type: 'text', placeholder: 'Kaynak' } });
		const question = panel.createEl('input', { attr: { type: 'text', placeholder: 'Soru notu' } });
		const solution = panel.createEl('input', { attr: { type: 'text', placeholder: 'Çözüm notu' } });
		source.value = defaults.sourceName;
		question.value = defaults.questionNote;
		solution.value = defaults.solutionNote;
		for (const item of status.mistakeTypes) mistake.createEl('option', { text: item.label, value: item.id });
		mistake.value = defaults.mistakeType;
		for (const item of status.reviewIntervals) interval.createEl('option', { text: item.label, value: String(item.days) });
		interval.value = String(defaults.reviewIntervalDays);
		const rebuildSubjects = (): void => {
			subject.empty(); topic.empty();
			const selectedExam = status.curriculum.find((item) => item.id === exam.value) ?? status.curriculum[0];
			for (const item of selectedExam?.subjects ?? []) subject.createEl('option', { text: item.label, value: item.id });
			subject.value = selectedExam?.subjects.some((item) => item.id === defaults.subjectCode) ? defaults.subjectCode : selectedExam?.subjects[0]?.id ?? '';
			rebuildTopics();
		};
		const rebuildTopics = (): void => {
			topic.empty();
			const selectedExam = status.curriculum.find((item) => item.id === exam.value);
			const selectedSubject = selectedExam?.subjects.find((item) => item.id === subject.value);
			for (const item of selectedSubject?.topics ?? []) topic.createEl('option', { text: item.label, value: item.id });
			topic.value = selectedSubject?.topics.some((item) => item.id === defaults.topicCode) ? defaults.topicCode : selectedSubject?.topics[0]?.id ?? '';
		};
		exam.addEventListener('change', rebuildSubjects);
		subject.addEventListener('change', rebuildTopics);
		rebuildSubjects();
		const save = panel.createEl('button', { cls: 'mod-cta', text: 'Ayarları kaydet', attr: { type: 'button' } });
		save.addEventListener('click', async () => {
			const next: EkatechStudyMistakeDefaults = { examType: exam.value, subjectCode: subject.value, topicCode: topic.value, mistakeType: mistake.value, reviewIntervalDays: Number(interval.value), sourceName: source.value.trim(), questionNote: question.value.trim(), solutionNote: solution.value.trim() };
			await this.plugin.updateEkatechStudyDefaults(next);
			for (const image of album.images) if (image.study && image.study.syncState !== 'synced') Object.assign(image.study, next);
			this.requestSave();
			new Notice('Hata Defteri varsayılanları kaydedildi.');
		});
	}

	private ensureEkatechStudyAlbum(): GalleryAlbum {
		const accountId = this.plugin.ekatechStudyAccountId;
		let album = this.document.albums.find((candidate) => candidate.kind === EKATECH_STUDY_ALBUM_KIND && candidate.studyAccountId === accountId);
		if (!album) {
			album = createGalleryAlbum(EKATECH_STUDY_ALBUM_NAME);
			album.kind = EKATECH_STUDY_ALBUM_KIND;
			album.studyAccountId = accountId ?? undefined;
			this.document.albums.unshift(album);
			this.requestSave();
		}
		return album;
	}

	private findEkatechStudyAlbum(): GalleryAlbum | undefined {
		const accountId = this.plugin.ekatechStudyAccountId;
		return this.document.albums.find((candidate) => candidate.kind === EKATECH_STUDY_ALBUM_KIND && (!candidate.studyAccountId || candidate.studyAccountId === accountId));
	}

	private renderStudySyncBadge(container: HTMLElement, image: GalleryImage): void {
		const state = image.study?.syncState ?? 'pending';
		const labels: Record<string, string> = { pending: 'Bekliyor', uploading: 'Yükleniyor', synced: 'Study ✓', failed: 'Tekrar denenecek', quota: 'Kota bekliyor' };
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
				if (latestQuota?.exhausted && !latestQuota.unlimited) { image.study.syncState = 'quota'; continue; }
				const file = this.app.vault.getFileByPath(image.path);
				if (!file) { image.study.syncState = 'failed'; image.study.lastError = 'Fotoğraf dosyası bulunamadı.'; image.study.lastAttemptAt = Date.now(); failed += 1; continue; }
				image.study.syncState = 'uploading'; image.study.lastAttemptAt = Date.now(); delete image.study.lastError; this.requestSave();
				try {
					const result = await this.plugin.uploadEkatechStudyImage(file, image, image.study, image.name.replace(/\.[^.]+$/, '').slice(0, 120) || 'Obsidian sorusu');
					image.study.syncState = 'synced'; image.study.remoteMistakeId = result.mistakeId; image.study.syncedAt = Date.now(); synced += 1;
				} catch (error) {
					const code = error instanceof Error && 'code' in error ? String((error as { code?: string }).code || '') : '';
					image.study.syncState = code === 'OBSIDIAN_MONTHLY_LIMIT_REACHED' ? 'quota' : 'failed'; image.study.lastError = error instanceof Error ? error.message : 'Yükleme tamamlanamadı.'; failed += 1;
					if (code === 'OBSIDIAN_MONTHLY_LIMIT_REACHED' || code === 'OBSIDIAN_AUTH_REQUIRED' || code === 'OBSIDIAN_SESSION_EXPIRED') break;
				}
				this.requestSave();
			}
		} finally {
			this.syncingStudyAlbum = false; album.updatedAt = Date.now(); this.requestSave(); this.render();
		}
		if (synced > 0) new Notice(`${synced} fotoğraf Study Hata Defteri’ne otomatik yüklendi.`);
		if (failed > 0 && synced === 0) new Notice('Bazı Hata Defteri fotoğrafları kuyrukta kaldı; otomatik yeniden denenecek.');
	}

	private getVisibleAlbums(): GalleryAlbum[] {
		const accountId = this.plugin.ekatechStudyAccountId;
		return this.document.albums.filter((album) => album.kind !== EKATECH_STUDY_ALBUM_KIND || Boolean(accountId && (album.studyAccountId === accountId || !album.studyAccountId)));
	}

	private getAllImages(): GalleryImageReference[] {
		const references = this.getVisibleAlbums().flatMap((album) => this.getAlbumReferences(album));
		return references.sort((left, right) => {
			switch (this.document.layout.sort) {
				case 'name-asc': return left.image.name.localeCompare(right.image.name);
				case 'name-desc': return right.image.name.localeCompare(left.image.name);
				case 'added-asc': return left.image.addedAt - right.image.addedAt;
				case 'added-desc': return right.image.addedAt - left.image.addedAt;
			}
		});
	}

	private getAlbumReferences(album: GalleryAlbum): GalleryImageReference[] {
		return sortImages(album.images, this.document.layout.sort).map((image) => ({ albumId: album.id, albumName: album.name, image }));
	}

	private getAlbumCover(album: GalleryAlbum): GalleryImage | null {
		if (album.coverImageId) {
			const cover = album.images.find((image) => image.id === album.coverImageId);
			if (cover) return cover;
		}
		return sortImages(album.images, 'added-desc')[0] ?? null;
	}

	private disconnectObserver(): void {
		this.observer?.disconnect();
		this.observer = null;
	}
}

interface AlbumNameModalOptions { title: string; initialValue?: string; submitText: string; onSubmit: (name: string) => void; }
class AlbumNameModal extends Modal {
	constructor(app: App, private readonly options: AlbumNameModalOptions) { super(app); }
	onOpen(): void {
		this.contentEl.createEl('h2', { text: this.options.title });
		const input = this.contentEl.createEl('input', { cls: 'album-gallery-name-input', attr: { type: 'text', placeholder: 'Album name', maxlength: '80' } });
		input.value = this.options.initialValue ?? '';
		const error = this.contentEl.createDiv({ cls: 'album-gallery-name-error' });
		const actions = this.contentEl.createDiv({ cls: 'modal-button-container' });
		actions.createEl('button', { text: 'Cancel', attr: { type: 'button' } }).addEventListener('click', () => this.close());
		const submit = actions.createEl('button', { cls: 'mod-cta', text: this.options.submitText, attr: { type: 'button' } });
		const finish = (): void => { const name = input.value.trim(); if (!name) { error.setText('Enter an album name.'); input.focus(); return; } this.options.onSubmit(name); this.close(); };
		submit.addEventListener('click', finish);
		input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); finish(); } });
		window.setTimeout(() => { input.focus(); input.select(); }, 0);
	}
	onClose(): void { this.contentEl.empty(); }
}

interface ConfirmActionOptions { title: string; description: string; confirmText: string; onConfirm: () => Promise<void> | void; }
class ConfirmActionModal extends Modal {
	constructor(app: App, private readonly options: ConfirmActionOptions) { super(app); }
	onOpen(): void {
		this.contentEl.createEl('h2', { text: this.options.title });
		this.contentEl.createEl('p', { text: this.options.description });
		const actions = this.contentEl.createDiv({ cls: 'modal-button-container' });
		actions.createEl('button', { text: 'Cancel', attr: { type: 'button' } }).addEventListener('click', () => this.close());
		const confirm = actions.createEl('button', { cls: 'mod-warning', text: this.options.confirmText, attr: { type: 'button' } });
		confirm.addEventListener('click', async () => { confirm.disabled = true; await this.options.onConfirm(); this.close(); });
	}
	onClose(): void { this.contentEl.empty(); }
}

class ImageLightboxModal extends Modal {
	private imageElement: HTMLImageElement | null = null;
	private titleElement: HTMLElement | null = null;
	private subtitleElement: HTMLElement | null = null;
	private touchStartX: number | null = null;
	constructor(app: App, private references: GalleryImageReference[], private index: number, private readonly onRequestDelete: (reference: GalleryImageReference) => void) { super(app); }
	onOpen(): void {
		this.modalEl.addClass('album-gallery-lightbox-modal');
		const shell = this.contentEl.createDiv({ cls: 'album-gallery-lightbox' });
		const toolbar = shell.createDiv({ cls: 'album-gallery-lightbox-toolbar' });
		const titleGroup = toolbar.createDiv({ cls: 'album-gallery-lightbox-title-group' });
		this.titleElement = titleGroup.createDiv({ cls: 'album-gallery-lightbox-title' });
		this.subtitleElement = titleGroup.createDiv({ cls: 'album-gallery-lightbox-subtitle' });
		const deleteButton = toolbar.createEl('button', { cls: 'clickable-icon album-gallery-lightbox-delete', attr: { type: 'button', 'aria-label': 'Delete photo' } });
		setIcon(deleteButton, 'trash-2');
		deleteButton.addEventListener('click', () => { const reference = this.references[this.index]; if (reference) { this.close(); this.onRequestDelete(reference); } });
		const stage = shell.createDiv({ cls: 'album-gallery-lightbox-stage' });
		const previous = stage.createEl('button', { cls: 'clickable-icon album-gallery-lightbox-nav album-gallery-lightbox-previous', attr: { type: 'button', 'aria-label': 'Previous photo' } });
		setIcon(previous, 'chevron-left'); previous.addEventListener('click', () => this.move(-1));
		this.imageElement = stage.createEl('img', { attr: { alt: '' } });
		this.imageElement.addEventListener('touchstart', (event) => { this.touchStartX = event.changedTouches[0]?.clientX ?? null; }, { passive: true });
		this.imageElement.addEventListener('touchend', (event) => { const endX = event.changedTouches[0]?.clientX; if (this.touchStartX === null || endX === undefined) return; const delta = endX - this.touchStartX; this.touchStartX = null; if (Math.abs(delta) >= 50) this.move(delta > 0 ? -1 : 1); }, { passive: true });
		const next = stage.createEl('button', { cls: 'clickable-icon album-gallery-lightbox-nav album-gallery-lightbox-next', attr: { type: 'button', 'aria-label': 'Next photo' } });
		setIcon(next, 'chevron-right'); next.addEventListener('click', () => this.move(1));
		this.scope.register([], 'ArrowLeft', () => { this.move(-1); return false; });
		this.scope.register([], 'ArrowRight', () => { this.move(1); return false; });
		this.updateImage();
	}
	onClose(): void { this.imageElement = null; this.titleElement = null; this.subtitleElement = null; this.contentEl.empty(); }
	private move(direction: number): void { if (this.references.length === 0) return; this.index = (this.index + direction + this.references.length) % this.references.length; this.updateImage(); }
	private updateImage(): void {
		const reference = this.references[this.index];
		if (!reference || !this.imageElement || !this.titleElement || !this.subtitleElement) return;
		const file = this.app.vault.getFileByPath(reference.image.path);
		if (file) this.imageElement.src = this.app.vault.getResourcePath(file); else this.imageElement.removeAttribute('src');
		this.imageElement.alt = reference.image.name;
		this.titleElement.setText(reference.image.name);
		this.subtitleElement.setText(`${reference.albumName} · ${this.index + 1} of ${this.references.length}`);
	}
}
