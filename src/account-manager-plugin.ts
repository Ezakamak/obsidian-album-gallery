import type AlbumGalleryPlugin from './main';
import { StudyAccountManagerModal } from './study-account-manager';

export function openStudyAccountManager(plugin: AlbumGalleryPlugin): void {
	if (!plugin.ekatechStudyConnected) {
		plugin.beginEkatechStudyLink();
		return;
	}
	new StudyAccountManagerModal(plugin.app, plugin).open();
}
