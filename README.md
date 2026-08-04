# Album Gallery

Album Gallery is an open-source Obsidian plugin for organizing photos, animated GIFs, and local videos in Apple Photos-inspired albums. It introduces a dedicated `.gallery` file type and keeps imported media inside the vault in a plugin-managed folder.

## Features

- Dedicated `.gallery` document type
- Media and Albums sections
- Create, rename, and delete albums
- Import multiple files with the native desktop or mobile file picker
- Photo support, including JPEG, PNG, WebP, GIF, HEIC, HEIF, TIFF, SVG, AVIF, and BMP
- Animated GIF playback
- MP4, MOV, and WebM video support
- Generated video thumbnails and a native video player
- Full-screen lightbox with keyboard and swipe navigation
- Automatic managed storage under `Album Gallery Assets/`
- Safe duplicate filename handling
- Obsidian trash integration for deleted media and albums
- Batched rendering for large libraries
- Responsive light and dark mode interface
- iPhone safe-area support
- Automatic migration of older gallery documents to the current format

## Ekatech Study integration

Album Gallery includes an optional Ekatech Study integration for the **Hata Defteri** workflow.

- Connecting an Ekatech Study account is optional.
- The integration requires an Ekatech Study account. Available quota depends on the connected Study plan; some plans or services may be paid.
- Album Gallery opens the Ekatech Study website only after the user confirms the redirect.
- After a successful connection, the plugin creates an account-scoped **Hata Defteri** album.
- Hata Defteri accepts photos only: JPG/JPEG, PNG, WebP, HEIC, and HEIF.
- GIFs and videos are always rejected from Hata Defteri.
- Each Hata Defteri photo is limited to 10 MB.
- Selected Hata Defteri photos and their lesson/topic/mistake metadata are uploaded to the connected Ekatech Study account.
- Normal albums, photos, GIFs, and videos remain local inside the vault and are never uploaded by the Study integration.
- The user can refresh account information, change accounts, or sign out from the Study account manager.

See [Privacy](PRIVACY.md) for the complete data and network disclosure.

## Storage

A `.gallery` file stores album metadata and media references as readable JSON. Imported media is copied into a managed structure:

```text
Album Gallery Assets/
└── <gallery-id>/
    └── <album-id>/
        ├── IMG_0001.heic
        ├── animation.gif
        └── clip.mov
```

The user does not need to create or select these folders. Gallery and album identifiers remain stable when a gallery file or album is renamed.

Deleting a managed media item or album moves its stored files through Obsidian's trash system before removing the corresponding gallery metadata.

## Installation

### Community Plugins

After Album Gallery is accepted into the Obsidian Community Plugins directory:

1. Open **Settings → Community plugins**.
2. Select **Browse**.
3. Search for **Album Gallery**.
4. Install and enable the plugin.

### Manual installation

Download `main.js`, `manifest.json`, and `styles.css` from the matching GitHub release, then copy them into:

```text
<Vault>/.obsidian/plugins/album-gallery/
```

Reload Obsidian and enable **Album Gallery** under **Settings → Community plugins**.

## Usage

1. Run **Album Gallery: Create new gallery** from the command palette, use the ribbon button, or choose **New gallery** from a folder menu.
2. Create an album.
3. Select **Add media** and choose photos, GIFs, or supported videos.
4. Open a media card to view it in the lightbox or video player.

Hata Defteri is shown only while an Ekatech Study account is connected. Add question photos from the Hata Defteri album itself.

## Privacy and permissions

- No advertising SDK
- No analytics or telemetry
- No background tracking
- No access outside the Obsidian vault through the normal gallery feature
- Network access is used only for the optional Ekatech Study account and Hata Defteri synchronization
- Study authentication tokens are stored in Obsidian's plugin data for the current vault and are cleared when the user signs out

For details, see [PRIVACY.md](PRIVACY.md).

## Development

Requirements:

- Node.js 18 or later
- npm

Install dependencies and validate the project:

```bash
npm ci
npm run check
```

Development build:

```bash
npm run dev
```

Production build:

```bash
npm run build
```

## Release process

1. Update `manifest.json`, `package.json`, and `versions.json` when required.
2. Run `npm ci`.
3. Run `npm run check`.
4. Create a GitHub release whose tag exactly matches the version in `manifest.json`, without a `v` prefix.
5. Attach these files separately to the release:
   - `main.js`
   - `manifest.json`
   - `styles.css`

The release checklist is documented in [RELEASING.md](RELEASING.md).

## Support and issues

Report reproducible problems through the repository's GitHub Issues page. Do not include private Study account tokens, personal information, or private vault content in reports.

## License

[MIT](LICENSE)

---

Developed by Ekatech.