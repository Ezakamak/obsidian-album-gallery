import {
	App,
	Menu,
	MenuItem,
	Modal,
	Notice,
	Plugin,
	TAbstractFile,
	TFile,
	TFolder,
	normalizePath,
	requestUrl,
	setIcon,
} from 'obsidian';
import {
	DEFAULT_GALLERY_BASENAME,
	GALLERY_EXTENSION,
	GALLERY_VIEW_TYPE,
} from './constants';
import { AlbumGalleryView } from './gallery-view';
import {
	EKATECH_STUDY_API_BASE,
	createEkatechStudyAuthURL,
	createMultipartBody,
	createSecureIdentifier,
	mimeTypeForImageName,
	type EkatechStudyMistakeDefaults,
	type EkatechStudyQuota,
	type EkatechStudyStatus,
	type EkatechStudyUploadResult,
	type StudyApiEnvelope,
} from './ekatech-study';
import { createGalleryDocument, serializeGalleryDocument, type GalleryImage } from './model';
import {
	AlbumGallerySettings,
	AlbumGallerySettingTab,
	DEFAULT_SETTINGS,
} from './settings';

class EkatechStudyLinkConfirmModal extends Modal {
	private readonly onConfirm: () => void;

	constructor(app: App, onConfirm: () => void) {
		super(app);
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		this.modalEl.addClass('album-gallery-study-link-confirm-modal');
		this.contentEl.empty();

		const shell = this.contentEl.createDiv({ cls: 'album-gallery-study-link-confirm' });
		const icon = shell.createDiv({ cls: 'album-gallery-study-link-confirm-icon' });
		setIcon(icon, 'graduation-cap');

		shell.createEl('h2', { text: 'Ekatech study hesabına bağlan' });
		shell.createEl('p', {
			cls: 'album-gallery-study-link-confirm-lead',
			text: 'Devam ettiğinde güvenli giriş için ekatech study web sitesine yönlendirileceksin.',
		});

		const notice = shell.createDiv({ cls: 'album-gallery-study-link-confirm-notice' });
		const noticeIcon = notice.createDiv({ cls: 'album-gallery-study-link-confirm-notice-icon' });
		setIcon(noticeIcon, 'info');
		const noticeText = notice.createDiv();
		noticeText.createEl('strong', {
			text: 'Bu hizmet yalnızca ekatech study uygulaması müşterileri içindir.',
		});
		noticeText.createEl('p', {
			text: 'Study hesabınla giriş yaptıktan ve bağlantıyı onayladıktan sonra Obsidian’a geri dönersin. Hata defteri fotoğrafları bağlı hesabına yüklenir.',
		});

		const actions = shell.createDiv({ cls: 'album-gallery-study-link-confirm-actions' });
		actions.createEl('button', {
			text: 'Vazgeç',
			attr: { type: 'button' },
		}).addEventListener('click', () => this.close());

		const continueButton = actions.createEl('button', {
			cls: 'mod-cta',
			text: 'Siteye Git',
			attr: { type: 'button' },
		});
		continueButton.addEventListener('click', () => {
			this.close();
			this.onConfirm();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export class EkatechStudyApiError extends Error {
	readonly code: string;
	readonly status: number;
	readonly quota?: EkatechStudyQuota;

	constructor(message: string, code: string, status: number, quota?: EkatechStudyQuota) {
		super(message);
		this.name = 'EkatechStudyApiError';
		this.code = code;
		this.status = status;
		this.quota = quota;
	}
}

export default class AlbumGalleryPlugin extends Plugin {
	settings: AlbumGallerySettings = { ...DEFAULT_SETTINGS };
	private statusRefreshPromise: Promise<EkatechStudyStatus | null> | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		await this.ensureStudyVaultId();

		this.registerView(
			GALLERY_VIEW_TYPE,
			(leaf) => new AlbumGalleryView(leaf, this),
		);
		this.registerExtensions([GALLERY_EXTENSION], GALLERY_VIEW_TYPE);
		this.registerObsidianProtocolHandler('album-gallery-auth', (params) => {
			void this.completeEkatechStudyAuth(params);
		});

		this.addRibbonIcon('images', 'Create gallery', () => {
			void this.createGalleryFile();
		});
		this.addCommand({
			id: 'create-gallery',
			name: 'Create new gallery',
			callback: () => { void this.createGalleryFile(); },
		});
		this.addCommand({
			id: 'connect-ekatech-study',
			name: 'Connect ekatech study account',
			callback: () => this.beginEkatechStudyLink(),
		});

		this.registerEvent(this.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
			if (!(file instanceof TFolder)) return;
			menu.addItem((item: MenuItem) => item
				.setTitle('New gallery')
				.setIcon('images')
				.onClick(() => { void this.createGalleryFile(file); }));
		}));

		this.registerEvent(this.app.vault.on('create', () => this.refreshOpenGalleryViews()));
		this.registerEvent(this.app.vault.on('delete', () => this.refreshOpenGalleryViews()));
		this.registerEvent(this.app.vault.on('rename', () => this.refreshOpenGalleryViews()));
		this.registerEvent(this.app.vault.on('modify', () => this.refreshOpenGalleryViews()));
		this.addSettingTab(new AlbumGallerySettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			if (this.settings.ekatechStudyToken) void this.refreshEkatechStudyStatus(false);
		});
	}

