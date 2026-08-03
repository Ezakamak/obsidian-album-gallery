import {
	App,
	Modal,
	Notice,
	TFile,
	TFolder,
	TextFileView,
	WorkspaceLeaf,
	setIcon,
} from 'obsidian';
import { GALLERY_VIEW_TYPE, SUPPORTED_IMAGE_EXTENSIONS } from './constants';
import { FolderSuggestModal } from './folder-suggest';
import {
	GalleryAlbum,
	GalleryDocument,
	createAlbumId,
	createGalleryDocument,
	parseGalleryDocument,
	serializeGalleryDocument,
} from './model';
import type AlbumGalleryPlugin from './main';

export class AlbumGalleryView extends TextFileView {
	private readonly plugin: AlbumGalleryPlugin;
	private document: GalleryDocument = createGalleryDocument('Untitled gallery');
	private activeAlbumId: string | null = null;
	private observer: IntersectionObserver | null = null;
	private refreshTimer: number | null = null;
	private readonly assetCache = new Map<string, TFile[]>();

	constructor(leaf: WorkspaceLeaf, plugin: AlbumGalleryPlugin) {
		super(leaf);
		this.plugin = plugin;
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
		this.document = parseGalleryDocument(data, this.file?.basename ?? 'Untitled gallery');
		this.render();
	}

	clear(): void {
		this.disconnectObserver();
		this.assetCache.clear();
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
		this.assetCache.clear();
		if (this.refreshTimer !== null) {
			window.clearTimeout(this.refreshTimer);
		}
		this.refreshTimer = window.setTimeout(() => {
			this.refreshTimer = null;
			this.render();
		}, 150);
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
		this.renderAlbumOverview();
	}

	private renderAlbumOverview(): void {
		const header = this.contentEl.createDiv({ cls: 'album-gallery-header' });
		const heading = header.createDiv({ cls: 'album-gallery-heading' });
		heading.createEl('h2', { text: this.document.title });
		heading.createDiv({
			cls: 'album-gallery-subtitle',
			text: `${this.document.albums.length} ${this.document.albums.length === 1 ? 'album' : 'albums'}`,
		});

		const addButton = header.createEl('button', {
			cls: 'mod-cta album-gallery-action-button',
			attr: { type: 'button' },
		});
		setIcon(addButton, 'folder-plus');
		addButton.createSpan({ text: 'Add album' });
		addButton.addEventListener('click', () => this.openFolderPicker());

		if (this.document.albums.length === 0) {
			const empty = this.contentEl.createDiv({ cls: 'album-gallery-empty' });
			const icon = empty.createDiv({ cls: 'album-gallery-empty-icon' });
			setIcon(icon, 'images');
			empty.createEl('h3', { text: 'No albums yet' });
			empty.createEl('p', {
				text: 'Add a folder. The folder stays in your vault and appears here as an album.',
			});
			const emptyButton = empty.createEl('button', {
				cls: 'mod-cta',
				text: 'Choose a folder',
				attr: { type: 'button' },
			});
			emptyButton.addEventListener('click', () => this.openFolderPicker());
			return;
		}

		const grid = this.contentEl.createDiv({ cls: 'album-gallery-album-grid' });
		for (const album of this.document.albums) {
			this.renderAlbumCard(grid, album);
		}
	}

