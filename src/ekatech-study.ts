export const EKATECH_STUDY_ALBUM_KIND = 'ekatech-study-mistakes' as const;
export const EKATECH_STUDY_ALBUM_NAME = 'Hata Defteri';
export const EKATECH_STUDY_API_BASE = 'https://ekatech.net';
export const EKATECH_STUDY_CALLBACK = 'obsidian://album-gallery-auth';
export const EKATECH_STUDY_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export type EkatechStudySyncState = 'pending' | 'uploading' | 'synced' | 'failed' | 'quota';

export interface EkatechStudyQuota {
	featureKey: string;
	period: 'monthly';
	periodKey: string;
	startsAt: string;
	resetsAt: string;
	unlimited: boolean;
	used: number;
	limit: number | null;
	remaining: number | null;
	exhausted: boolean;
	plan: string;
	accessSource: string;
}

export interface EkatechStudyAccount {
	id: string;
	email: string | null;
	displayName: string;
	role: string;
	plan: string;
}

export interface EkatechStudyTopic {
	id: string;
	label: string;
}

export interface EkatechStudySubject {
	id: string;
	label: string;
	topics: EkatechStudyTopic[];
}

export interface EkatechStudyExam {
	id: string;
	label: string;
	subjects: EkatechStudySubject[];
}

export interface EkatechStudyOption {
	id: string;
	label: string;
}

export interface EkatechStudyReviewInterval {
	days: number;
	label: string;
}

export interface EkatechStudyMistakeDefaults {
	examType: string;
	subjectCode: string;
	topicCode: string;
	mistakeType: string;
	reviewIntervalDays: number;
	sourceName: string;
	questionNote: string;
	solutionNote: string;
}

export interface EkatechStudyStatus {
	connected: true;
	account: EkatechStudyAccount;
	session?: { vaultId: string; expiresAt: string };
	quota: EkatechStudyQuota;
	defaults: EkatechStudyMistakeDefaults;
	mistakeTypes: EkatechStudyOption[];
	reviewIntervals: EkatechStudyReviewInterval[];
	curriculum: EkatechStudyExam[];
}

export interface EkatechStudyUploadResult {
	processed: boolean;
	idempotent: boolean;
	mistakeId: string;
	quota: EkatechStudyQuota;
}

export interface StudyApiEnvelope<T> {
	ok: boolean;
	data?: T;
	error?: {
		code?: string;
		message?: string;
		quota?: EkatechStudyQuota;
	};
}

export function createSecureIdentifier(prefix: string): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return `${prefix}${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;
	}
	return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export function createEkatechStudyAuthURL(state: string, vaultId: string): string {
	const url = new URL('/api/study/obsidian/auth/start', EKATECH_STUDY_API_BASE);
	url.searchParams.set('redirect_uri', EKATECH_STUDY_CALLBACK);
	url.searchParams.set('state', state);
	url.searchParams.set('vault_id', vaultId);
	return url.toString();
}

export function mimeTypeForImageName(filename: string): string {
	const extension = filename.toLowerCase().split('.').pop() ?? '';
	const mapping: Record<string, string> = {
		heic: 'image/heic',
		heif: 'image/heif',
		jpeg: 'image/jpeg',
		jpg: 'image/jpeg',
		png: 'image/png',
		webp: 'image/webp',
	};
	return mapping[extension] ?? 'application/octet-stream';
}

export function isStudyCloudImage(filename: string, mimeType = ''): boolean {
	const resolved = mimeType.toLowerCase() || mimeTypeForImageName(filename);
	return resolved === 'image/jpeg'
		|| resolved === 'image/png'
		|| resolved === 'image/webp'
		|| resolved === 'image/heic'
		|| resolved === 'image/heif';
}

function utf8(value: string): Uint8Array {
	return new TextEncoder().encode(value);
}

export function createMultipartBody(
	fields: Record<string, string>,
	file: { fieldName: string; filename: string; contentType: string; bytes: ArrayBuffer },
): { boundary: string; body: ArrayBuffer } {
	const boundary = `----AlbumGallery${createSecureIdentifier('').slice(0, 48)}`;
	const chunks: Uint8Array[] = [];
	for (const [key, value] of Object.entries(fields)) {
		chunks.push(utf8(`--${boundary}\r\nContent-Disposition: form-data; name="${key.replace(/["\\]/g, '')}"\r\n\r\n${value}\r\n`));
	}
	const safeFilename = file.filename.replace(/["\\\r\n]/g, '-');
	chunks.push(utf8(
		`--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldName}"; filename="${safeFilename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`,
	));
	chunks.push(new Uint8Array(file.bytes));
	chunks.push(utf8(`\r\n--${boundary}--\r\n`));
	const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
	const output = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		output.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return { boundary, body: output.buffer };
}
