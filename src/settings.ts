import { App, PluginSettingTab, Setting, setIcon } from 'obsidian';
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

	display(): void {
		this.containerEl.empty();
		this.containerEl.addClass('album-gallery-settings');
		const status = this.plugin.settings.ekatechStudyStatus;
		const quota = status?.quota;
		const accountText = status
			? `${status.account.displayName} · ${status.account.plan}`
			: 'Obsidian içinde Study hesabına giriş yap. Hata Defteri albümü otomatik oluşturulur ve eklediğin fotoğraflar aynı hesaba yüklenir.';
		const quotaText = quota
			? quota.unlimited
				? 'Obsidian cloud yüklemeleri sınırsız.'
				: `Bu ay ${quota.used} / ${quota.limit ?? 12} yükleme kullanıldı. ${quota.remaining ?? 0} kaldı.`
			: '';

		new Setting(this.containerEl)
			.setName('Ekatech Study')
			.setDesc([accountText, quotaText].filter(Boolean).join(' '))
			.addButton((button) => {
				if (status) {
					button.setButtonText('Çıkış yap').setWarning().onClick(async () => {
						await this.plugin.disconnectEkatechStudy();
						this.display();
					});
				} else {
					button.setButtonText('Study hesabına giriş').setCta().onClick(() => {
						this.plugin.beginEkatechStudyLink();
					});
				}
			});

		if (status) {
			new Setting(this.containerEl)
				.setName('Hesabı ve kotayı yenile')
				.setDesc('Study paketini, aylık kotayı ve ders-konu listesini yeniden kontrol eder.')
				.addButton((button) => button.setButtonText('Yenile').onClick(async () => {
					await this.plugin.refreshEkatechStudyStatus(true);
					this.display();
				}));
		}

		new Setting(this.containerEl)
			.setName('Default tab')
			.setDesc('Choose which section opens first in a gallery.')
			.addDropdown((dropdown) => dropdown
				.addOption('photos', 'Photos')
				.addOption('albums', 'Albums')
				.setValue(this.plugin.settings.defaultTab)
				.onChange(async (value: string) => {
					this.plugin.settings.defaultTab = value === 'albums' ? 'albums' : 'photos';
					await this.plugin.saveSettings();
				}));

		new Setting(this.containerEl)
			.setName('Photos loaded per batch')
			.setDesc('Lower values reduce memory use on mobile. Higher values reveal large galleries faster.')
			.addSlider((slider) => slider
				.setLimits(20, 300, 20)
				.setDynamicTooltip()
				.setValue(this.plugin.settings.batchSize)
				.onChange(async (value: number) => {
					this.plugin.settings.batchSize = value;
					await this.plugin.saveSettings();
				}));

		this.renderBrandFooter();
	}

	private renderBrandFooter(): void {
		const footer = this.containerEl.createEl('footer', {
			cls: 'album-gallery-brand-footer',
			attr: { 'aria-label': 'Album Gallery geliştirici bilgisi' },
		});
		const mark = footer.createSpan({
			cls: 'album-gallery-brand-mark',
			attr: { 'aria-hidden': 'true' },
		});
		setIcon(mark, 'sparkles');

		const identity = footer.createDiv({ cls: 'album-gallery-brand-identity' });
		identity.createEl('strong', { text: 'Album Gallery' });
		identity.createEl('span', {
			text: `Ekatech tarafından geliştirildi · v${this.plugin.manifest.version}`,
		});

		const repositoryLink = footer.createEl('a', {
			cls: 'album-gallery-brand-link',
			text: 'GitHub',
			attr: {
				href: 'https://github.com/Ezakamak/obsidian-album-gallery',
				target: '_blank',
				rel: 'noopener noreferrer',
				'aria-label': 'Album Gallery GitHub deposunu aç',
			},
		});
		repositoryLink.setAttr('title', 'GitHub deposunu aç');
	}
}
