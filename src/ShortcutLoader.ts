///////////////////////////////////////////////////////////////////////////////////////////////////
// Shortcut loader - Load shortcuts from a shortcut-file, or from all shortcut-files & settings. //
///////////////////////////////////////////////////////////////////////////////////////////////////

"use strict";

const REGEX_NOTE_METADATA: RegExp = /^\n*---\n(?:[^-]+\n)?---\n/;
const REGEX_SPLIT_FIRST_DASH: RegExp = / - (.*)/s;

abstract class ShortcutLoader
{
	public static initialize(plugin: any)
	{
		this._plugin = plugin;
	}

	// Parses a shortcut-file's contents into a useful data format and returns it
	public static parseShortcutFile(
		filename: string, content: string, maintainCodeFence?: boolean,
		maintainAboutString?: boolean) : any
	{
		return this.parseShortcutFile_internal(
			filename, content, maintainCodeFence, maintainAboutString);
	}

	// Offer "setupShortcuts" function for use as a callback.
	// Function loads all shortcuts from the settings and shortcut-file list into the plugin.
	public static getFunction_setupShortcuts(): Function
	{
		return this.setupShortcuts_internal.bind(this);
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	private static _plugin: any;

	private static parseShortcutFile_internal(
		filename: string, content: string, maintainCodeFence?: boolean,
		maintainAboutString?: boolean) : any
	{
		// Sanitize newlines.  "\r" disrupts calculations, including the regex replace.
		content = content.replaceAll("\r", "");

		// Remove any note metadata
		content = content.replace(REGEX_NOTE_METADATA, "");

		// Result vars
		let fileAbout: string = "";
		let shortcuts: Array<any> = [];
		let shortcutAbouts: Array<any> = [];

		// Flag set when an error occurs.  Used for single popup for ALL file errors.
		let fileHasErrors: boolean = false;

		const sections: Array<string> = content.split("~~").map((v: string) => v.trim());
		fileAbout = sections[0];

		// Check for the obvious error of misnumbered sections (bounded by "~~")
		if (!!((sections.length-1) % 3))
		{
			UserNotifier.run(
			{
				consoleMessage: "In shortcut-file \"" + filename + "\"",
				messageType: "MISNUMBERED-SECTION-COUNT-ERROR"
			});
			fileHasErrors = true;
		}

		// Parse each shortcut in the file
		// NOTE: this loop checks i+2 and increments by 3 as it uses i, i+1 and i+2.
		for (let i: number = 1; i+2 < sections.length; i += 3)
		{
			// Test string handling
			let testRegex: any = undefined;
			if (maintainCodeFence)
			{
				// "maintainCodeFence" is not possible with a real RegExp object.
				// Instead, create RegExp-style-dummy to retain fence within API.
				testRegex = { source: sections[i] };
			}
			else
			{
				let c = sections[i];

				// Handle the Test being in a basic fenced code-block
				if (c.startsWith("```") && c.endsWith("```"))
				{
					c = c.substring(3, c.length-3).trim();
				}

				try
				{
					testRegex = new RegExp(c);
				}
				catch (e: any)
				{
					UserNotifier.run(
					{
						consoleMessage: "In shortcut-file \"" + filename + "\":\n" + INDENT + c,
						messageType: "BAD-TEST-STRING-ERROR"
					});
					fileHasErrors = true;
					continue;
				}
			}

			// Expansion string handling
			let exp: string = sections[i+1];
			// Handle the Expansion being in a javascript fenced code-block
			if (!maintainCodeFence)
			{
				if (exp.startsWith("```js") && exp.endsWith("```"))
				{
					exp = exp.substring(5, exp.length-3).trim();
				}
			}

			// Add shortcut to result
			if (maintainAboutString)
			{
				shortcuts.push({
					test: testRegex, expansion: exp, about: sections[i+2] });
			}
			else
			{
				shortcuts.push({ test: testRegex, expansion: exp });
			}

			// About string handling
			// Skip if it's a helper script, helper blocker or setup script, or if the About
			// string's syntax string is the string "hidden"
			if (testRegex.source !== "(?:)" && testRegex.source !== "^tejs setup$" &&
			    testRegex.source !== "^tejs shutdown$" && !sections[i+2].startsWith("hidden - "))
			{
				let aboutParts: Array<string> =
					sections[i+2].split(REGEX_SPLIT_FIRST_DASH).map((v: string) => v.trim());
				// If no syntax string is included, use the Regex string instead
				if (aboutParts.length === 1)
				{
					aboutParts = [testRegex.source, aboutParts[0]];
				}
				shortcutAbouts.push({ syntax: aboutParts[0], description: aboutParts[1] });
			}
		}

		// If errors during parsing, notify user in a general popup notification.
		// Any errors were added to console at the moment they were found.
		if (fileHasErrors)
		{
			UserNotifier.run(
			{
				popupMessage: "Shortcut-file issues\n" + filename,
				consoleHasDetails: true
			});
		}

		// Return result of parsing the shortcut file
		return { shortcuts: shortcuts, fileAbout: fileAbout, shortcutAbouts: shortcutAbouts };
	}

	private static async setupShortcuts_internal(): Promise<void>
	{
		let result: any = { shortcuts: [], shutdownScripts: {} };

		// To fill with data for the generation of help shortcuts
		let abouts: Array<any> = [];

		// Add shortcuts defined directly in the settings
		let parseResult: any =
			this.parseShortcutFile_internal("settings", this._plugin.settings.shortcuts);
		result.shortcuts = parseResult.shortcuts;
		abouts.push({ filename: "", shortcutAbouts: parseResult.shortcutAbouts });

		// Add a helper-blocker to segment helper scripts within their shortcut-files
		result.shortcuts.push({});

		// Go over all shortcut-files
		for (const filename of this._plugin.settings.shortcutFiles)
		{
			const file: any = this._plugin.app.vault.fileMap[filename];
			if (!file)
			{
				UserNotifier.run(
				{
					popupMessage: "Missing shortcut-file\n" + filename,
					consoleMessage: filename,
					messageType: "MISSING-SHORTCUT-FILE-ERROR"
				});
				continue;
			}

			const content: string = await this._plugin.app.vault.cachedRead(file);

			// Parse shortcut-file contents
			parseResult = this.parseShortcutFile(filename, content)

			// Look for a "setup" script in this shortcut-file.  Run if found.
			for (const newShortcut of parseResult.shortcuts)
			{
				if (newShortcut.test.source === "^tejs setup$")
				{
					// If setup script returns TRUE, don't use shortcuts
					if (ShortcutExpander.runExpansionScript(newShortcut.expansion))
					{
						parseResult.shortcuts = undefined;
					}
					break;
				}
			}

			// If setup script returned true, abort adding the new shortcuts
			if (!parseResult.shortcuts) { continue; }

			// Look for "shutdown" script in this shortcut-file.  Store if found.
			for (const newShortcut of parseResult.shortcuts)
			{
				if (newShortcut.test.source === "^tejs shutdown$")
				{
					result.shutdownScripts[filename] = newShortcut.expansion;
					break;
				}
			}

			// Add new shortcuts to master list, followed by helper-blocker
			result.shortcuts = result.shortcuts.concat(parseResult.shortcuts);
			result.shortcuts.push({});

			// Get the file About string and shortcut About strings
			let baseName: string =
				filename.substring(filename.lastIndexOf("/")+1, filename.length-3);
			baseName = baseName.startsWith("tejs_") ? baseName.substr(5) : baseName;
			abouts.push(
			{
				filename: baseName,
				fileAbout: parseResult.fileAbout,
				shortcutAbouts: parseResult.shortcutAbouts
			});
		}

		// Generate and add help shortcuts
		result.shortcuts = this.generateHelpShortcuts(abouts).concat(result.shortcuts);

		// Assign new shortcuts to the plugin.  Also, add any shutdown scripts that were found.
		this._plugin.shortcuts = result.shortcuts;
		this._plugin.shutdownScripts =
			Object.assign(this._plugin.shutdownScripts, result.shutdownScripts);
	}

	// Creates help shortcuts based on "about" info from shortcuts and shortcut-files
	private static generateHelpShortcuts(abouts: any): Array<any>
	{
		// The final list of help shortcuts
		let result: Array<any> = [];

		// Support functions
		function capitalize(s: string)
		{
			return s.charAt(0).toUpperCase() + s.slice(1);
		}
		function stringifyString(s: string)
		{
			return s.replaceAll("\"", "\\\"").replaceAll("\n", "\\n");
		}
		function makeAboutShortcut(name: string, about: string)
		{
			about ||= "No information available.";
			const expansion: string =
				"return \"### About - " + capitalize(name) + "\\n" + stringifyString(about) +
				"\\n\\n\";";
			const test: RegExp = new RegExp("^about " + name + "$");
			result.push({ test: test, expansion: expansion });
		}
		function makeRefShortcut(groupName: string, abouts: any, displayName?: string)
		{
			displayName = displayName || capitalize(groupName);
			let expansion: string = "let result = \"### Reference - " + displayName + "\\n\";\n";
			for (const about of abouts)
			{
				let description: string = "";
				if (about.description)
				{
					description = " - " + stringifyString(about.description);
				}
				expansion +=
					"result += \"- __" + about.syntax + "__" + description + "\\n\";\n";
			}
			if (!abouts.length)
			{
				expansion += "result += \"No shortcuts\\n\";\n";
			}
			expansion += "return result + \"\\n\";";
			const test: RegExp = new RegExp("^ref(?:erence)? " + groupName + "$");
			result.push({ test: test, expansion: expansion });
		}

		// Gather info
		let settingsAbouts: Array<any> = [];
		let shortcutFileAbouts: Array<any> = [];
		let shortcutFileList: string = "";
		for (const about of abouts)
		{
			// If not the "settings" shortcut-file (the only about with a blank filename)
			if (about.filename)
			{
				// Add help only for shortcut-files that contain non-hidden shortcuts
				if (about.shortcutAbouts.length === 0) { continue; }
				// Make "about" shortcut for this shortcut-file
				makeAboutShortcut(about.filename, about.fileAbout);
				// Make "ref" shortcut for this shortcut-file
				makeRefShortcut(about.filename, about.shortcutAbouts);
				// Add to the general "help" shortcut's expansion
				shortcutFileList +=
					"- __about " + about.filename + "__, __ref " + about.filename + "__\\n";
				// Add to "ref all" list: reference of ALL shortcuts
				shortcutFileAbouts = shortcutFileAbouts.concat(about.shortcutAbouts);
			}
			else if (about.shortcutAbouts.length > 0)
			{
				// Add to "ref all" list: reference of ALL shortcuts
				settingsAbouts = about.shortcutAbouts;
			}
		}

		// Create "ref all" shortcut: expands to a reference for ALL shortcuts
		makeRefShortcut("all", settingsAbouts.concat(shortcutFileAbouts), "All shortcuts");

		// Create "ref settings" shortcut: expands to a reference for shortcuts defined in settings
		makeRefShortcut("settings", settingsAbouts);

		// Create "help" shortcut: expands to a general help text which lists all help shortcuts
		const expansion: string =
			"return \"The following shortcuts provide help for all shortcuts and " +
			"shortcut-files currently setup with __Text Expander JS__:\\n" +
			"- __help__ - Shows this text.\\n" +
			"- __ref settings__ - Summarizes shortcuts defined in the Settings.\\n" +
			"- __ref all__ - Summarizes all shortcuts (except the ones in " +
			"this list).\\n" +
			shortcutFileList + "\\n\";";
		const test: RegExp = /^help$/;
		result.push({ test: test, expansion: expansion });

		// Reversing ensures that "ref all" and "ref settings" aren't superseded by a poorly named
		// shortcut-file
		result.reverse();

		// Return list of help shortcuts we just generated
		return result;
	}
}
