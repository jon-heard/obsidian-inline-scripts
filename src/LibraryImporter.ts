//////////////////////////////////////////////////////////////////////////////////////////////
// Library Importer - Pulls the official library from github & adds it to the current vault //
//////////////////////////////////////////////////////////////////////////////////////////////

"use strict";

import { normalizePath } from "obsidian";
import InlineScriptsPlugin from "./_Plugin";
import { UserNotifier } from "./ui_userNotifier";
import { InputBlocker } from "./ui_InputBlocker";
import { Popups } from "./ui_Popups";
import { HelperFncs } from "./HelperFncs";
import { SettingUi_ShortcutFiles } from "./ui_setting_shortcutFiles";

const REGEX_LIBRARY_README_SHORTCUT_FILE: RegExp =
	/### ([_a-zA-Z0-9]+.sfile)\n(_\(disabled by default)?/g;
const DEFAULT_REMOTE_ADDRESS: string =
	"https://raw.githubusercontent.com/jon-heard/" +
	"obsidian-inline-scripts-library/main";
const DEFAULT_LOCAL_ADDRESS: string = "support/inlineScripts";
const FILE_README: string = "README.md";
const PRE_REFACTOR_SFILES = ["tejs_state","tejs_lists","tejs_mythicv2","tejs_mythicgme","tejs_une","tejs_adventurecrafter","tejs_rpgtools","tejs_clips","tejs_arrows","tejs_lipsum","tejs_support"];

export namespace LibraryImporter
{
	// Pull the official library from github & add it to the current vault
	export async function run(): Promise<boolean>
	{
		return await run_internal();
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	async function run_internal(useCustomSource?: boolean): Promise<boolean>
	{
		const plugin = InlineScriptsPlugin.getInstance();

		// Need to manually disable user-input until this process is finished
		// (due to asynchronous downloads not otherwise blocking user-input)
		InputBlocker.setEnabled(true);

		let addressRemote: string = DEFAULT_REMOTE_ADDRESS;

		// Give the option to change the library source
		if (useCustomSource)
		{
			addressRemote = await Popups.getInstance().input(
				"What is the library source?", DEFAULT_REMOTE_ADDRESS);
			if (addressRemote === null)
			{
				InputBlocker.setEnabled(false);
				return false;
			}
		}

		// Get list of shortcut-files from the project's github readme.  Sanitize the newlines.
		let readmeContent: string;
		try
		{
			readmeContent = await window.request({
				url: addressRemote + "/" + FILE_README,
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
			return false;
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

		// Sometimes we should check both library files AND pre-refactor library files
		const libSFiles_currentAndPrerefactor = libShortcutFiles.concat(PRE_REFACTOR_SFILES);

		// Pick default library path.  This is normally ADDRESSS_LOCAL.  But, if all shortcut-file
		// entries that match library files are in a single folder, use that instead.
		const sfNoteAddresses: Array<string> =
			SettingUi_ShortcutFiles.getContents().shortcutFiles.map((f: any) => f.address);
		// The filenames of referenced shortcut-files
		const sfNoteNames: Array<string> =
			sfNoteAddresses.map(s => s.slice(s.lastIndexOf("/")+1, -3));
		// The paths of referenced shortcut-files
		const sfNotePaths: Array<string> = sfNoteAddresses.map((s: any, i: number) =>
		{
			return s.slice(0, s.length-sfNoteNames[i].length-4)
		});
		// Find a common path, or lack thereof, to shortcut-files belonging to the library
		let commonPath: string = null;
		for (let i: number = 0; i < sfNoteAddresses.length; i++)
		{
			if(libSFiles_currentAndPrerefactor.includes(sfNoteNames[i]))
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
		const libDstSuggestions =
			Object.keys((plugin.app.vault as any).fileMap)
			.filter(v => (plugin.app.vault as any).fileMap[v].children)
			.filter(v => (v !== "/"));
		let libraryDestinationPath: string = await Popups.getInstance().input(
			"What path should the library be placed in?", commonPath || DEFAULT_LOCAL_ADDRESS,
			libDstSuggestions);
		if (libraryDestinationPath === null)
		{
			InputBlocker.setEnabled(false);
			return false;
		}

		if (libraryDestinationPath.trim().toLowerCase() === "customlibsrc")
		{
			return run_internal(true);
		}

		// Normalize the inputted library destination path
		libraryDestinationPath = normalizePath(libraryDestinationPath);

		// Adjust the disabledShortcutFiles to match the libraryDestinationPath
		disabledShortcutFiles =
			disabledShortcutFiles.map(v => libraryDestinationPath + "/" + v + ".md");

		// Create the choosen library destination folder, if necessary
		if (!(plugin.app.vault as any).fileMap.hasOwnProperty(libraryDestinationPath))
		{
			await plugin.app.vault.createFolder(libraryDestinationPath);
		}

		// Download and create library files
		for (const libShortcutFile of libShortcutFiles)
		{
			// Download the file
			const content: string = await window.request({
				url: addressRemote + "/" + libShortcutFile + ".md",
				method: "GET", headers: { "Cache-Control": "no-cache" }
			});

			const filename: string = libraryDestinationPath + "/" + libShortcutFile + ".md";
			await HelperFncs.fileWrite(filename, content);
		}

		// Delete any pre-refactor library files in the shortcut-files list
		for (let i = 0; i < sfNoteAddresses.length; i++)
		{
			if (PRE_REFACTOR_SFILES.includes(sfNoteNames[i]))
			{
				await plugin.app.vault.delete((plugin.app.vault as any).fileMap[sfNoteAddresses[i]]);
			}
		}

		// Add version file
		{
			const libVersion = readmeContent.match(/# Version (.*)/)[1] || "";
			const filename: string = libraryDestinationPath + "/" + "Ξ_libraryVersion.md";
			await HelperFncs.fileWrite(filename, libVersion);
		}

		// Before adding the library shortcut-files to the plugin settings, we should
		// update the plugin settings with the latest changes made in the settings ui.
		plugin.settings.shortcutFiles = SettingUi_ShortcutFiles.getContents().shortcutFiles;

		// We don't want to duplicate shortcut-files, and it's important to keep the library
		// shortcut-files in-order.  Remove any shortcut-files from the list that are part of the
		// library before appending the shortcut-files from the library to the end of the list.
		// NOTE - we are replacing some shortcuts from the library, but we do want to keep their
		// enable state so the user doesn't have to re-disable unwanted shortcut-files.
		for (const libShortcutFile of libSFiles_currentAndPrerefactor)
		{
			const shortcutFileAddresses = plugin.settings.shortcutFiles.map((f: any) => f.address);
			const libAddress: string = libraryDestinationPath + "/" + libShortcutFile + ".md";
			const index: number = shortcutFileAddresses.indexOf(libAddress);
			if (index >= 0)
			{
				if (!plugin.settings.shortcutFiles[index].enabled)
				{
					disabledShortcutFiles.push(libAddress);
				}
				plugin.settings.shortcutFiles.splice(index, 1);
			}
		}

		// Add all library shortcut-files to the settings
		for (const libShortcutFile of libShortcutFiles)
		{
			const address = libraryDestinationPath + "/" + libShortcutFile + ".md";
			plugin.settings.shortcutFiles.push(
			{
				enabled: !disabledShortcutFiles.includes(address),
				address: address
			});
		}

		// Refresh settings ui to display the updated list of shortcut-files
		InlineScriptsPlugin.getInstance().settingsUi.display();
		InputBlocker.setEnabled(false);

		return true;
	}
}
