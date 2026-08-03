import {
	Menu,
	MenuItem,
	Notice,
	Plugin,
	TAbstractFile,
	TFolder,
	normalizePath,
} from 'obsidian';
import {
	DEFAULT_GALLERY_BASENAME,
	GALLERY_EXTENSION,
	GALLERY_VIEW_TYPE,
} from './constants';
import { AlbumGalleryView } from './gallery-view';
import { createGalleryDocument, serializeGalleryDocument } from './model';
import {
	AlbumGallerySettings,
	AlbumGallerySettingTab,
	DEFAULT_SETTINGS,
} from './settings';

export default class AlbumGalleryPlugin extends Plugin {
	settings: AlbumGallerySettings = { ...DEFAULT_SETTINGS };

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(
			GALLERY_VIEW_TYPE,
			(leaf) => new AlbumGalleryView(leaf, this),
		);
		this.registerExtensions([GALLERY_EXTENSION], GALLERY_VIEW_TYPE);

		this.addRibbonIcon('images', 'Create gallery', () => {
			void this.createGalleryFile();
		});

		this.addCommand({
			id: 'create-gallery',
			name: 'Create new gallery',
			callback: () => {
				void this.createGalleryFile();
			},
		});

		this.registerEvent(this.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
			if (!(file instanceof TFolder)) {
				return;
			}
			menu.addItem((item: MenuItem) => item
				.setTitle('New gallery')
				.setIcon('images')
				.onClick(() => {
					void this.createGalleryFile(file);
				}));
		}));

		this.registerEvent(this.app.vault.on('create', () => this.refreshOpenGalleryViews()));
		this.registerEvent(this.app.vault.on('delete', () => this.refreshOpenGalleryViews()));
		this.registerEvent(this.app.vault.on('rename', () => this.refreshOpenGalleryViews()));
		this.registerEvent(this.app.vault.on('modify', () => this.refreshOpenGalleryViews()));

		this.addSettingTab(new AlbumGallerySettingTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		const stored = await this.loadData() as Partial<AlbumGallerySettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, stored ?? {});
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	refreshOpenGalleryViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(GALLERY_VIEW_TYPE)) {
			if (leaf.view instanceof AlbumGalleryView) {
				leaf.view.requestVaultRefresh();
			}
		}
	}

	private async createGalleryFile(targetFolder?: TFolder): Promise<void> {
		const folder = targetFolder ?? this.app.workspace.getActiveFile()?.parent ?? this.app.vault.getRoot();
		const path = this.findAvailableGalleryPath(folder, DEFAULT_GALLERY_BASENAME);
		const title = path.split('/').pop()?.replace(`.${GALLERY_EXTENSION}`, '') ?? DEFAULT_GALLERY_BASENAME;
		const file = await this.app.vault.create(
			path,
			serializeGalleryDocument(createGalleryDocument(title)),
		);
		await this.app.workspace.getLeaf(false).openFile(file);
		new Notice('Gallery created. Create an album and add photos.');
	}

	private findAvailableGalleryPath(folder: TFolder, basename: string): string {
		let suffix = 0;
		while (true) {
			const candidateName = suffix === 0 ? basename : `${basename} ${suffix}`;
			const filename = `${candidateName}.${GALLERY_EXTENSION}`;
			const path = normalizePath(
				folder.path === '/' || folder.path === ''
					? filename
					: `${folder.path}/${filename}`,
			);
			if (!this.app.vault.getAbstractFileByPath(path)) {
				return path;
			}
			suffix += 1;
		}
	}
}
