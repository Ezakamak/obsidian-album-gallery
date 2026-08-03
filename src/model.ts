export type GallerySort = 'name-asc' | 'name-desc' | 'modified-asc' | 'modified-desc';

export interface GalleryAlbum {
	id: string;
	name: string;
	folderPath: string;
	coverPath?: string;
	createdAt: number;
}

export interface GalleryLayout {
	thumbnailSize: number;
	gap: number;
	sort: GallerySort;
}

export interface GalleryDocument {
	version: 1;
	title: string;
	albums: GalleryAlbum[];
	layout: GalleryLayout;
}

const DEFAULT_LAYOUT: GalleryLayout = {
	thumbnailSize: 220,
	gap: 12,
	sort: 'modified-desc',
};

export function createGalleryDocument(title: string): GalleryDocument {
	return {
		version: 1,
		title,
		albums: [],
		layout: { ...DEFAULT_LAYOUT },
	};
}

export function createAlbumId(): string {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function parseGalleryDocument(raw: string, fallbackTitle: string): GalleryDocument {
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!isRecord(parsed)) {
			return createGalleryDocument(fallbackTitle);
		}

		const albumsValue = Array.isArray(parsed.albums) ? parsed.albums : [];
		const albums = albumsValue
			.map(parseAlbum)
			.filter((album): album is GalleryAlbum => album !== null);

		return {
			version: 1,
			title: readNonEmptyString(parsed.title) ?? fallbackTitle,
			albums,
			layout: parseLayout(parsed.layout),
		};
	} catch {
		return createGalleryDocument(fallbackTitle);
	}
}

export function serializeGalleryDocument(document: GalleryDocument): string {
	return `${JSON.stringify(document, null, 2)}\n`;
}

function parseAlbum(value: unknown): GalleryAlbum | null {
	if (!isRecord(value)) {
		return null;
	}

	const id = readNonEmptyString(value.id);
	const name = readNonEmptyString(value.name);
	const folderPath = readNonEmptyString(value.folderPath);
	if (!id || !name || !folderPath) {
		return null;
	}

	const coverPath = readNonEmptyString(value.coverPath);
	const createdAt = typeof value.createdAt === 'number' && Number.isFinite(value.createdAt)
		? value.createdAt
		: Date.now();

	return {
		id,
		name,
		folderPath,
		...(coverPath ? { coverPath } : {}),
		createdAt,
	};
}

function parseLayout(value: unknown): GalleryLayout {
	if (!isRecord(value)) {
		return { ...DEFAULT_LAYOUT };
	}

	const thumbnailSize = clampNumber(value.thumbnailSize, 120, 420, DEFAULT_LAYOUT.thumbnailSize);
	const gap = clampNumber(value.gap, 0, 32, DEFAULT_LAYOUT.gap);
	const sort = isGallerySort(value.sort) ? value.sort : DEFAULT_LAYOUT.sort;

	return { thumbnailSize, gap, sort };
}

function isGallerySort(value: unknown): value is GallerySort {
	return value === 'name-asc'
		|| value === 'name-desc'
		|| value === 'modified-asc'
		|| value === 'modified-desc';
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return fallback;
	}
	return Math.min(max, Math.max(min, Math.round(value)));
}

function readNonEmptyString(value: unknown): string | null {
	if (typeof value !== 'string') {
		return null;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
