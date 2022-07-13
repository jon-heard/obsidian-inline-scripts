///////////////////////////////////////////////////////////////////////////////////////////////////
// Library Importer - Pulls the official TEJS library from github & adds it to the current vault //
///////////////////////////////////////////////////////////////////////////////////////////////////

"use strict";

const REGEX_LIBRARY_README_SHORTCUT_FILE: RegExp = /### tejs_[_a-zA-Z0-9]+\n/g;

namespace LibraryImporter
{
	export function initialize(settingsUi: TextExpanderJsPluginSettings)
	{
		_settingsUi = settingsUi;
	}

	// Pull the official TEJS library from github & add it to the current vault
	export function run(): void
	{
		run_internal();
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	let _settingsUi: TextExpanderJsPluginSettings;

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

		// Get list of shortcut-files from the project's github readme.  Sanitize the newlines.
		let readmeContent: string;
		try
		{
			readmeContent = await window.request({
				url: ADDRESS_REMOTE + "/" + FILE_README,
				method: "GET", cache: "no-cache"
			});
		}
		catch(e)
		{
			UserNotifier.run({
				popupMessage: "Library importing failed.\nUnable to connect.",
				consoleMessage: "Library importing failed.",
				messageType: e.message
			});
			InputBlocker.setEnabled(false);
			return;
		}
		readmeContent = readmeContent.replaceAll("\r", "");
		const libShortcutFiles: Array<string> =
			readmeContent.match(REGEX_LIBRARY_README_SHORTCUT_FILE).
			map((s: string) => s.substring(4, s.length-1));

		// Figure out library destination.  By default this is ADDRESSS_LOCAL.
		// However, if all shortcut-file references in the settings that match files in
		// the library are in a single folder, ask user if they want to use that folder
		// instead of the default library destination.
		let sfNoteAddresses: Array<string> =
			SettingUi_ShortcutFiles.getContents().shortcutFiles.map((f: any) => f.address);
		// The filenames of referenced shortcut-files
		let sfNoteNames: Array<string> =
			sfNoteAddresses.map(s => s.substring(s.lastIndexOf("/")+1, s.length-3));
		// The paths of referenced shortcut-files
		let sfNotePaths: Array<string> = sfNoteAddresses.map((s: any, i: number) =>
		{
			return s.substring(0, s.length-sfNoteNames[i].length-4)
		});
		// Find a common path, or lack thereof, to shortcut-files belonging to the library
		let commonPath: string = undefined;
		for (let i: number = 0; i < sfNoteAddresses.length; i++)
		{
			if(libShortcutFiles.includes(sfNoteNames[i]))
			{
				if (commonPath === undefined)
				{
					commonPath = sfNotePaths[i];
				}
				else
				{
					if (sfNotePaths[i] !== commonPath)
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
		for (const libShortcutFile of libShortcutFiles)
		{
			// Download the file
			let content: string = await window.request({
				url: ADDRESS_REMOTE + "/" + libShortcutFile + ".md",
				method: "GET", cache: "no-cache"
			});

			let filename: string = libraryDestination + "/" + libShortcutFile + ".md";
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
			const shortcutFileAddresses =
				_settingsUi.plugin.settings.shortcutFiles.map((f: any) => f.address);
			nothingToRemove = true;
			for (const libShortcutFile of libShortcutFiles)
			{
				let libAddress: string = libraryDestination + "/" + libShortcutFile + ".md";
				const index: number = shortcutFileAddresses.indexOf(libAddress);
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
		for (const libShortcutFile of libShortcutFiles)
		{
			let libAddress: string = libraryDestination + "/" + libShortcutFile + ".md";
			_settingsUi.plugin.settings.shortcutFiles.push({ enabled: true, address: libAddress });
		}

		// Refresh settings ui to display the updated list of shortcut-files
		InputBlocker.setEnabled(false);
		_settingsUi.display();
	}
}
