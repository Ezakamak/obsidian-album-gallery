/* Album Gallery 0.6.2 — standalone mobile-safe bundle with generated video thumbnails. */
'use strict';
const __modules = Object.create(null);
__modules["constants"] = function(module, exports, __require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_MEDIA_EXTENSIONS = exports.SUPPORTED_VIDEO_EXTENSIONS = exports.SUPPORTED_IMAGE_EXTENSIONS = exports.STUDY_PHOTO_PICKER_ACCEPT = exports.STANDARD_MEDIA_PICKER_ACCEPT = exports.ASSET_ROOT_FOLDER = exports.DEFAULT_GALLERY_BASENAME = exports.GALLERY_EXTENSION = exports.GALLERY_VIEW_TYPE = void 0;
exports.GALLERY_VIEW_TYPE = 'album-gallery-view';
exports.GALLERY_EXTENSION = 'gallery';
exports.DEFAULT_GALLERY_BASENAME = 'Untitled gallery';
exports.ASSET_ROOT_FOLDER = 'Album Gallery Assets';
exports.STANDARD_MEDIA_PICKER_ACCEPT = 'image/*,video/mp4,video/quicktime,video/webm,.heic,.heif,.tif,.tiff,.mp4,.mov,.webm';
exports.STUDY_PHOTO_PICKER_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif';
exports.SUPPORTED_IMAGE_EXTENSIONS = new Set([
    'avif',
    'bmp',
    'gif',
    'heic',
    'heif',
    'jpeg',
    'jpg',
    'png',
    'svg',
    'tif',
    'tiff',
    'webp',
]);
exports.SUPPORTED_VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm']);
exports.SUPPORTED_MEDIA_EXTENSIONS = new Set([
    ...exports.SUPPORTED_IMAGE_EXTENSIONS,
    ...exports.SUPPORTED_VIDEO_EXTENSIONS,
]);

};
__modules["ekatech-study"] = function(module, exports, __require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EKATECH_STUDY_MAX_IMAGE_BYTES = exports.EKATECH_STUDY_CALLBACK = exports.EKATECH_STUDY_API_BASE = exports.EKATECH_STUDY_ALBUM_NAME = exports.EKATECH_STUDY_ALBUM_KIND = void 0;
exports.createSecureIdentifier = createSecureIdentifier;
exports.createEkatechStudyAuthURL = createEkatechStudyAuthURL;
exports.mimeTypeForImageName = mimeTypeForImageName;
exports.isStudyCloudImage = isStudyCloudImage;
exports.createMultipartBody = createMultipartBody;
exports.EKATECH_STUDY_ALBUM_KIND = 'ekatech-study-mistakes';
exports.EKATECH_STUDY_ALBUM_NAME = 'Hata Defteri';
exports.EKATECH_STUDY_API_BASE = 'https://ekatech.net';
exports.EKATECH_STUDY_CALLBACK = 'obsidian://album-gallery-auth';
exports.EKATECH_STUDY_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
function createSecureIdentifier(prefix) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${prefix}${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;
    }
    return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}