	async loadSettings(): Promise<void> {
		const stored = await this.loadData() as Partial<AlbumGallerySettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, stored ?? {});
		this.settings.ekatechStudyDefaultsByAccount = this.settings.ekatechStudyDefaultsByAccount ?? {};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async ensureStudyVaultId(): Promise<void> {
		if (this.settings.ekatechStudyVaultId.length >= 8) return;
		this.settings.ekatechStudyVaultId = createSecureIdentifier('vault_');
		await this.saveSettings();
	}

	get ekatechStudyConnected(): boolean {
		return Boolean(this.settings.ekatechStudyToken && this.settings.ekatechStudyStatus?.account.id);
	}

	get ekatechStudyAccountId(): string | null {
		return this.settings.ekatechStudyStatus?.account.id ?? null;
	}

	getEkatechStudyDefaults(): EkatechStudyMistakeDefaults | null {
		const status = this.settings.ekatechStudyStatus;
		if (!status) return null;
		return this.settings.ekatechStudyDefaultsByAccount[status.account.id] ?? status.defaults;
	}

	async updateEkatechStudyDefaults(next: EkatechStudyMistakeDefaults): Promise<void> {
		const accountId = this.ekatechStudyAccountId;
		if (!accountId) return;
		this.settings.ekatechStudyDefaultsByAccount[accountId] = { ...next };
		await this.saveSettings();
		this.refreshOpenGalleryViews();
	}

	beginEkatechStudyLink(): void {
		new EkatechStudyLinkConfirmModal(this.app, () => {
			void this.beginEkatechStudyLinkFlow();
		}).open();
	}

	private async beginEkatechStudyLinkFlow(): Promise<void> {
		await this.ensureStudyVaultId();
		const state = createSecureIdentifier('state_');
		this.settings.ekatechStudyPendingState = state;
		await this.saveSettings();
		const url = createEkatechStudyAuthURL(state, this.settings.ekatechStudyVaultId);
		new Notice('Study hesabı girişi açılıyor…');
		const opened = window.open(url, '_blank', 'noopener,noreferrer');
		if (!opened) window.location.assign(url);
	}

