export const EKATECH_STUDY_ALBUM_KIND = 'ekatech-study-mistakes' as const;
export const EKATECH_STUDY_ALBUM_NAME = 'Hata Defteri';
export const EKATECH_STUDY_IMPORT_TYPE = 'ekatech-study-mistake-import';
export const EKATECH_STUDY_IMPORT_EXTENSION = 'ekastudyimport';
export const EKATECH_STUDY_IMPORT_MIME = 'application/vnd.ekatech.study-import+json';
export const EKATECH_STUDY_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const EKATECH_STUDY_MAX_PACKAGE_SOURCE_BYTES = 120 * 1024 * 1024;

export interface EkatechStudyImportQuestion {
	id: string;
	title: string;
	originalName: string;
	mimeType: string;
	dataBase64: string;
}

export interface EkatechStudyImportPackage {
	version: 1;
	type: typeof EKATECH_STUDY_IMPORT_TYPE;
	source: 'obsidian-album-gallery';
	createdAt: string;
	gallery: {
		id: string;
		title: string;
		fileName: string;
	};
	album: {
		id: string;
		name: string;
	};
	defaults: {
		examType: 'TYT';
		lessonID: '';
		topicID: '';
		sourceName: 'Obsidian ile aktarıldı';
		questionNote: 'Obsidian ile aktarıldı';
		reviewIntervalDays: 7;
	};
	questions: EkatechStudyImportQuestion[];
}

export function createEkatechStudyLinkNonce(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

export function createEkatechStudyConnectURL(nonce: string): string {
	const callback = 'obsidian://ekatech-study-link';
	return `ekatechstudy://obsidian/connect?callback=${encodeURIComponent(callback)}&nonce=${encodeURIComponent(nonce)}`;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	const chunkSize = 0x8000;
	let binary = '';
	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
		binary += String.fromCharCode(...chunk);
	}
	return btoa(binary);
}

export function mimeTypeForImageName(filename: string): string {
	const extension = filename.toLowerCase().split('.').pop() ?? '';
	const mapping: Record<string, string> = {
		avif: 'image/avif',
		bmp: 'image/bmp',
		gif: 'image/gif',
		heic: 'image/heic',
		heif: 'image/heif',
		jpeg: 'image/jpeg',
		jpg: 'image/jpeg',
		png: 'image/png',
		svg: 'image/svg+xml',
		tif: 'image/tiff',
		tiff: 'image/tiff',
		webp: 'image/webp',
	};
	return mapping[extension] ?? 'application/octet-stream';
}

export function safeExportFilename(value: string): string {
	const normalized = value
		.replace(/[\\/:*?"<>|\u0000-\u001F]/g, '-')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 80);
	return normalized || 'Obsidian Hata Defteri';
}
