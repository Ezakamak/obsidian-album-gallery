import type { WorkspaceLeaf } from 'obsidian';
import { GALLERY_VIEW_TYPE } from './constants';
import { AlbumGalleryView } from './gallery-view';
import AlbumGalleryPlugin from './main';
import { installGalleryMediaSupport } from './media-support';
import { installVideoPreviewThumbnails } from './video-preview-thumbnails';

interface RegisterViewHost {
	registerView(type: string, viewCreator: (leaf: WorkspaceLeaf) => unknown): void;
}

export default class AlbumGalleryMediaPlugin extends AlbumGalleryPlugin {
	async onload(): Promise<void> {
		const host = this as unknown as RegisterViewHost;
		const originalRegisterView = host.registerView.bind(this);
		host.registerView = (type, viewCreator) => {
			originalRegisterView(type, (leaf) => {
				const view = viewCreator(leaf);
				if (type === GALLERY_VIEW_TYPE && view instanceof AlbumGalleryView) {
					installGalleryMediaSupport(view);
					installVideoPreviewThumbnails(view);
				}
				return view;
			});
		};

		try {
			await super.onload();
		} finally {
			host.registerView = originalRegisterView;
		}
	}
}
