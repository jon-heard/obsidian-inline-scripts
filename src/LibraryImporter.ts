///////////////////////////////////////////////////////////////////////////////////////////////////
// Library Importer - Pulls the official TEJS library from github & adds it to the current vault //
///////////////////////////////////////////////////////////////////////////////////////////////////

"use strict";

const REGEX_LIBRARY_README_SHORTCUT_FILE: RegExp = /### tejs_[_a-zA-Z0-9]+\n/g;

abstract class LibraryImporter
{
	public static initialize(settingsUi: any)
	{
		this.settingsUi = settingsUi;
	}

	// Pull the official TEJS library from github & add it to the current vault
	public static run(): void
	{
		this.run_internal();
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	private static settingsUi: any;

	public static async run_internal(): Promise<void>
	{
		const ADDRESS_REMOTE: string =
			"https://raw.githubusercontent.com/jon-heard/" +
			"obsidian-text-expander-js_shortcutFileLibrary/shortcutAboutString";
		const ADDRESS_LOCAL: string = "tejs";
		const FILE_README: string = "README.md";

		// Need to manually disable user-input until this process is finished
		// (due to asynchronous downloads not otherwise blocking user-input)
		InputBlocker.setEnabled(true);

		// Get list of shortcut-files from the projects github readme
		const readmeContent: string = await window.request({
			url: ADDRESS_REMOTE + "/" + FILE_README,
			method: "GET", cache: "no-cache"
		});
		const shortcutFiles: Array<string> =
			readmeContent.match(REGEX_LIBRARY_README_SHORTCUT_FILE).
			map((s: string) => s.substring(4, s.length-1));

		// Figure out library destination.  By default this is ADDRESSS_LOCAL.
		// However, if all shortcut-file references in the settings that match files in
		// the library are in a single folder, ask user if they want to use that folder
		// instead of the default library destination.
		let shortcutReferences: Array<string> = this.settingsUi.getShortcutFilesFromUi();
		// The filenames of referenced shortcut-files
		let shortcutReferenceFilenames: Array<string> =
			shortcutReferences.map(s => s.substring(s.lastIndexOf("/")+1, s.length-3));
		// The paths of referenced shortcut-files
		let shortcutReferencePaths: Array<string> = shortcutReferences.map((s,i) =>
		{
			return s.substring(0, s.length-shortcutReferenceFilenames[i].length-4)
		});
		// Find a common path, or lack thereof, to shortcut-files belonging to the library
		let commonPath: string = undefined;
		for (let i: number = 0; i < shortcutReferences.length; i++)
		{
			if(shortcutFiles.includes(shortcutReferenceFilenames[i]))
			{
				if (commonPath === undefined)
				{
					commonPath = shortcutReferencePaths[i];
				}
				else
				{
					if (shortcutReferencePaths[i] != commonPath)
					{
						commonPath = undefined;
						break;
					}
				}
			}
		}
		if (commonPath == ADDRESS_LOCAL) { commonPath = undefined; }
		let libraryDestination: string = await new Promise((resolve, reject) =>
		{
			if (commonPath == undefined)
			{
				resolve(ADDRESS_LOCAL);
				return;
			}

			// We need to remove the input blocker to let the user choose
			InputBlocker.setEnabled(false);

			new ConfirmDialogBox(
				this.settingsUi.plugin.app,
				"All library references are currently in the folder \"" + commonPath +
				"\".\nWould you like to import the library into \"" + commonPath +
				"\"?\nIf not, the library will be imported into the folder \"" + ADDRESS_LOCAL +
				"\".",
				(confirmation: boolean) =>
				{
					if (confirmation)
					{
						resolve(commonPath);
					}
					else
					{
						resolve(ADDRESS_LOCAL);
					}
				}
			).open();
		});

		// Put the input blocker back (if it was disabled for confirm dialog)
		InputBlocker.setEnabled(true);

		// Create the choosen library destination folder, if necessary
		if (!this.settingsUi.plugin.app.vault.fileMap.hasOwnProperty(libraryDestination))
		{
			this.settingsUi.plugin.app.vault.createFolder(libraryDestination);
		}

		// Download and create library files
		for (const shortcutFile of shortcutFiles)
		{
			// Download the file
			let content: string = await window.request({
				url: ADDRESS_REMOTE + "/" + shortcutFile + ".md",
				method: "GET", cache: "no-cache"
			});

			let filename: string = libraryDestination + "/" + shortcutFile + ".md";
			let file: any = this.settingsUi.plugin.app.vault.fileMap[filename];
			if (file)
			{
				await this.settingsUi.plugin.app.vault.modify(file, content);
			}
			else
			{
				await this.settingsUi.plugin.app.vault.create(filename, content);
			}
		}

		// Before adding the library shortcut-files to the plugin settings, we should
		// update the plugin settings with the latest changes made in the settings ui.
		this.settingsUi.plugin.settings.shortcutFiles = this.settingsUi.getShortcutFilesFromUi();

		// Add shortcut-file references, for new shortcut-files, to the settings
		for (const shortcutFile of shortcutFiles)
		{
			let filename: string = libraryDestination + "/" + shortcutFile + ".md";
			if (!this.settingsUi.plugin.settings.shortcutFiles.includes(filename))
			{
				this.settingsUi.plugin.settings.shortcutFiles.push(filename);
			}
		}

		// Refresh settings ui with the new shortcut-file references
		InputBlocker.setEnabled(false);
		this.settingsUi.display();
	}
}
