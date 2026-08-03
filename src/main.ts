import {
	Menu,
	MenuItem,
	Notice,
	Platform,
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
	EKATECH_STUDY_LINK_EXTENSION,
	EKATECH_STUDY_LINK_MIME,
	createEkatechStudyConnectURL,
	createEkatechStudyLinkNonce,
	createEkatechStudyLinkPackage,
} from './ekatech-study';
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
		this.registerObsidianProtocolHandler('ekatech-study-link', (params) => {
			void this.completeEkatechStudyLink(params);
		});

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

	beginEkatechStudyLink(): void {
		void this.beginEkatechStudyLinkFlow();
	}

	private async beginEkatechStudyLinkFlow(): Promise<void> {
		const nonce = createEkatechStudyLinkNonce();
		this.settings.ekatechStudyPendingNonce = nonce;
		await this.saveSettings();

		if (Platform.isIosApp) {
			await this.shareEkatechStudyLinkDocument(nonce);
			return;
		}

		try {
			window.location.assign(createEkatechStudyConnectURL(nonce));
			new Notice('Ekatech Study bağlantı isteği açıldı.');
		} catch (error) {
			console.error('Album Gallery could not open Ekatech Study', error);
			await this.clearPendingEkatechStudyLink(nonce);
			new Notice('Ekatech Study bağlantı isteği açılamadı.');
		}
	}

	private async shareEkatechStudyLinkDocument(nonce: string): Promise<void> {
		const payload = createEkatechStudyLinkPackage(nonce);
		const file = new File(
			[`${JSON.stringify(payload, null, 2)}\n`],
			`Ekatech Study Baglantisi.${EKATECH_STUDY_LINK_EXTENSION}`,
			{ type: EKATECH_STUDY_LINK_MIME },
		);
		const shareData: ShareData = {
			files: [file],
			title: 'Ekatech Study bağlantısı',
			text: 'Album Gallery hesabını bağlamak için Ekatech Study uygulamasını seç.',
		};
		const canShare = typeof navigator.share === 'function'
			&& (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] }));

		if (!canShare) {
			await this.clearPendingEkatechStudyLink(nonce);
			new Notice('iOS paylaşım menüsü kullanılamıyor. Obsidian ve iOS sürümünü güncelle.');
			return;
		}

		new Notice('Paylaşım menüsünden Ekatech Study’yi seç.');
		try {
			await navigator.share(shareData);
			new Notice('Bağlantı isteği Ekatech Study’ye teslim edildi.');
		} catch (error) {
			await this.clearPendingEkatechStudyLink(nonce);
			if (error instanceof DOMException && error.name === 'AbortError') {
				new Notice('Ekatech Study bağlantısı iptal edildi.');
				return;
			}
			console.error('Album Gallery could not share the Ekatech Study link document', error);
			new Notice('Ekatech Study bağlantı dosyası paylaşılamadı.');
		}
	}

	private async clearPendingEkatechStudyLink(nonce: string): Promise<void> {
		if (this.settings.ekatechStudyPendingNonce !== nonce) {
			return;
		}
		this.settings.ekatechStudyPendingNonce = '';
		await this.saveSettings();
	}

	private async completeEkatechStudyLink(params: Record<string, string>): Promise<void> {
		const nonce = params.nonce?.trim() ?? '';
		if (!nonce || nonce !== this.settings.ekatechStudyPendingNonce) {
			new Notice('Ekatech Study bağlantısı doğrulanamadı. Yeniden bağlanmayı dene.');
			return;
		}
		if (params.status !== 'connected') {
			new Notice(params.message || 'Ekatech Study bağlantısı tamamlanmadı.');
			return;
		}

		this.settings.ekatechStudyLinked = true;
		this.settings.ekatechStudyAccountLabel = params.account?.trim() ?? '';
		this.settings.ekatechStudyPendingNonce = '';
		await this.saveSettings();

		for (const leaf of this.app.workspace.getLeavesOfType(GALLERY_VIEW_TYPE)) {
			if (leaf.view instanceof AlbumGalleryView) {
				leaf.view.ensureEkatechStudyAlbum();
			}
		}
		new Notice('Ekatech Study bağlandı. Hata Defteri albümü hazır.');
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