	private renderAlbumCard(container: HTMLElement, album: GalleryAlbum): void {
		const folder = this.app.vault.getFolderByPath(album.folderPath);
		const images = folder ? this.getAlbumImages(folder) : [];
		const card = container.createDiv({ cls: 'album-gallery-album-card' });
		card.setAttr('role', 'button');
		card.setAttr('tabindex', '0');

		const media = card.createDiv({ cls: 'album-gallery-album-cover' });
		const cover = this.resolveCover(album, images);
		if (cover) {
			const image = media.createEl('img', {
				attr: {
					alt: '',
					loading: 'lazy',
					decoding: 'async',
				},
			});
			image.src = this.app.vault.getResourcePath(cover);
		} else {
			const icon = media.createDiv({ cls: 'album-gallery-cover-placeholder' });
			setIcon(icon, folder ? 'image-off' : 'folder-x');
		}

		const overlay = media.createDiv({ cls: 'album-gallery-card-overlay' });
		const removeButton = overlay.createEl('button', {
			cls: 'clickable-icon',
			attr: {
				type: 'button',
				'aria-label': `Remove ${album.name} from gallery`,
			},
		});
		setIcon(removeButton, 'trash-2');
		removeButton.addEventListener('click', (event) => {
			event.stopPropagation();
			new RemoveAlbumModal(this.app, album.name, () => this.removeAlbum(album.id)).open();
		});

		const body = card.createDiv({ cls: 'album-gallery-album-body' });
		body.createEl('h3', { text: album.name });
		body.createDiv({
			cls: 'album-gallery-album-meta',
			text: folder
				? `${images.length} ${images.length === 1 ? 'image' : 'images'}`
				: 'Folder not found',
		});
		body.createDiv({ cls: 'album-gallery-album-path', text: album.folderPath });

		const open = (): void => {
			if (!folder) {
				new Notice(`Folder not found: ${album.folderPath}`);
				return;
			}
			this.activeAlbumId = album.id;
			this.render();
		};
		card.addEventListener('click', open);
		card.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				open();
			}
		});
	}

	private renderAlbum(album: GalleryAlbum): void {
		const folder = this.app.vault.getFolderByPath(album.folderPath);
		const header = this.contentEl.createDiv({ cls: 'album-gallery-header album-gallery-album-header' });
		const titleRow = header.createDiv({ cls: 'album-gallery-title-row' });
		const backButton = titleRow.createEl('button', {
			cls: 'clickable-icon',
			attr: { type: 'button', 'aria-label': 'Back to albums' },
		});
		setIcon(backButton, 'arrow-left');
		backButton.addEventListener('click', () => {
			this.activeAlbumId = null;
			this.render();
		});

		const heading = titleRow.createDiv({ cls: 'album-gallery-heading' });
		heading.createEl('h2', { text: album.name });
		heading.createDiv({ cls: 'album-gallery-subtitle', text: album.folderPath });

		if (!folder) {
			const missing = this.contentEl.createDiv({ cls: 'album-gallery-empty' });
			const icon = missing.createDiv({ cls: 'album-gallery-empty-icon' });
			setIcon(icon, 'folder-x');
			missing.createEl('h3', { text: 'Folder not found' });
			missing.createEl('p', { text: 'The folder may have been renamed, moved, or deleted.' });
			return;
		}

		const images = this.getAlbumImages(folder);
		heading.createDiv({
			cls: 'album-gallery-count',
			text: `${images.length} ${images.length === 1 ? 'image' : 'images'}`,
		});

		if (images.length === 0) {
			const empty = this.contentEl.createDiv({ cls: 'album-gallery-empty' });
			const icon = empty.createDiv({ cls: 'album-gallery-empty-icon' });
			setIcon(icon, 'image-off');
			empty.createEl('h3', { text: 'This album is empty' });
			empty.createEl('p', { text: 'Add supported image files to the folder and they will appear automatically.' });
			return;
		}

		const grid = this.contentEl.createDiv({ cls: 'album-gallery-image-grid' });
		grid.setCssProps({
			'--album-gallery-thumbnail-size': `${this.document.layout.thumbnailSize}px`,
			'--album-gallery-gap': `${this.document.layout.gap}px`,
		});

		let renderedCount = 0;
		const appendBatch = (): void => {
			const end = Math.min(renderedCount + this.plugin.settings.batchSize, images.length);
			for (let index = renderedCount; index < end; index += 1) {
				const file = images[index];
				if (file) {
					this.renderImageCard(grid, file, images, index);
				}
			}
			renderedCount = end;
		};

		appendBatch();
		if (renderedCount >= images.length) {
			return;
		}

		const sentinel = this.contentEl.createDiv({ cls: 'album-gallery-load-sentinel', text: 'Loading more images…' });
		this.observer = new IntersectionObserver((entries) => {
			if (!entries.some((entry) => entry.isIntersecting)) {
				return;
			}
			appendBatch();
			if (renderedCount >= images.length) {
				this.disconnectObserver();
				sentinel.remove();
			}
		}, { root: this.contentEl, rootMargin: '600px' });
		this.observer.observe(sentinel);
	}

	private renderImageCard(container: HTMLElement, file: TFile, images: TFile[], index: number): void {
		const button = container.createEl('button', {
			cls: 'album-gallery-image-card',
			attr: {
				type: 'button',
				'aria-label': `Open ${file.basename}`,
			},
		});
		const image = button.createEl('img', {
			attr: {
				alt: file.basename,
				loading: 'lazy',
				decoding: 'async',
			},
		});
		image.src = this.app.vault.getResourcePath(file);
		button.addEventListener('click', () => new ImageLightboxModal(this.app, images, index).open());
	}

	private openFolderPicker(): void {
		const excludedPaths = new Set(this.document.albums.map((album) => album.folderPath));
		new FolderSuggestModal(this.app, excludedPaths, (folder) => {
			this.addAlbum(folder);
		}).open();
	}

	private addAlbum(folder: TFolder): void {
		if (this.document.albums.some((album) => album.folderPath === folder.path)) {
			new Notice('That folder is already in this gallery.');
			return;
		}

		this.document.albums.push({
			id: createAlbumId(),
			name: folder.path === '/' || folder.path === '' ? 'Vault root' : folder.name,
			folderPath: folder.path,
			createdAt: Date.now(),
		});
		this.requestSave();
		this.assetCache.delete(folder.path);
		this.render();
	}

	private removeAlbum(albumId: string): void {
		this.document.albums = this.document.albums.filter((album) => album.id !== albumId);
		if (this.activeAlbumId === albumId) {
			this.activeAlbumId = null;
		}
		this.requestSave();
		this.render();
	}

	private getAlbumImages(folder: TFolder): TFile[] {
		const cached = this.assetCache.get(folder.path);
		if (cached) {
			return cached;
		}

		const images: TFile[] = [];
		const visit = (current: TFolder): void => {
			for (const child of current.children) {
				if (child instanceof TFile && SUPPORTED_IMAGE_EXTENSIONS.has(child.extension.toLowerCase())) {
					images.push(child);
				} else if (this.plugin.settings.includeSubfolders && child instanceof TFolder) {
					visit(child);
				}
			}
		};
		visit(folder);

		images.sort((left, right) => {
			switch (this.document.layout.sort) {
				case 'name-asc':
					return left.name.localeCompare(right.name);
				case 'name-desc':
					return right.name.localeCompare(left.name);
				case 'modified-asc':
					return left.stat.mtime - right.stat.mtime;
				case 'modified-desc':
					return right.stat.mtime - left.stat.mtime;
			}
		});

		this.assetCache.set(folder.path, images);
		return images;
	}

	private resolveCover(album: GalleryAlbum, images: TFile[]): TFile | null {
		if (album.coverPath) {
			const cover = this.app.vault.getFileByPath(album.coverPath);
			if (cover) {
				return cover;
			}
		}
		return images[0] ?? null;
	}

	private disconnectObserver(): void {
		this.observer?.disconnect();
		this.observer = null;
	}
}