	private async completeEkatechStudyAuth(params: Record<string, string>): Promise<void> {
		const state = String(params.state || '').trim();
		const code = String(params.code || '').trim();
		if (params.error) {
			new Notice('Study hesabı bağlantısı tamamlanmadı.');
			return;
		}
		if (!state || state !== this.settings.ekatechStudyPendingState || !code) {
			new Notice('Study hesabı bağlantısı doğrulanamadı. Yeniden giriş yap.');
			return;
		}
		try {
			const response = await requestUrl({
				url: `${EKATECH_STUDY_API_BASE}/api/study/obsidian/auth/exchange`,
				method: 'POST',
				contentType: 'application/json',
				body: JSON.stringify({
					code,
					state,
					vault_id: this.settings.ekatechStudyVaultId,
				}),
				throw: false,
			});
			const envelope = response.json as StudyApiEnvelope<EkatechStudyStatus & { token: string }>;
			if (!envelope.ok || !envelope.data?.token) {
				throw this.apiError(envelope, response.status);
			}
			this.settings.ekatechStudyToken = envelope.data.token;
			this.settings.ekatechStudyPendingState = '';
			this.applyStudyStatus(envelope.data);
			await this.saveSettings();
			for (const leaf of this.app.workspace.getLeavesOfType(GALLERY_VIEW_TYPE)) {
				if (leaf.view instanceof AlbumGalleryView) leaf.view.activateEkatechStudyAlbum();
			}
			new Notice(`${envelope.data.account.displayName} hesabı bağlandı. Hata Defteri hazır.`);
		} catch (error) {
			console.error('Album Gallery Study auth exchange failed', error);
			new Notice(error instanceof Error ? error.message : 'Study hesabı bağlanamadı.');
		}
	}

	async refreshEkatechStudyStatus(showNotice: boolean): Promise<EkatechStudyStatus | null> {
		if (!this.settings.ekatechStudyToken) return null;
		if (this.statusRefreshPromise) return this.statusRefreshPromise;
		this.statusRefreshPromise = (async () => {
			try {
				const response = await requestUrl({
					url: `${EKATECH_STUDY_API_BASE}/api/study/obsidian/status`,
					method: 'GET',
					headers: { Authorization: `Bearer ${this.settings.ekatechStudyToken}` },
					throw: false,
				});
				const envelope = response.json as StudyApiEnvelope<EkatechStudyStatus>;
				if (!envelope.ok || !envelope.data) throw this.apiError(envelope, response.status);
				this.applyStudyStatus(envelope.data);
				await this.saveSettings();
				this.refreshOpenGalleryViews();
				if (showNotice) new Notice('Study hesabı ve aylık kota yenilendi.');
				return envelope.data;
			} catch (error) {
				if (error instanceof EkatechStudyApiError && error.status === 401) {
					await this.clearStudySession();
					new Notice('Obsidian study oturumu sona erdi. Yeniden giriş yap.');
				} else if (showNotice) {
					new Notice(error instanceof Error ? error.message : 'Study bilgileri yenilenemedi.');
				}
				return null;
			} finally {
				this.statusRefreshPromise = null;
			}
		})();
		return this.statusRefreshPromise;
	}

	async disconnectEkatechStudy(showNotice = true): Promise<void> {
		const token = this.settings.ekatechStudyToken;
		if (token) {
			await requestUrl({
				url: `${EKATECH_STUDY_API_BASE}/api/study/obsidian/auth/logout`,
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				throw: false,
			}).catch(() => null);
		}
		await this.clearStudySession();
		if (showNotice) new Notice('Study hesabından çıkış yapıldı. Normal albümlerin değişmedi.');
	}

	private async clearStudySession(): Promise<void> {
		this.settings.ekatechStudyToken = '';
		this.settings.ekatechStudyPendingState = '';
		this.settings.ekatechStudyStatus = null;
		await this.saveSettings();
		this.refreshOpenGalleryViews();
	}

	private applyStudyStatus(status: EkatechStudyStatus): void {
		this.settings.ekatechStudyStatus = status;
		if (!this.settings.ekatechStudyDefaultsByAccount[status.account.id]) {
			this.settings.ekatechStudyDefaultsByAccount[status.account.id] = { ...status.defaults };
		}
	}

