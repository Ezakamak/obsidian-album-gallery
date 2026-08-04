import {
	App,
	Modal,
	Notice,
	TFolder,
	setIcon,
} from 'obsidian';
import type { AlbumGalleryView } from './gallery-view';
import {
	EKATECH_STUDY_ALBUM_KIND,
	EKATECH_STUDY_MAX_IMAGE_BYTES,
	isStudyCloudImage,
} from './ekatech-study';
import {
	createGalleryImage,
	type GalleryAlbum,
	type GalleryDocument,
	type GalleryImage,
} from './model';

const STANDARD_MEDIA_ACCEPT = 'image/*,video/mp4,video/quicktime,video/webm,.heic,.heif,.tif,.tiff,.mp4,.mov,.webm';
const STUDY_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif';
const SUPPORTED_IMAGE_EXTENSIONS = new Set([
	'avif', 'bmp', 'gif', 'heic', 'heif', 'jpeg', 'jpg', 'png', 'svg', 'tif', 'tiff', 'webp',
]);
const SUPPORTED_VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm']);
const SUPPORTED_MEDIA_EXTENSIONS = new Set([...SUPPORTED_IMAGE_EXTENSIONS, ...SUPPORTED_VIDEO_EXTENSIONS]);

interface GalleryMediaReference {
	albumId: string;
	albumName: string;
	image: GalleryImage;
}

interface MediaGalleryView {
	app: App;
	contentEl: HTMLElement;
	document: GalleryDocument;
	activeAlbumId: string | null;
	importingAlbumId: string | null;
	plugin: {
		ekatechStudyAccountId: string | null;
		getEkatechStudyDefaults(): GalleryImage['study'] | null;
	};
	render(): void;
	requestSave(): void;
	ensureAlbumAssetFolder(albumId: string): Promise<TFolder>;
	findAvailableAssetPath(folder: TFolder, filename: string): string;
	syncPendingStudyImages(force: boolean): Promise<void>;
	renderStudySyncBadge(container: HTMLElement, image: GalleryImage): void;
	confirmDeleteImage(reference: GalleryMediaReference): void;
	deleteImage(reference: GalleryMediaReference): Promise<void>;
	getVisibleAlbums(): GalleryAlbum[];
	getAllImages(): GalleryMediaReference[];
	openPhotoPicker(albumId: string): void;
	importSelectedFiles(albumId: string, files: File[]): Promise<void>;
	renderImageElement(container: HTMLElement, image: GalleryImage, alt: string): HTMLElement;
	renderPhotoGrid(container: HTMLElement, references: GalleryMediaReference[]): void;
}

function extensionOf(name: string): string {
	return name.toLowerCase().split('.').pop() ?? '';
}

function isVideo(image: GalleryImage): boolean {
	return SUPPORTED_VIDEO_EXTENSIONS.has(extensionOf(image.name || image.path));
}

function mediaCountLabel(count: number): string {
	return `${count} ${count === 1 ? 'item' : 'items'}`;
}

function photoCountLabel(count: number): string {
	return `${count} ${count === 1 ? 'photo' : 'photos'}`;
}

function createVideoPreview(view: MediaGalleryView, container: HTMLElement, image: GalleryImage, alt: string): HTMLVideoElement {
	const video = container.createEl('video', {
		cls: 'album-gallery-media-video',
		attr: {
			'aria-label': alt || image.name,
			muted: 'true',
			playsinline: 'true',
			preload: 'metadata',
			tabindex: '-1',
		},
	});
	video.muted = true;
	video.playsInline = true;
	video.controls = false;
	video.disablePictureInPicture = true;
	const file = view.app.vault.getFileByPath(image.path);
	if (file) video.src = view.app.vault.getResourcePath(file);
	else video.addClass('is-broken');
	const badge = container.createDiv({ cls: 'album-gallery-video-badge', attr: { 'aria-hidden': 'true' } });
	setIcon(badge, 'play');
	return video;
}

