import { App, FuzzySuggestModal, TFolder } from 'obsidian';

export class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
	private readonly excludedPaths: Set<string>;
	private readonly onChoose: (folder: TFolder) => void;

	constructor(app: App, excludedPaths: Set<string>, onChoose: (folder: TFolder) => void) {
		super(app);
		this.excludedPaths = excludedPaths;
		this.onChoose = onChoose;
		this.setPlaceholder('Choose a folder to use as an album');
	}

	getItems(): TFolder[] {
		return this.app.vault
			.getAllFolders(true)
			.filter((folder) => !this.excludedPaths.has(folder.path));
	}

	getItemText(folder: TFolder): string {
		return folder.path === '/' || folder.path === '' ? 'Vault root' : folder.path;
	}

	onChooseItem(folder: TFolder): void {
		this.onChoose(folder);
	}
}
