import {
	App,
	PluginSettingTab,
	setIcon,
	type SettingDefinitionItem,
} from 'obsidian';
import type { EkatechStudyMistakeDefaults, EkatechStudyStatus } from './ekatech-study';
import type AlbumGalleryPlugin from './main';

export type GalleryDefaultTab = 'photos' | 'albums';

export interface AlbumGallerySettings {
	batchSize: number;
	defaultTab: GalleryDefaultTab;
	ekatechStudyToken: string;
	ekatechStudyVaultId: string;
	ekatechStudyPendingState: string;
	ekatechStudyStatus: EkatechStudyStatus | null;
	ekatechStudyDefaultsByAccount: Record<string, EkatechStudyMistakeDefaults>;
}

export const DEFAULT_SETTINGS: AlbumGallerySettings = {
	batchSize: 100,
	defaultTab: 'photos',
	ekatechStudyToken: '',
	ekatechStudyVaultId: '',
	ekatechStudyPendingState: '',
	ekatechStudyStatus: null,
	ekatechStudyDefaultsByAccount: {},
};

export class AlbumGallerySettingTab extends PluginSettingTab {
	private readonly plugin: AlbumGalleryPlugin;

	constructor(app: App, plugin: AlbumGalleryPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const status = this.plugin.settings.ekatechStudyStatus;
		const quota = status?.quota;
		const accountText = status
			? `${status.account.displayName} · ${status.account.plan}`
			: 'Obsidian içinde Study hesabına giriş yap. Hata defteri albümü otomatik oluşturulur ve eklediğin fotoğraflar aynı hesaba yüklenir.';
		const quotaText = quota
			? quota.unlimited
				? 'Obsidian cloud yüklemeleri sınırsız.'
				: `Bu ay ${quota.used} / ${quota.limit ?? 12} yükleme kullanıldı. ${quota.remaining ?? 0} kaldı.`
			: '';

		return [
			{
				name: 'Ekatech study',
				desc: [accountText, quotaText].filter(Boolean).join(' '),
				render: (setting) => {
					setting.addButton((button) => {
						if (status) {
							button
								.setButtonText('Çıkış yap')
								.setDestructive()
								.onClick(() => { void this.disconnectStudyAccount(); });
						} else {
							button
								.setButtonText('Study hesabına giriş')
								.setCta()
								.onClick(() => this.plugin.beginEkatechStudyLink());
						}
					});
				},
			},
			{
				name: 'Hesabı ve kotayı yenile',
				desc: 'Study paketini, aylık kotayı ve ders-konu listesini yeniden kontrol eder.',
				visible: Boolean(status),
				render: (setting) => {
					setting.addButton((button) => button
						.setButtonText('Yenile')
						.onClick(() => { void this.refreshStudyAccount(); }));
				},
			},
			{
				name: 'Default tab',
				desc: 'Choose which section opens first in a gallery.',
				render: (setting) => {
					setting.addDropdown((dropdown) => dropdown
						.addOption('photos', 'Photos')
						.addOption('albums', 'Albums')
						.setValue(this.plugin.settings.defaultTab)
						.onChange((value) => {
							this.plugin.settings.defaultTab = value === 'albums' ? 'albums' : 'photos';
							void this.plugin.saveSettings();
						}));
				},
			},
			{
				name: 'Photos loaded per batch',
				desc: 'Lower values reduce memory use on mobile. Higher values reveal large galleries faster.',
				render: (setting) => {
					setting.addSlider((slider) => slider
						.setLimits(20, 300, 20)
						.setValue(this.plugin.settings.batchSize)
						.onChange((value) => {
							this.plugin.settings.batchSize = value;
							void this.plugin.saveSettings();
						}));
				},
			},
			{
				name: 'Album gallery',
				desc: `Ekatech tarafından geliştirildi · v${this.plugin.manifest.version}`,
				searchable: false,
				render: (setting) => {
					setting.settingEl.addClass('album-gallery-brand-footer');
					setting.settingEl.setAttr('aria-label', 'Album gallery geliştirici bilgisi');
					const mark = setting.nameEl.createSpan({
						cls: 'album-gallery-brand-mark',
						attr: { 'aria-hidden': 'true' },
						prepend: true,
					});
					setIcon(mark, 'sparkles');
					setting.controlEl.createEl('a', {
						cls: 'album-gallery-brand-link',
						text: 'GitHub',
						attr: {
							href: 'https://github.com/Ezakamak/obsidian-album-gallery',
							target: '_blank',
							rel: 'noopener noreferrer',
							'aria-label': 'Album gallery GitHub deposunu aç',
						},
					});
				},
			},
		];
	}

	private async disconnectStudyAccount(): Promise<void> {
		await this.plugin.disconnectEkatechStudy();
		this.update();
	}

	private async refreshStudyAccount(): Promise<void> {
		await this.plugin.refreshEkatechStudyStatus(true);
		this.update();
	}
}
