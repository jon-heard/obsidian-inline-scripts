
class ShortcutLoader
{
	public constructor(plugin: any)
	{
		this.plugin = plugin;

		//Setup bound versons of these function for persistant use
		this._setupShortcuts_internal = this.setupShortcuts_internal.bind(this);
	}

	public setupShortcuts()
	{
		this.setupShortcuts_internal();
	}
	
	public parseShortcutFile(
		filename: string, content: string, maintainCodeFence?: boolean,
		maintainAboutString?: boolean) : any
	{
		return this.parseShortcutFile_internal(
			filename, content, maintainCodeFence, maintainAboutString);
	}
	
	public getBoundSetupShortcuts()
	{
		return this._setupShortcuts_internal;
	}

////////////////////////////////////////////////////////////////////////////////////////////////////

	private plugin: any;
	private _setupShortcuts_internal: Function;

	// Parses a shortcut-file's contents into a useful data format and returns it
	private parseShortcutFile_internal(
		filename: string, content: string, maintainCodeFence?: boolean,
		maintainAboutString?: boolean) : any
	{
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
			this.plugin.notifyUser(
				"In Shortcut-file \"" + filename + "\"",
				"MISNUMBERED-SECTION-COUNT-ERROR");
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
					this.plugin.notifyUser(
						"In shortcut-file \"" + filename + "\":\n" +
						INDENT + c, "BAD-TEST-STRING-ERROR");
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
			// Skip if a helper script, helper block or setup script, or if About
			// string is "hidden"
			if (testRegex.source != "(?:)" && testRegex.source != "^tejs setup$" &&
			    testRegex.source != "^tejs shutdown$" &&
			    !sections[i+2].startsWith("hidden - "))
			{
				let aboutParts: Array<string> =
					sections[i+2].split(REGEX_SPLIT_FIRST_DASH).
					map((v: string) => v.trim());
				// If no syntax string is included, use the Regex string instead
				if (aboutParts.length == 1)
				{
					aboutParts = [testRegex.source, aboutParts[0]];
				}
				shortcutAbouts.push(
					{ syntax: aboutParts[0], description: aboutParts[1] });
			}
		}

		if (fileHasErrors)
		{
			this.plugin.notifyUser("", "ERR", "Shortcut-file issues\n" + filename, true);
		}

		return {
			shortcuts: shortcuts,
			fileAbout: fileAbout,
			shortcutAbouts: shortcutAbouts
		};
	}

	// Creates entire shortcut list based on shortcuts from settings and shortcut-files
	private async setupShortcuts_internal()
	{
		// To fill with data for the help-shortcut creation
		let abouts: Array<any> = [];

		// Add shortcuts defined directly in the settings
		let parseResult: any =
			this.parseShortcutFile("settings", this.plugin.settings.shortcuts);
		this.plugin.shortcuts = parseResult.shortcuts;
		abouts.push({ filename: "", shortcutAbouts: parseResult.shortcutAbouts });

		// Add a helper-block to segment helper scripts within their shortcut-files
		this.plugin.shortcuts.push({});

		// Go over all shortcut-files
		for (const filename of this.plugin.settings.shortcutFiles)
		{
			const file: any = this.plugin.app.vault.fileMap[filename];
			if (!file)
			{
				this.plugin.notifyUser(
					filename, "MISSING-SHORTCUT-FILE-ERROR",
					"Missing shortcut-file\n" + filename, false);
				continue;
			}

			const content: string = await this.plugin.app.vault.cachedRead(file);

			// Parse shortcut-file contents
			parseResult = this.parseShortcutFile(filename, content)

			// Look for a "setup" script in this shortcut-file.  Run if found.
			for (const newShortcut of parseResult.shortcuts)
			{
				if (newShortcut.test.source == "^tejs setup$")
				{
					// If setup script returns TRUE, don't use shortcuts
					if (this.plugin.shortcutExpander.expand(newShortcut.expansion))
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
				if (newShortcut.test.source == "^tejs shutdown$")
				{
					this.plugin.shortcutFileShutdownScripts[filename] =
						newShortcut.expansion;
					break;
				}
			}

			// Add new shortcuts to master list, followed by helper-block
			this.plugin.shortcuts = this.plugin.shortcuts.concat(parseResult.shortcuts);
			this.plugin.shortcuts.push({});

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

		this.generateHelpShortcuts(abouts);
	}

	// Creates systems help shortcuts and adds them to the shortcuts list
	private generateHelpShortcuts(abouts: any)
	{
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
		function makeRefShortcut(groupName: string, abouts: any, displayName?: string)
		{
			displayName = displayName || capitalize(groupName);
			let expansion: string =
				"let result = \"### Reference - " + displayName + "\\n\";\n";
			for (const about of abouts)
			{
				let description: string = "";
				if (about.description)
				{
					description = " - " + stringifyString(about.description);
				}
				expansion +=
					"result += \"- __" + about.syntax + "__" + description +
					"\\n\";\n";
			}
			if (!abouts.length)
			{
				expansion += "result += \"No shortcuts\\n\";\n";
			}
			expansion += "return result + \"\\n\";";
			const test: RegExp = new RegExp("^ref(?:erence)? " + groupName + "$");
			result.push({ test: test, expansion: expansion });
		}
		function makeAboutShortcut(name: string, about: string)
		{
			about ||= "No information available.";
			const expansion: string =
				"return \"### About - " + capitalize(name) + "\\n" +
				stringifyString(about) + "\\n\\n\";";
			const test: RegExp = new RegExp("^about " + name + "$");
			result.push({ test: test, expansion: expansion });
		}

		// Gather info
		let settingsAbouts: Array<any> = [];
		let shortcutFileAbouts: Array<any> = [];
		let shortcutFileList: string = "";
		for (const about of abouts)
		{
			if (about.filename)
			{
				if (about.shortcutAbouts.length == 0) { continue; }
				// Make "ref" shortcut
				makeRefShortcut(about.filename, about.shortcutAbouts);
				// Make "about" shortcut
				makeAboutShortcut(about.filename, about.fileAbout);

				shortcutFileList +=
					"- __about " + about.filename + "__, __ref " +
					about.filename + "__\\n";
				shortcutFileAbouts =
					shortcutFileAbouts.concat(about.shortcutAbouts);
			}
			else if (about.shortcutAbouts.length > 0)
			{
				settingsAbouts = about.shortcutAbouts;
			}
		}

		// Create "ref all" shortcut
		makeRefShortcut("all", settingsAbouts.concat(shortcutFileAbouts), "All shortcuts");

		// Create "ref settings" shortcut
		makeRefShortcut("settings", settingsAbouts);

		// Create "help" shortcut
		const expansion: string =
			"return \"The following shortcuts provide help for all shortcuts and " +
			"shortcut-files currently setup with __Text Expander JS__:\\n" +
			"- __help__ - Shows this text.\\n" +
			"- __ref settings__ - Summarizes shortcuts defined in the Settings.\\n" +
			"- __ref all__ - Summarizes all shortcuts (except the ones in " +
			"this list).\\n" +
			shortcutFileList + "\\n\";";
		const test: RegExp = /^help$"/;
		result.push({ test: test, expansion: expansion });

		// Reversing ensures that "ref all" and "ref settings" aren't superseded
		// by a poorly named shortcut-file
		result.reverse();

		// Prepend help shortcuts to start of main shortcuts list
		this.plugin.shortcuts = result.concat(this.plugin.shortcuts);
	}
}
