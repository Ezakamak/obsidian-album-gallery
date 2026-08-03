export type GallerySort = 'added-desc' | 'added-asc' | 'name-asc' | 'name-desc';
export type GalleryAlbumKind = 'standard' | 'ekatech-study-mistakes';

export interface GalleryStudyMetadata {
	accountId: string;
	examType: string;
	subjectCode: string;
	topicCode: string;
	mistakeType: string;
	reviewIntervalDays: number;
	sourceName: string;
	questionNote: string;
	solutionNote: string;
	syncState: 'pending' | 'uploading' | 'synced' | 'failed' | 'quota';
	remoteMistakeId?: string;
	lastError?: string;
	lastAttemptAt?: number;
	syncedAt?: number;
}

export interface GalleryImage {
	id: string;
	path: string;
	name: string;
	addedAt: number;
	study?: GalleryStudyMetadata;
}

export interface GalleryAlbum {
	id: string;
	name: string;
	images: GalleryImage[];
	coverImageId?: string;
	kind?: GalleryAlbumKind;
	studyAccountId?: string;
	createdAt: number;
	updatedAt: number;
}

export interface GalleryLayout {
	thumbnailSize: number;
	gap: number;
	sort: GallerySort;
}

export interface GalleryDocument {
	version: 2;
	id: string;
	title: string;
	albums: GalleryAlbum[];
	layout: GalleryLayout;
}

const DEFAULT_LAYOUT: GalleryLayout = {
	thumbnailSize: 220,
	gap: 4,
	sort: 'added-desc',
};

export function createId(): string {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createGalleryDocument(title: string): GalleryDocument {
	return {
		version: 2,
		id: createId(),
		title,
		albums: [],
		layout: { ...DEFAULT_LAYOUT },
	};
}

export function createGalleryAlbum(name: string, kind: GalleryAlbumKind = 'standard', studyAccountId?: string): GalleryAlbum {
	const now = Date.now();
	return {
		id: createId(),
		name,
		images: [],
		...(kind !== 'standard' ? { kind } : {}),
		...(studyAccountId ? { studyAccountId } : {}),
		createdAt: now,
		updatedAt: now,
	};
}

export function createGalleryImage(path: string, name: string, addedAt = Date.now(), study?: GalleryStudyMetadata): GalleryImage {
	return {
		id: createId(),
		path,
		name,
		addedAt,
		...(study ? { study } : {}),
	};
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
			version: 2,
			id: readNonEmptyString(parsed.id) ?? createId(),
			title: readNonEmptyString(parsed.title) ?? fallbackTitle,
			albums,
			layout: parseLayout(parsed.layout),
		};
	} catch {
		return createGalleryDocument(fallbackTitle);
	}
}

export function isGalleryDocumentV2(raw: string): boolean {
	try {
		const parsed: unknown = JSON.parse(raw);
		return isRecord(parsed) && parsed.version === 2 && typeof parsed.id === 'string';
	} catch {
		return false;
	}
}

export function serializeGalleryDocument(document: GalleryDocument): string {
	return `${JSON.stringify(document, null, 2)}\n`;
}

export function sortImages(images: GalleryImage[], sort: GallerySort): GalleryImage[] {
	return [...images].sort((left, right) => {
		switch (sort) {
			case 'name-asc':
				return left.name.localeCompare(right.name);
			case 'name-desc':
				return right.name.localeCompare(left.name);
			case 'added-asc':
				return left.addedAt - right.addedAt;
			case 'added-desc':
				return right.addedAt - left.addedAt;
		}
	});
}

