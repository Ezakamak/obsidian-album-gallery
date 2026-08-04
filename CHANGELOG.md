# Changelog

All notable changes to Album Gallery are documented here.

## 0.6.4

### Added

- Subtle Ekatech ownership branding that does not place watermarks on user media
- Developer information and repository access in the settings source interface
- Responsive branding styles for mobile, light mode, and dark mode

### Fixed

- iPhone lightbox close-button placement now respects the status bar and safe-area insets
- Full-screen mobile lightbox sizing uses the dynamic viewport height
- MP4, MOV, and WebM cards generate visible preview frames instead of remaining black on iOS
- Obsidian Mobile startup no longer depends on the removed secondary runtime loader

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