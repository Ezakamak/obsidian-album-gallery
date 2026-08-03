# Album Gallery

Album Gallery is an open-source Obsidian plugin for creating fast, file-based photo galleries.

A `.gallery` file behaves like a dedicated Obsidian document type. Open it to see the gallery interface instead of raw JSON. Each folder added to the file becomes an album, while the original folders and images stay in the vault.

## Current foundation

- Dedicated `.gallery` file view
- Create a gallery from the ribbon, command palette, or a folder context menu
- Add vault folders as albums
- Album cover and image count
- Lazy image loading and batched rendering
- Full-screen lightbox with previous/next navigation
- Automatic refresh when vault files change
- Desktop and mobile support

## Gallery file format

Gallery files are readable JSON and contain references rather than copied media:

```json
{
  "version": 1,
  "title": "Travel photos",
  "albums": [
    {
      "id": "example-album",
      "name": "Ankara",
      "folderPath": "Photos/Ankara",
      "createdAt": 1785772800000
    }
  ],
  "layout": {
    "thumbnailSize": 220,
    "gap": 12,
    "sort": "modified-desc"
  }
}
```

Removing an album from a gallery does not delete its folder or images.

## Local development

Use a separate test vault rather than your main vault.

```bash
npm install
npm run dev
```

For manual validation:

```bash
npm run build
npm run lint
```

Copy or clone the repository into:

```text
<Vault>/.obsidian/plugins/album-gallery/
```

Then enable **Album Gallery** under **Settings → Community plugins** and reload Obsidian after rebuilding.

## Roadmap

- Rename albums and choose custom covers
- Drag-and-drop album ordering
- Search and filtering
- Virtualized masonry layout for very large albums
- Thumbnail cache with safe invalidation
- Import and export helpers

## License

MIT
