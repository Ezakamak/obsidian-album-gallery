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
}
.album-gallery-lightbox-video { outline: none; }
@media (max-width: 700px) {
	.album-gallery-media-lightbox-stage { grid-template-columns: 1fr; }
	.album-gallery-lightbox-media-host { grid-column: 1; grid-row: 1; }
	.album-gallery-video-badge { right: 6px; bottom: 6px; width: 28px; height: 28px; }
}
`;
	document.head.appendChild(style);
}