function updateMediaLanguage(view: MediaGalleryView): void {
	const activeAlbum = view.activeAlbumId
		? view.document.albums.find((album) => album.id === view.activeAlbumId)
		: undefined;
	if (!activeAlbum) {
		const visibleAlbums = view.getVisibleAlbums();
		const allMedia = view.getAllImages();
		const summary = view.contentEl.querySelector<HTMLElement>('.album-gallery-library-summary');
		if (summary) summary.setText(`${mediaCountLabel(allMedia.length)} · ${visibleAlbums.length} ${visibleAlbums.length === 1 ? 'album' : 'albums'}`);
		const firstTabLabel = view.contentEl.querySelector<HTMLElement>('.album-gallery-tab-label');
		if (firstTabLabel) firstTabLabel.setText('Media');
		const sectionHeading = view.contentEl.querySelector<HTMLElement>('.album-gallery-section-heading h2');
		if (sectionHeading?.textContent === 'Photos') sectionHeading.setText('Media');
		const emptyTitle = view.contentEl.querySelector<HTMLElement>('.album-gallery-empty h2');
		const emptyDescription = view.contentEl.querySelector<HTMLElement>('.album-gallery-empty p');
		if (emptyTitle?.textContent === 'No photos yet') emptyTitle.setText('No media yet');
		if (emptyDescription?.textContent?.includes('choose photos')) {
			emptyDescription.setText('Create an album, then choose photos, animated gifs, or videos. Album gallery stores them automatically inside the vault.');
		}
		const cards = Array.from(view.contentEl.querySelectorAll<HTMLElement>('.album-gallery-album-card'));
		for (const [index, card] of cards.entries()) {
			const album = visibleAlbums[index];
			const count = card.querySelector<HTMLElement>('.album-gallery-album-count');
			if (!album || !count) continue;
			count.setText(album.kind === EKATECH_STUDY_ALBUM_KIND ? photoCountLabel(album.images.length) : mediaCountLabel(album.images.length));
		}
		return;
	}

	const isStudyAlbum = activeAlbum.kind === EKATECH_STUDY_ALBUM_KIND;
	const summary = view.contentEl.querySelector<HTMLElement>('.album-gallery-library-summary');
	if (summary) summary.setText(isStudyAlbum ? photoCountLabel(activeAlbum.images.length) : mediaCountLabel(activeAlbum.images.length));
	if (isStudyAlbum) return;

	const addButton = view.contentEl.querySelector<HTMLElement>('.album-gallery-add-photos-button');
	addButton?.setAttr('aria-label', 'Add media');
	const addLabel = addButton?.querySelector<HTMLElement>('span');
	if (addLabel) addLabel.setText('Add media');
	const importing = view.contentEl.querySelector<HTMLElement>('.album-gallery-importing span');
	if (importing) importing.setText('Importing media…');
	const emptyTitle = view.contentEl.querySelector<HTMLElement>('.album-gallery-empty h2');
	const emptyDescription = view.contentEl.querySelector<HTMLElement>('.album-gallery-empty p');
	const emptyAction = view.contentEl.querySelector<HTMLElement>('.album-gallery-empty-button');
	if (emptyTitle?.textContent === 'Add photos to this album') emptyTitle.setText('Add media to this album');
	if (emptyDescription?.textContent?.includes('Choose one or many photos')) {
		emptyDescription.setText('Choose photos, animated gifs, mp4/mov videos, or webm videos. The plugin creates and manages the storage folder automatically.');
	}
	if (emptyAction?.textContent === 'Add photos') emptyAction.setText('Add media');
}

