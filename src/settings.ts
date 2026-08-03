import { App, PluginSettingTab, Setting } from 'obsidian';
import type AlbumGalleryPlugin from './main';

export interface AlbumGallerySettings {
	includeSubfolders: boolean;
	batchSize: number;
}

export const DEFAULT_SETTINGS: AlbumGallerySettings = {
	includeSubfolders: false,
	batchSize: 80,
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
			.setName('Include subfolders')
			.setDesc('Show images from nested folders inside each album.')
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.includeSubfolders)
				.onChange(async (value) => {
					this.plugin.settings.includeSubfolders = value;
					await this.plugin.saveSettings();
					this.plugin.refreshOpenGalleryViews();
				}));

		new Setting(this.containerEl)
			.setName('Images loaded per batch')
			.setDesc('Lower values reduce memory use on mobile. Higher values reveal large albums faster.')
			.addSlider((slider) => slider
				.setLimits(20, 200, 20)
				.setDynamicTooltip()
				.setValue(this.plugin.settings.batchSize)
				.onChange(async (value) => {
					this.plugin.settings.batchSize = value;
					await this.plugin.saveSettings();
				}));
	}
}
