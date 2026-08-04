const MEDIA_STYLE_ID = 'album-gallery-media-runtime-styles';

export function installGalleryMediaStyles(): void {
	if (typeof document === 'undefined' || document.getElementById(MEDIA_STYLE_ID)) return;
	const style = document.createElement('style');
	style.id = MEDIA_STYLE_ID;
	style.textContent = `
.album-gallery-album-cover > video,
.album-gallery-photo-card > video {
	display: block;
	width: 100%;
	height: 100%;
	object-fit: cover;
	background: #000;
	transition: transform 180ms ease, filter 180ms ease;
}
.album-gallery-photo-card:hover > video { transform: scale(1.025); }
.album-gallery-media-video.is-broken { opacity: 0.15; }
.album-gallery-video-badge {
	position: absolute;
	right: 8px;
	bottom: 8px;
	z-index: 3;
	display: grid;
	place-items: center;
	width: 32px;
	height: 32px;
	border: 1px solid rgba(255, 255, 255, 0.28);
	border-radius: 999px;
	background: rgba(0, 0, 0, 0.68);
	color: #fff;
	box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
	backdrop-filter: blur(10px);
	-webkit-backdrop-filter: blur(10px);
	pointer-events: none;
}
.album-gallery-video-badge svg { width: 16px; height: 16px; margin-left: 1px; }

/* Proven mobile lightbox layout restored from the working 0.2.1–0.2.2 implementation. */
.album-gallery-lightbox-modal .modal-content {
	height: 100%;
}
.album-gallery-lightbox-toolbar {
	justify-content: space-between;
	gap: 12px;
	min-width: 0;
	padding-right: 0;
}
.album-gallery-lightbox-title-group {
	flex: 1 1 auto;
	min-width: 0;
	align-items: flex-start;
	flex-direction: column;
	gap: 2px;
	overflow: hidden;
}
.album-gallery-lightbox-title,
.album-gallery-lightbox-subtitle {
	display: block;
	width: 100%;
	max-width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.album-gallery-lightbox-title {
	font-weight: var(--font-semibold);
}
.album-gallery-lightbox-actions {
	display: flex;
	align-items: center;
	flex: 0 0 auto;
	gap: 8px;
}
.album-gallery-lightbox-delete,
.album-gallery-lightbox-close {
	display: grid;
	place-items: center;
	flex: 0 0 auto;
	width: 44px;
	height: 44px;
	min-width: 44px;
	min-height: 44px;
	margin: 0;
	padding: 0;
	border-radius: 999px;
}
.album-gallery-lightbox-delete {
	color: var(--text-error);
}
.album-gallery-lightbox-close {
	border: 1px solid rgba(255, 255, 255, 0.14);
	background: rgba(38, 38, 38, 0.9);
	color: #fff;
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
	backdrop-filter: blur(16px);
	-webkit-backdrop-filter: blur(16px);
	touch-action: manipulation;
}
.album-gallery-lightbox-modal .modal-close-button {
	display: none !important;
}
.album-gallery-lightbox-stage {
	min-height: 0;
}
.album-gallery-lightbox-nav {
	z-index: 4;
	display: grid;
	place-items: center;
	width: 44px;
	height: 44px;
	min-width: 44px;
	min-height: 44px;
	margin: 8px;
	border-radius: 999px;
	background: rgba(30, 30, 30, 0.72);
	color: #fff;
	backdrop-filter: blur(12px);
	-webkit-backdrop-filter: blur(12px);
}
.album-gallery-lightbox-media-host {
	min-width: 0;
	min-height: 0;
	width: 100%;
	height: 100%;
	display: grid;
	place-items: center;
	overflow: hidden;
	background: #000;
}
.album-gallery-lightbox-media-host > img,
.album-gallery-lightbox-media-host > video {
	display: block;
	width: 100%;
	height: 100%;
	min-width: 0;
	min-height: 0;
	max-width: 100%;
	max-height: 100%;
	object-fit: contain;
	background: #000;
	user-select: none;
	-webkit-user-drag: none;
}
.album-gallery-lightbox-video { outline: none; }

@media (max-width: 700px) {
	.album-gallery-lightbox-modal {
		position: fixed !important;
		inset: 0 !important;
		width: 100vw !important;
		height: 100vh !important;
		height: 100dvh !important;
		max-width: none !important;
		max-height: none !important;
		margin: 0 !important;
		padding: 0 !important;
		border-radius: 0 !important;
		box-sizing: border-box;
	}

	.album-gallery-lightbox-modal .modal-content {
		height: 100% !important;
		padding-top: 72px !important;
		padding-right: 0 !important;
		padding-bottom: max(calc(env(safe-area-inset-bottom, 0px) + 10px), 10px) !important;
		padding-left: 0 !important;
		box-sizing: border-box;
	}
	.album-gallery-lightbox-toolbar {
		min-height: 48px;
		padding: 0 16px;
	}
	.album-gallery-lightbox-title-group {
		min-width: 0;
	}
	.album-gallery-lightbox-title {
		max-width: calc(100vw - 164px);
	}
	.album-gallery-lightbox-subtitle {
		max-width: calc(100vw - 164px);
	}
	.album-gallery-lightbox-delete,
	.album-gallery-lightbox-close {
		width: 48px;
		height: 48px;
		min-width: 48px;
		min-height: 48px;
	}
	.album-gallery-media-lightbox-stage {
		grid-template-columns: 1fr;
		border-radius: 0;
	}
	.album-gallery-lightbox-media-host {
		grid-column: 1;
		grid-row: 1;
	}
	.album-gallery-lightbox-nav {
		position: absolute;
		top: 50%;
		width: 48px;
		height: 48px;
		min-width: 48px;
		min-height: 48px;
		margin: 0;
		transform: translateY(-50%);
	}
	.album-gallery-lightbox-previous {
		left: 8px;
	}
	.album-gallery-lightbox-next {
		right: 8px;
	}
	.album-gallery-video-badge { right: 6px; bottom: 6px; width: 28px; height: 28px; }
}
`;
	document.head.appendChild(style);
}
