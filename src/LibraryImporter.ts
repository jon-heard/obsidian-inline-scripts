///////////////////////////////////////////////////////////////////////////////////////////////////
// Library Importer - Pulls the official TEJS library from github & adds it to the current vault //
///////////////////////////////////////////////////////////////////////////////////////////////////

"use strict";

const REGEX_LIBRARY_README_SHORTCUT_FILE: RegExp = /### tejs_[_a-zA-Z0-9]+\n/g;

namespace LibraryImporter
{
	export function initialize(settingsUi: any)
	{
		_settingsUi = settingsUi;
	}

	// Pull the official TEJS library from github & add it to the current vault
	export function run(): void
	{
		run_internal();
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	let _settingsUi: any;

	async function run_internal(): Promise<void>
	{
		const ADDRESS_REMOTE: string =
			"https://raw.githubusercontent.com/jon-heard/" +
			"obsidian-text-expander-js_shortcutFileLibrary/main";
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
		let shortcutReferences: Array<string> = SettingUi_ShortcutFiles.getContents().shortcutFiles;
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
					if (shortcutReferencePaths[i] !== commonPath)
					{
						commonPath = undefined;
						break;
					}
				}
			}
		}
		if (commonPath === ADDRESS_LOCAL) { commonPath = undefined; }
		let libraryDestination: string = await new Promise((resolve, reject) =>
		{
			if (commonPath === undefined)
			{
				resolve(ADDRESS_LOCAL);
				return;
			}

			// We need to remove the input blocker to let the user choose
			InputBlocker.setEnabled(false);

			new ConfirmDialogBox(
				_settingsUi.plugin.app,
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

		// Put the input blocker back (if it was disabled for the confirm dialog)
		InputBlocker.setEnabled(true);

		// Create the choosen library destination folder, if necessary
		if (!_settingsUi.plugin.app.vault.fileMap.hasOwnProperty(libraryDestination))
		{
			_settingsUi.plugin.app.vault.createFolder(libraryDestination);
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
			let file: any = _settingsUi.plugin.app.vault.fileMap[filename];
			if (file)
			{
				await _settingsUi.plugin.app.vault.modify(file, content);
			}
			else
			{
				await _settingsUi.plugin.app.vault.create(filename, content);
			}
		}

		// Before adding the library shortcut-files to the plugin settings, we should
		// update the plugin settings with the latest changes made in the settings ui.
		_settingsUi.plugin.settings.shortcutFiles =
			SettingUi_ShortcutFiles.getContents().shortcutFiles;

		// We don't want to duplicate shortcut-files, and it's important to keep the library
		// shortcut-files in-order.  Remove any shortcut-files from the list that are part of the
		// library before appending the shortcut-files from the library to the end of the list.
		let nothingToRemove: boolean;
		do
		{
			nothingToRemove = true;
			for (const shortcutFile of shortcutFiles)
			{
				let filename: string = libraryDestination + "/" + shortcutFile + ".md";
				const index: number = _settingsUi.plugin.settings.shortcutFiles.indexOf(filename);
				if (index >= 0)
				{
					_settingsUi.plugin.settings.shortcutFiles.splice(index, 1);
					nothingToRemove = false;
					break;
				}
			}
		}
		while (!nothingToRemove);

		// Add all library shortcut-files to the settings
		for (const shortcutFile of shortcutFiles)
		{
			let filename: string = libraryDestination + "/" + shortcutFile + ".md";
			_settingsUi.plugin.settings.shortcutFiles.push(filename);
		}

		// Refresh settings ui to display the updated list of shortcut-files
		InputBlocker.setEnabled(false);
		_settingsUi.display();
	}
}