	async uploadEkatechStudyImage(
		file: TFile,
		image: GalleryImage,
		defaults: EkatechStudyMistakeDefaults,
		title: string,
	): Promise<EkatechStudyUploadResult> {
		const token = this.settings.ekatechStudyToken;
		const accountId = this.ekatechStudyAccountId;
		if (!token || !accountId) throw new EkatechStudyApiError('Study hesabına giriş yapman gerekiyor.', 'OBSIDIAN_AUTH_REQUIRED', 401);
		if (image.study?.accountId !== accountId) {
			throw new EkatechStudyApiError('Bu fotoğraf başka bir Study hesabına ait.', 'ACCOUNT_MISMATCH', 409);
		}
		const data = await this.app.vault.readBinary(file);
		const multipart = createMultipartBody({
			asset_id: image.id,
			vault_id: this.settings.ekatechStudyVaultId,
			exam_type: defaults.examType,
			subject_code: defaults.subjectCode,
			topic_code: defaults.topicCode,
			mistake_type: defaults.mistakeType,
			review_interval_days: String(defaults.reviewIntervalDays),
			source_name: defaults.sourceName,
			question_note: defaults.questionNote,
			solution_note: defaults.solutionNote,
			title,
		}, {
			fieldName: 'attachment',
			filename: file.name,
			contentType: mimeTypeForImageName(file.name),
			bytes: data,
		});
		const response = await requestUrl({
			url: `${EKATECH_STUDY_API_BASE}/api/study/obsidian/mistakes`,
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': `multipart/form-data; boundary=${multipart.boundary}`,
			},
			body: multipart.body,
			throw: false,
		});
		const envelope = response.json as StudyApiEnvelope<EkatechStudyUploadResult>;
		if (!envelope.ok || !envelope.data) {
			const error = this.apiError(envelope, response.status);
			if (error.quota && this.settings.ekatechStudyStatus) this.settings.ekatechStudyStatus.quota = error.quota;
			if (error.status === 401) await this.clearStudySession();
			throw error;
		}
		if (this.settings.ekatechStudyStatus) this.settings.ekatechStudyStatus.quota = envelope.data.quota;
		await this.saveSettings();
		return envelope.data;
	}

	private apiError<T>(envelope: StudyApiEnvelope<T>, status: number): EkatechStudyApiError {
		const code = envelope.error?.code || 'STUDY_REQUEST_FAILED';
		const message = envelope.error?.message || `Study isteği tamamlanamadı (${status}).`;
		return new EkatechStudyApiError(message, code, status, envelope.error?.quota);
	}

	refreshOpenGalleryViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(GALLERY_VIEW_TYPE)) {
			if (leaf.view instanceof AlbumGalleryView) leaf.view.requestVaultRefresh();
		}
	}

	private async createGalleryFile(targetFolder?: TFolder): Promise<void> {
		const folder = targetFolder ?? this.app.workspace.getActiveFile()?.parent ?? this.app.vault.getRoot();
		const path = this.findAvailableGalleryPath(folder, DEFAULT_GALLERY_BASENAME);
		const title = path.split('/').pop()?.replace(`.${GALLERY_EXTENSION}`, '') ?? DEFAULT_GALLERY_BASENAME;
		const file = await this.app.vault.create(path, serializeGalleryDocument(createGalleryDocument(title)));
		await this.app.workspace.getLeaf(false).openFile(file);
		new Notice('Gallery created. Create an album and add photos.');
	}

	private findAvailableGalleryPath(folder: TFolder, basename: string): string {
		let suffix = 0;
		while (true) {
			const candidateName = suffix === 0 ? basename : `${basename} ${suffix}`;
			const filename = `${candidateName}.${GALLERY_EXTENSION}`;
			const path = normalizePath(folder.path === '/' || folder.path === '' ? filename : `${folder.path}/${filename}`);
			if (!this.app.vault.getAbstractFileByPath(path)) return path;
			suffix += 1;
		}
	}
}
