'use strict';

module.exports = function installStudyLinkConfirmation(pluginClass) {
	if (!pluginClass || pluginClass.prototype.__albumGalleryStudyLinkConfirmationInstalled) return;
	const { Modal, setIcon } = require('obsidian');
	const prototype = pluginClass.prototype;
	const originalBegin = prototype.beginEkatechStudyLink;
	if (typeof originalBegin !== 'function') return;

	class StudyLinkConfirmModal extends Modal {
		constructor(app, onConfirm) {
			super(app);
			this.onConfirm = onConfirm;
		}

		onOpen() {
			this.modalEl.addClass('album-gallery-study-link-confirm-modal');
			this.contentEl.empty();
			const shell = this.contentEl.createDiv({ cls: 'album-gallery-study-link-confirm' });
			const icon = shell.createDiv({ cls: 'album-gallery-study-link-confirm-icon' });
			setIcon(icon, 'graduation-cap');
			shell.createEl('h2', { text: 'Ekatech Study hesabına bağlan' });
			shell.createEl('p', {
				cls: 'album-gallery-study-link-confirm-lead',
				text: 'Devam ettiğinde güvenli giriş için Ekatech Study web sitesine yönlendirileceksin.',
			});
			const notice = shell.createDiv({ cls: 'album-gallery-study-link-confirm-notice' });
			const noticeIcon = notice.createDiv({ cls: 'album-gallery-study-link-confirm-notice-icon' });
			setIcon(noticeIcon, 'info');
			const noticeText = notice.createDiv();
			noticeText.createEl('strong', { text: 'Bu hizmet yalnızca Ekatech Study uygulaması müşterileri içindir.' });
			noticeText.createEl('p', {
				text: 'Study hesabınla giriş yaptıktan ve bağlantıyı onayladıktan sonra Obsidian’a geri dönersin. Hata Defteri fotoğrafları bağlı hesabına yüklenir.',
			});
			const actions = shell.createDiv({ cls: 'album-gallery-study-link-confirm-actions' });
			actions.createEl('button', { text: 'Vazgeç', attr: { type: 'button' } }).addEventListener('click', () => this.close());
			const continueButton = actions.createEl('button', { cls: 'mod-cta', text: 'Siteye git', attr: { type: 'button' } });
			continueButton.addEventListener('click', () => {
				this.close();
				this.onConfirm();
			});
		}

		onClose() {
			this.contentEl.empty();
		}
	}

	prototype.__albumGalleryStudyLinkConfirmationInstalled = true;
	prototype.beginEkatechStudyLink = function () {
		new StudyLinkConfirmModal(this.app, () => originalBegin.call(this)).open();
	};
};