class RemoveAlbumModal extends Modal {
	private readonly albumName: string;
	private readonly onConfirm: () => void;

	constructor(app: App, albumName: string, onConfirm: () => void) {
		super(app);
		this.albumName = albumName;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		this.contentEl.createEl('h2', { text: 'Remove album?' });
		this.contentEl.createEl('p', {
			text: `“${this.albumName}” will be removed from this gallery. The folder and its images will not be deleted.`,
		});
		const actions = this.contentEl.createDiv({ cls: 'modal-button-container' });
		const cancel = actions.createEl('button', { text: 'Cancel', attr: { type: 'button' } });
		cancel.addEventListener('click', () => this.close());
		const remove = actions.createEl('button', {
			cls: 'mod-warning',
			text: 'Remove album',
			attr: { type: 'button' },
		});
		remove.addEventListener('click', () => {
			this.onConfirm();
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

class ImageLightboxModal extends Modal {
	private readonly images: TFile[];
	private index: number;
	private imageElement: HTMLImageElement | null = null;
	private captionElement: HTMLElement | null = null;
	private counterElement: HTMLElement | null = null;

	constructor(app: App, images: TFile[], index: number) {
		super(app);
		this.images = images;
		this.index = index;
	}

	onOpen(): void {
		this.modalEl.addClass('album-gallery-lightbox-modal');
		const shell = this.contentEl.createDiv({ cls: 'album-gallery-lightbox' });
		const previous = shell.createEl('button', {
			cls: 'clickable-icon album-gallery-lightbox-nav album-gallery-lightbox-previous',
			attr: { type: 'button', 'aria-label': 'Previous image' },
		});
		setIcon(previous, 'chevron-left');
		previous.addEventListener('click', () => this.move(-1));

		const stage = shell.createDiv({ cls: 'album-gallery-lightbox-stage' });
		this.imageElement = stage.createEl('img', { attr: { alt: '' } });
		const details = stage.createDiv({ cls: 'album-gallery-lightbox-details' });
		this.captionElement = details.createDiv({ cls: 'album-gallery-lightbox-caption' });
		this.counterElement = details.createDiv({ cls: 'album-gallery-lightbox-counter' });

		const next = shell.createEl('button', {
			cls: 'clickable-icon album-gallery-lightbox-nav album-gallery-lightbox-next',
			attr: { type: 'button', 'aria-label': 'Next image' },
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
		this.captionElement = null;
		this.counterElement = null;
		this.contentEl.empty();
	}

	private move(direction: number): void {
		if (this.images.length === 0) {
			return;
		}
		this.index = (this.index + direction + this.images.length) % this.images.length;
		this.updateImage();
	}

	private updateImage(): void {
		const file = this.images[this.index];
		if (!file || !this.imageElement || !this.captionElement || !this.counterElement) {
			return;
		}
		this.imageElement.src = this.app.vault.getResourcePath(file);
		this.imageElement.alt = file.basename;
		this.captionElement.setText(file.name);
		this.counterElement.setText(`${this.index + 1} / ${this.images.length}`);
	}
}
