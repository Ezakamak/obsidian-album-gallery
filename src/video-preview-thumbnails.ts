import type { AlbumGalleryView } from './gallery-view';

interface GalleryMediaReference {
	name: string;
	path: string;
}

interface MediaRenderHost {
	renderImageElement(
		container: HTMLElement,
		image: GalleryMediaReference,
		alt: string,
	): HTMLElement | void;
	__albumGalleryVideoPreviewThumbnailsInstalled?: boolean;
}

function previewSeekTime(duration: number): number {
	if (!Number.isFinite(duration) || duration <= 0.2) return 0;
	const latestSafeFrame = Math.max(0.05, duration - 0.08);
	return Math.min(Math.max(duration * 0.08, 0.35), 1.5, latestSafeFrame);
}

function isMostlyBlackFrame(
	context: CanvasRenderingContext2D,
	width: number,
	height: number,
): boolean {
	const sampleWidth = Math.min(24, width);
	const sampleHeight = Math.min(24, height);
	if (sampleWidth < 2 || sampleHeight < 2) return false;

	const sample = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
	let luminanceTotal = 0;
	let visiblePixels = 0;
	for (let index = 0; index < sample.length; index += 4) {
		const alpha = sample[index + 3] ?? 0;
		if (alpha < 16) continue;
		const red = sample[index] ?? 0;
		const green = sample[index + 1] ?? 0;
		const blue = sample[index + 2] ?? 0;
		luminanceTotal += red * 0.2126 + green * 0.7152 + blue * 0.0722;
		visiblePixels += 1;
	}
	return visiblePixels > 0 && luminanceTotal / visiblePixels < 10;
}

function createVideoPoster(video: HTMLVideoElement): boolean {
	if (!video.videoWidth || !video.videoHeight) return false;

	const maxWidth = 480;
	const scale = Math.min(1, maxWidth / video.videoWidth);
	const width = Math.max(2, Math.round(video.videoWidth * scale));
	const height = Math.max(2, Math.round(video.videoHeight * scale));
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d', {
		alpha: false,
		willReadFrequently: true,
	});
	if (!context) return false;
	context.drawImage(video, 0, 0, width, height);

	const sampleCanvas = document.createElement('canvas');
	sampleCanvas.width = Math.min(24, width);
	sampleCanvas.height = Math.min(24, height);
	const sampleContext = sampleCanvas.getContext('2d', {
		alpha: false,
		willReadFrequently: true,
	});
	if (sampleContext) {
		sampleContext.drawImage(
			canvas,
			0,
			0,
			sampleCanvas.width,
			sampleCanvas.height,
		);
		if (isMostlyBlackFrame(sampleContext, sampleCanvas.width, sampleCanvas.height)) {
			return false;
		}
	}

	video.poster = canvas.toDataURL('image/jpeg', 0.76);
	video.classList.add('is-preview-ready');
	return true;
}

function prepareVideoPreview(video: HTMLVideoElement): void {
	video.muted = true;
	video.playsInline = true;
	video.controls = false;
	video.preload = 'auto';
	video.setAttribute('preload', 'auto');

	const source = video.currentSrc || video.src;
	if (source) video.src = `${source.split('#')[0]}#t=0.1`;

	let captureAttempts = 0;
	let targetTime = 0;
	const revealFrame = (): void => {
		try {
			if (createVideoPoster(video)) return;
		} catch (error) {
			console.debug('Album Gallery could not create a video poster.', error);
		}
		video.classList.add('is-preview-ready');
	};
	const seekToPreview = (): void => {
		targetTime = previewSeekTime(video.duration);
		try {
			if (Math.abs(video.currentTime - targetTime) > 0.04) {
				video.currentTime = targetTime;
				return;
			}
		} catch (error) {
			console.debug('Album Gallery could not seek the video preview.', error);
		}
		revealFrame();
	};

	video.addEventListener('loadedmetadata', seekToPreview, { once: true });
	video.addEventListener('seeked', () => {
		captureAttempts += 1;
		try {
			if (createVideoPoster(video)) return;
		} catch (error) {
			console.debug('Album Gallery could not capture the selected video frame.', error);
		}

		const duration = video.duration;
		if (
			captureAttempts < 3
			&& Number.isFinite(duration)
			&& duration > targetTime + 0.35
		) {
			targetTime = Math.min(
				duration - 0.08,
				targetTime + Math.max(0.5, duration * 0.12),
			);
			try {
				video.currentTime = targetTime;
				return;
			} catch (error) {
				console.debug('Album Gallery could not seek to a later video frame.', error);
			}
		}
		video.classList.add('is-preview-ready');
	});
	video.addEventListener('loadeddata', () => {
		if (!video.seeking && !video.poster) revealFrame();
	}, { once: true });
	video.addEventListener('error', () => {
		video.classList.add('is-broken');
	}, { once: true });
	video.load();
}

export function installVideoPreviewThumbnails(view: AlbumGalleryView): void {
	const host = view as unknown as MediaRenderHost;
	if (host.__albumGalleryVideoPreviewThumbnailsInstalled) return;
	host.__albumGalleryVideoPreviewThumbnailsInstalled = true;

	const originalRenderMedia = host.renderImageElement.bind(view);
	host.renderImageElement = (container, image, alt) => {
		const existingElements = new Set(Array.from(container.children));
		const result = originalRenderMedia(container, image, alt);
		const renderedVideo = result instanceof HTMLVideoElement
			? result
			: Array.from(container.children).find((element): element is HTMLVideoElement => (
				element instanceof HTMLVideoElement && !existingElements.has(element)
			));
		if (renderedVideo) prepareVideoPreview(renderedVideo);
		return result;
	};
}
