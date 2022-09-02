///////////////////////////////////////////////////////////////////////////////////////////////////
// Shortcut loader - Load shortcuts from a shortcut-file, or from all shortcut-files & settings. //
///////////////////////////////////////////////////////////////////////////////////////////////////

"use strict";

import InlineScriptsPlugin from "./_Plugin";
import { UserNotifier } from "./ui_userNotifier";
import { ShortcutExpander } from "./ShortcutExpander";
import { InputBlocker } from "./ui_InputBlocker";
import { ButtonView } from "./ui_ButtonView";
import { HelperFncs } from "./HelperFncs";

const REGEX_NOTE_METADATA: RegExp = /^\n*---\n(?:[^-]+\n)?---\n/;
const REGEX_SPLIT_FIRST_DASH: RegExp = / - (.*)/s;
const REGEX_SFILE_SECTION_SPLIT: RegExp = /^__$/gm;
const REGEX_ALTERNATIVE_SYNTAX: RegExp = /\n\t- Alternative: __([^_]+)__/;
const ESCAPED_CHARACTERS: Set<string> = new Set(
[
	".", "+", "*", "?", "[", "^", "]", "$", "(", ")", "{", "}", "=", "!", "<", ">", "|", ":", "-",
	"\\", "\"", "'", "`"
]);
const GENERAL_HELP_PREAMBLE = `return [ "#### Help - General
Here are shortcuts for help with __Inline Scripts__.
- __help__ - Shows this text.
- __ref settings__ - Describes shortcuts defined in the Settings.
- __ref all__ - Describes _all_ shortcuts (except for the ones in this list).`;
const GENERAL_HELP_PREAMBLE_SHORTCUT_FILES = `
- For help on specific shortcut-files, __help__ and __ref__ can be followed by:`;
const SFILE_HELP_PREAMBLE = `return "#### Help - $1
_Use shortcut __ref $2__ for a list of shortcuts._

`;
const SFILE_REF_PREAMBLE = `let result = "#### Reference - $1
_Use shortcut __help $2__ for general help._
";`;
const SORT_SYNTAXES = (a: any, b: any): number =>
{
	if (a.text === "help") { return -1; }
	else if (b.text === "help") { return 1; }
	else
	{
		const lhs = a.text
			.replaceAll("{", "0")
			.replaceAll(/(^|[^\\])~/g, "$1" + String.fromCharCode(9));
		const rhs = b.text
			.replaceAll("{", "0")
			.replaceAll(/(^|[^\\])~/g, "$1" + String.fromCharCode(9));
		return lhs.localeCompare(rhs);
	}
}

export abstract class ShortcutLoader
{
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

		// Get sections from file contents
		const sections: Array<string> =
			content.split(REGEX_SFILE_SECTION_SPLIT).map((v: string) => v.trim());
		fileAbout = sections[0];

