# Privacy

Album Gallery is designed so that standard gallery use remains local to the user's Obsidian vault.

## Local gallery data

For normal albums, the plugin processes and stores the following data locally:

- `.gallery` document metadata
- Album names and identifiers
- Media filenames and vault-relative paths
- Imported photos, animated GIFs, and videos
- Plugin settings

Normal album media is copied into `Album Gallery Assets/` inside the vault. Album Gallery does not upload normal album content to Ekatech or another service.

## Optional Ekatech Study connection

The Ekatech Study integration is optional and is activated only after the user starts the connection and confirms that the plugin may open the Ekatech Study website.

When this integration is used, the plugin communicates with `https://ekatech.net` to:

- Start and complete Study account authorization
- Read the connected account name, email address, plan, curriculum, and Obsidian upload quota
- Sign out the current Obsidian Study session
- Upload Hata Defteri question photos and the metadata entered by the user

Uploaded Hata Defteri data can include:

- The selected question photo
- Exam, lesson, and topic identifiers
- Mistake type
- Review interval
- Source name
- Question and solution notes
- A vault-scoped identifier and media identifier used for synchronization

Hata Defteri accepts only JPG/JPEG, PNG, WebP, HEIC, and HEIF photos up to 10 MB. GIFs and videos are not accepted or uploaded through this integration.

## Authentication data

The Study authorization token and account status are stored in Obsidian's plugin data for the current vault. Signing out clears the local Study token and account status. The plugin also requests server-side session revocation when possible.

Users should not share plugin data files, Study tokens, or private vault content in public issue reports.

## Analytics, advertising, and tracking

Album Gallery does not include:

- Analytics
- Advertising SDKs
- Cross-site tracking
- Behavioral profiling
- Background location access
- Contact, microphone, or camera collection

## Third-party services

The only service used by the plugin itself is the optional Ekatech Study service at `ekatech.net`. GitHub may be opened when the user selects the repository link in the plugin settings.

## Changes

Material privacy changes will be documented in the repository and release notes. Questions or privacy concerns can be submitted through GitHub Issues without including sensitive information.