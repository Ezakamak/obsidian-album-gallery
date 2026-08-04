from pathlib import Path
import json

ROOT = Path('.')


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'Expected exactly one match in {path}, found {count}: {old[:120]!r}')
    write(path, content.replace(old, new, 1))


replace_once(
    'src/gallery-view.ts',
    "\t\tlet shouldSave = !isGalleryDocumentV2(data);\n\t\tif (this.file && this.document.title !== this.file.basename) {\n\t\t\tthis.document.title = this.file.basename;\n\t\t\tshouldSave = true;\n\t\t}\n",
    "\t\tlet shouldSave = !isGalleryDocumentV2(data);\n\t\tif (this.syncTitleWithFileName()) shouldSave = true;\n",
)

replace_once(
    'src/gallery-view.ts',
    "\trequestVaultRefresh(): void {\n\t\tif (this.importingAlbumId) return;\n\t\tif (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);\n\t\tthis.refreshTimer = window.setTimeout(() => {\n\t\t\tthis.refreshTimer = null;\n\t\t\tthis.render();\n\t\t}, 180);\n\t}\n",
    "\tprivate syncTitleWithFileName(): boolean {\n\t\tconst fileTitle = this.file?.basename;\n\t\tif (!fileTitle || this.document.title === fileTitle) return false;\n\t\tthis.document.title = fileTitle;\n\t\treturn true;\n\t}\n\n\trequestVaultRefresh(): void {\n\t\tif (this.importingAlbumId) return;\n\t\tif (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);\n\t\tthis.refreshTimer = window.setTimeout(() => {\n\t\t\tthis.refreshTimer = null;\n\t\t\tconst titleChanged = this.syncTitleWithFileName();\n\t\t\tthis.render();\n\t\t\tif (titleChanged) this.requestSave();\n\t\t}, 180);\n\t}\n",
)

manifest = json.loads(read('manifest.json'))
manifest['version'] = '0.6.11'
write('manifest.json', json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')

package = json.loads(read('package.json'))
package['version'] = '0.6.11'
write('package.json', json.dumps(package, indent=2, ensure_ascii=False) + '\n')

lock = json.loads(read('package-lock.json'))
lock['version'] = '0.6.11'
if '' in lock.get('packages', {}):
    lock['packages']['']['version'] = '0.6.11'
write('package-lock.json', json.dumps(lock, indent=2, ensure_ascii=False) + '\n')

versions = json.loads(read('versions.json'))
versions['0.6.11'] = '1.13.0'
write('versions.json', json.dumps(versions, indent=2, ensure_ascii=False) + '\n')

replace_once(
    'scripts/validate-release.mjs',
    "const releasing = await readText('RELEASING.md');\n",
    "const releasing = await readText('RELEASING.md');\nconst galleryViewSource = await readText('src/gallery-view.ts');\n",
)

replace_once(
    'scripts/validate-release.mjs',
    "if (!releasing.includes('main.js') || !releasing.includes('manifest.json') || !releasing.includes('styles.css')) fail('RELEASING.md must list all required release assets.');\n\n\n",
    "if (!releasing.includes('main.js') || !releasing.includes('manifest.json') || !releasing.includes('styles.css')) fail('RELEASING.md must list all required release assets.');\n\nconst titleSyncMarkers = [\n  'private syncTitleWithFileName(): boolean',\n  'const fileTitle = this.file?.basename;',\n  'if (!fileTitle || this.document.title === fileTitle) return false;',\n  'this.document.title = fileTitle;',\n  'if (this.syncTitleWithFileName()) shouldSave = true;',\n  'const titleChanged = this.syncTitleWithFileName();',\n  'if (titleChanged) this.requestSave();',\n];\nfor (const marker of titleSyncMarkers) {\n  if (!galleryViewSource.includes(marker)) fail(`Instant gallery-title synchronization marker is missing: ${marker}`);\n}\nconst titleRefreshStart = galleryViewSource.indexOf('requestVaultRefresh(): void');\nconst titleRefreshEnd = galleryViewSource.indexOf('public activateEkatechStudyAlbum', titleRefreshStart);\nif (titleRefreshStart < 0 || titleRefreshEnd < 0) fail('Could not locate requestVaultRefresh() for title synchronization validation.');\nconst titleRefreshBlock = galleryViewSource.slice(titleRefreshStart, titleRefreshEnd);\nconst titleSyncIndex = titleRefreshBlock.indexOf('const titleChanged = this.syncTitleWithFileName();');\nconst titleRenderIndex = titleRefreshBlock.indexOf('this.render();');\nconst titleSaveIndex = titleRefreshBlock.indexOf('if (titleChanged) this.requestSave();');\nif (!(titleSyncIndex >= 0 && titleRenderIndex > titleSyncIndex && titleSaveIndex > titleRenderIndex)) {\n  fail('Rename refresh must synchronize the title, render immediately, then persist only when changed.');\n}\n\n\n",
)

changelog = read('CHANGELOG.md')
marker = 'All notable changes to Album Gallery are documented here.\n\n'
entry = (
    '## 0.6.11\n\n'
    '### Fixed\n\n'
    '- Gallery titles now update immediately when the backing gallery file is renamed\n'
    '- The synchronized title is persisted only when the filename actually changes, preventing save loops\n'
    '- Added a permanent release check for instant filename-to-title synchronization\n\n'
)
if marker not in changelog:
    raise RuntimeError('CHANGELOG insertion marker not found')
write('CHANGELOG.md', changelog.replace(marker, marker + entry, 1))
