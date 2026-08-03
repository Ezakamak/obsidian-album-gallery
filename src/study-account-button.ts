import { setIcon } from 'obsidian';
import type AlbumGalleryPlugin from './main';
import { StudyAccountManagerModal } from './study-account-manager';

export function renderStudyAccountButton(container: HTMLElement, plugin: AlbumGalleryPlugin): HTMLButtonElement {
	const connected = plugin.ekatechStudyConnected;
	const button = container.createEl('button', {
		cls: `album-gallery-study-button${connected ? ' is-connected' : ''}`,
		attr: {
			type: 'button',
			'aria-label': connected ? 'Study hesap yöneticisini aç' : 'Study hesabına giriş yap',
			title: connected ? 'Study Hesap Yöneticisi' : 'Study hesabına giriş',
		},
	});
	setIcon(button, connected ? 'badge-check' : 'graduation-cap');
	button.createSpan({ text: connected ? 'Study' : 'Study hesabına giriş' });
	button.addEventListener('click', () => {
		if (!plugin.ekatechStudyConnected) {
			plugin.beginEkatechStudyLink();
			return;
		}
		new StudyAccountManagerModal(plugin.app, plugin).open();
	});
	return button;
}