function createEkatechStudyAuthURL(state, vaultId) {
    const url = new URL('/api/study/obsidian/auth/start', exports.EKATECH_STUDY_API_BASE);
    url.searchParams.set('redirect_uri', exports.EKATECH_STUDY_CALLBACK);
    url.searchParams.set('state', state);
    url.searchParams.set('vault_id', vaultId);
    return url.toString();
}
function mimeTypeForImageName(filename) {
    const extension = filename.toLowerCase().split('.').pop() ?? '';
    const mapping = {
        heic: 'image/heic',
        heif: 'image/heif',
        jpeg: 'image/jpeg',
        jpg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
    };
    return mapping[extension] ?? 'application/octet-stream';
}
function isStudyCloudImage(filename, mimeType = '') {
    const resolved = mimeType.toLowerCase() || mimeTypeForImageName(filename);
    return resolved === 'image/jpeg'
        || resolved === 'image/png'
        || resolved === 'image/webp'
        || resolved === 'image/heic'
        || resolved === 'image/heif';
}
function utf8(value) {
    return new TextEncoder().encode(value);
}
function createMultipartBody(fields, file) {
    const boundary = `----AlbumGallery${createSecureIdentifier('').slice(0, 48)}`;
    const chunks = [];
    for (const [key, value] of Object.entries(fields)) {
        chunks.push(utf8(`--${boundary}\r\nContent-Disposition: form-data; name="${key.replace(/["\\]/g, '')}"\r\n\r\n${value}\r\n`));
    }
    const safeFilename = file.filename.replace(/["\\\r\n]/g, '-');
    chunks.push(utf8(`--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldName}"; filename="${safeFilename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`));
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

};
__modules["folder-suggest"] = function(module, exports, __require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FolderSuggestModal = void 0;
const obsidian_1 = require("obsidian");
class FolderSuggestModal extends obsidian_1.FuzzySuggestModal {
    constructor(app, onChoose) {
        super(app);
        this.onChoose = onChoose;
        this.setPlaceholder('Choose a folder');
    }
    getItems() {
        return this.app.vault.getAllLoadedFiles().filter((file) => file instanceof obsidian_1.TFolder);
    }
    getItemText(folder) {
        return folder.path || '/';
    }
    onChooseItem(folder) {
        this.onChoose(folder);
    }
}
exports.FolderSuggestModal = FolderSuggestModal;

};
__modules["model"] = function(module, exports, __require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createId = createId;
exports.createGalleryDocument = createGalleryDocument;
exports.createGalleryAlbum = createGalleryAlbum;
exports.createGalleryImage = createGalleryImage;
exports.parseGalleryDocument = parseGalleryDocument;
exports.isGalleryDocumentV2 = isGalleryDocumentV2;
exports.serializeGalleryDocument = serializeGalleryDocument;
exports.sortImages = sortImages;
const DEFAULT_LAYOUT = {
    thumbnailSize: 220,
    gap: 4,
    sort: 'added-desc',
};
function createId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
function createGalleryDocument(title) {
    return {
        version: 2,
        id: createId(),
        title,
        albums: [],
        layout: { ...DEFAULT_LAYOUT },
    };
}
function createGalleryAlbum(name, kind = 'standard', studyAccountId) {
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
function createGalleryImage(path, name, addedAt = Date.now(), study) {
    return {
        id: createId(),
        path,
        name,
        addedAt,
        ...(study ? { study } : {}),
    };
}
function parseGalleryDocument(raw, fallbackTitle) {
    try {
        const parsed = JSON.parse(raw);
        if (!isRecord(parsed)) {
            return createGalleryDocument(fallbackTitle);
        }
        const albumsValue = Array.isArray(parsed.albums) ? parsed.albums : [];
        const albums = albumsValue
            .map(parseAlbum)
            .filter((album) => album !== null);
        return {
            version: 2,
            id: readNonEmptyString(parsed.id) ?? createId(),
            title: readNonEmptyString(parsed.title) ?? fallbackTitle,
            albums,
            layout: parseLayout(parsed.layout),
        };
    }
    catch {
        return createGalleryDocument(fallbackTitle);
    }
}
function isGalleryDocumentV2(raw) {
    try {
        const parsed = JSON.parse(raw);
        return isRecord(parsed) && parsed.version === 2 && typeof parsed.id === 'string';
    }
    catch {
        return false;
    }
}
function serializeGalleryDocument(document) {
    return `${JSON.stringify(document, null, 2)}\n`;
}
function sortImages(images, sort) {
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
function parseAlbum(value) {
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
        .filter((image) => image !== null);
    const createdAt = readFiniteNumber(value.createdAt) ?? Date.now();
    const updatedAt = readFiniteNumber(value.updatedAt) ?? createdAt;
    const coverImageId = readNonEmptyString(value.coverImageId);
    const kindValue = readNonEmptyString(value.kind);
    const kind = kindValue === 'ekatech-study-mistakes'
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
function parseImage(value) {
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
function parseStudyMetadata(value) {
    if (!isRecord(value))
        return null;
    const accountId = readNonEmptyString(value.accountId);
    const examType = readNonEmptyString(value.examType);
    const subjectCode = readNonEmptyString(value.subjectCode);
    const topicCode = readNonEmptyString(value.topicCode);
    const mistakeType = readNonEmptyString(value.mistakeType);
    const sourceName = typeof value.sourceName === 'string' ? value.sourceName : '';
    const syncValue = readNonEmptyString(value.syncState);
    const syncState = syncValue === 'uploading'
        || syncValue === 'synced'
        || syncValue === 'failed'
        || syncValue === 'quota'
        ? syncValue
        : 'pending';
    if (!accountId || !examType || !subjectCode || !topicCode || !mistakeType)
        return null;
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
function parseLayout(value) {
    if (!isRecord(value)) {
        return { ...DEFAULT_LAYOUT };
    }
    const rawSort = readNonEmptyString(value.sort);
    const sort = isGallerySort(rawSort)
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
function isGallerySort(value) {
    return value === 'added-desc'
        || value === 'added-asc'
        || value === 'name-asc'
        || value === 'name-desc';
}
function clampNumber(value, min, max, fallback) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }
    return Math.min(max, Math.max(min, Math.round(value)));
}
function readFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function readNonEmptyString(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

};
__modules["gallery-view"] = function(module, exports, __require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlbumGalleryView = void 0;
const obsidian_1 = require("obsidian");
const constants_1 = __require("constants");
const model_1 = __require("model");
const ekatech_study_1 = __require("ekatech-study");
function mediaExtension(name) {
    return name.toLowerCase().split('.').pop() ?? '';
}
function isVideoMedia(image) {
    return constants_1.SUPPORTED_VIDEO_EXTENSIONS.has(mediaExtension(image.name || image.path));
}
function previewSeekTime(duration) {
    if (!Number.isFinite(duration) || duration <= 0.2)
        return 0;
    const latestSafeFrame = Math.max(0.05, duration - 0.08);
    return Math.min(Math.max(duration * 0.08, 0.35), 1.5, latestSafeFrame);
}
function isMostlyBlackFrame(context, width, height) {
    const sampleWidth = Math.min(24, width);
    const sampleHeight = Math.min(24, height);
    if (sampleWidth < 2 || sampleHeight < 2)
        return false;
    const sample = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
    let luminanceTotal = 0;
    let visiblePixels = 0;
    for (let index = 0; index < sample.length; index += 4) {
        if (sample[index + 3] < 16)
            continue;
        luminanceTotal += sample[index] * 0.2126 + sample[index + 1] * 0.7152 + sample[index + 2] * 0.0722;
        visiblePixels += 1;
    }
    return visiblePixels > 0 && luminanceTotal / visiblePixels < 10;
}
function createVideoPoster(video) {
    if (!video.videoWidth || !video.videoHeight)
        return false;
    const maxWidth = 480;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const width = Math.max(2, Math.round(video.videoWidth * scale));
    const height = Math.max(2, Math.round(video.videoHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    if (!context)
        return false;
    context.drawImage(video, 0, 0, width, height);
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = Math.min(24, width);
    sampleCanvas.height = Math.min(24, height);
    const sampleContext = sampleCanvas.getContext('2d', { alpha: false, willReadFrequently: true });
    if (sampleContext) {
        sampleContext.drawImage(canvas, 0, 0, sampleCanvas.width, sampleCanvas.height);
        if (isMostlyBlackFrame(sampleContext, sampleCanvas.width, sampleCanvas.height))
            return false;
    }
    video.poster = canvas.toDataURL('image/jpeg', 0.76);
    video.addClass('is-preview-ready');
    return true;
}
function prepareVideoPreview(video, resource) {
    video.muted = true;
    video.playsInline = true;
    video.controls = false;
    video.preload = 'auto';
    video.setAttr('preload', 'auto');
    video.src = `${resource.split('#')[0]}#t=0.1`;
    let captureAttempts = 0;
    let targetTime = 0;
    const revealFrame = () => {
        try {
            if (createVideoPoster(video))
                return;
        }
        catch (error) {
            console.debug('Album Gallery could not create a video poster.', error);
        }
        video.addClass('is-preview-ready');
    };
    const seekToPreview = () => {
        targetTime = previewSeekTime(video.duration);
        try {
            if (Math.abs(video.currentTime - targetTime) > 0.04) {
                video.currentTime = targetTime;
                return;
            }
        }
        catch (error) {
            console.debug('Album Gallery could not seek the video preview.', error);
        }
        revealFrame();
    };
    video.addEventListener('loadedmetadata', seekToPreview, { once: true });
    video.addEventListener('seeked', () => {
        captureAttempts += 1;
        try {
            if (createVideoPoster(video))
                return;
        }
        catch (error) {
            console.debug('Album Gallery could not capture the selected video frame.', error);
        }
        const duration = video.duration;
        if (captureAttempts < 3 && Number.isFinite(duration) && duration > targetTime + 0.35) {
            targetTime = Math.min(duration - 0.08, targetTime + Math.max(0.5, duration * 0.12));
            try {
                video.currentTime = targetTime;
                return;
            }
            catch (error) {
                console.debug('Album Gallery could not seek to a later video frame.', error);
            }
        }
        video.addClass('is-preview-ready');
    });
    video.addEventListener('loadeddata', () => {
        if (!video.seeking && !video.poster)
            revealFrame();
    }, { once: true });
    video.addEventListener('error', () => video.addClass('is-broken'), { once: true });
    video.load();
}
function mediaCount(count, study = false) {
    if (study)
        return `${count} ${count === 1 ? 'photo' : 'photos'}`;
    return `${count} ${count === 1 ? 'item' : 'items'}`;
}
class AlbumGalleryView extends obsidian_1.TextFileView {
    constructor(leaf, plugin) {
        super(leaf);
        this.document = (0, model_1.createGalleryDocument)('Untitled gallery');
        this.activeAlbumId = null;
        this.observer = null;
        this.refreshTimer = null;
        this.importingAlbumId = null;
        this.syncingStudyAlbum = false;
        this.plugin = plugin;
        this.activeTab = plugin.settings.defaultTab;
    }
    getViewType() {
        return constants_1.GALLERY_VIEW_TYPE;
    }
    getDisplayText() {
        return this.file?.basename ?? 'Album Gallery';
    }
    getIcon() {
        return 'images';
    }
    getViewData() {
        return (0, model_1.serializeGalleryDocument)(this.document);
    }
    setViewData(data, clear) {
        if (clear) {
            this.clear();
        }
        this.data = data;
        const fallbackTitle = this.file?.basename ?? 'Untitled gallery';
        this.document = (0, model_1.parseGalleryDocument)(data, fallbackTitle);
        let shouldSave = !(0, model_1.isGalleryDocumentV2)(data);
        if (this.file && this.document.title !== this.file.basename) {
            this.document.title = this.file.basename;
            shouldSave = true;
        }
        if (this.plugin.ekatechStudyConnected && !this.findEkatechStudyAlbum()) {
            this.ensureEkatechStudyAlbum();
            shouldSave = true;
        }
        this.render();
        if (shouldSave) {
            window.setTimeout(() => this.requestSave(), 0);
        }
        if (this.plugin.ekatechStudyConnected) {
            window.setTimeout(() => {
                void this.syncPendingStudyImages(false);
            }, 300);
        }
    }
    clear() {
        this.disconnectObserver();
        this.contentEl.empty();
    }
    async onClose() {
        if (this.refreshTimer !== null) {
            window.clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
        this.disconnectObserver();
        await super.onClose();
    }
    requestVaultRefresh() {
        if (this.importingAlbumId)
            return;
        if (this.refreshTimer !== null)
            window.clearTimeout(this.refreshTimer);
        this.refreshTimer = window.setTimeout(() => {
            this.refreshTimer = null;
            this.render();
        }, 180);
    }
    render() {
        this.disconnectObserver();
        this.contentEl.empty();
        this.contentEl.addClass('album-gallery-view');
        const activeAlbum = this.activeAlbumId
            ? this.getVisibleAlbums().find((album) => album.id === this.activeAlbumId)
            : undefined;
        if (activeAlbum) {
            this.renderAlbum(activeAlbum);
            return;
        }
        this.activeAlbumId = null;
        this.renderLibrary();
    }
    renderLibrary() {
        const visibleAlbums = this.getVisibleAlbums();
        const allMedia = this.getAllImages();
        const header = this.contentEl.createDiv({ cls: 'album-gallery-library-header' });
        const titleGroup = header.createDiv({ cls: 'album-gallery-title-group' });
        titleGroup.createEl('h1', { text: this.document.title });
        titleGroup.createDiv({
            cls: 'album-gallery-library-summary',
            text: `${mediaCount(allMedia.length)} · ${visibleAlbums.length} ${visibleAlbums.length === 1 ? 'album' : 'albums'}`,
        });
        const headerActions = header.createDiv({ cls: 'album-gallery-library-actions' });
        this.renderStudyAccountButton(headerActions);
        const createButton = headerActions.createEl('button', {
            cls: 'album-gallery-round-button mod-cta',
            attr: { type: 'button', 'aria-label': 'Create album' },
        });
        (0, obsidian_1.setIcon)(createButton, 'folder-plus');
        createButton.addEventListener('click', () => this.openCreateAlbumModal());
        this.renderTabBar(allMedia.length);
        if (this.activeTab === 'photos')
            this.renderAllMedia(allMedia);
        else
            this.renderAlbums();
    }
    renderStudyAccountButton(container) {
        const connected = this.plugin.ekatechStudyConnected;
        const button = container.createEl('button', {
            cls: `album-gallery-study-button${connected ? ' is-connected' : ''}`,
            attr: {
                type: 'button',
                'aria-label': connected ? 'Open Study account manager' : 'Connect Ekatech Study',
                'aria-haspopup': 'dialog',
            },
        });
        (0, obsidian_1.setIcon)(button, connected ? 'badge-check' : 'graduation-cap');
        button.createSpan({ text: connected ? 'Study' : 'Study hesabına giriş' });
        button.addEventListener('click', () => {
            if (connected) {
                new StudyAccountManagerModal(this.app, this.plugin).open();
                return;
            }
            this.plugin.beginEkatechStudyLink();
        });
    }
    renderTabBar(itemCount) {
        const tabBar = this.contentEl.createDiv({
            cls: 'album-gallery-tab-bar',
            attr: { role: 'tablist', 'aria-label': 'Gallery sections' },
        });
        this.renderTabButton(tabBar, 'photos', 'Media', 'images', itemCount);
        this.renderTabButton(tabBar, 'albums', 'Albums', 'folder-heart', this.getVisibleAlbums().length);
    }
    renderTabButton(container, tab, label, iconName, count) {
        const isActive = this.activeTab === tab;
        const button = container.createEl('button', {
            cls: `album-gallery-tab${isActive ? ' is-active' : ''}`,
            attr: {
                type: 'button',
                role: 'tab',
                'aria-selected': isActive ? 'true' : 'false',
                'aria-current': isActive ? 'page' : 'false',
            },
        });
        button.disabled = isActive;
        const icon = button.createSpan({ cls: 'album-gallery-tab-icon' });
        (0, obsidian_1.setIcon)(icon, iconName);
        button.createSpan({ cls: 'album-gallery-tab-label', text: label });
        button.createSpan({ cls: 'album-gallery-tab-count', text: String(count) });
        if (!isActive) {
            button.addEventListener('click', () => {
                this.activeTab = tab;
                this.render();
            });
        }
    }
    renderAllMedia(references) {
        if (references.length === 0) {
            this.renderEmptyState('images', 'No media yet', 'Create an album, then choose photos, animated GIFs, or videos. Album Gallery stores them automatically inside the vault.', 'Create album', () => this.openCreateAlbumModal());
            return;
        }
        const section = this.contentEl.createDiv({ cls: 'album-gallery-section' });
        const sectionHeader = section.createDiv({ cls: 'album-gallery-section-heading' });
        sectionHeader.createEl('h2', { text: 'Media' });
        sectionHeader.createDiv({ cls: 'album-gallery-section-count', text: `${references.length}` });
        this.renderPhotoGrid(section, references);
    }
    renderAlbums() {
        const visibleAlbums = this.getVisibleAlbums();
        if (visibleAlbums.length === 0) {
            this.renderEmptyState('folder-heart', 'No albums yet', 'Create an album and add photos, animated GIFs, or videos directly from your device.', 'New album', () => this.openCreateAlbumModal());
            return;
        }
        const section = this.contentEl.createDiv({ cls: 'album-gallery-section' });
        const sectionHeader = section.createDiv({ cls: 'album-gallery-section-heading' });
        sectionHeader.createEl('h2', { text: 'Albums' });
        sectionHeader.createDiv({ cls: 'album-gallery-section-count', text: `${visibleAlbums.length}` });
        const grid = section.createDiv({ cls: 'album-gallery-album-grid' });
        for (const album of visibleAlbums)
            this.renderAlbumCard(grid, album);
    }
    renderAlbumCard(container, album) {
        const isStudyAlbum = album.kind === ekatech_study_1.EKATECH_STUDY_ALBUM_KIND;
        const card = container.createDiv({ cls: `album-gallery-album-card${isStudyAlbum ? ' album-gallery-study-album-card' : ''}` });
        card.setAttr('role', 'button');
        card.setAttr('tabindex', '0');
        card.setAttr('aria-label', `Open ${album.name}`);
        const coverArea = card.createDiv({ cls: 'album-gallery-album-cover' });
        const cover = this.getAlbumCover(album);
        if (cover)
            this.renderImageElement(coverArea, cover, '');
        else {
            const placeholder = coverArea.createDiv({ cls: 'album-gallery-cover-placeholder' });
            (0, obsidian_1.setIcon)(placeholder, 'images');
        }
        const details = card.createDiv({ cls: 'album-gallery-album-details' });
        const nameRow = details.createDiv({ cls: 'album-gallery-album-name-row' });
        nameRow.createEl('h3', { text: album.name });
        if (isStudyAlbum) {
            const badge = nameRow.createSpan({ cls: 'album-gallery-study-badge', text: 'Study' });
            badge.setAttr('aria-label', 'Ekatech Study Hata Defteri');
        }
        details.createDiv({
            cls: 'album-gallery-album-count',
            text: mediaCount(album.images.length, isStudyAlbum),
        });
        const openAlbum = () => {
            this.activeAlbumId = album.id;
            this.render();
        };
        card.addEventListener('click', openAlbum);
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openAlbum();
            }
        });
    }
    renderAlbum(album) {
        const references = this.getAlbumReferences(album);
        const isStudyAlbum = album.kind === ekatech_study_1.EKATECH_STUDY_ALBUM_KIND;
        const header = this.contentEl.createDiv({ cls: 'album-gallery-album-header' });
        const leading = header.createDiv({ cls: 'album-gallery-album-leading' });
        const backButton = leading.createEl('button', {
            cls: 'clickable-icon album-gallery-back-button',
            attr: { type: 'button', 'aria-label': 'Back to library' },
        });
        (0, obsidian_1.setIcon)(backButton, 'chevron-left');
        backButton.addEventListener('click', () => {
            this.activeAlbumId = null;
            this.activeTab = 'albums';
            this.render();
        });
        const titleGroup = leading.createDiv({ cls: 'album-gallery-title-group' });
        titleGroup.createEl('h1', { text: album.name });
        titleGroup.createDiv({
            cls: 'album-gallery-library-summary',
            text: mediaCount(album.images.length, isStudyAlbum),
        });
        const actions = header.createDiv({ cls: 'album-gallery-album-actions' });
        if (isStudyAlbum) {
            const quota = this.plugin.settings.ekatechStudyStatus?.quota;
            actions.createSpan({
                cls: 'album-gallery-study-quota-pill',
                text: quota?.unlimited ? 'Sınırsız' : `${quota?.used ?? 0} / ${quota?.limit ?? 12}`,
            });
        }
        const addButton = actions.createEl('button', {
            cls: 'album-gallery-add-photos-button mod-cta',
            attr: { type: 'button', 'aria-label': isStudyAlbum ? 'Add photos' : 'Add media' },
        });
        (0, obsidian_1.setIcon)(addButton, 'image-plus');
        addButton.createSpan({ text: isStudyAlbum ? 'Add photos' : 'Add media' });
        addButton.addEventListener('click', () => this.openPhotoPicker(album.id));
        const menuButton = actions.createEl('button', {
            cls: 'clickable-icon',
            attr: { type: 'button', 'aria-label': 'Album options' },
        });
        (0, obsidian_1.setIcon)(menuButton, 'ellipsis');
        menuButton.addEventListener('click', (event) => this.openAlbumMenu(event, album));
        if (isStudyAlbum)
            this.renderStudyControls(album);
        if (this.importingAlbumId === album.id) {
            const importing = this.contentEl.createDiv({ cls: 'album-gallery-importing' });
            const spinner = importing.createDiv({ cls: 'album-gallery-spinner' });
            (0, obsidian_1.setIcon)(spinner, 'loader-circle');
            importing.createSpan({ text: isStudyAlbum ? 'Importing photos…' : 'Importing media…' });
        }
        if (references.length === 0) {
            this.renderEmptyState('image-plus', isStudyAlbum ? 'Add photos to this album' : 'Add media to this album', isStudyAlbum
                ? 'Choose JPG, PNG, WebP, HEIC, or HEIF photos. Hata Defteri never accepts GIFs or videos.'
                : 'Choose photos, animated GIFs, MP4/MOV videos, or WebM videos. The plugin manages the storage folder automatically.', isStudyAlbum ? 'Choose photos' : 'Choose media', () => this.openPhotoPicker(album.id));
            return;
        }
        const section = this.contentEl.createDiv({ cls: 'album-gallery-section album-gallery-album-section' });
        this.renderPhotoGrid(section, references);
    }
    renderPhotoGrid(container, references) {
        const grid = container.createDiv({ cls: 'album-gallery-photo-grid' });
        grid.setCssProps({
            '--album-gallery-thumbnail-size': `${this.document.layout.thumbnailSize}px`,
            '--album-gallery-gap': `${this.document.layout.gap}px`,
        });
        let rendered = 0;
        const renderBatch = () => {
            const next = Math.min(rendered + this.plugin.settings.batchSize, references.length);
            for (let index = rendered; index < next; index += 1) {
                const reference = references[index];
                if (reference)
                    this.renderPhotoCard(grid, reference, references, index);
            }
            rendered = next;
        };
        renderBatch();
        if (rendered >= references.length)
            return;
        const sentinel = container.createDiv({
            cls: 'album-gallery-load-sentinel',
            text: 'Loading more media…',
        });
        this.observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                renderBatch();
                if (rendered >= references.length) {
                    this.disconnectObserver();
                    sentinel.remove();
                }
            }
        }, { root: this.contentEl, rootMargin: '700px' });
        this.observer.observe(sentinel);
    }
    renderPhotoCard(container, reference, references, index) {
        const button = container.createEl('button', {
            cls: `album-gallery-photo-card${isVideoMedia(reference.image) ? ' is-video' : ''}`,
            attr: { type: 'button', 'aria-label': `Open ${reference.image.name}` },
        });
        this.renderImageElement(button, reference.image, reference.image.name);
        if (reference.image.study)
            this.renderStudySyncBadge(button, reference.image);
        button.addEventListener('click', () => {
            new MediaLightboxModal(this.app, references, index, (item) => this.confirmDeleteImage(item)).open();
        });
    }
    renderImageElement(container, image, alt) {
        const file = this.app.vault.getFileByPath(image.path);
        if (!file) {
            const placeholder = container.createDiv({ cls: 'album-gallery-missing-photo' });
            (0, obsidian_1.setIcon)(placeholder, 'image-off');
            return;
        }
        const resource = this.app.vault.getResourcePath(file);
        if (isVideoMedia(image)) {
            const video = container.createEl('video', { cls: 'album-gallery-media-video', attr: { 'aria-label': alt, muted: 'true', playsinline: 'true', preload: 'auto', tabindex: '-1' } });
            prepareVideoPreview(video, resource);
            const badge = container.createDiv({ cls: 'album-gallery-video-badge', attr: { 'aria-hidden': 'true' } });
            (0, obsidian_1.setIcon)(badge, 'play');
            return;
        }
        const element = container.createEl('img', { attr: { alt, loading: 'lazy', decoding: 'async' } });
        element.src = resource;
        element.addEventListener('error', () => element.addClass('is-broken'));
    }
    renderEmptyState(iconName, title, description, buttonText, onClick) {
        const empty = this.contentEl.createDiv({ cls: 'album-gallery-empty' });
        const icon = empty.createDiv({ cls: 'album-gallery-empty-icon' });
        (0, obsidian_1.setIcon)(icon, iconName);
        empty.createEl('h2', { text: title });
        empty.createEl('p', { text: description });
        const button = empty.createEl('button', {
            cls: 'mod-cta album-gallery-empty-button',
            text: buttonText,
            attr: { type: 'button' },
        });
        button.addEventListener('click', onClick);
    }
    openCreateAlbumModal() {
        new AlbumNameModal(this.app, {
            title: 'New album',
            submitText: 'Create',
            onSubmit: (name) => {
                const album = (0, model_1.createGalleryAlbum)(name);
                this.document.albums.unshift(album);
                this.activeAlbumId = album.id;
                this.activeTab = 'albums';
                this.requestSave();
                this.render();
            },
        }).open();
    }
    openRenameAlbumModal(album) {
        new AlbumNameModal(this.app, {
            title: 'Rename album',
            initialValue: album.name,
            submitText: 'Save',
            onSubmit: (name) => {
                album.name = name;
                album.updatedAt = Date.now();
                this.requestSave();
                this.render();
            },
        }).open();
    }
    openAlbumMenu(event, album) {
        const menu = new obsidian_1.Menu();
        menu.addItem((item) => item
            .setTitle(album.kind === ekatech_study_1.EKATECH_STUDY_ALBUM_KIND ? 'Add photos' : 'Add media')
            .setIcon('image-plus')
            .onClick(() => this.openPhotoPicker(album.id)));
        if (album.kind === ekatech_study_1.EKATECH_STUDY_ALBUM_KIND) {
            menu.addItem((item) => item
                .setTitle('Senkronizasyonu yeniden dene')
                .setIcon('refresh-cw')
                .onClick(() => {
                void this.syncPendingStudyImages(true);
            }));
        }
        else {
            menu.addItem((item) => item
                .setTitle('Rename album')
                .setIcon('pencil')
                .onClick(() => this.openRenameAlbumModal(album)));
            menu.addSeparator();
            menu.addItem((item) => item
                .setTitle('Delete album')
                .setIcon('trash-2')
                .onClick(() => this.confirmDeleteAlbum(album)));
        }
        menu.showAtMouseEvent(event);
    }
    ensureEkatechStudyAlbum() {
        const accountId = this.plugin.ekatechStudyAccountId;
        if (!accountId)
            throw new Error('Study account is not connected.');
        const existing = this.findEkatechStudyAlbum();
        if (existing)
            return existing;
        const legacy = this.document.albums.find((album) => album.kind === ekatech_study_1.EKATECH_STUDY_ALBUM_KIND && !album.studyAccountId);
        if (legacy) {
            legacy.studyAccountId = accountId;
            legacy.name = ekatech_study_1.EKATECH_STUDY_ALBUM_NAME;
            this.requestSave();
            return legacy;
        }
        const album = (0, model_1.createGalleryAlbum)(ekatech_study_1.EKATECH_STUDY_ALBUM_NAME, ekatech_study_1.EKATECH_STUDY_ALBUM_KIND, accountId);
        this.document.albums.unshift(album);
        this.requestSave();
        return album;
    }
    activateEkatechStudyAlbum() {
        if (!this.plugin.ekatechStudyConnected)
            return;
        const album = this.ensureEkatechStudyAlbum();
        this.activeTab = 'albums';
        this.activeAlbumId = album.id;
        this.render();
        void this.syncPendingStudyImages(false);
    }
    findEkatechStudyAlbum() {
        const accountId = this.plugin.ekatechStudyAccountId;
        if (!accountId)
            return undefined;
        return this.document.albums.find((album) => album.kind === ekatech_study_1.EKATECH_STUDY_ALBUM_KIND && album.studyAccountId === accountId)
            ?? this.document.albums.find((album) => album.kind === ekatech_study_1.EKATECH_STUDY_ALBUM_KIND && !album.studyAccountId);
    }
    openPhotoPicker(albumId) {
        if (this.importingAlbumId) {
            new obsidian_1.Notice('Please wait for the current import to finish.');
            return;
        }
        const album = this.document.albums.find((candidate) => candidate.id === albumId);
        if (!album)
            return;
        const input = this.contentEl.ownerDocument.createElement('input');
        input.type = 'file';
        input.accept = album.kind === ekatech_study_1.EKATECH_STUDY_ALBUM_KIND
            ? constants_1.STUDY_PHOTO_PICKER_ACCEPT
            : constants_1.STANDARD_MEDIA_PICKER_ACCEPT;
        input.multiple = true;
        input.addClass('album-gallery-file-input');
        this.contentEl.ownerDocument.body.appendChild(input);
        input.addEventListener('change', () => {
            const files = Array.from(input.files ?? []);
            input.remove();
            if (files.length > 0)
                void this.importPhotos(albumId, files);
        }, { once: true });
        input.click();
    }
    async importPhotos(albumId, files) {
        const album = this.document.albums.find((candidate) => candidate.id === albumId);
        if (!album) {
            new obsidian_1.Notice('Album no longer exists.');
            return;
        }
        const isStudyAlbum = album.kind === ekatech_study_1.EKATECH_STUDY_ALBUM_KIND;
        const accepted = [];
        for (const file of files) {
            const extension = this.getExtension(file.name) ?? '';
            if (isStudyAlbum) {
                if (!(0, ekatech_study_1.isStudyCloudImage)(file.name, file.type)) {
                    new obsidian_1.Notice(`${file.name} eklenmedi. Hata Defteri yalnızca JPG, PNG, WebP, HEIC veya HEIF fotoğraf kabul eder; GIF ve video kabul etmez.`);
                    continue;
                }
                if (file.size > ekatech_study_1.EKATECH_STUDY_MAX_IMAGE_BYTES) {
                    new obsidian_1.Notice(`${file.name} eklenmedi. Hata Defteri fotoğrafı 10 MB sınırını aşıyor.`);
                    continue;
                }
            }
            else if (!constants_1.SUPPORTED_MEDIA_EXTENSIONS.has(extension)) {
                new obsidian_1.Notice(`${file.name} desteklenmiyor. Normal albümlere fotoğraf, animasyonlu GIF, MP4/MOV veya WebM video eklenebilir.`);
                continue;
            }
            accepted.push(file);
        }
        if (accepted.length === 0) {
            new obsidian_1.Notice(isStudyAlbum
                ? 'Hata Defteri için desteklenen bir fotoğraf seçilmedi.'
                : 'Desteklenen bir fotoğraf, GIF veya video seçilmedi.');
            return;
        }
        this.importingAlbumId = albumId;
        this.render();
        new obsidian_1.Notice(`Importing ${accepted.length} ${isStudyAlbum ? (accepted.length === 1 ? 'photo' : 'photos') : (accepted.length === 1 ? 'item' : 'items')}…`);
        let imported = 0;
        let failed = 0;
        try {
            const assetFolder = (0, obsidian_1.normalizePath)(`${constants_1.ASSET_ROOT_FOLDER}/${this.document.id}/${album.id}`);
            await this.ensureFolder(assetFolder);
            for (let index = 0; index < accepted.length; index += 1) {
                const file = accepted[index];
                if (!file)
                    continue;
                try {
                    const filename = this.createSafeFilename(file, assetFolder);
                    const path = (0, obsidian_1.normalizePath)(`${assetFolder}/${filename}`);
                    const buffer = await file.arrayBuffer();
                    await this.app.vault.createBinary(path, buffer);
                    const defaults = isStudyAlbum ? this.plugin.getEkatechStudyDefaults() : null;
                    const accountId = isStudyAlbum ? this.plugin.ekatechStudyAccountId : null;
                    const image = (0, model_1.createGalleryImage)(path, file.name || filename, Date.now() + index, defaults && accountId
                        ? { ...defaults, accountId, syncState: 'pending' }
                        : undefined);
                    album.images.push(image);
                    imported += 1;
                }
                catch (error) {
                    console.error('Album Gallery failed to import media', error);
                    failed += 1;
                }
            }
            album.images = (0, model_1.sortImages)(album.images, this.document.layout.sort);
            album.updatedAt = Date.now();
            this.requestSave();
        }
        finally {
            this.importingAlbumId = null;
            this.render();
        }
        if (imported > 0) {
            new obsidian_1.Notice(`${imported} ${isStudyAlbum ? (imported === 1 ? 'photo' : 'photos') : (imported === 1 ? 'item' : 'items')} added to ${album.name}.`);
        }
        if (failed > 0) {
            new obsidian_1.Notice(`${failed} ${failed === 1 ? 'file could' : 'files could'} not be imported.`);
        }
        if (imported > 0 && isStudyAlbum)
            void this.syncPendingStudyImages(false);
    }
    createSafeFilename(file, folder) {
        const original = file.name.trim() || `Media ${Date.now()}`;
        const extension = this.getExtension(original) ?? this.extensionFromMime(file.type) ?? 'jpg';
        const base = original
            .replace(new RegExp(`\\.${extension}$`, 'i'), '')
            .replace(/[\\/:*?"<>|\u0000-\u001F]/g, '-')
            .replace(/\s+/g, ' ')
            .replace(/^\.+|\.+$/g, '')
            .trim()
            .slice(0, 120) || 'Media';
        let index = 0;
        while (true) {
            const candidate = index === 0
                ? `${base}.${extension.toLowerCase()}`
                : `${base} ${index + 1}.${extension.toLowerCase()}`;
            const path = (0, obsidian_1.normalizePath)(`${folder}/${candidate}`);
            if (!this.app.vault.getAbstractFileByPath(path))
                return candidate;
            index += 1;
        }
    }
    getExtension(name) {
        return name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? null;
    }
    extensionFromMime(type) {
        const normalized = type.toLowerCase();
        const mapping = {
            'image/avif': 'avif',
            'image/bmp': 'bmp',
            'image/gif': 'gif',
            'image/heic': 'heic',
            'image/heif': 'heif',
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/svg+xml': 'svg',
            'image/tiff': 'tiff',
            'image/webp': 'webp',
            'video/mp4': 'mp4',
            'video/quicktime': 'mov',
            'video/webm': 'webm',
        };
        return mapping[normalized] ?? null;
    }
    async ensureFolder(path) {
        const parts = (0, obsidian_1.normalizePath)(path).split('/').filter(Boolean);
        let current = '';
        for (const part of parts) {
            current = current ? `${current}/${part}` : part;
            const existing = this.app.vault.getAbstractFileByPath(current);
            if (!existing) {
                await this.app.vault.createFolder(current);
            }
            else if (!(existing instanceof obsidian_1.TFolder)) {
                throw new Error(`Cannot create folder because a file exists at ${current}`);
            }
        }
    }
    confirmDeleteImage(reference) {
        const isStudyPhoto = Boolean(reference.image.study);
        const isVideo = isVideoMedia(reference.image);
        new ConfirmActionModal(this.app, {
            title: `Delete ${isStudyPhoto ? 'photo' : isVideo ? 'video' : 'media item'}?`,
            description: `“${reference.image.name}” will be moved to the trash and removed from this album.`,
            confirmText: 'Delete',
            onConfirm: async () => this.deleteImage(reference),
        }).open();
    }
    async deleteImage(reference) {
        const album = this.document.albums.find((candidate) => candidate.id === reference.albumId);
        if (!album)
            return;
        const file = this.app.vault.getFileByPath(reference.image.path);
        if (file) {
            try {
                await this.app.fileManager.trashFile(file);
            }
            catch (error) {
                console.error('Album Gallery failed to trash media', error);
                new obsidian_1.Notice('The file could not be moved to the trash.');
                return;
            }
        }
        album.images = album.images.filter((candidate) => candidate.id !== reference.image.id);
        if (album.coverImageId === reference.image.id)
            delete album.coverImageId;
        album.updatedAt = Date.now();
        this.requestSave();
        this.render();
        new obsidian_1.Notice('Media deleted.');
    }
    confirmDeleteAlbum(album) {
        new ConfirmActionModal(this.app, {
            title: 'Delete album?',
            description: `“${album.name}” and its ${mediaCount(album.images.length, album.kind === ekatech_study_1.EKATECH_STUDY_ALBUM_KIND)} will be moved to the trash.`,
            confirmText: 'Delete album',
            onConfirm: async () => this.deleteAlbum(album),
        }).open();
    }
    async deleteAlbum(album) {
        const folderPath = (0, obsidian_1.normalizePath)(`${constants_1.ASSET_ROOT_FOLDER}/${this.document.id}/${album.id}`);
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (folder) {
            try {
                await this.app.fileManager.trashFile(folder);
            }
            catch (error) {
                console.error('Album Gallery failed to trash an album folder', error);
                new obsidian_1.Notice('The album folder could not be moved to the trash.');
                return;
            }
        }
        this.document.albums = this.document.albums.filter((candidate) => candidate.id !== album.id);
        this.activeAlbumId = null;
        this.activeTab = 'albums';
        this.requestSave();
        this.render();
        new obsidian_1.Notice('Album deleted.');
    }
    renderStudyControls(album) {
        const status = this.plugin.settings.ekatechStudyStatus;
        const defaults = this.plugin.getEkatechStudyDefaults();
        if (!status || !defaults)
            return;
        const panel = this.contentEl.createDiv({ cls: 'album-gallery-study-settings' });
        const heading = panel.createDiv({ cls: 'album-gallery-study-settings-heading' });
        const copy = heading.createDiv();
        copy.createEl('h2', { text: 'Hata ayarları' });
        copy.createEl('p', {
            text: 'Bu ayarlar bundan sonra ekleyeceğin fotoğraflara uygulanır. Hata Defteri GIF veya video kabul etmez.',
        });
        const quota = status.quota;
        heading.createSpan({
            cls: `album-gallery-study-quota${quota.exhausted ? ' is-exhausted' : ''}`,
            text: quota.unlimited
                ? `${status.account.plan} · Sınırsız`
                : `${status.account.plan} · ${quota.used} / ${quota.limit ?? 12}`,
        });
        const grid = panel.createDiv({ cls: 'album-gallery-study-settings-grid' });
        const exam = this.createStudySelect(grid, 'Sınav', status.curriculum.map((item) => ({ value: item.id, label: item.label })), defaults.examType);
        const subject = this.createStudySelect(grid, 'Ders', [], defaults.subjectCode);
        const topic = this.createStudySelect(grid, 'Konu', [], defaults.topicCode);
        const mistake = this.createStudySelect(grid, 'Hata türü', status.mistakeTypes.map((item) => ({ value: item.id, label: item.label })), defaults.mistakeType);
        const interval = this.createStudySelect(grid, 'Tekrar sıklığı', status.reviewIntervals.map((item) => ({ value: String(item.days), label: item.label })), String(defaults.reviewIntervalDays));
        const source = this.createStudyInput(grid, 'Kaynak', defaults.sourceName, 'Örn. Deneme 3');
        const question = this.createStudyInput(grid, 'Soru notu', defaults.questionNote, 'İsteğe bağlı');
        const solution = this.createStudyInput(grid, 'Çözüm notu', defaults.solutionNote, 'İsteğe bağlı');
        const curriculum = status.curriculum;
        const rebuildSubjects = () => {
            const selectedExam = curriculum.find((item) => item.id === exam.value) ?? curriculum[0];
            subject.empty();
            for (const item of selectedExam?.subjects ?? [])
                subject.createEl('option', { value: item.id, text: item.label });
            if ((selectedExam?.subjects ?? []).some((item) => item.id === defaults.subjectCode))
                subject.value = defaults.subjectCode;
            if (!subject.value && subject.options.length > 0)
                subject.selectedIndex = 0;
        };
        const rebuildTopics = () => {
            const selectedExam = curriculum.find((item) => item.id === exam.value) ?? curriculum[0];
            const selectedSubject = selectedExam?.subjects.find((item) => item.id === subject.value)
                ?? selectedExam?.subjects[0];
            topic.empty();
            for (const item of selectedSubject?.topics ?? [])
                topic.createEl('option', { value: item.id, text: item.label });
            if ((selectedSubject?.topics ?? []).some((item) => item.id === defaults.topicCode))
                topic.value = defaults.topicCode;
            if (!topic.value && topic.options.length > 0)
                topic.selectedIndex = 0;
        };
        const persist = () => {
            void this.plugin.updateEkatechStudyDefaults({
                examType: exam.value,
                subjectCode: subject.value,
                topicCode: topic.value,
                mistakeType: mistake.value,
                reviewIntervalDays: Number(interval.value) || 7,
                sourceName: source.value.trim().slice(0, 120),
                questionNote: question.value.trim().slice(0, 1000),
                solutionNote: solution.value.trim().slice(0, 2000),
            });
        };
        rebuildSubjects();
        rebuildTopics();
        exam.addEventListener('change', () => {
            rebuildSubjects();
            rebuildTopics();
            persist();
        });
        subject.addEventListener('change', () => {
            rebuildTopics();
            persist();
        });
        for (const select of [topic, mistake, interval])
            select.addEventListener('change', persist);
        for (const input of [source, question, solution])
            input.addEventListener('change', persist);
        if (quota.exhausted) {
            panel.createDiv({
                cls: 'album-gallery-study-limit-warning',
                text: `Aylık 12 yükleme hakkın doldu. Yeni fotoğraflar cihazda kalır ve ${new Date(quota.resetsAt).toLocaleDateString('tr-TR')} tarihinde otomatik devam eder.`,
            });
        }
        const pending = album.images.filter((image) => image.study?.syncState !== 'synced').length;
        if (pending > 0) {
            panel.createDiv({
                cls: 'album-gallery-study-pending',
                text: `${pending} fotoğraf senkronizasyon kuyruğunda.`,
            });
        }
    }
    createStudySelect(container, label, options, value) {
        const field = container.createEl('label', { cls: 'album-gallery-study-field' });
        field.createSpan({ text: label });
        const select = field.createEl('select');
        for (const option of options)
            select.createEl('option', { value: option.value, text: option.label });
        select.value = value;
        return select;
    }
    createStudyInput(container, label, value, placeholder) {
        const field = container.createEl('label', { cls: 'album-gallery-study-field' });
        field.createSpan({ text: label });
        return field.createEl('input', { type: 'text', value, placeholder });
    }
    renderStudySyncBadge(container, image) {
        const state = image.study?.syncState ?? 'pending';
        const labels = {
            pending: 'Bekliyor',
            uploading: 'Yükleniyor',
            synced: 'Study ✓',
            failed: 'Tekrar denenecek',
            quota: 'Kota bekliyor',
        };
        container.createSpan({
            cls: `album-gallery-study-sync-badge is-${state}`,
            text: labels[state] ?? state,
        });
    }
    async syncPendingStudyImages(force) {
        if (this.syncingStudyAlbum || !this.plugin.ekatechStudyConnected)
            return;
        if (force)
            await this.plugin.refreshEkatechStudyStatus(false);
        const album = this.findEkatechStudyAlbum();
        const accountId = this.plugin.ekatechStudyAccountId;
        const quota = this.plugin.settings.ekatechStudyStatus?.quota;
        if (!album || !accountId || !quota)
            return;
        const now = Date.now();
        const candidates = album.images.filter((image) => {
            const metadata = image.study;
            if (!metadata || metadata.accountId !== accountId || metadata.syncState === 'synced' || metadata.syncState === 'uploading')
                return false;
            if (metadata.syncState === 'quota' && quota.exhausted)
                return false;
            if (!force && metadata.syncState === 'failed' && metadata.lastAttemptAt && now - metadata.lastAttemptAt < 30000)
                return false;
            return true;
        });
        if (candidates.length === 0 || (quota.exhausted && !quota.unlimited))
            return;
        this.syncingStudyAlbum = true;
        let synced = 0;
        let failed = 0;
        try {
            for (const image of candidates) {
                if (!image.study)
                    continue;
                const latestQuota = this.plugin.settings.ekatechStudyStatus?.quota;
                if (latestQuota?.exhausted && !latestQuota.unlimited) {
                    image.study.syncState = 'quota';
                    continue;
                }
                const file = this.app.vault.getFileByPath(image.path);
                if (!file) {
                    image.study.syncState = 'failed';
                    image.study.lastError = 'Fotoğraf dosyası bulunamadı.';
                    image.study.lastAttemptAt = Date.now();
                    failed += 1;
                    continue;
                }
                image.study.syncState = 'uploading';
                image.study.lastAttemptAt = Date.now();
                delete image.study.lastError;
                this.requestSave();
                try {
                    const result = await this.plugin.uploadEkatechStudyImage(file, image, image.study, image.name.replace(/\.[^.]+$/, '').slice(0, 120) || 'Obsidian sorusu');
                    image.study.syncState = 'synced';
                    image.study.remoteMistakeId = result.mistakeId;
                    image.study.syncedAt = Date.now();
                    synced += 1;
                }
                catch (error) {
                    const code = error instanceof Error && 'code' in error
                        ? String(error.code || '')
                        : '';
                    image.study.syncState = code === 'OBSIDIAN_MONTHLY_LIMIT_REACHED' ? 'quota' : 'failed';
                    image.study.lastError = error instanceof Error ? error.message : 'Yükleme tamamlanamadı.';
                    failed += 1;
                    if (code === 'OBSIDIAN_MONTHLY_LIMIT_REACHED' || code === 'OBSIDIAN_AUTH_REQUIRED' || code === 'OBSIDIAN_SESSION_EXPIRED')
                        break;
                }
                this.requestSave();
            }
        }
        finally {
            this.syncingStudyAlbum = false;
            album.updatedAt = Date.now();
            this.requestSave();
            this.render();
        }
        if (synced > 0)
            new obsidian_1.Notice(`${synced} fotoğraf Study Hata Defteri’ne otomatik yüklendi.`);
        if (failed > 0 && synced === 0)
            new obsidian_1.Notice('Bazı Hata Defteri fotoğrafları kuyrukta kaldı; otomatik yeniden denenecek.');
    }
    getVisibleAlbums() {
        const accountId = this.plugin.ekatechStudyAccountId;
        return this.document.albums.filter((album) => album.kind !== ekatech_study_1.EKATECH_STUDY_ALBUM_KIND || Boolean(accountId && (album.studyAccountId === accountId || !album.studyAccountId)));
    }
    getAllImages() {
        return this.getVisibleAlbums().flatMap((album) => this.getAlbumReferences(album)).sort((left, right) => {
            switch (this.document.layout.sort) {
                case 'name-asc':
                    return left.image.name.localeCompare(right.image.name);
                case 'name-desc':
                    return right.image.name.localeCompare(left.image.name);
                case 'added-asc':
                    return left.image.addedAt - right.image.addedAt;
                case 'added-desc':
                    return right.image.addedAt - left.image.addedAt;
            }
        });
    }
    getAlbumReferences(album) {
        return (0, model_1.sortImages)(album.images, this.document.layout.sort).map((image) => ({
            albumId: album.id,
            albumName: album.name,
            image,
        }));
    }
    getAlbumCover(album) {
        if (album.coverImageId) {
            const cover = album.images.find((image) => image.id === album.coverImageId);
            if (cover)
                return cover;
        }
        return (0, model_1.sortImages)(album.images, 'added-desc')[0] ?? null;
    }
    disconnectObserver() {
        this.observer?.disconnect();
        this.observer = null;
    }
}
exports.AlbumGalleryView = AlbumGalleryView;
class AlbumNameModal extends obsidian_1.Modal {
    constructor(app, options) {
        super(app);
        this.options = options;
    }
    onOpen() {
        this.contentEl.addClass('album-gallery-name-modal');
        this.contentEl.createEl('h2', { text: this.options.title });
        const input = this.contentEl.createEl('input', {
            cls: 'album-gallery-name-input',
            attr: { type: 'text', placeholder: 'Album name', maxlength: '80' },
        });
        input.value = this.options.initialValue ?? '';
        const error = this.contentEl.createDiv({ cls: 'album-gallery-name-error' });
        const actions = this.contentEl.createDiv({ cls: 'modal-button-container' });
        actions.createEl('button', { text: 'Cancel', attr: { type: 'button' } })
            .addEventListener('click', () => this.close());
        const submit = actions.createEl('button', {
            cls: 'mod-cta',
            text: this.options.submitText,
            attr: { type: 'button' },
        });
        const finish = () => {
            const name = input.value.trim();
            if (!name) {
                error.setText('Enter an album name.');
                input.focus();
                return;
            }
            this.options.onSubmit(name);
            this.close();
        };
        submit.addEventListener('click', finish);
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                finish();
            }
        });
        window.setTimeout(() => {
            input.focus();
            input.select();
        }, 0);
    }
    onClose() {
        this.contentEl.empty();
    }
}
class ConfirmActionModal extends obsidian_1.Modal {
    constructor(app, options) {
        super(app);
        this.options = options;
    }
    onOpen() {
        this.contentEl.createEl('h2', { text: this.options.title });
        this.contentEl.createEl('p', { text: this.options.description });
        const actions = this.contentEl.createDiv({ cls: 'modal-button-container' });
        actions.createEl('button', { text: 'Cancel', attr: { type: 'button' } })
            .addEventListener('click', () => this.close());
        const confirm = actions.createEl('button', {
            cls: 'mod-warning',
            text: this.options.confirmText,
            attr: { type: 'button' },
        });
        confirm.addEventListener('click', async () => {
            confirm.disabled = true;
            await this.options.onConfirm();
            this.close();
        });
    }
    onClose() {
        this.contentEl.empty();
    }
}
class MediaLightboxModal extends obsidian_1.Modal {
    constructor(app, references, index, onRequestDelete) {
        super(app);
        this.references = references;
        this.index = index;
        this.onRequestDelete = onRequestDelete;
        this.mediaHost = null;
        this.activeVideo = null;
        this.titleElement = null;
        this.subtitleElement = null;
        this.touchStartX = null;
    }
    onOpen() {
        this.modalEl.addClass('album-gallery-lightbox-modal');
        const shell = this.contentEl.createDiv({ cls: 'album-gallery-lightbox' });
        const toolbar = shell.createDiv({ cls: 'album-gallery-lightbox-toolbar' });
        const titleGroup = toolbar.createDiv({ cls: 'album-gallery-lightbox-title-group' });
        this.titleElement = titleGroup.createDiv({ cls: 'album-gallery-lightbox-title' });
        this.subtitleElement = titleGroup.createDiv({ cls: 'album-gallery-lightbox-subtitle' });
        const deleteButton = toolbar.createEl('button', {
            cls: 'clickable-icon album-gallery-lightbox-delete',
            attr: { type: 'button', 'aria-label': 'Delete media item' },
        });
        (0, obsidian_1.setIcon)(deleteButton, 'trash-2');
        deleteButton.addEventListener('click', () => {
            const reference = this.references[this.index];
            if (reference) {
                this.close();
                this.onRequestDelete(reference);
            }
        });
        const stage = shell.createDiv({ cls: 'album-gallery-lightbox-stage album-gallery-media-lightbox-stage' });
        const previous = stage.createEl('button', {
            cls: 'clickable-icon album-gallery-lightbox-nav album-gallery-lightbox-previous',
            attr: { type: 'button', 'aria-label': 'Previous media item' },
        });
        (0, obsidian_1.setIcon)(previous, 'chevron-left');
        previous.addEventListener('click', () => this.move(-1));
        this.mediaHost = stage.createDiv({ cls: 'album-gallery-lightbox-media-host' });
        this.mediaHost.addEventListener('touchstart', (event) => {
            this.touchStartX = event.changedTouches[0]?.clientX ?? null;
        }, { passive: true });
        this.mediaHost.addEventListener('touchend', (event) => {
            const endX = event.changedTouches[0]?.clientX;
            if (this.touchStartX === null || endX === undefined)
                return;
            const delta = endX - this.touchStartX;
            this.touchStartX = null;
            if (Math.abs(delta) >= 50)
                this.move(delta > 0 ? -1 : 1);
        }, { passive: true });
        const next = stage.createEl('button', {
            cls: 'clickable-icon album-gallery-lightbox-nav album-gallery-lightbox-next',
            attr: { type: 'button', 'aria-label': 'Next media item' },
        });
        (0, obsidian_1.setIcon)(next, 'chevron-right');
        next.addEventListener('click', () => this.move(1));
        this.scope.register([], 'ArrowLeft', () => {
            this.move(-1);
            return false;
        });
        this.scope.register([], 'ArrowRight', () => {
            this.move(1);
            return false;
        });
        this.updateMedia();
    }
    onClose() {
        this.releaseVideo();
        this.mediaHost = null;
        this.titleElement = null;
        this.subtitleElement = null;
        this.contentEl.empty();
    }
    move(direction) {
        if (this.references.length === 0)
            return;
        this.index = (this.index + direction + this.references.length) % this.references.length;
        this.updateMedia();
    }
    updateMedia() {
        const reference = this.references[this.index];
        if (!reference || !this.mediaHost || !this.titleElement || !this.subtitleElement)
            return;
        this.releaseVideo();
        this.mediaHost.empty();
        const file = this.app.vault.getFileByPath(reference.image.path);
        if (!file) {
            const missing = this.mediaHost.createDiv({ cls: 'album-gallery-missing-photo' });
            (0, obsidian_1.setIcon)(missing, 'file-question');
        }
        else if (isVideoMedia(reference.image)) {
            const video = this.mediaHost.createEl('video', {
                cls: 'album-gallery-lightbox-video',
                attr: { controls: 'true', playsinline: 'true', preload: 'metadata' },
            });
            video.controls = true;
            video.playsInline = true;
            video.preload = 'metadata';
            video.src = this.app.vault.getResourcePath(file);
            this.activeVideo = video;
        }
        else {
            const image = this.mediaHost.createEl('img', { attr: { alt: reference.image.name } });
            image.src = this.app.vault.getResourcePath(file);
        }
        this.titleElement.setText(reference.image.name);
        this.subtitleElement.setText(`${reference.albumName} · ${this.index + 1} of ${this.references.length}`);
    }
    releaseVideo() {
        if (!this.activeVideo)
            return;
        this.activeVideo.pause();
        this.activeVideo.removeAttribute('src');
        this.activeVideo.load();
        this.activeVideo = null;
    }
}
class StudyAccountManagerModal extends obsidian_1.Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }
    onOpen() {
        this.modalEl.addClass('album-gallery-study-account-manager-modal');
        this.render();
    }
    onClose() {
        this.contentEl.empty();
    }
    render() {
        this.contentEl.empty();
        const status = this.plugin.settings.ekatechStudyStatus;
        if (!status) {
            this.close();
            return;
        }
        const shell = this.contentEl.createDiv({ cls: 'album-gallery-study-account-manager' });
        const header = shell.createDiv({ cls: 'album-gallery-study-account-manager-header' });
        const verifiedIcon = header.createDiv({ cls: 'album-gallery-study-account-manager-verified' });
        (0, obsidian_1.setIcon)(verifiedIcon, 'badge-check');
        const titleGroup = header.createDiv({ cls: 'album-gallery-study-account-manager-title-group' });
        titleGroup.createEl('h2', { text: 'Study Hesap Yöneticisi' });
        titleGroup.createEl('p', { text: 'Obsidian Hata Defteri bağlantısı' });
        const accountCard = shell.createDiv({ cls: 'album-gallery-study-account-card' });
        const avatar = accountCard.createDiv({ cls: 'album-gallery-study-account-avatar' });
        avatar.setText(this.accountInitials(status.account.displayName));
        const identity = accountCard.createDiv({ cls: 'album-gallery-study-account-identity' });
        identity.createEl('strong', { text: status.account.displayName });
        identity.createEl('span', { text: status.account.email || 'E-posta bilgisi yok' });
        identity.createEl('span', { cls: 'album-gallery-study-account-plan', text: status.account.plan });
        const quota = status.quota;
        const quotaCard = shell.createDiv({ cls: 'album-gallery-study-account-quota' });
        const quotaHeading = quotaCard.createDiv({ cls: 'album-gallery-study-account-quota-heading' });
        quotaHeading.createEl('strong', { text: 'Aylık Obsidian kotası' });
        quotaHeading.createSpan({ text: quota.unlimited ? 'Sınırsız' : `${quota.used} / ${quota.limit ?? 12}` });
        if (!quota.unlimited) {
            const progress = quotaCard.createDiv({ cls: 'album-gallery-study-account-progress' });
            const fill = progress.createDiv({ cls: 'album-gallery-study-account-progress-fill' });
            const percentage = Math.min(100, Math.max(0, quota.limit ? (quota.used / quota.limit) * 100 : 0));
            fill.style.width = `${percentage}%`;
        }
        quotaCard.createEl('p', {
            text: quota.unlimited
                ? 'Study paketinde Obsidian bulut yüklemeleri sınırsız.'
                : `${quota.remaining ?? 0} yükleme kaldı · ${new Date(quota.resetsAt).toLocaleDateString('tr-TR')} tarihinde yenilenir.`,
        });
        const actions = shell.createDiv({ cls: 'album-gallery-study-account-actions' });
        this.createActionButton(actions, 'refresh-cw', 'Hesabı ve kotayı yenile', 'Paket, kota ve ders listelerini yeniden kontrol et.', async (button) => {
            await this.runAction(button, async () => {
                await this.plugin.refreshEkatechStudyStatus(true);
                this.render();
            });
        });
        this.createActionButton(actions, 'repeat-2', 'Hesap değiştir', 'Mevcut oturumu kapat ve başka bir Study hesabına bağlan.', async (button) => {
            await this.runAction(button, async () => {
                await this.plugin.disconnectEkatechStudy(false);
                this.close();
                this.plugin.beginEkatechStudyLink();
            });
        });
        const logout = actions.createEl('button', {
            cls: 'album-gallery-study-account-action is-danger',
            attr: { type: 'button' },
        });
        const logoutIcon = logout.createSpan({ cls: 'album-gallery-study-account-action-icon' });
        (0, obsidian_1.setIcon)(logoutIcon, 'log-out');
        const logoutText = logout.createSpan({ cls: 'album-gallery-study-account-action-text' });
        logoutText.createEl('strong', { text: 'Çıkış yap' });
        logoutText.createEl('small', { text: 'Normal albümlerin ve yerel dosyaların korunur.' });
        logout.addEventListener('click', () => {
            new ConfirmActionModal(this.app, {
                title: 'Study hesabından çıkış yapılsın mı?',
                description: 'Bu cihazdaki Study oturumu kapatılacak. Normal albümlerin ve yerel fotoğrafların silinmeyecek.',
                confirmText: 'Çıkış yap',
                onConfirm: async () => {
                    await this.plugin.disconnectEkatechStudy(true);
                    this.close();
                },
            }).open();
        });
    }
    createActionButton(container, iconName, title, subtitle, onClick) {
        const button = container.createEl('button', {
            cls: 'album-gallery-study-account-action',
            attr: { type: 'button' },
        });
        const icon = button.createSpan({ cls: 'album-gallery-study-account-action-icon' });
        (0, obsidian_1.setIcon)(icon, iconName);
        const copy = button.createSpan({ cls: 'album-gallery-study-account-action-text' });
        copy.createEl('strong', { text: title });
        copy.createEl('small', { text: subtitle });
        button.addEventListener('click', () => {
            void onClick(button);
        });
    }
    async runAction(button, action) {
        button.disabled = true;
        try {
            await action();
        }
        finally {
            button.disabled = false;
        }
    }
    accountInitials(displayName) {
        const initials = displayName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toLocaleUpperCase('tr-TR') ?? '')
            .join('');
        return initials || 'ES';
    }
}

};
__modules["settings"] = function(module, exports, __require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlbumGallerySettingTab = exports.DEFAULT_SETTINGS = void 0;
const obsidian_1 = require("obsidian");
exports.DEFAULT_SETTINGS = {
    batchSize: 100,
    defaultTab: 'photos',
    ekatechStudyToken: '',
    ekatechStudyVaultId: '',
    ekatechStudyPendingState: '',
    ekatechStudyStatus: null,
    ekatechStudyDefaultsByAccount: {},
};
class AlbumGallerySettingTab extends obsidian_1.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        const status = this.plugin.settings.ekatechStudyStatus;
        const quota = status?.quota;
        const accountDescription = status
            ? `${status.account.displayName} · ${status.account.plan}`
            : 'Obsidian içinde Study hesabına giriş yap. Hata Defteri albümü otomatik oluşturulur ve eklediğin fotoğraflar aynı hesaba yüklenir.';
        const quotaDescription = quota
            ? quota.unlimited
                ? 'Obsidian cloud yüklemeleri sınırsız.'
                : `Bu ay ${quota.used} / ${quota.limit ?? 12} yükleme kullanıldı. ${quota.remaining ?? 0} kaldı.`
            : '';
        new obsidian_1.Setting(containerEl)
            .setName('Ekatech Study')
            .setDesc([accountDescription, quotaDescription].filter(Boolean).join(' '))
            .addButton((button) => {
            if (status) {
                button
                    .setButtonText('Çıkış yap')
                    .setWarning()
                    .onClick(() => {
                    this.plugin.openEkatechStudyAccountManager();
                });
            }
            else {
                button
                    .setButtonText('Study hesabına giriş')
                    .setCta()
                    .onClick(() => {
                    this.plugin.beginEkatechStudyLink();
                });
            }
        });
        if (status) {
            new obsidian_1.Setting(containerEl)
                .setName('Hesabı ve kotayı yenile')
                .setDesc('Study paketini, aylık kotayı ve ders-konu listesini yeniden kontrol eder.')
                .addButton((button) => button
                .setButtonText('Yenile')
                .onClick(async () => {
                await this.plugin.refreshEkatechStudyStatus(true);
                this.display();
            }));
        }
        new obsidian_1.Setting(containerEl)
            .setName('Default tab')
            .setDesc('Choose which section opens first in a gallery.')
            .addDropdown((dropdown) => dropdown
            .addOption('photos', 'Media')
            .addOption('albums', 'Albums')
            .setValue(this.plugin.settings.defaultTab)
            .onChange(async (value) => {
            this.plugin.settings.defaultTab = value === 'albums' ? 'albums' : 'photos';
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName('Media loaded per batch')
            .setDesc('Lower values reduce memory use on mobile. Higher values reveal large galleries faster.')
            .addSlider((slider) => slider
            .setLimits(20, 300, 20)
            .setDynamicTooltip()
            .setValue(this.plugin.settings.batchSize)
            .onChange(async (value) => {
            this.plugin.settings.batchSize = value;
            await this.plugin.saveSettings();
        }));
    }
}
exports.AlbumGallerySettingTab = AlbumGallerySettingTab;

};
__modules["main"] = function(module, exports, __require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EkatechStudyApiError = void 0;
const obsidian_1 = require("obsidian");
const constants_1 = __require("constants");
const gallery_view_1 = __require("gallery-view");
const ekatech_study_1 = __require("ekatech-study");
const model_1 = __require("model");
const settings_1 = __require("settings");
class EkatechStudyLinkConfirmModal extends obsidian_1.Modal {
    constructor(app, onConfirm) {
        super(app);
        this.onConfirm = onConfirm;
    }
    onOpen() {
        this.modalEl.addClass('album-gallery-study-link-confirm-modal');
        this.contentEl.empty();
        const shell = this.contentEl.createDiv({ cls: 'album-gallery-study-link-confirm' });
        const icon = shell.createDiv({ cls: 'album-gallery-study-link-confirm-icon' });
        (0, obsidian_1.setIcon)(icon, 'graduation-cap');
        shell.createEl('h2', { text: 'Ekatech Study hesabına bağlan' });
        shell.createEl('p', {
            cls: 'album-gallery-study-link-confirm-lead',
            text: 'Devam ettiğinde güvenli giriş için Ekatech Study web sitesine yönlendirileceksin.',
        });
        const notice = shell.createDiv({ cls: 'album-gallery-study-link-confirm-notice' });
        const noticeIcon = notice.createDiv({ cls: 'album-gallery-study-link-confirm-notice-icon' });
        (0, obsidian_1.setIcon)(noticeIcon, 'info');
        const noticeText = notice.createDiv();
        noticeText.createEl('strong', {
            text: 'Bu hizmet yalnızca Ekatech Study uygulaması müşterileri içindir.',
        });
        noticeText.createEl('p', {
            text: 'Study hesabınla giriş yaptıktan ve bağlantıyı onayladıktan sonra Obsidian’a geri dönersin. Hata Defteri fotoğrafları bağlı hesabına yüklenir.',
        });
        const actions = shell.createDiv({ cls: 'album-gallery-study-link-confirm-actions' });
        actions.createEl('button', {
            text: 'Vazgeç',
            attr: { type: 'button' },
        }).addEventListener('click', () => this.close());
        const continueButton = actions.createEl('button', {
            cls: 'mod-cta',
            text: 'Siteye git',
            attr: { type: 'button' },
        });
        continueButton.addEventListener('click', () => {
            this.close();
            this.onConfirm();
        });
    }
    onClose() {
        this.contentEl.empty();
    }
}
class EkatechStudyApiError extends Error {
    constructor(message, code, status, quota) {
        super(message);
        this.code = code;
        this.status = status;
        this.quota = quota;
        this.name = 'EkatechStudyApiError';
    }
}
exports.EkatechStudyApiError = EkatechStudyApiError;
class AlbumGalleryPlugin extends obsidian_1.Plugin {
    constructor() {
        super(...arguments);
        this.settings = { ...settings_1.DEFAULT_SETTINGS };
        this.statusRefreshPromise = null;
    }
    async onload() {
        await this.loadSettings();
        await this.ensureStudyVaultId();
        this.registerView(constants_1.GALLERY_VIEW_TYPE, (leaf) => new gallery_view_1.AlbumGalleryView(leaf, this));
        this.registerExtensions([constants_1.GALLERY_EXTENSION], constants_1.GALLERY_VIEW_TYPE);
        this.registerObsidianProtocolHandler('album-gallery-auth', (params) => {
            void this.completeEkatechStudyAuth(params);
        });
        this.addRibbonIcon('images', 'Create gallery', () => {
            void this.createGalleryFile();
        });
        this.addCommand({
            id: 'create-gallery',
            name: 'Create new gallery',
            callback: () => {
                void this.createGalleryFile();
            },
        });
        this.addCommand({
            id: 'connect-ekatech-study',
            name: 'Connect Ekatech Study account',
            callback: () => this.beginEkatechStudyLink(),
        });
        this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
            if (!(file instanceof obsidian_1.TFolder))
                return;
            menu.addItem((item) => item
                .setTitle('New gallery')
                .setIcon('images')
                .onClick(() => {
                void this.createGalleryFile(file);
            }));
        }));
        this.registerEvent(this.app.vault.on('create', () => this.refreshOpenGalleryViews()));
        this.registerEvent(this.app.vault.on('delete', () => this.refreshOpenGalleryViews()));
        this.registerEvent(this.app.vault.on('rename', () => this.refreshOpenGalleryViews()));
        this.registerEvent(this.app.vault.on('modify', () => this.refreshOpenGalleryViews()));
        this.addSettingTab(new settings_1.AlbumGallerySettingTab(this.app, this));
        this.app.workspace.onLayoutReady(() => {
            if (this.settings.ekatechStudyToken)
                void this.refreshEkatechStudyStatus(false);
        });
    }
    async loadSettings() {
        const stored = await this.loadData();
        this.settings = Object.assign({}, settings_1.DEFAULT_SETTINGS, stored ?? {});
        this.settings.ekatechStudyDefaultsByAccount = this.settings.ekatechStudyDefaultsByAccount ?? {};
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
    async ensureStudyVaultId() {
        if (this.settings.ekatechStudyVaultId.length >= 8)
            return;
        this.settings.ekatechStudyVaultId = (0, ekatech_study_1.createSecureIdentifier)('vault_');
        await this.saveSettings();
    }
    get ekatechStudyConnected() {
        return Boolean(this.settings.ekatechStudyToken && this.settings.ekatechStudyStatus?.account.id);
    }
    get ekatechStudyAccountId() {
        return this.settings.ekatechStudyStatus?.account.id ?? null;
    }
    getEkatechStudyDefaults() {
        const status = this.settings.ekatechStudyStatus;
        if (!status)
            return null;
        return this.settings.ekatechStudyDefaultsByAccount[status.account.id] ?? status.defaults;
    }
    async updateEkatechStudyDefaults(next) {
        const accountId = this.ekatechStudyAccountId;
        if (!accountId)
            return;
        this.settings.ekatechStudyDefaultsByAccount[accountId] = { ...next };
        await this.saveSettings();
        this.refreshOpenGalleryViews();
    }
    beginEkatechStudyLink() {
        new EkatechStudyLinkConfirmModal(this.app, () => {
            void this.beginEkatechStudyLinkFlow();
        }).open();
    }
    async beginEkatechStudyLinkFlow() {
        await this.ensureStudyVaultId();
        const state = (0, ekatech_study_1.createSecureIdentifier)('state_');
        this.settings.ekatechStudyPendingState = state;
        await this.saveSettings();
        const url = (0, ekatech_study_1.createEkatechStudyAuthURL)(state, this.settings.ekatechStudyVaultId);
        new obsidian_1.Notice('Study hesabı girişi açılıyor…');
        const opened = window.open(url, '_blank', 'noopener,noreferrer');
        if (!opened)
            window.location.assign(url);
    }
    async completeEkatechStudyAuth(params) {
        const state = String(params.state || '').trim();
        const code = String(params.code || '').trim();
        if (params.error) {
            new obsidian_1.Notice('Study hesabı bağlantısı tamamlanmadı.');
            return;
        }
        if (!state || state !== this.settings.ekatechStudyPendingState || !code) {
            new obsidian_1.Notice('Study hesabı bağlantısı doğrulanamadı. Yeniden giriş yap.');
            return;
        }
        try {
            const response = await (0, obsidian_1.requestUrl)({
                url: `${ekatech_study_1.EKATECH_STUDY_API_BASE}/api/study/obsidian/auth/exchange`,
                method: 'POST',
                contentType: 'application/json',
                body: JSON.stringify({
                    code,
                    state,
                    vault_id: this.settings.ekatechStudyVaultId,
                }),
                throw: false,
            });
            const envelope = response.json;
            if (!envelope.ok || !envelope.data?.token) {
                throw this.apiError(envelope, response.status);
            }
            this.settings.ekatechStudyToken = envelope.data.token;
            this.settings.ekatechStudyPendingState = '';
            this.applyStudyStatus(envelope.data);
            await this.saveSettings();
            for (const leaf of this.app.workspace.getLeavesOfType(constants_1.GALLERY_VIEW_TYPE)) {
                if (leaf.view instanceof gallery_view_1.AlbumGalleryView)
                    leaf.view.activateEkatechStudyAlbum();
            }
            new obsidian_1.Notice(`${envelope.data.account.displayName} hesabı bağlandı. Hata Defteri hazır.`);
        }
        catch (error) {
            console.error('Album Gallery Study auth exchange failed', error);
            new obsidian_1.Notice(error instanceof Error ? error.message : 'Study hesabı bağlanamadı.');
        }
    }
    async refreshEkatechStudyStatus(showNotice) {
        if (!this.settings.ekatechStudyToken)
            return null;
        if (this.statusRefreshPromise)
            return this.statusRefreshPromise;
        this.statusRefreshPromise = (async () => {
            try {
                const response = await (0, obsidian_1.requestUrl)({
                    url: `${ekatech_study_1.EKATECH_STUDY_API_BASE}/api/study/obsidian/status`,
                    method: 'GET',
                    headers: { Authorization: `Bearer ${this.settings.ekatechStudyToken}` },
                    throw: false,
                });
                const envelope = response.json;
                if (!envelope.ok || !envelope.data)
                    throw this.apiError(envelope, response.status);
                this.applyStudyStatus(envelope.data);
                await this.saveSettings();
                this.refreshOpenGalleryViews();
                if (showNotice)
                    new obsidian_1.Notice('Study hesabı ve aylık kota yenilendi.');
                return envelope.data;
            }
            catch (error) {
                if (error instanceof EkatechStudyApiError && error.status === 401) {
                    await this.clearStudySession();
                    new obsidian_1.Notice('Obsidian Study oturumu sona erdi. Yeniden giriş yap.');
                }
                else if (showNotice) {
                    new obsidian_1.Notice(error instanceof Error ? error.message : 'Study bilgileri yenilenemedi.');
                }
                return null;
            }
            finally {
                this.statusRefreshPromise = null;
            }
        })();
        return this.statusRefreshPromise;
    }
    async disconnectEkatechStudy(showNotice = true) {
        const token = this.settings.ekatechStudyToken;
        if (token) {
            await (0, obsidian_1.requestUrl)({
                url: `${ekatech_study_1.EKATECH_STUDY_API_BASE}/api/study/obsidian/auth/logout`,
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                throw: false,
            }).catch(() => null);
        }
        await this.clearStudySession();
        if (showNotice)
            new obsidian_1.Notice('Study hesabından çıkış yapıldı. Normal albümlerin değişmedi.');
    }
    async clearStudySession() {
        this.settings.ekatechStudyToken = '';
        this.settings.ekatechStudyPendingState = '';
        this.settings.ekatechStudyStatus = null;
        await this.saveSettings();
        this.refreshOpenGalleryViews();
    }
    applyStudyStatus(status) {
        this.settings.ekatechStudyStatus = status;
        if (!this.settings.ekatechStudyDefaultsByAccount[status.account.id]) {
            this.settings.ekatechStudyDefaultsByAccount[status.account.id] = { ...status.defaults };
        }
    }
    async uploadEkatechStudyImage(file, image, defaults, title) {
        const token = this.settings.ekatechStudyToken;
        const accountId = this.ekatechStudyAccountId;
        if (!token || !accountId)
            throw new EkatechStudyApiError('Study hesabına giriş yapman gerekiyor.', 'OBSIDIAN_AUTH_REQUIRED', 401);
        if (image.study?.accountId !== accountId) {
            throw new EkatechStudyApiError('Bu fotoğraf başka bir Study hesabına ait.', 'ACCOUNT_MISMATCH', 409);
        }
        const data = await this.app.vault.readBinary(file);
        const multipart = (0, ekatech_study_1.createMultipartBody)({
            asset_id: image.id,
            vault_id: this.settings.ekatechStudyVaultId,
            exam_type: defaults.examType,
            subject_code: defaults.subjectCode,
            topic_code: defaults.topicCode,
            mistake_type: defaults.mistakeType,
            review_interval_days: String(defaults.reviewIntervalDays),
            source_name: defaults.sourceName,
            question_note: defaults.questionNote,
            solution_note: defaults.solutionNote,
            title,
        }, {
            fieldName: 'attachment',
            filename: file.name,
            contentType: (0, ekatech_study_1.mimeTypeForImageName)(file.name),
            bytes: data,
        });
        const response = await (0, obsidian_1.requestUrl)({
            url: `${ekatech_study_1.EKATECH_STUDY_API_BASE}/api/study/obsidian/mistakes`,
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': `multipart/form-data; boundary=${multipart.boundary}`,
            },
            body: multipart.body,
            throw: false,
        });
        const envelope = response.json;
        if (!envelope.ok || !envelope.data) {
            const error = this.apiError(envelope, response.status);
            if (error.quota && this.settings.ekatechStudyStatus)
                this.settings.ekatechStudyStatus.quota = error.quota;
            if (error.status === 401)
                await this.clearStudySession();
            throw error;
        }
        if (this.settings.ekatechStudyStatus)
            this.settings.ekatechStudyStatus.quota = envelope.data.quota;
        await this.saveSettings();
        return envelope.data;
    }
    apiError(envelope, status) {
        const code = envelope.error?.code || 'STUDY_REQUEST_FAILED';
        const message = envelope.error?.message || `Study isteği tamamlanamadı (${status}).`;
        return new EkatechStudyApiError(message, code, status, envelope.error?.quota);
    }
    refreshOpenGalleryViews() {
        for (const leaf of this.app.workspace.getLeavesOfType(constants_1.GALLERY_VIEW_TYPE)) {
            if (leaf.view instanceof gallery_view_1.AlbumGalleryView)
                leaf.view.requestVaultRefresh();
        }
    }
    openEkatechStudyAccountManager() {
        const leaf = this.app.workspace.getLeavesOfType(constants_1.GALLERY_VIEW_TYPE)[0];
        if (leaf?.view instanceof gallery_view_1.AlbumGalleryView) {
            const container = leaf.view.contentEl;
            const connectedButton = container.querySelector('.album-gallery-study-button.is-connected');
            if (connectedButton instanceof HTMLElement) {
                connectedButton.click();
                return;
            }
        }
        new obsidian_1.Notice('Study Hesap Yöneticisi açık bir galeri üzerinden kullanılabilir.');
    }
    async createGalleryFile(targetFolder) {
        const folder = targetFolder ?? this.app.workspace.getActiveFile()?.parent ?? this.app.vault.getRoot();
        const path = this.findAvailableGalleryPath(folder, constants_1.DEFAULT_GALLERY_BASENAME);
        const title = path.split('/').pop()?.replace(`.${constants_1.GALLERY_EXTENSION}`, '') ?? constants_1.DEFAULT_GALLERY_BASENAME;
        const file = await this.app.vault.create(path, (0, model_1.serializeGalleryDocument)((0, model_1.createGalleryDocument)(title)));
        await this.app.workspace.getLeaf(false).openFile(file);
        new obsidian_1.Notice('Gallery created. Create an album and add media.');
    }
    findAvailableGalleryPath(folder, basename) {
        let suffix = 0;
        while (true) {
            const candidateName = suffix === 0 ? basename : `${basename} ${suffix}`;
            const filename = `${candidateName}.${constants_1.GALLERY_EXTENSION}`;
            const path = (0, obsidian_1.normalizePath)(folder.path === '/' || folder.path === '' ? filename : `${folder.path}/${filename}`);
            if (!this.app.vault.getAbstractFileByPath(path))
                return path;
            suffix += 1;
        }
    }
}
exports.default = AlbumGalleryPlugin;

};
function __require(id) {
  if (id === 'obsidian') return require('obsidian');
  if (id === 'electron') return require('electron');
  const factory = __modules[id];
  if (!factory) throw new Error('Unknown bundled module: ' + id);
  if (factory.__cache) return factory.__cache.exports;
  const module = { exports: {} };
  factory.__cache = module;
  factory(module, module.exports, __require);
  return module.exports;
}
const __entry = __require("main");
module.exports = __entry && (__entry.default || __entry);
