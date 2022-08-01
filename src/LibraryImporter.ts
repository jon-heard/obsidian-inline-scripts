//////////////////////////////////////////////////////////////////////////////////////////////
// Library Importer - Pulls the official library from github & adds it to the current vault //
//////////////////////////////////////////////////////////////////////////////////////////////

"use strict";

import { normalizePath } from "obsidian";
import InlineScriptsPlugin from "./_Plugin";
import { UserNotifier } from "./ui_userNotifier";
import { InputBlocker } from "./ui_InputBlocker";
import { Popups } from "./ui_Popups";
import { SettingUi_ShortcutFiles } from "./ui_setting_shortcutFiles";

const REGEX_LIBRARY_README_SHORTCUT_FILE: RegExp =
	/### ([_a-zA-Z0-9]+.sfile)\n(_\(disabled by default)?/g;
const ADDRESS_REMOTE: string =
	"https://raw.githubusercontent.com/jon-heard/" +
	"obsidian-inline-scripts-library/main";
const DEFAULT_LOCAL_ADDRESS: string = "support/inlineScripts";
const FILE_README: string = "README.md";

export namespace LibraryImporter
{
	// Pull the official library from github & add it to the current vault
	export function run(): void
	{
		run_internal();
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	async function run_internal(): Promise<void>
	{
		const plugin = InlineScriptsPlugin.getInstance();

		// Need to manually disable user-input until this process is finished
		// (due to asynchronous downloads not otherwise blocking user-input)
		InputBlocker.setEnabled(true);

		// Get list of shortcut-files from the project's github readme.  Sanitize the newlines.
		let readmeContent: string;
		try
		{
			readmeContent = await window.request({
				url: ADDRESS_REMOTE + "/" + FILE_README,
				method: "GET", headers: { "Cache-Control": "no-cache" }
			});
		}
		catch(e: any)
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
		let libShortcutFiles: Array<string> = [];
		let disabledShortcutFiles: Array<string> = [];
		for (const match of readmeContent.matchAll(REGEX_LIBRARY_README_SHORTCUT_FILE))
		{
			libShortcutFiles.push(match[1]);
			if (match[2])
			{
				disabledShortcutFiles.push(match[1]);
			}
		}

		// Pick default library path.  This is normally ADDRESSS_LOCAL.  But, if all shortcut-file
		// entries that match library files are in a single folder, use that instead.
		let sfNoteAddresses: Array<string> =
			SettingUi_ShortcutFiles.getContents().shortcutFiles.map((f: any) => f.address);
		// The filenames of referenced shortcut-files
		let sfNoteNames: Array<string> =
			sfNoteAddresses.map(s => s.slice(s.lastIndexOf("/")+1, -3));
		// The paths of referenced shortcut-files
		let sfNotePaths: Array<string> = sfNoteAddresses.map((s: any, i: number) =>
		{
			return s.slice(0, s.length-sfNoteNames[i].length-4)
		});
		// Find a common path, or lack thereof, to shortcut-files belonging to the library
		let commonPath: string = null;
		for (let i: number = 0; i < sfNoteAddresses.length; i++)
		{
			if(libShortcutFiles.includes(sfNoteNames[i]))
			{
				if (commonPath === null)
				{
					commonPath = sfNotePaths[i];
				}
				else
				{
					if (sfNotePaths[i] !== commonPath)
					{
						commonPath = null;
						break;
					}
				}
			}
		}

		// Have user pick the library path, using the default determined above.  Cancel ends import.
		let libraryDestinationPath: string = await Popups.getInstance().input(
			"What path should the library be placed in?", commonPath || DEFAULT_LOCAL_ADDRESS);
		if (libraryDestinationPath == null)
		{
			InputBlocker.setEnabled(false);
			return;
		}

		// Normalize the inputted library destination path
		libraryDestinationPath = normalizePath(libraryDestinationPath);

		// Adjust the disabledShortcutFiles to match the libraryDestinationPath
		disabledShortcutFiles =
			disabledShortcutFiles.map(v => libraryDestinationPath + "/" + v + ".md");

		// Create the choosen library destination folder, if necessary
		if (!(plugin.app.vault as any).fileMap.hasOwnProperty(libraryDestinationPath))
		{
			plugin.app.vault.createFolder(libraryDestinationPath);
		}

		// Download and create library files
		for (const libShortcutFile of libShortcutFiles)
		{
			// Download the file
			let content: string = await window.request({
				url: ADDRESS_REMOTE + "/" + libShortcutFile + ".md",
				method: "GET", headers: { "Cache-Control": "no-cache" }
			});

			let filename: string = libraryDestinationPath + "/" + libShortcutFile + ".md";
			let file: any = (plugin.app.vault as any).fileMap[filename];
			if (file)
			{
				await plugin.app.vault.modify(file, content);
			}
			else
			{
				await plugin.app.vault.create(filename, content);
			}
		}

		// Before adding the library shortcut-files to the plugin settings, we should
		// update the plugin settings with the latest changes made in the settings ui.
		plugin.settings.shortcutFiles = SettingUi_ShortcutFiles.getContents().shortcutFiles;

		// We don't want to duplicate shortcut-files, and it's important to keep the library
		// shortcut-files in-order.  Remove any shortcut-files from the list that are part of the
		// library before appending the shortcut-files from the library to the end of the list.
		// NOTE - we are replacing some shortcuts from the library, but we do want to keep their
		// enable state so the user doesn't have to re-disable unwanted shortcut-files.
		let nothingToRemove: boolean;
		do
		{
			const shortcutFileAddresses = plugin.settings.shortcutFiles.map((f: any) => f.address);
			nothingToRemove = true;
			for (const libShortcutFile of libShortcutFiles)
			{
				let libAddress: string = libraryDestinationPath + "/" + libShortcutFile + ".md";
				const index: number = shortcutFileAddresses.indexOf(libAddress);
				if (index >= 0)
				{
					if (!plugin.settings.shortcutFiles[index].enabled)
					{
						disabledShortcutFiles.push(libAddress);
					}
					plugin.settings.shortcutFiles.splice(index, 1);
					nothingToRemove = false;
					break;
				}
			}
		}
		while (!nothingToRemove);

		// Add all library shortcut-files to the settings
		for (const libShortcutFile of libShortcutFiles)
		{
			const address = libraryDestinationPath + "/" + libShortcutFile + ".md";
			plugin.settings.shortcutFiles.push(
			{
				enabled: (disabledShortcutFiles.indexOf(address) < 0),
				address: address
			});
		}
		// Refresh settings ui to display the updated list of shortcut-files
		InputBlocker.setEnabled(false);
		plugin.shortcutDfc.updateFileList(plugin.getActiveShortcutFileAddresses());
		InlineScriptsPlugin.getInstance().settingsUi.display();
	}
}
