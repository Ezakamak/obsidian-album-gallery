'use strict';

module.exports = function installGalleryMediaRuntime(pluginClass) {
	if (!pluginClass || pluginClass.prototype.__albumGalleryMediaEntrypointInstalled) return;
	const { Modal, Notice, setIcon } = require('obsidian');
	const GALLERY_VIEW_TYPE = 'album-gallery-view';
	const STUDY_ALBUM_KIND = 'ekatech-study-mistakes';
	const STUDY_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
	const STANDARD_MEDIA_ACCEPT = 'image/*,video/mp4,video/quicktime,video/webm,.heic,.heif,.tif,.tiff,.mp4,.mov,.webm';
	const STUDY_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif';
	const IMAGE_EXTENSIONS = new Set(['avif', 'bmp', 'gif', 'heic', 'heif', 'jpeg', 'jpg', 'png', 'svg', 'tif', 'tiff', 'webp']);
	const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm']);
	const MEDIA_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS]);

	function extensionOf(name) {
		return String(name || '').toLowerCase().split('.').pop() || '';
	}

	function isVideo(image) {
		return VIDEO_EXTENSIONS.has(extensionOf(image && (image.name || image.path)));
	}

	function mimeTypeForStudyImage(filename) {
		const map = { heic: 'image/heic', heif: 'image/heif', jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
		return map[extensionOf(filename)] || 'application/octet-stream';
	}

	function isStudyCloudImage(filename, mimeType = '') {
		const resolved = String(mimeType || '').toLowerCase() || mimeTypeForStudyImage(filename);
		return resolved === 'image/jpeg'
			|| resolved === 'image/png'
			|| resolved === 'image/webp'
			|| resolved === 'image/heic'
			|| resolved === 'image/heif';
	}

	function createGalleryImage(path, name) {
		return {
			id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
			path,
			name,
			addedAt: Date.now(),
		};
	}

	function mediaCountLabel(count) {
		return `${count} ${count === 1 ? 'item' : 'items'}`;
	}

	function photoCountLabel(count) {
		return `${count} ${count === 1 ? 'photo' : 'photos'}`;
	}

	function createVideoPreview(view, container, image, alt) {
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

	function updateMediaLanguage(view) {
		const activeAlbum = view.activeAlbumId
			? view.document.albums.find((album) => album.id === view.activeAlbumId)
			: undefined;
		if (!activeAlbum) {
			const visibleAlbums = view.getVisibleAlbums();
			const allMedia = view.getAllImages();
			const summary = view.contentEl.querySelector('.album-gallery-library-summary');
			if (summary) summary.setText(`${mediaCountLabel(allMedia.length)} · ${visibleAlbums.length} ${visibleAlbums.length === 1 ? 'album' : 'albums'}`);
			const firstTabLabel = view.contentEl.querySelector('.album-gallery-tab-label');
			if (firstTabLabel) firstTabLabel.setText('Media');
			const sectionHeading = view.contentEl.querySelector('.album-gallery-section-heading h2');
			if (sectionHeading && sectionHeading.textContent === 'Photos') sectionHeading.setText('Media');
			const emptyTitle = view.contentEl.querySelector('.album-gallery-empty h2');
			const emptyDescription = view.contentEl.querySelector('.album-gallery-empty p');
			if (emptyTitle && emptyTitle.textContent === 'No photos yet') emptyTitle.setText('No media yet');
			if (emptyDescription && emptyDescription.textContent && emptyDescription.textContent.includes('choose photos')) {
				emptyDescription.setText('Create an album, then choose photos, animated GIFs, or videos. Album Gallery stores them automatically inside the vault.');
			}
			const cards = Array.from(view.contentEl.querySelectorAll('.album-gallery-album-card'));
			for (const [index, card] of cards.entries()) {
				const album = visibleAlbums[index];
				const count = card.querySelector('.album-gallery-album-count');
				if (!album || !count) continue;
				count.setText(album.kind === STUDY_ALBUM_KIND ? photoCountLabel(album.images.length) : mediaCountLabel(album.images.length));
			}
			return;
		}

		const isStudyAlbum = activeAlbum.kind === STUDY_ALBUM_KIND;
		const summary = view.contentEl.querySelector('.album-gallery-library-summary');
		if (summary) summary.setText(isStudyAlbum ? photoCountLabel(activeAlbum.images.length) : mediaCountLabel(activeAlbum.images.length));
		if (isStudyAlbum) return;
		const addButton = view.contentEl.querySelector('.album-gallery-add-photos-button');
		if (addButton) addButton.setAttr('aria-label', 'Add media');
		const addLabel = addButton && addButton.querySelector('span');
		if (addLabel) addLabel.setText('Add media');
		const importing = view.contentEl.querySelector('.album-gallery-importing span');
		if (importing) importing.setText('Importing media…');
		const emptyTitle = view.contentEl.querySelector('.album-gallery-empty h2');
		const emptyDescription = view.contentEl.querySelector('.album-gallery-empty p');
		const emptyAction = view.contentEl.querySelector('.album-gallery-empty-button');
		if (emptyTitle && emptyTitle.textContent === 'Add photos to this album') emptyTitle.setText('Add media to this album');
		if (emptyDescription && emptyDescription.textContent && emptyDescription.textContent.includes('Choose one or many photos')) {
			emptyDescription.setText('Choose photos, animated GIFs, MP4/MOV videos, or WebM videos. The plugin creates and manages the storage folder automatically.');
		}
		if (emptyAction && emptyAction.textContent === 'Add photos') emptyAction.setText('Add media');
	}

	class ConfirmMediaDeleteModal extends Modal {
		constructor(app, reference, onConfirm) {
			super(app);
			this.reference = reference;
			this.onConfirm = onConfirm;
		}
		onOpen() {
			const label = isVideo(this.reference.image) ? 'video' : 'media item';
			this.contentEl.createEl('h2', { text: `Delete ${label}?` });
			this.contentEl.createEl('p', { text: 'This managed file will be deleted from the vault.' });
			const actions = this.contentEl.createDiv({ cls: 'modal-button-container' });
			actions.createEl('button', { text: 'Cancel', attr: { type: 'button' } }).addEventListener('click', () => this.close());
			const confirm = actions.createEl('button', { cls: 'mod-warning', text: 'Delete', attr: { type: 'button' } });
			confirm.addEventListener('click', async () => {
				confirm.disabled = true;
				await this.onConfirm();
				this.close();
			});
		}
		onClose() { this.contentEl.empty(); }
	}

	class GalleryMediaLightboxModal extends Modal {
		constructor(app, references, index, onRequestDelete) {
			super(app);
			this.references = references;
			this.index = index;
			this.onRequestDelete = onRequestDelete;
			this.mediaHost = null;
			this.activeVideo = null;
			this.titleElement = null;
			this.subtitleElement = null;
			this.touchStartX = null;
		}
		onOpen() {
			this.modalEl.addClass('album-gallery-lightbox-modal');
			const shell = this.contentEl.createDiv({ cls: 'album-gallery-lightbox' });
			const toolbar = shell.createDiv({ cls: 'album-gallery-lightbox-toolbar' });
			const titleGroup = toolbar.createDiv({ cls: 'album-gallery-lightbox-title-group' });
			this.titleElement = titleGroup.createDiv({ cls: 'album-gallery-lightbox-title' });
			this.subtitleElement = titleGroup.createDiv({ cls: 'album-gallery-lightbox-subtitle' });
			const deleteButton = toolbar.createEl('button', {
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
			const stage = shell.createDiv({ cls: 'album-gallery-lightbox-stage album-gallery-media-lightbox-stage' });
			const previous = stage.createEl('button', {
				cls: 'clickable-icon album-gallery-lightbox-nav album-gallery-lightbox-previous',
				attr: { type: 'button', 'aria-label': 'Previous media item' },
			});
			setIcon(previous, 'chevron-left');
			previous.addEventListener('click', () => this.move(-1));
			this.mediaHost = stage.createDiv({ cls: 'album-gallery-lightbox-media-host' });
			this.mediaHost.addEventListener('touchstart', (event) => {
				this.touchStartX = event.changedTouches[0] ? event.changedTouches[0].clientX : null;
			}, { passive: true });
			this.mediaHost.addEventListener('touchend', (event) => {
				const endX = event.changedTouches[0] && event.changedTouches[0].clientX;
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
		onClose() {
			this.releaseVideo();
			this.mediaHost = null;
			this.titleElement = null;
			this.subtitleElement = null;
			this.contentEl.empty();
		}
		move(direction) {
			if (this.references.length === 0) return;
			this.index = (this.index + direction + this.references.length) % this.references.length;
			this.updateMedia();
		}
		updateMedia() {
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
		releaseVideo() {
			if (!this.activeVideo) return;
			this.activeVideo.pause();
			this.activeVideo.removeAttribute('src');
			this.activeVideo.load();
			this.activeVideo = null;
		}
	}

	function installView(view) {
		if (!view || view.__albumGalleryMediaSupportInstalled) return;
		view.__albumGalleryMediaSupportInstalled = true;
		const originalRender = view.render.bind(view);
		const originalRenderImageElement = view.renderImageElement.bind(view);
		const originalConfirmDeleteImage = view.confirmDeleteImage.bind(view);

		view.renderImageElement = (container, image, alt) => {
			if (isVideo(image)) return createVideoPreview(view, container, image, alt);
			return originalRenderImageElement(container, image, alt);
		};

		view.renderPhotoGrid = (container, references) => {
			const grid = container.createDiv({ cls: 'album-gallery-photo-grid' });
			for (const [index, reference] of references.entries()) {
				const button = grid.createEl('button', {
					cls: `album-gallery-photo-card${isVideo(reference.image) ? ' is-video' : ''}`,
					attr: { type: 'button', 'aria-label': reference.image.name },
				});
				view.renderImageElement(button, reference.image, reference.image.name);
				if (reference.image.study) view.renderStudySyncBadge(button, reference.image);
				button.addEventListener('click', () => {
					new GalleryMediaLightboxModal(view.app, references, index, (selected) => view.confirmDeleteImage(selected)).open();
				});
			}
		};

		view.openPhotoPicker = (albumId) => {
			const album = view.document.albums.find((candidate) => candidate.id === albumId);
			if (!album) return;
			const accept = album.kind === STUDY_ALBUM_KIND ? STUDY_PHOTO_ACCEPT : STANDARD_MEDIA_ACCEPT;
			const input = view.contentEl.createEl('input', {
				cls: 'album-gallery-file-input',
				attr: { type: 'file', accept, multiple: 'true' },
			});
			input.addEventListener('change', () => {
				void view.importSelectedFiles(albumId, Array.from(input.files || []));
				input.remove();
			}, { once: true });
			input.click();
		};

		view.importSelectedFiles = async (albumId, files) => {
			const album = view.document.albums.find((candidate) => candidate.id === albumId);
			if (!album || files.length === 0) return;
			const isStudyAlbum = album.kind === STUDY_ALBUM_KIND;
			view.importingAlbumId = albumId;
			view.render();
			let imported = 0;
			try {
				for (const file of files) {
					const extension = extensionOf(file.name);
					if (isStudyAlbum) {
						if (!isStudyCloudImage(file.name, file.type)) {
							new Notice(`${file.name} eklenmedi. Hata Defteri yalnızca JPG, PNG, WebP, HEIC veya HEIF fotoğraf kabul eder; GIF ve video kabul etmez.`);
							continue;
						}
						if (file.size > STUDY_MAX_IMAGE_BYTES) {
							new Notice(`${file.name} eklenmedi. Hata Defteri fotoğrafı 10 MB sınırını aşıyor.`);
							continue;
						}
					} else if (!MEDIA_EXTENSIONS.has(extension)) {
						new Notice(`${file.name} desteklenmiyor. Normal albümlere fotoğraf, animasyonlu GIF, MP4/MOV veya WebM video eklenebilir.`);
						continue;
					}
					try {
						const targetFolder = await view.ensureAlbumAssetFolder(album.id);
						const path = view.findAvailableAssetPath(targetFolder, file.name);
						await view.app.vault.createBinary(path, await file.arrayBuffer());
						const image = createGalleryImage(path, file.name);
						if (isStudyAlbum) {
							const defaults = view.plugin.getEkatechStudyDefaults();
							const accountId = view.plugin.ekatechStudyAccountId;
							if (!defaults || !accountId) {
								const created = view.app.vault.getFileByPath(path);
								if (created) await view.app.fileManager.trashFile(created);
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
				if (imported > 0) view.requestSave();
			} finally {
				view.importingAlbumId = null;
				view.render();
			}
			if (isStudyAlbum && imported > 0) void view.syncPendingStudyImages(true);
		};

		view.confirmDeleteImage = (reference) => {
			if (reference.image.study) {
				originalConfirmDeleteImage(reference);
				return;
			}
			new ConfirmMediaDeleteModal(view.app, reference, async () => view.deleteImage(reference)).open();
		};

		view.render = () => {
			originalRender();
			updateMediaLanguage(view);
		};
	}

	const originalOnload = pluginClass.prototype.onload;
	pluginClass.prototype.__albumGalleryMediaEntrypointInstalled = true;
	pluginClass.prototype.onload = async function (...args) {
		const originalRegisterView = this.registerView.bind(this);
		this.registerView = (type, viewCreator) => originalRegisterView(type, (leaf) => {
			const view = viewCreator(leaf);
			if (type === GALLERY_VIEW_TYPE) installView(view);
			return view;
		});
		try {
			return await originalOnload.apply(this, args);
		} finally {
			this.registerView = originalRegisterView;
		}
	};
};