function parseAlbum(value: unknown): GalleryAlbum | null {
	if (!isRecord(value)) {
		return null;
	}

	const id = readNonEmptyString(value.id) ?? createId();
	const name = readNonEmptyString(value.name);
	if (!name) {
		return null;
	}

	const imagesValue = Array.isArray(value.images) ? value.images : [];
	const images = imagesValue
		.map(parseImage)
		.filter((image): image is GalleryImage => image !== null);

	const createdAt = readFiniteNumber(value.createdAt) ?? Date.now();
	const updatedAt = readFiniteNumber(value.updatedAt) ?? createdAt;
	const coverImageId = readNonEmptyString(value.coverImageId);
	const kindValue = readNonEmptyString(value.kind);
	const kind: GalleryAlbumKind = kindValue === 'ekatech-study-mistakes'
		? 'ekatech-study-mistakes'
		: 'standard';
	const studyAccountId = readNonEmptyString(value.studyAccountId);

	return {
		id,
		name,
		images,
		...(coverImageId ? { coverImageId } : {}),
		...(kind !== 'standard' ? { kind } : {}),
		...(studyAccountId ? { studyAccountId } : {}),
		createdAt,
		updatedAt,
	};
}

function parseImage(value: unknown): GalleryImage | null {
	if (!isRecord(value)) {
		return null;
	}

	const path = readNonEmptyString(value.path);
	const name = readNonEmptyString(value.name);
	if (!path || !name) {
		return null;
	}

	const study = parseStudyMetadata(value.study);
	return {
		id: readNonEmptyString(value.id) ?? createId(),
		path,
		name,
		addedAt: readFiniteNumber(value.addedAt) ?? Date.now(),
		...(study ? { study } : {}),
	};
}

function parseStudyMetadata(value: unknown): GalleryStudyMetadata | null {
	if (!isRecord(value)) return null;
	const accountId = readNonEmptyString(value.accountId);
	const examType = readNonEmptyString(value.examType);
	const subjectCode = readNonEmptyString(value.subjectCode);
	const topicCode = readNonEmptyString(value.topicCode);
	const mistakeType = readNonEmptyString(value.mistakeType);
	const sourceName = typeof value.sourceName === 'string' ? value.sourceName : '';
	const syncValue = readNonEmptyString(value.syncState);
	const syncState: GalleryStudyMetadata['syncState'] = syncValue === 'uploading'
		|| syncValue === 'synced'
		|| syncValue === 'failed'
		|| syncValue === 'quota'
		? syncValue
		: 'pending';
	if (!accountId || !examType || !subjectCode || !topicCode || !mistakeType) return null;
	return {
		accountId,
		examType,
		subjectCode,
		topicCode,
		mistakeType,
		reviewIntervalDays: readFiniteNumber(value.reviewIntervalDays) ?? 7,
		sourceName,
		questionNote: typeof value.questionNote === 'string' ? value.questionNote : '',
		solutionNote: typeof value.solutionNote === 'string' ? value.solutionNote : '',
		syncState,
		...(readNonEmptyString(value.remoteMistakeId) ? { remoteMistakeId: readNonEmptyString(value.remoteMistakeId) ?? undefined } : {}),
		...(typeof value.lastError === 'string' && value.lastError ? { lastError: value.lastError } : {}),
		...(readFiniteNumber(value.lastAttemptAt) !== null ? { lastAttemptAt: readFiniteNumber(value.lastAttemptAt) ?? undefined } : {}),
		...(readFiniteNumber(value.syncedAt) !== null ? { syncedAt: readFiniteNumber(value.syncedAt) ?? undefined } : {}),
	};
}

function parseLayout(value: unknown): GalleryLayout {
	if (!isRecord(value)) {
		return { ...DEFAULT_LAYOUT };
	}

	const rawSort = readNonEmptyString(value.sort);
	const sort: GallerySort = isGallerySort(rawSort)
		? rawSort
		: rawSort === 'modified-asc'
			? 'added-asc'
			: 'added-desc';

	return {
		thumbnailSize: clampNumber(value.thumbnailSize, 120, 420, DEFAULT_LAYOUT.thumbnailSize),
		gap: clampNumber(value.gap, 0, 24, DEFAULT_LAYOUT.gap),
		sort,
	};
}

function isGallerySort(value: unknown): value is GallerySort {
	return value === 'added-desc'
		|| value === 'added-asc'
		|| value === 'name-asc'
		|| value === 'name-desc';
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return fallback;
	}
	return Math.min(max, Math.max(min, Math.round(value)));
}

function readFiniteNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
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