export function installGalleryMediaSupport(view: AlbumGalleryView): void {
	const target = view as unknown as MediaGalleryView;
	const originalRender = target.render.bind(target);
	const originalRenderImageElement = target.renderImageElement.bind(target);
	const originalConfirmDeleteImage = target.confirmDeleteImage.bind(target);

	target.renderImageElement = (container, image, alt) => {
		if (isVideo(image)) return createVideoPreview(target, container, image, alt);
		return originalRenderImageElement(container, image, alt);
	};

	target.renderPhotoGrid = (container, references) => {
		const grid = container.createDiv({ cls: 'album-gallery-photo-grid' });
		for (const [index, reference] of references.entries()) {
			const button = grid.createEl('button', {
				cls: `album-gallery-photo-card${isVideo(reference.image) ? ' is-video' : ''}`,
				attr: { type: 'button', 'aria-label': reference.image.name },
			});
			target.renderImageElement(button, reference.image, reference.image.name);
			if (reference.image.study) target.renderStudySyncBadge(button, reference.image);
			button.addEventListener('click', () => {
				new GalleryMediaLightboxModal(target.app, references, index, (selected) => target.confirmDeleteImage(selected)).open();
			});
		}
	};

	target.openPhotoPicker = (albumId) => {
		const album = target.document.albums.find((candidate) => candidate.id === albumId);
		if (!album) return;
		const accept = album.kind === EKATECH_STUDY_ALBUM_KIND ? STUDY_PHOTO_ACCEPT : STANDARD_MEDIA_ACCEPT;
		const input = target.contentEl.createEl('input', {
			cls: 'album-gallery-file-input',
			attr: { type: 'file', accept, multiple: 'true' },
		});
		input.addEventListener('change', () => {
			void target.importSelectedFiles(albumId, Array.from(input.files ?? []));
			input.remove();
		}, { once: true });
		input.click();
	};

	target.importSelectedFiles = async (albumId, files) => {
		const album = target.document.albums.find((candidate) => candidate.id === albumId);
		if (!album || files.length === 0) return;
		const isStudyAlbum = album.kind === EKATECH_STUDY_ALBUM_KIND;
		target.importingAlbumId = albumId;
		target.render();
		let imported = 0;
		try {
			for (const file of files) {
				const extension = extensionOf(file.name);
				if (isStudyAlbum) {
					if (!isStudyCloudImage(file.name, file.type)) {
						new Notice(`${file.name} eklenmedi. Hata Defteri yalnızca JPG, PNG, WebP, HEIC veya HEIF fotoğraf kabul eder; GIF ve video kabul etmez.`);
						continue;
					}
					if (file.size > EKATECH_STUDY_MAX_IMAGE_BYTES) {
						new Notice(`${file.name} eklenmedi. Hata Defteri fotoğrafı 10 MB sınırını aşıyor.`);
						continue;
					}
				} else if (!SUPPORTED_MEDIA_EXTENSIONS.has(extension)) {
					new Notice(`${file.name} desteklenmiyor. Normal albümlere fotoğraf, animasyonlu GIF, MP4/MOV veya WebM video eklenebilir.`);
					continue;
				}

				try {
					const targetFolder = await target.ensureAlbumAssetFolder(album.id);
					const path = target.findAvailableAssetPath(targetFolder, file.name);
					await target.app.vault.createBinary(path, await file.arrayBuffer());
					const image = createGalleryImage(path, file.name);
					if (isStudyAlbum) {
						const defaults = target.plugin.getEkatechStudyDefaults();
						const accountId = target.plugin.ekatechStudyAccountId;
						if (!defaults || !accountId) {
							const created = target.app.vault.getFileByPath(path);
							if (created) await target.app.fileManager.trashFile(created);
							new Notice('Study hesabı bağlı olmadığı için fotoğraf eklenmedi.');
							continue;
						}
						image.study = { ...defaults, accountId, syncState: 'pending' };
					}
					album.images.push(image);
					imported += 1;
				} catch (error) {
					console.error('Album Gallery media import failed', error);
					new Notice(`${file.name} içe aktarılamadı.`);
				}
			}
			album.updatedAt = Date.now();
			if (imported > 0) target.requestSave();
		} finally {
			target.importingAlbumId = null;
			target.render();
		}
		if (isStudyAlbum && imported > 0) void target.syncPendingStudyImages(true);
	};

	target.confirmDeleteImage = (reference) => {
		if (reference.image.study) {
			originalConfirmDeleteImage(reference);
			return;
		}
		new ConfirmMediaDeleteModal(target.app, reference, async () => target.deleteImage(reference)).open();
	};

	target.render = () => {
		originalRender();
		updateMediaLanguage(target);
	};
}

class ConfirmMediaDeleteModal extends Modal {
	constructor(
		app: App,
		private readonly reference: GalleryMediaReference,
		private readonly onConfirm: () => Promise<void>,
	) {
		super(app);
	}

