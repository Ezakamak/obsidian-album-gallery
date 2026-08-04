# Releasing Album Gallery

This checklist prepares an Album Gallery release for the Obsidian Community Plugins directory.

## 1. Update versions

The following values must match exactly:

- `manifest.json` → `version`
- `package.json` → `version`
- `versions.json` → current version mapped to `manifest.minAppVersion`

Use semantic versioning in `x.y.z` format. GitHub release tags must use the same value without a `v` prefix.

The production build reads the version directly from `manifest.json` and stamps it into `main.js`, preventing a stale bundle-version label.

## 2. Install and validate locally

Use Node.js 18 or later:

```bash
npm install
npm run check
```

The development toolchain is pinned to exact versions in `package.json`. `npm install` may generate a fresh `package-lock.json` for the local environment.

`npm run check` performs all of the following without GitHub Actions:

1. ESLint validation
2. TypeScript validation
3. Production CommonJS bundle generation
4. Manifest, runtime, privacy, mobile-layout, media-support, and release-document consistency validation

Do not publish when any command fails.

## 3. Test in Obsidian

Copy the generated root files into a clean test vault:

```text
<Test Vault>/.obsidian/plugins/album-gallery/
├── main.js
├── manifest.json
└── styles.css
```

Test on desktop and mobile before publishing:

- Plugin startup, disable/enable, and reload
- Creating and reopening `.gallery` files
- Creating, renaming, and deleting normal albums
- Importing photos and animated GIFs
- Importing and playing MP4, MOV, and WebM videos
- Video thumbnail generation
- Photo and video lightbox navigation
- iPhone status-bar and safe-area layout
- Ekatech Study redirect confirmation
- Study account connection and account manager
- Study account switching and sign-out
- Hata Defteri photo upload and quota display
- Rejection of GIFs and videos from Hata Defteri
- Preservation of normal albums after Study sign-out

Never use a production Study account containing private material for screenshots or public issue reports.

## 4. Prepare release assets

```bash
npm run prepare:release
```

The command reruns the complete validation and creates:

```text
release/<version>/
├── main.js
├── manifest.json
├── styles.css
└── release-manifest.json
```

`release-manifest.json` contains SHA-256 checksums for verification. It is not a required Obsidian release asset.

## 5. Create the GitHub release

Create a GitHub release with:

- Tag: exactly the `manifest.json` version, for example `0.6.4`
- Title: `Album Gallery 0.6.4`
- Release notes based on `CHANGELOG.md`

Attach these files separately:

- `main.js`
- `manifest.json`
- `styles.css`

A ZIP can be attached as an optional convenience download, but it does not replace the three required individual assets.

Before publishing the release, download the three uploaded assets once and verify that their SHA-256 values match `release-manifest.json`.

## 6. Submit to Obsidian

Submit the public repository through the current Obsidian Community Plugins submission flow. The repository default branch must contain the same current `manifest.json` version as the GitHub release tag.

Before submission, verify that README and PRIVACY disclosures still match the plugin's network, account, payment, and data behavior.

## Updating an accepted plugin

For later versions, update the version files, run the complete checklist, and publish a matching GitHub release. A new directory submission is not required for each update.
