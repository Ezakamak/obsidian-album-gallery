# Changelog

All notable changes to Album Gallery are documented here.

## 0.6.11

### Fixed

- Gallery titles now update immediately when the backing gallery file is renamed
- The synchronized title is persisted only when the filename actually changes, preventing save loops
- Added a permanent release check for instant filename-to-title synchronization

## 0.6.10

### Changed

- Added a reproducible npm lockfile and current Obsidian API types so automated source analysis resolves types correctly
- Migrated settings to the declarative Obsidian 1.13 API and removed deprecated imperative controls
- Replaced raw DOM creation and cross-window `instanceof` checks with Obsidian-safe helpers
- Removed every `!important` declaration while preserving the proven mobile grid and lightbox layout through scoped selectors
- Converted asynchronous UI listeners to synchronous callbacks with explicitly managed promises
- Added strict zero-warning lint and release gates to prevent these review warnings from returning

## 0.6.9

### Fixed

- Moved all media and mobile lightbox CSS into the static styles.css release asset required by Obsidian
- Removed runtime style-element creation and the obsolete media-styles module
- Preserved the proven two-column mobile grid, toolbar close button, and left/right lightbox navigation
- Switched the lightbox animation-frame call to the active window for popout compatibility
- Added release validation that rejects future runtime style injection

## 0.6.8

### Fixed

- Removed Obsidian's native modal close element from the Album Gallery lightbox DOM instead of relying on an incorrectly scoped CSS selector
- Added a container-level fallback rule and a MutationObserver so the native status-bar X cannot return
- Kept the Album Gallery-owned toolbar close button, corrected two-column grid, and left/right navigation unchanged

## 0.6.7

### Fixed

- Removed the unreliable native Obsidian lightbox close button from the media viewer
- Added a toolbar-owned close control that cannot overlap the iPhone battery or status icons
- Reduced the excessive empty space above the media toolbar while preserving the safe top offset
- Preserved the corrected two-column media grid and left/right lightbox navigation

## 0.6.6

### Fixed

- Restored the proven mobile lightbox layout from the correctly working early releases
- Kept long filenames on one ellipsized line and moved album/count metadata beneath them
- Returned previous and next controls to the left and right center of the media stage
- Moved the close control below the iPhone status area with a fixed 48-point touch target
- Added permanent lightbox regression validation while preserving the corrected two-column media grid

## 0.6.5

### Fixed

- Restored the proven two-column iPhone media grid from the correctly working 0.6.2 package
- Restored square photo, GIF, and video cards with full-width cover cropping
- Prevented Obsidian mobile button and intrinsic media sizing from collapsing previews into strips
- Added a permanent release validation that rejects removal of the mobile grid contract or the failed absolute-position workaround
- Removed the stale unused TFile import that blocked the repository lint gate
- Replaced brittle minified-variable and outdated UI-copy release assertions with stable runtime MIME and feature checks

## 0.6.4

### Added

- Subtle Ekatech ownership branding that does not place watermarks on user media
- Developer information and repository access in the settings source interface
- Responsive branding styles for mobile, light mode, and dark mode
- Local release preparation, privacy, security, and Community Plugins submission documentation

### Fixed

- iPhone lightbox close-button placement now respects the status bar and safe-area insets
- Full-screen mobile lightbox sizing uses the dynamic viewport height
- MP4, MOV, and WebM cards generate visible preview frames instead of remaining black on iOS
- Obsidian Mobile startup no longer depends on the removed secondary runtime loader
- Production bundles are stamped with the exact `manifest.json` version
- Obsolete runtime shards and stale sample-project package metadata were removed from the public repository
- Release tooling versions are pinned and the complete release package is validated locally without GitHub Actions

### Media support

- Normal albums support photos, animated GIFs, MP4, MOV, and WebM videos
- Videos include grid previews, album-cover previews, playback controls, and lightbox navigation
- Hata Defteri remains strictly photo-only and rejects GIFs and videos

### Ekatech Study

- Added a redirect confirmation before opening the Study website
- Added the Study account manager with account details, quota refresh, account switching, and sign-out
- Preserved normal albums and local files during Study sign-out or account changes

## 0.5.0

- Added optional Ekatech Study account connection and account-scoped Hata Defteri synchronization
- Added Study quota, curriculum metadata, upload retry, and synchronization status handling

## Earlier versions

Earlier versions established the `.gallery` document format, managed vault storage, album management, mobile layout, lightbox navigation, and gallery migration behavior.