	onOpen(): void {
		const label = isVideo(this.reference.image) ? 'video' : 'media item';
		this.contentEl.createEl('h2', { text: `Delete ${label}?` });
		this.contentEl.createEl('p', { text: 'This managed file will be deleted from the vault.' });
		const actions = this.contentEl.createDiv({ cls: 'modal-button-container' });
		actions.createEl('button', { text: 'Cancel', attr: { type: 'button' } }).addEventListener('click', () => this.close());
		const confirm = actions.createEl('button', { cls: 'mod-warning', text: 'Delete', attr: { type: 'button' } });
		confirm.addEventListener('click', () => { void (async () => {
			confirm.disabled = true;
			await this.onConfirm();
			this.close();
		})(); });
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

class GalleryMediaLightboxModal extends Modal {
	private mediaHost: HTMLElement | null = null;
	private activeVideo: HTMLVideoElement | null = null;
	private titleElement: HTMLElement | null = null;
	private subtitleElement: HTMLElement | null = null;
	private touchStartX: number | null = null;
	private nativeCloseObserver: MutationObserver | null = null;

	constructor(
		app: App,
		private readonly references: GalleryMediaReference[],
		private index: number,
		private readonly onRequestDelete: (reference: GalleryMediaReference) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass('album-gallery-lightbox-modal');
		this.containerEl.addClass('album-gallery-lightbox-container');
		this.removeNativeCloseControl();
		this.nativeCloseObserver = new MutationObserver(() => this.removeNativeCloseControl());
		this.nativeCloseObserver.observe(this.containerEl, { childList: true, subtree: true });
		window.requestAnimationFrame(() => this.removeNativeCloseControl());
		const shell = this.contentEl.createDiv({ cls: 'album-gallery-lightbox' });
		const toolbar = shell.createDiv({ cls: 'album-gallery-lightbox-toolbar' });
		const titleGroup = toolbar.createDiv({ cls: 'album-gallery-lightbox-title-group' });
		this.titleElement = titleGroup.createDiv({ cls: 'album-gallery-lightbox-title' });
		this.subtitleElement = titleGroup.createDiv({ cls: 'album-gallery-lightbox-subtitle' });
		const toolbarActions = toolbar.createDiv({ cls: 'album-gallery-lightbox-actions' });
		const deleteButton = toolbarActions.createEl('button', {
			cls: 'clickable-icon album-gallery-lightbox-delete',
			attr: { type: 'button', 'aria-label': 'Delete media item' },
		});
		setIcon(deleteButton, 'trash-2');
		deleteButton.addEventListener('click', () => {
			const reference = this.references[this.index];
			if (!reference) return;
			this.close();
			this.onRequestDelete(reference);
		});
		const closeButton = toolbarActions.createEl('button', {
			cls: 'clickable-icon album-gallery-lightbox-close',
			attr: { type: 'button', 'aria-label': 'Close media viewer' },
		});
		setIcon(closeButton, 'x');
		closeButton.addEventListener('click', () => this.close());

		const stage = shell.createDiv({ cls: 'album-gallery-lightbox-stage album-gallery-media-lightbox-stage' });
		const previous = stage.createEl('button', {
			cls: 'clickable-icon album-gallery-lightbox-nav album-gallery-lightbox-previous',
			attr: { type: 'button', 'aria-label': 'Previous media item' },
		});
		setIcon(previous, 'chevron-left');
		previous.addEventListener('click', () => this.move(-1));
		this.mediaHost = stage.createDiv({ cls: 'album-gallery-lightbox-media-host' });
		this.mediaHost.addEventListener('touchstart', (event) => {
			this.touchStartX = event.changedTouches[0]?.clientX ?? null;
		}, { passive: true });
		this.mediaHost.addEventListener('touchend', (event) => {
			const endX = event.changedTouches[0]?.clientX;
			if (this.touchStartX === null || endX === undefined) return;
			const delta = endX - this.touchStartX;
			this.touchStartX = null;
			if (Math.abs(delta) >= 50) this.move(delta > 0 ? -1 : 1);
		}, { passive: true });
		const next = stage.createEl('button', {
			cls: 'clickable-icon album-gallery-lightbox-nav album-gallery-lightbox-next',
			attr: { type: 'button', 'aria-label': 'Next media item' },
		});
		setIcon(next, 'chevron-right');
		next.addEventListener('click', () => this.move(1));
		this.scope.register([], 'ArrowLeft', () => { this.move(-1); return false; });
		this.scope.register([], 'ArrowRight', () => { this.move(1); return false; });
		this.updateMedia();
	}

	onClose(): void {
		this.nativeCloseObserver?.disconnect();
		this.nativeCloseObserver = null;
		this.releaseVideo();
		this.mediaHost = null;
		this.titleElement = null;
		this.subtitleElement = null;
		this.contentEl.empty();
	}

	private move(direction: number): void {
		if (this.references.length === 0) return;
		this.index = (this.index + direction + this.references.length) % this.references.length;
		this.updateMedia();
	}

	private updateMedia(): void {
		const reference = this.references[this.index];
		if (!reference || !this.mediaHost || !this.titleElement || !this.subtitleElement) return;
		this.releaseVideo();
		this.mediaHost.empty();
		const file = this.app.vault.getFileByPath(reference.image.path);
		if (!file) {
			const missing = this.mediaHost.createDiv({ cls: 'album-gallery-missing-photo' });
			setIcon(missing, 'file-question');
		} else if (isVideo(reference.image)) {
			const video = this.mediaHost.createEl('video', {
				cls: 'album-gallery-lightbox-video',
				attr: { controls: 'true', playsinline: 'true', preload: 'metadata' },
			});
			video.controls = true;
			video.playsInline = true;
			video.preload = 'metadata';
			video.src = this.app.vault.getResourcePath(file);
			this.activeVideo = video;
		} else {
			const image = this.mediaHost.createEl('img', { attr: { alt: reference.image.name } });
			image.src = this.app.vault.getResourcePath(file);
		}
		this.titleElement.setText(reference.image.name);
		this.subtitleElement.setText(`${reference.albumName} · ${this.index + 1} of ${this.references.length}`);
	}

	private removeNativeCloseControl(): void {
		this.containerEl.querySelectorAll<HTMLElement>('.modal-close-button')
			.forEach((closeButton) => closeButton.remove());
	}

	private releaseVideo(): void {
		if (!this.activeVideo) return;
		this.activeVideo.pause();
		this.activeVideo.removeAttribute('src');
		this.activeVideo.load();
		this.activeVideo = null;
	}
}
