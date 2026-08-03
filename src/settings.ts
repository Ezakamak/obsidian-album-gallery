import { App, PluginSettingTab, Setting } from 'obsidian';
import type AlbumGalleryPlugin from './main';

export type GalleryDefaultTab = 'photos' | 'albums';

export interface AlbumGallerySettings {
	batchSize: number;
	defaultTab: GalleryDefaultTab;
	ekatechStudyLinked: boolean;
	ekatechStudyAccountLabel: string;
	ekatechStudyPendingNonce: string;
}

export const DEFAULT_SETTINGS: AlbumGallerySettings = {
	batchSize: 100,
	defaultTab: 'photos',
	ekatechStudyLinked: false,
	ekatechStudyAccountLabel: '',
	ekatechStudyPendingNonce: '',
};

export class AlbumGallerySettingTab extends PluginSettingTab {
	private readonly plugin: AlbumGalleryPlugin;

	constructor(app: App, plugin: AlbumGalleryPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		this.containerEl.empty();

		new Setting(this.containerEl)
			.setName('Ekatech Study')
			.setDesc(this.plugin.settings.ekatechStudyLinked
				? `Connected${this.plugin.settings.ekatechStudyAccountLabel ? ` as ${this.plugin.settings.ekatechStudyAccountLabel}` : ''}. Photos are handed to Study locally through iOS; they are not uploaded by this plugin.`
				: 'Connect the Ekatech Study app to create a managed Hata Defteri album and transfer selected questions locally.')
			.addButton((button) => button
				.setButtonText(this.plugin.settings.ekatechStudyLinked ? 'Reconnect' : 'Connect')
				.onClick(() => this.plugin.beginEkatechStudyLink()));

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
	}
}
