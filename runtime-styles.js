'use strict';

module.exports = function installRuntimeStyles() {
	if (typeof document === 'undefined' || document.getElementById('album-gallery-media-runtime-styles')) return;
	const style = document.createElement('style');
	style.id = 'album-gallery-media-runtime-styles';
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
.album-gallery-study-link-confirm-modal .modal-content { max-width: 30rem; }
.album-gallery-study-link-confirm {
	display: flex;
	flex-direction: column;
	align-items: stretch;
	gap: 0.9rem;
	padding: 0.25rem 0.15rem 0.1rem;
	text-align: center;
}
.album-gallery-study-link-confirm-icon {
	display: grid;
	width: 3.25rem;
	height: 3.25rem;
	margin: 0 auto 0.1rem;
	place-items: center;
	border: 1px solid color-mix(in srgb, var(--interactive-accent) 35%, var(--background-modifier-border));
	border-radius: 1rem;
	background: color-mix(in srgb, var(--interactive-accent) 14%, var(--background-secondary));
	color: var(--interactive-accent);
}
.album-gallery-study-link-confirm-icon svg { width: 1.75rem; height: 1.75rem; }
.album-gallery-study-link-confirm h2 { margin: 0; font-size: 1.45rem; }
.album-gallery-study-link-confirm-lead { margin: 0; color: var(--text-muted); line-height: 1.55; }
.album-gallery-study-link-confirm-notice {
	display: grid;
	grid-template-columns: auto minmax(0, 1fr);
	gap: 0.75rem;
	align-items: start;
	padding: 0.95rem;
	border: 1px solid var(--background-modifier-border);
	border-radius: 1rem;
	background: var(--background-secondary);
	text-align: left;
}
.album-gallery-study-link-confirm-notice-icon {
	display: grid;
	width: 2rem;
	height: 2rem;
	place-items: center;
	border-radius: 0.7rem;
	background: color-mix(in srgb, var(--interactive-accent) 12%, transparent);
	color: var(--interactive-accent);
}
.album-gallery-study-link-confirm-notice-icon svg { width: 1.1rem; height: 1.1rem; }
.album-gallery-study-link-confirm-notice strong { display: block; line-height: 1.4; }
.album-gallery-study-link-confirm-notice p { margin: 0.35rem 0 0; color: var(--text-muted); font-size: 0.86rem; line-height: 1.5; }
.album-gallery-study-link-confirm-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; margin-top: 0.2rem; }
.album-gallery-study-link-confirm-actions button { min-height: 2.75rem; border-radius: 0.85rem; font-weight: 700; }
@media (max-width: 700px) {
	.album-gallery-media-lightbox-stage { grid-template-columns: 1fr; }
	.album-gallery-lightbox-media-host { grid-column: 1; grid-row: 1; }
	.album-gallery-video-badge { right: 6px; bottom: 6px; width: 28px; height: 28px; }
}
@media (max-width: 420px) {
	.album-gallery-study-link-confirm-modal { width: calc(100vw - 1.25rem); }
	.album-gallery-study-link-confirm-actions { grid-template-columns: 1fr; }
	.album-gallery-study-link-confirm-actions .mod-cta { order: -1; }
}
`;
	document.head.appendChild(style);
};