		// Check for the obvious error of misnumbered sections (bounded by "__")
		if (sections.length === 1)
		{
			UserNotifier.run(
			{
				message:
					"Shortcut-file \"" + filename + "\"\nhas no shortcuts." +
					"\n\n(Shortcut-files are sectioned with \"__\")",
				messageLevel: "warn",
			});
		}
		else if ((sections.length-1) % 3)
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
			let testRegex: any = null;
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
					c = c.slice(3, -3).trim();
				}

				try
				{
					testRegex = new RegExp(c);
				}
				catch (e: any)
				{
					UserNotifier.run(
					{
						consoleMessage: "In shortcut-file \"" + filename + "\":\n" + c,
						messageType: "BAD-TEST-STRING-ERROR"
					});
					fileHasErrors = true;
					continue;
				}
			}

			// Expansion string handling
			let exp: string = sections[i+1];
			// Handle the Expansion being in a JavaScript fenced code-block
			if (!maintainCodeFence)
			{
				if (exp.startsWith("```js") && exp.endsWith("```"))
				{
					exp = exp.slice(5, -3).trim();
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
			if (testRegex.source !== "(?:)" && testRegex.source !== "^sfile setup$" &&
			    testRegex.source !== "^sfile shutdown$" && !sections[i+2].startsWith("hidden - "))
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
		const plugin = InlineScriptsPlugin.getInstance();

		// To fill with data for the generation of help shortcuts
		let abouts: Array<any> = [];

		// Restart the master list of shortcuts
		plugin.shortcuts = [ { test: /^help ?$/, expansion: "" } ];
		let shortcutFiles: Array<string> = [];
		this.updateGeneralHelpShortcut(shortcutFiles);

		// Restart the master list of shortcut syntaxes
		plugin.syntaxes = [];

		// Add shortcuts defined directly in the settings
		let parseResult: any =
			this.parseShortcutFile("settings", plugin.settings.shortcuts);
		plugin.shortcuts = plugin.shortcuts.concat(parseResult.shortcuts);
		abouts.push({ filename: "", shortcutAbouts: parseResult.shortcutAbouts });

		// Add shortcut syntaxes to the master list
		this.addShortcutFileSyntaxes(
			"settings",
			parseResult.shortcutAbouts,
			[ [ "help", "A list of helpful shortcuts" ],
			  [ "ref settings", "A list of shortcuts defined in settings" ],
			  [ "ref all", "A list of ALL shortcuts" ] ]);

		// Add a helper-blocker to segment helper scripts within their shortcut-files
		plugin.shortcuts.push({});

		// Setup a list of indices for shortcut-files, available to shortcuts
		HelperFncs.confirmObjectPath("_inlineScripts.inlineScripts");
		window._inlineScripts.inlineScripts.sfileIndices = {};
		let sfileIndicesIndex = 0;

		// Go over all shortcut-files
		for (const shortcutFile of plugin.settings.shortcutFiles)
		{
			if (!shortcutFile.enabled) { continue; }
			const file: any = (plugin.app.vault as any).fileMap[shortcutFile.address];
			if (!file)
			{
				UserNotifier.run(
				{
					popupMessage: "Missing shortcut-file\n" + shortcutFile.address,
					consoleMessage: shortcutFile.address,
					messageType: "MISSING-SHORTCUT-FILE-ERROR"
				});
				continue;
			}

			const content: string = await plugin.app.vault.cachedRead(file);

			// Parse shortcut-file contents
			parseResult = this.parseShortcutFile(shortcutFile.address, content)

			// Look for a "setup" script in this shortcut-file.  Run if found.
			const setupScript = this.getExpansionScript("^sfile setup$", parseResult.shortcuts);
			if (setupScript)
			{
				// Disable input while running the setup script (in case it takes a while)
				InputBlocker.setEnabled(true);

				// Run the setup script
				try
				{
					// If setup script returns TRUE, don't use shortcuts in this shortcut-file
					if (await ShortcutExpander.runExpansionScript(
						setupScript, false, { shortcutText: "sfile setup" }))
					{
						parseResult.shortcuts = null;
					}
				}
				catch (e: any)
				{
					// If setup script failed, don't use the shortcuts in this shortcut-file
					parseResult.shortcuts = null;
				}

				// Enable input, now that the expansion is over
				InputBlocker.setEnabled(false);
			}

			// If setup script returned true, abort adding the new shortcuts
			if (!parseResult.shortcuts) { continue; }

			// Look for "shutdown" script in this shortcut-file.  Store if found.
			const shutdownScript =
				this.getExpansionScript("^sfile shutdown$", parseResult.shortcuts);
			if (shutdownScript)
			{
				plugin.shutdownScripts[shortcutFile.address] = shutdownScript;
			}

			// Add new shortcuts to master list, followed by helper-blocker
			plugin.shortcuts = plugin.shortcuts.concat(parseResult.shortcuts);
			plugin.shortcuts.push({});

			// Get the file About string and shortcut About strings
			let baseName: string =
				shortcutFile.address.slice(shortcutFile.address.lastIndexOf("/")+1, -3);
			baseName =
				baseName.endsWith(".sfile") ?
				baseName.slice(0, -6) :
				baseName;
			shortcutFiles.push(baseName);
			this.updateGeneralHelpShortcut(shortcutFiles);
			abouts.push(
			{
				filename: baseName,
				fileAbout: parseResult.fileAbout,
				shortcutAbouts: parseResult.shortcutAbouts
			});

			// Add shortcut syntaxes to the master list
			this.addShortcutFileSyntaxes(
				baseName,
				parseResult.shortcutAbouts,
				[ [ "help " + baseName,
				    "Description of the \"" + baseName + "\" shortcut-file." ],
				  [ "ref " + baseName,
				    "A list of shortcuts defined in the \"" + baseName + "\" shortcut-file." ] ]);

			window._inlineScripts.inlineScripts.sfileIndices[baseName] = sfileIndicesIndex;
			sfileIndicesIndex++;
		}

		// Generate and add help shortcuts
		plugin.shortcuts = this.generateHelpShortcuts(abouts).concat(plugin.shortcuts);

		// Finalize the master syntaxes list
		this.finalizeShortcutSyntaxes();

		// ButtonView needs to be updated with the latest shortcut info
		ButtonView.getInstance()?.refreshGroupUi();
	}

	private static getExpansionScript(scriptId: string, shortcuts: Array<any>): string
	{
		let result = "";
		for (const shortcut of shortcuts)
		{
			if (!shortcut.test.source || shortcut.test.source === "(?:)")
			{
				if (!shortcut.expansion) { result = ""; }
				else
				{
					result += shortcut.expansion;
				}
			}
			else if (shortcut.test.source === scriptId)
			{
				result += shortcut.expansion;
				break;
			}
		}
		return result;
	}

	private static updateGeneralHelpShortcut(shortcutFiles: Array<string>): void
	{
		let expansion = GENERAL_HELP_PREAMBLE.replaceAll("\n", "\\n");
		if (shortcutFiles.length > 0)
		{
			expansion +=
				GENERAL_HELP_PREAMBLE_SHORTCUT_FILES.replaceAll("\n", "\\n") + "\", " +
				"\"\\n    - " + shortcutFiles.join("\",\"\\n    - ");
		}
		expansion += "\", \"\\n\\n\" ];"
		InlineScriptsPlugin.getInstance().shortcuts[0].expansion = expansion;
	}

	// Creates help shortcuts based on "about" info from shortcuts and shortcut-files
	private static generateHelpShortcuts(abouts: any): Array<any>
	{
		// The final list of help shortcuts
		let result: Array<any> = [];

		// Helper functions
		function capitalize(s: string)
		{
			return s.charAt(0).toUpperCase() + s.slice(1);
		}
		function stringifyString(s: string)
		{
			return s.replaceAll("\"", "\\\"").replaceAll("\n", "\\n");
		}
		function makeHelpShortcut(name: string, about: string)
		{
			about ||= "No information available.";
			const expansion: string =
				SFILE_HELP_PREAMBLE.replaceAll("\n", "\\n").replaceAll("$1", capitalize(name)).
					replaceAll("$2", name) +
				stringifyString(about) +
				"\\n\\n\";";
			const test: RegExp = new RegExp("^help " + name + "$");
			result.push({ test: test, expansion: expansion });
		}
		function makeRefShortcut(groupName: string, abouts: any, displayName?: string)
		{
			displayName = displayName || capitalize(groupName);
			let expansion: string =
			SFILE_REF_PREAMBLE.replaceAll("\n", "\\n").replaceAll("$1", displayName).
				replaceAll("$2", groupName) + "\n";
			for (const about of abouts)
			{
				let description: string = "";
				if (about.description)
				{
					description = " - " + stringifyString(about.description);
				}
				expansion +=
					"result += \"- __" + stringifyString(about.syntax) + "__" +
					description + "\\n\";\n";
			}
			if (!abouts.length)
			{
				expansion += "result += \"\\nNo shortcuts\\n\";\n";
			}
			expansion += "return result + \"\\n\";";
			const test: RegExp = new RegExp("^ref(?:erence)? " + groupName + "$");
			result.push({ test: test, expansion: expansion });
		}

		// Gather info
		let settingsAbouts: Array<any> = [];
		let shortcutFileAbouts: Array<any> = [];
		for (const about of abouts)
		{
			// If not the "settings" shortcut-file (the only about with a blank filename)
			if (about.filename)
			{
				// Add help only for shortcut-files that contain non-hidden shortcuts
				if (about.shortcutAbouts.length === 0) { continue; }
				// Make "help" shortcut for this shortcut-file
				makeHelpShortcut(about.filename, about.fileAbout);
				// Make "ref" shortcut for this shortcut-file
				makeRefShortcut(about.filename, about.shortcutAbouts);
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
		makeRefShortcut("?(?:all)?", settingsAbouts.concat(shortcutFileAbouts), "All shortcuts");

		// Create "ref settings" shortcut: expands to a reference for shortcuts defined in settings
		makeRefShortcut("settings", settingsAbouts);

		// Reversing ensures that "ref all" and "ref settings" aren't superseded by a poorly named
		// shortcut-file
		result.reverse();

		// Return list of help shortcuts we just generated
		return result;
	}

	private static addShortcutFileSyntaxes(sfile: string, abouts: Array<any>, syntaxes: Array<any>)
	{
		const plugin = InlineScriptsPlugin.getInstance();

		const addSyntax = (syntax: string, description: string, about: any, sfile: string) =>
		{
			description = description.replaceAll("\n***", "");
			plugin.syntaxes.push({ text: syntax, description: description, sfile: sfile });

			if (about) { about.syntax = this.removeSyntaxSpecialCharacters(syntax); }

			const altSyntax: string = description.match(REGEX_ALTERNATIVE_SYNTAX)?.[1];
			if (altSyntax)
			{
				const altDescription = description.replace(
					REGEX_ALTERNATIVE_SYNTAX, "\n\t- Alternative: __" + syntax + "__");
				plugin.syntaxes.push({ text: altSyntax, description: altDescription, sfile: "" });
			}
		}

		for (const about of abouts)
		{
			addSyntax(about.syntax, about.description, about, sfile);
		}
		for (const syntax of syntaxes)
		{
			addSyntax(syntax[0], syntax[1], null, "");
		}
	}

	private static finalizeShortcutSyntaxes(): void
	{
		const plugin = InlineScriptsPlugin.getInstance();

		plugin.syntaxesSorted = [... plugin.syntaxes ];
		plugin.syntaxesSorted.sort(SORT_SYNTAXES);

		for (let syntax of plugin.syntaxes)
		{
			syntax.text = this.removeSyntaxSpecialCharacters(syntax.text);
			syntax.regex = this.generateSyntaxRegex(syntax.text);
		}
	}

	private static removeSyntaxSpecialCharacters(src: string): string
	{
		return src.replaceAll(/(^|[^\\])~/g, "$1").replaceAll(/\\(?=-|~)/g, "");
	}

	private static generateSyntaxRegex(syntax: string): RegExp
	{
		let result: string = "^";
		let isInParameter: boolean = false;
		for (let i = 0; i < syntax.length; i++)
		{
			if (syntax[i] === "{")
			{
				result += "(?:([^ ]+)|$)";
				isInParameter = true;
			}
			else if (syntax[i] === "}" && isInParameter)
			{
				isInParameter = false;
			}
			else if (!isInParameter)
			{
				result += "(?:" + this.escapeCharacterForRegex(syntax[i]) + "|$)";
			}
		}
		result += "$";
		return new RegExp(result);
	}

	private static escapeCharacterForRegex(src: string): string
	{
		return (!ESCAPED_CHARACTERS.has(src)) ? src : ("\\" + src);
	}
}
