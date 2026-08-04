from pathlib import Path
import json

ROOT = Path('.')


def read(path):
    return (ROOT / path).read_text()


def write(path, text):
    (ROOT / path).write_text(text)


def replace(path, old, new, count=-1):
    text = read(path)
    if old not in text:
        raise RuntimeError(f'Missing expected text in {path}: {old[:120]!r}')
    text = text.replace(old, new, count)
    write(path, text)


manifest = json.loads(read('manifest.json'))
manifest['version'] = '0.6.10'
manifest['minAppVersion'] = '1.13.0'
write('manifest.json', json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')

package = json.loads(read('package.json'))
package['version'] = '0.6.10'
package['scripts']['lint'] = 'eslint . --max-warnings=0'
package['devDependencies']['obsidian'] = '1.13.1'
write('package.json', json.dumps(package, indent=2, ensure_ascii=False) + '\n')

versions = json.loads(read('versions.json'))
versions['0.6.10'] = '1.13.0'
write('versions.json', json.dumps(versions, indent=2, ensure_ascii=False) + '\n')

eslint_config = """import js from '@eslint/js';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

const runtimeConfigs = obsidianmd.configs.recommended.map((config) => ({
  ...config,
  files: ['src/**/*.ts'],
}));

export default defineConfig(
  globalIgnores([
    'node_modules/**',
    'release/**',
    'dist/**',
    'build/**',
    'coverage/**',
    'main.js',
    'package-lock.json',
  ]),
  {
    files: ['scripts/**/*.mjs', '*.mjs'],
    ...js.configs.recommended,
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-console': 'off',
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'eslint.config.mjs',
            'eslint.config.mts',
            'esbuild.config.mjs',
            'version-bump.mjs',
            'scripts/*.mjs',
            'manifest.json',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.json'],
      },
    },
  },
  ...runtimeConfigs,
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
    },
  },
);
"""
write('eslint.config.mjs', eslint_config)

settings = """import {
\tApp,
\tPluginSettingTab,
\tsetIcon,
\ttype SettingDefinitionItem,
} from 'obsidian';
import type { EkatechStudyMistakeDefaults, EkatechStudyStatus } from './ekatech-study';
import type AlbumGalleryPlugin from './main';

export type GalleryDefaultTab = 'photos' | 'albums';

export interface AlbumGallerySettings {
\tbatchSize: number;
\tdefaultTab: GalleryDefaultTab;
\tekatechStudyToken: string;
\tekatechStudyVaultId: string;
\tekatechStudyPendingState: string;
\tekatechStudyStatus: EkatechStudyStatus | null;
\tekatechStudyDefaultsByAccount: Record<string, EkatechStudyMistakeDefaults>;
}

export const DEFAULT_SETTINGS: AlbumGallerySettings = {
\tbatchSize: 100,
\tdefaultTab: 'photos',
\tekatechStudyToken: '',
\tekatechStudyVaultId: '',
\tekatechStudyPendingState: '',
\tekatechStudyStatus: null,
\tekatechStudyDefaultsByAccount: {},
};

export class AlbumGallerySettingTab extends PluginSettingTab {
\tprivate readonly plugin: AlbumGalleryPlugin;

\tconstructor(app: App, plugin: AlbumGalleryPlugin) {
\t\tsuper(app, plugin);
\t\tthis.plugin = plugin;
\t}

\tgetSettingDefinitions(): SettingDefinitionItem[] {
\t\tconst status = this.plugin.settings.ekatechStudyStatus;
\t\tconst quota = status?.quota;
\t\tconst accountText = status
\t\t\t? `${status.account.displayName} · ${status.account.plan}`
\t\t\t: 'Obsidian içinde Study hesabına giriş yap. Hata defteri albümü otomatik oluşturulur ve eklediğin fotoğraflar aynı hesaba yüklenir.';
\t\tconst quotaText = quota
\t\t\t? quota.unlimited
\t\t\t\t? 'Obsidian cloud yüklemeleri sınırsız.'
\t\t\t\t: `Bu ay ${quota.used} / ${quota.limit ?? 12} yükleme kullanıldı. ${quota.remaining ?? 0} kaldı.`
\t\t\t: '';

\t\treturn [
\t\t\t{
\t\t\t\tname: 'Ekatech study',
\t\t\t\tdesc: [accountText, quotaText].filter(Boolean).join(' '),
\t\t\t\trender: (setting) => {
\t\t\t\t\tsetting.addButton((button) => {
\t\t\t\t\t\tif (status) {
\t\t\t\t\t\t\tbutton
\t\t\t\t\t\t\t\t.setButtonText('Çıkış yap')
\t\t\t\t\t\t\t\t.setDestructive()
\t\t\t\t\t\t\t\t.onClick(() => { void this.disconnectStudyAccount(); });
\t\t\t\t\t\t} else {
\t\t\t\t\t\t\tbutton
\t\t\t\t\t\t\t\t.setButtonText('Study hesabına giriş')
\t\t\t\t\t\t\t\t.setCta()
\t\t\t\t\t\t\t\t.onClick(() => this.plugin.beginEkatechStudyLink());
\t\t\t\t\t\t}
\t\t\t\t\t});
\t\t\t\t},
\t\t\t},
\t\t\t{
\t\t\t\tname: 'Hesabı ve kotayı yenile',
\t\t\t\tdesc: 'Study paketini, aylık kotayı ve ders-konu listesini yeniden kontrol eder.',
\t\t\t\tvisible: Boolean(status),
\t\t\t\trender: (setting) => {
\t\t\t\t\tsetting.addButton((button) => button
\t\t\t\t\t\t.setButtonText('Yenile')
\t\t\t\t\t\t.onClick(() => { void this.refreshStudyAccount(); }));
\t\t\t\t},
\t\t\t},
\t\t\t{
\t\t\t\tname: 'Default tab',
\t\t\t\tdesc: 'Choose which section opens first in a gallery.',
\t\t\t\trender: (setting) => {
\t\t\t\t\tsetting.addDropdown((dropdown) => dropdown
\t\t\t\t\t\t.addOption('photos', 'Photos')
\t\t\t\t\t\t.addOption('albums', 'Albums')
\t\t\t\t\t\t.setValue(this.plugin.settings.defaultTab)
\t\t\t\t\t\t.onChange((value) => {
\t\t\t\t\t\t\tthis.plugin.settings.defaultTab = value === 'albums' ? 'albums' : 'photos';
\t\t\t\t\t\t\tvoid this.plugin.saveSettings();
\t\t\t\t\t\t}));
\t\t\t\t},
\t\t\t},
\t\t\t{
\t\t\t\tname: 'Photos loaded per batch',
\t\t\t\tdesc: 'Lower values reduce memory use on mobile. Higher values reveal large galleries faster.',
\t\t\t\trender: (setting) => {
\t\t\t\t\tsetting.addSlider((slider) => slider
\t\t\t\t\t\t.setLimits(20, 300, 20)
\t\t\t\t\t\t.setValue(this.plugin.settings.batchSize)
\t\t\t\t\t\t.onChange((value) => {
\t\t\t\t\t\t\tthis.plugin.settings.batchSize = value;
\t\t\t\t\t\t\tvoid this.plugin.saveSettings();
\t\t\t\t\t\t}));
\t\t\t\t},
\t\t\t},
\t\t\t{
\t\t\t\tname: 'Album gallery',
\t\t\t\tdesc: `Ekatech tarafından geliştirildi · v${this.plugin.manifest.version}`,
\t\t\t\tsearchable: false,
\t\t\t\trender: (setting) => {
\t\t\t\t\tsetting.settingEl.addClass('album-gallery-brand-footer');
\t\t\t\t\tsetting.settingEl.setAttr('aria-label', 'Album gallery geliştirici bilgisi');
\t\t\t\t\tconst mark = setting.nameEl.createSpan({
\t\t\t\t\t\tcls: 'album-gallery-brand-mark',
\t\t\t\t\t\tattr: { 'aria-hidden': 'true' },
\t\t\t\t\t\tprepend: true,
\t\t\t\t\t});
\t\t\t\t\tsetIcon(mark, 'sparkles');
\t\t\t\t\tsetting.controlEl.createEl('a', {
\t\t\t\t\t\tcls: 'album-gallery-brand-link',
\t\t\t\t\t\ttext: 'GitHub',
\t\t\t\t\t\tattr: {
\t\t\t\t\t\t\thref: 'https://github.com/Ezakamak/obsidian-album-gallery',
\t\t\t\t\t\t\ttarget: '_blank',
\t\t\t\t\t\t\trel: 'noopener noreferrer',
\t\t\t\t\t\t\t'aria-label': 'Album gallery GitHub deposunu aç',
\t\t\t\t\t\t},
\t\t\t\t\t});
\t\t\t\t},
\t\t\t},
\t\t];
\t}

\tprivate async disconnectStudyAccount(): Promise<void> {
\t\tawait this.plugin.disconnectEkatechStudy();
\t\tthis.update();
\t}

\tprivate async refreshStudyAccount(): Promise<void> {
\t\tawait this.plugin.refreshEkatechStudyStatus(true);
\t\tthis.update();
\t}
}
"""
write('src/settings.ts', settings)

for old, new in [
    ('Refresh Study account', 'Refresh study account'),
    ('Hata Defteri varsayılanları kaydedildi.', 'Hata defteri varsayılanları kaydedildi.'),
    ('Bazı Hata Defteri fotoğrafları kuyrukta kaldı; otomatik yeniden denenecek.', 'Bazı hata defteri fotoğrafları kuyrukta kaldı; otomatik yeniden denenecek.'),
]:
    replace('src/gallery-view.ts', old, new)
replace('src/gallery-view.ts', "save.addEventListener('click', async () => {", "save.addEventListener('click', () => { void (async () => {")
replace('src/gallery-view.ts', "\t\t\tnew Notice('Hata defteri varsayılanları kaydedildi.');\n\t\t});", "\t\t\tnew Notice('Hata defteri varsayılanları kaydedildi.');\n\t\t})(); });")
replace('src/gallery-view.ts', "confirm.addEventListener('click', async () => { confirm.disabled = true; await this.options.onConfirm(); this.close(); });", "confirm.addEventListener('click', () => { void (async () => { confirm.disabled = true; await this.options.onConfirm(); this.close(); })(); });")

for old, new in [
    ('Ekatech Study hesabına bağlan', 'Ekatech study hesabına bağlan'),
    ('Devam ettiğinde güvenli giriş için Ekatech Study web sitesine yönlendirileceksin.', 'Devam ettiğinde güvenli giriş için ekatech study web sitesine yönlendirileceksin.'),
    ('Bu hizmet yalnızca Ekatech Study uygulaması müşterileri içindir.', 'Bu hizmet yalnızca ekatech study uygulaması müşterileri içindir.'),
    ('Study hesabınla giriş yaptıktan ve bağlantıyı onayladıktan sonra Obsidian’a geri dönersin. Hata Defteri fotoğrafları bağlı hesabına yüklenir.', 'Study hesabınla giriş yaptıktan ve bağlantıyı onayladıktan sonra Obsidian’a geri dönersin. Hata defteri fotoğrafları bağlı hesabına yüklenir.'),
    ('Siteye git', 'Siteye Git'),
    ('Connect Ekatech Study account', 'Connect Ekatech study account'),
    ('Obsidian Study oturumu sona erdi. Yeniden giriş yap.', 'Obsidian study oturumu sona erdi. Yeniden giriş yap.'),
]:
    replace('src/main.ts', old, new)

for old, new in [
    ('Create an album, then choose photos, animated GIFs, or videos. Album Gallery stores them automatically inside the vault.', 'Create an album, then choose photos, animated gifs, or videos. Album gallery stores them automatically inside the vault.'),
    ('Choose photos, animated GIFs, MP4/MOV videos, or WebM videos. The plugin creates and manages the storage folder automatically.', 'Choose photos, animated gifs, mp4/mov videos, or webm videos. The plugin creates and manages the storage folder automatically.'),
]:
    replace('src/media-support.ts', old, new)
replace('src/media-support.ts', "confirm.addEventListener('click', async () => {\n\t\t\tconfirm.disabled = true;\n\t\t\tawait this.onConfirm();\n\t\t\tthis.close();\n\t\t});", "confirm.addEventListener('click', () => { void (async () => {\n\t\t\tconfirm.disabled = true;\n\t\t\tawait this.onConfirm();\n\t\t\tthis.close();\n\t\t})(); });")

for old, new in [
    ('Study Hesap Yöneticisi', 'Study hesap yöneticisi'),
    ('Obsidian Hata Defteri bağlantını ve aylık yükleme hakkını yönet.', 'Obsidian hata defteri bağlantını ve aylık yükleme hakkını yönet.'),
    ('Bu cihazdaki Study oturumu kapatılacak. Normal albümlerin ve yerel fotoğrafların silinmeyecek.', 'Bu cihazdaki study oturumu kapatılacak. Normal albümlerin ve yerel fotoğrafların silinmeyecek.'),
]:
    replace('src/study-account-manager.ts', old, new)
replace('src/study-account-manager.ts', "button.addEventListener('click', async () => {", "button.addEventListener('click', () => { void (async () => {")
replace('src/study-account-manager.ts', "\t\t\t\tbutton.disabled = false;\n\t\t\t}\n\t\t});", "\t\t\t\tbutton.disabled = false;\n\t\t\t}\n\t\t})(); });")
replace('src/study-account-manager.ts', "confirm.addEventListener('click', async () => {", "confirm.addEventListener('click', () => { void (async () => {")
replace('src/study-account-manager.ts', "\t\t\tthis.onLoggedOut();\n\t\t});", "\t\t\tthis.onLoggedOut();\n\t\t})(); });")

video = read('src/video-preview-thumbnails.ts')
video = video.replace("document.createElement('canvas')", "createEl('canvas')")
video = video.replace('result instanceof HTMLVideoElement', 'result && result.instanceOf(HTMLVideoElement)')
video = video.replace('element instanceof HTMLVideoElement', 'element.instanceOf(HTMLVideoElement)')
write('src/video-preview-thumbnails.ts', video)

css = read('styles.css')
css = css.replace('.album-gallery-photo-card {\n\tdisplay: block !important;\n\twidth: 100% !important;\n\theight: auto !important;\n\tmin-width: 0 !important;\n\tmin-height: 0 !important;\n\tpadding: 0 !important;', '.album-gallery-view button.album-gallery-photo-card {\n\tdisplay: block;\n\twidth: 100%;\n\theight: auto;\n\tmin-width: 0;\n\tmin-height: 0;\n\tpadding: 0;')
css = css.replace('.album-gallery-photo-card > img,\n.album-gallery-photo-card > video {\n\tdisplay: block !important;\n\twidth: 100% !important;\n\theight: 100% !important;\n\tmin-width: 0 !important;\n\tmin-height: 0 !important;\n\tmax-width: none !important;\n\tmax-height: none !important;\n\tobject-fit: cover !important;', '.album-gallery-view button.album-gallery-photo-card > img,\n.album-gallery-view button.album-gallery-photo-card > video {\n\tdisplay: block;\n\twidth: 100%;\n\theight: 100%;\n\tmin-width: 0;\n\tmin-height: 0;\n\tmax-width: none;\n\tmax-height: none;\n\tobject-fit: cover;')
css = css.replace('.album-gallery-lightbox-container .modal-close-button,\n.album-gallery-lightbox-modal .modal-close-button {\n\tdisplay: none !important;', '.modal-container.album-gallery-lightbox-container .modal-close-button,\n.album-gallery-lightbox-container .modal.album-gallery-lightbox-modal .modal-close-button {\n\tdisplay: none;')
css = css.replace('\t.album-gallery-lightbox-modal {\n\t\tposition: fixed !important;\n\t\tinset: 0 !important;\n\t\twidth: 100vw !important;\n\t\tmin-height: 100vh !important;\n\t\theight: 100dvh !important;\n\t\tmax-width: none !important;\n\t\tmax-height: none !important;\n\t\tmargin: 0 !important;\n\t\tpadding: 0 !important;\n\t\tborder-radius: 0 !important;', '\t.album-gallery-lightbox-container .modal.album-gallery-lightbox-modal {\n\t\tposition: fixed;\n\t\tinset: 0;\n\t\twidth: 100vw;\n\t\tmin-height: 100vh;\n\t\theight: 100dvh;\n\t\tmax-width: none;\n\t\tmax-height: none;\n\t\tmargin: 0;\n\t\tpadding: 0;\n\t\tborder-radius: 0;')
css = css.replace('\t.album-gallery-lightbox-modal .modal-content {\n\t\theight: 100% !important;\n\t\tpadding-top: 72px !important;\n\t\tpadding-right: 0 !important;\n\t\tpadding-bottom: max(calc(env(safe-area-inset-bottom, 0px) + 10px), 10px) !important;\n\t\tpadding-left: 0 !important;', '\t.album-gallery-lightbox-container .modal.album-gallery-lightbox-modal .modal-content {\n\t\theight: 100%;\n\t\tpadding-top: 72px;\n\t\tpadding-right: 0;\n\t\tpadding-bottom: max(calc(env(safe-area-inset-bottom, 0px) + 10px), 10px);\n\t\tpadding-left: 0;')
if '!important' in css:
    raise RuntimeError('Unexpected !important remains in styles.css')
write('styles.css', css)

grid_validator = """import fs from 'node:fs';

const styles = fs.readFileSync('styles.css', 'utf8');
const startMarker = '/* Album Gallery mobile media grid — restored from proven 0.6.2 */';
const endMarker = '/* End proven mobile media grid */';
const start = styles.indexOf(startMarker);
const end = styles.indexOf(endMarker, start);

if (start < 0 || end < 0) {
\tthrow new Error('The proven mobile media-grid contract is missing from styles.css.');
}

const block = styles.slice(start, end + endMarker.length);
const required = [
\t'repeat(2, minmax(0, 1fr))',
\t'aspect-ratio: 1',
\t'height: auto',
\t'.album-gallery-view button.album-gallery-photo-card > img',
\t'.album-gallery-view button.album-gallery-photo-card > video',
\t'object-fit: cover',
];

for (const token of required) {
\tif (!block.includes(token)) throw new Error(`Mobile media-grid contract is missing: ${token}`);
}

if (/position\\s*:\\s*absolute/i.test(block)) {
\tthrow new Error('Media cards must not use the failed absolute-position grid workaround.');
}
if (block.includes('!important')) {
\tthrow new Error('The mobile media-grid contract must not use !important.');
}
"""
write('scripts/validate-mobile-grid.mjs', grid_validator)

lightbox_validator = """import fs from 'node:fs';

const styles = fs.readFileSync('styles.css', 'utf8');
const support = fs.readFileSync('src/media-support.ts', 'utf8');

const requiredStyles = [
\t'.modal-container.album-gallery-lightbox-container .modal-close-button',
\t'display: none',
\t'.album-gallery-lightbox-actions',
\t'.album-gallery-lightbox-close',
\t'padding-top: 72px',
\t'flex-direction: column',
\t'text-overflow: ellipsis',
\t'white-space: nowrap',
\t'.album-gallery-lightbox-previous',
\t'left: 8px',
\t'.album-gallery-lightbox-next',
\t'right: 8px',
\t'top: 50%',
\t'transform: translateY(-50%)',
\t'grid-column: 1',
\t'grid-row: 1',
];
for (const token of requiredStyles) {
\tif (!styles.includes(token)) throw new Error(`Mobile lightbox contract is missing: ${token}`);
}

const requiredSource = [
\t"this.containerEl.addClass('album-gallery-lightbox-container')",
\t"new MutationObserver(() => this.removeNativeCloseControl())",
\t"this.nativeCloseObserver.observe(this.containerEl, { childList: true, subtree: true })",
\t"querySelectorAll<HTMLElement>('.modal-close-button')",
\t'closeButton.remove()',
\t"cls: 'album-gallery-lightbox-actions'",
\t"cls: 'clickable-icon album-gallery-lightbox-close'",
\t"setIcon(closeButton, 'x')",
\t"closeButton.addEventListener('click', () => this.close())",
];
for (const token of requiredSource) {
\tif (!support.includes(token)) throw new Error(`Native/custom close-control contract is missing: ${token}`);
}

if (styles.includes('124px') || styles.includes('!important')) {
\tthrow new Error('The warning-free mobile lightbox contract regressed.');
}
"""
write('scripts/validate-lightbox.mjs', lightbox_validator)

release = read('scripts/validate-release.mjs')
release = release.replace("  'package.json',\n  'versions.json',", "  'package.json',\n  'package-lock.json',\n  'versions.json',")
release = release.replace("if (main.includes('album-gallery-media-runtime-styles')) {\n  fail('main.js still contains the removed runtime media-style injector.');\n}\n", "if (main.includes('album-gallery-media-runtime-styles')) {\n  fail('main.js still contains the removed runtime media-style injector.');\n}\nif (main.includes('document.createElement')) fail('main.js must use Obsidian DOM helpers instead of document.createElement.');\n")
release = release.replace("for (const marker of styleMarkers) {\n  if (!styles.includes(marker)) fail(`styles.css is missing release marker: ${marker}`);\n}\n", "for (const marker of styleMarkers) {\n  if (!styles.includes(marker)) fail(`styles.css is missing release marker: ${marker}`);\n}\nif (styles.includes('!important')) fail('styles.css must not use !important.');\n")
release = release.replace("console.log(`Album Gallery ${manifest.version} release files are internally consistent.`);", "")
write('scripts/validate-release.mjs', release)

text = read('scripts/prepare-release.mjs')
lines = [line for line in text.splitlines() if not line.lstrip().startswith('console.log(')]
write('scripts/prepare-release.mjs', '\n'.join(lines) + '\n')

changelog = read('CHANGELOG.md')
entry = """## 0.6.10

### Changed

- Added a reproducible npm lockfile and current Obsidian API types so automated source analysis resolves types correctly
- Migrated settings to the declarative Obsidian 1.13 API and removed deprecated imperative controls
- Replaced raw DOM creation and cross-window `instanceof` checks with Obsidian-safe helpers
- Removed every `!important` declaration while preserving the proven mobile grid and lightbox layout through scoped selectors
- Converted asynchronous UI listeners to synchronous callbacks with explicitly managed promises
- Added strict zero-warning lint and release gates to prevent these review warnings from returning

"""
if '## 0.6.10' not in changelog:
    changelog = changelog.replace('All notable changes to Album Gallery are documented here.\n\n', 'All notable changes to Album Gallery are documented here.\n\n' + entry)
write('CHANGELOG.md', changelog)

for path in [
    'eslint-fix-exit.txt',
    'strict-review-lint-exit.txt',
    'strict-review-lint.txt',
    'eslint-fix.log',
]:
    candidate = ROOT / path
    if candidate.exists():
        candidate.unlink()
