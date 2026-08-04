import { App, Modal, Notice, setIcon } from 'obsidian';
import type AlbumGalleryPlugin from './main';

export class StudyAccountManagerModal extends Modal {
	private readonly plugin: AlbumGalleryPlugin;
	private busy = false;

	constructor(app: App, plugin: AlbumGalleryPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		this.modalEl.addClass('album-gallery-account-manager-modal');
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		this.contentEl.empty();
		const status = this.plugin.settings.ekatechStudyStatus;
		if (!status) {
			this.close();
			this.plugin.beginEkatechStudyLink();
			return;
		}

		const shell = this.contentEl.createDiv({ cls: 'album-gallery-account-manager' });
		const heading = shell.createDiv({ cls: 'album-gallery-account-manager-heading' });
		const icon = heading.createDiv({ cls: 'album-gallery-account-manager-icon' });
		setIcon(icon, 'badge-check');
		const headingText = heading.createDiv();
		headingText.createEl('h2', { text: 'Study hesap yöneticisi' });
		headingText.createEl('p', { text: 'Obsidian hata defteri bağlantını ve aylık yükleme hakkını yönet.' });

		const account = shell.createDiv({ cls: 'album-gallery-account-card' });
		const identity = account.createDiv({ cls: 'album-gallery-account-identity' });
		identity.createEl('strong', { text: status.account.displayName });
		identity.createSpan({ text: status.account.email || 'E-posta bilgisi yok' });
		const plan = account.createDiv({ cls: 'album-gallery-account-plan' });
		plan.createSpan({ text: 'Paket' });
		plan.createEl('strong', { text: status.account.plan });

		const quota = status.quota;
		const quotaCard = shell.createDiv({ cls: 'album-gallery-account-quota' });
		const quotaHeader = quotaCard.createDiv({ cls: 'album-gallery-account-quota-header' });
		quotaHeader.createEl('strong', { text: 'Aylık Obsidian yükleme hakkı' });
		quotaHeader.createSpan({ text: quota.unlimited ? 'Sınırsız' : `${quota.used} / ${quota.limit ?? 12}` });
		if (!quota.unlimited) {
			const meter = quotaCard.createDiv({ cls: 'album-gallery-account-quota-meter' });
			const fill = meter.createDiv({ cls: 'album-gallery-account-quota-fill' });
			const percentage = quota.limit ? Math.min(100, Math.max(0, (quota.used / quota.limit) * 100)) : 0;
			fill.style.width = `${percentage}%`;
			quotaCard.createEl('p', { text: `${quota.remaining ?? 0} yükleme kaldı. Kota ${new Date(quota.resetsAt).toLocaleDateString('tr-TR')} tarihinde yenilenir.` });
		} else {
			quotaCard.createEl('p', { text: 'Bu hesapta Obsidian cloud yüklemeleri sınırsız.' });
		}

		const actions = shell.createDiv({ cls: 'album-gallery-account-actions' });
		this.addAction(actions, 'refresh-cw', 'Hesabı ve kotayı yenile', false, async () => {
			await this.plugin.refreshEkatechStudyStatus(true);
			this.render();
		});
		this.addAction(actions, 'repeat-2', 'Hesap değiştir', false, async () => {
			await this.plugin.disconnectEkatechStudy(false);
			this.close();
			this.plugin.beginEkatechStudyLink();
		});
		this.addAction(actions, 'log-out', 'Çıkış yap', true, async () => {
			new StudyAccountLogoutConfirmModal(this.app, this.plugin, () => this.close()).open();
		});
	}

	private addAction(
		container: HTMLElement,
		iconName: string,
		label: string,
		warning: boolean,
		onClick: () => Promise<void> | void,
	): void {
		const button = container.createEl('button', {
			cls: `album-gallery-account-action${warning ? ' is-warning' : ''}`,
			attr: { type: 'button' },
		});
		const icon = button.createSpan({ cls: 'album-gallery-account-action-icon' });
		setIcon(icon, iconName);
		button.createSpan({ text: label });
		button.addEventListener('click', () => { void (async () => {
			if (this.busy) return;
			this.busy = true;
			button.disabled = true;
			try {
				await onClick();
			} catch (error) {
				new Notice(error instanceof Error ? error.message : 'İşlem tamamlanamadı.');
			} finally {
				this.busy = false;
				button.disabled = false;
			}
		})(); });
	}
}

class StudyAccountLogoutConfirmModal extends Modal {
	private readonly plugin: AlbumGalleryPlugin;
	private readonly onLoggedOut: () => void;
	private busy = false;

	constructor(app: App, plugin: AlbumGalleryPlugin, onLoggedOut: () => void) {
		super(app);
		this.plugin = plugin;
		this.onLoggedOut = onLoggedOut;
	}

	onOpen(): void {
		this.contentEl.createEl('h2', { text: 'Study hesabından çıkış yapılsın mı?' });
		this.contentEl.createEl('p', {
			text: 'Bu cihazdaki study oturumu kapatılacak. Normal albümlerin ve yerel fotoğrafların silinmeyecek.',
		});
		const actions = this.contentEl.createDiv({ cls: 'modal-button-container' });
		actions.createEl('button', { text: 'Vazgeç', attr: { type: 'button' } }).addEventListener('click', () => this.close());
		const confirm = actions.createEl('button', { cls: 'mod-warning', text: 'Çıkış yap', attr: { type: 'button' } });
		confirm.addEventListener('click', () => { void (async () => {
			if (this.busy) return;
			this.busy = true;
			confirm.disabled = true;
			await this.plugin.disconnectEkatechStudy();
			this.close();
			this.onLoggedOut();
		})(); });
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
