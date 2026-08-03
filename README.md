# Album Gallery

Album Gallery is an open-source Obsidian plugin that turns `.gallery` files into a simple, Apple Photos-inspired photo library.

Users do not need to create folders or organize image files manually. Create an album, tap **Add photos**, choose one or many images, and the plugin stores them in a managed vault folder automatically.

## Features

- Dedicated `.gallery` document type
- Photos and Albums sections
- Create, rename, and delete albums
- Native mobile/desktop file picker with multi-select
- Automatic managed storage under `Album Gallery Assets/`
- Safe duplicate filename handling
- Full-screen lightbox with keyboard buttons and swipe navigation
- Delete photos through Obsidian's trash system
- Batched lazy rendering for large libraries
- Responsive light and dark mode interface
- Automatic migration of version 1 gallery files to version 2

## How storage works

A gallery file stores album metadata and image references as readable JSON. Imported photos are copied into a plugin-managed structure:

```text
Album Gallery Assets/
└── <gallery-id>/
    └── <album-id>/
        ├── IMG_0001.heic
        └── IMG_0002.jpg
```

The user never needs to create or select these folders. Gallery and album IDs remain stable when a `.gallery` file or album is renamed.

Example version 2 gallery document:

```json
{
  "version": 2,
  "id": "gallery-id",
  "title": "Travel",
  "albums": [
    {
      "id": "album-id",
      "name": "Ankara",
      "images": [
        {
          "id": "image-id",
          "path": "Album Gallery Assets/gallery-id/album-id/IMG_0001.jpg",
          "name": "IMG_0001.jpg",
          "addedAt": 1785772800000
        }
      ],
      "createdAt": 1785772800000,
      "updatedAt": 1785772800000
    }
  ],
  "layout": {
    "thumbnailSize": 220,
    "gap": 4,
    "sort": "added-desc"
  }
}
```

Deleting a managed photo or album moves its stored files to Obsidian's trash before removing the gallery metadata.

## Installation

Copy these files into:

```text
<Vault>/.obsidian/plugins/album-gallery/
```

Required files:

- `main.js`
- `manifest.json`
- `styles.css`

Enable **Album Gallery** under **Settings → Community plugins**, then reload Obsidian.

## Local development

```bash
npm install
npm run dev
```

Validation:

```bash
npm run lint
npm run build
```

## License

MIT
