"use strict";

///////////////////////////////////////////////////////////////////////////////////////////////////

// NOTE: The "Text Expander JS" plugin uses a custom format for shortcut-files.  I tried using
// existing formats (json, xml, etc), but they were cumbersome for developing javascript code in.
// The chosen format is simple, flexible, and allows for wrapping scripts in js-fenced-code-blocks.
// This makes it easy to write Expansion scripts within Obsidian which is the intended use-case.
//
// For a summary of the format, see here:
// https://github.com/jon-heard/obsidian-text-expander-js#tutorial-create-a-new-shortcut-file
// and here:
// https://github.com/jon-heard/obsidian-text-expander-js#development-aid-fenced-code-blocks

///////////////////////////////////////////////////////////////////////////////////////////////////

const state = require("@codemirror/state");

// This is a node.js library, so is not available for mobile.  However, the code that uses it is
// blocked for mobile, so the plugin is still useful for mobile, just slightly more limited.
const childProcess = require("child_process");

const DEFAULT_SETTINGS: any = Object.freeze(
{
	prefix: ";;",
	suffix: ";",
	devMode: false,
	allowExternal: false,
	shortcutFiles: [],
	shortcuts: `
~~
^hi$
~~
return "Hello! How are you?";
~~
hi - Expands into "Hello! How are you?".  A simple shortcut to see if Text Expander JS is running.

~~
^date$
~~
return new Date().toLocaleDateString();
~~
date - Expands into the current, local date.

~~
^time$
~~
return new Date().toLocaleTimeString();
~~
time - Expands into the current, local time.

~~
^datetime$
~~
return new Date().toLocaleString();
~~
datetime - Expands into the current, local date and time.

~~
~~
function roll(max) { return Math.trunc(Math.random() * max + 1); }
~~
A random "roll" function for other shortcuts.

~~
^[d|D]([0-9]+)$
~~
return "🎲 " + roll($1) + " /D" + $1;
~~
d{max} - A dice roller shortcut.  Expands into "🎲 {roll result} /D{max}".  {max} is a required parameter: a positive integer giving the size of dice to roll.
    - Examples - d3, d20, d57, d999

~~
^[f|F][d|D]([0-9]+)$
~~
return "<span style='background-color:lightblue;color:black;padding:0 .25em'>🎲 <b>" + roll($1) + "</b> /D" + $1 + "</span>";
~~
fd{max} - Same as d{max}, but with fancy formatting.

~~
^([0-9]*)[d|D]([0-9]+)(|(?:\\+[0-9]+)|(?:\\-[0-9]+))$
~~
$1 = Number($1) || 1;
let result = 0;
let label = "D" + $2;
if ($1 > 1) { label += "x" + $1; }
for (let i = 0; i < $1; i++) { result += roll($2); }
if ($3) {
	if ($3.startsWith("+")) {
		result += Number($3.substr(1));
	} else {
		result -= Number($3.substr(1));
	}
	label += $3;
}
if (isNaN(label.substr(1))) { label = "(" + label + ")"; }
return "🎲 " + result + " /" + label;
~~
{count}d{max}{add} - Same as d{max}, but with optional {count} and {add} parameters.  {count} is a positive integer giving the number of dice to roll and add together.  {add} is "+" or "-" followed by a positive integer giving the amount to adjust the result by.
    - Examples - d100, 3d20, d10+5, 3d6+6"
`
});

const DEFAULT_SETTINGS_MOBILE: object = Object.freeze(
{
	prefix: "!!",
	suffix: "!"
});

const LONG_NOTE_TIME: number = 8 * 1000;
const INDENT: string = " ".repeat(4);
const REGEX_LIBRARY_README_SHORTCUT_FILE: RegExp = /### tejs_[_a-zA-Z0-9]+\n/g;
const REGEX_NOTE_METADATA: RegExp = /^\n*---\n(?:[^-]+\n)?---\n/;
const REGEX_SPLIT_FIRST_DASH: RegExp = / - (.*)/s;
const SHORTCUT_PRINT: Function = function(message: string)
{
	console.info("TEJS Shortcut:\n\t" + message);
	new obsidian.Notice("TEJS Shortcut:\n" + message, LONG_NOTE_TIME);
};

///////////////////////////////////////////////////////////////////////////////////////////////////

class TextExpanderJsPlugin extends obsidian.Plugin
{
	public saveSettings()
	{
		this.saveData(this.settings);
	}

	public async onload()
	{
		// Load settings
		const currentDefaultSettings: object =
			obsidian.Platform.isMobile ?
			Object.assign({}, DEFAULT_SETTINGS, DEFAULT_SETTINGS_MOBILE) :
			DEFAULT_SETTINGS;
		this.settings = Object.assign({}, currentDefaultSettings, await this.loadData());

		// Now that settings are loaded, keep track of the suffix's finishing character
		this.suffixEndCharacter =
			this.settings.suffix.charAt(this.settings.suffix.length - 1);

		// Attach settings UI
		this.addSettingTab(new TextExpanderJsPluginSettings(this.app, this));

		//Setup bound versons of these function for persistant use
		this._cm5_handleExpansionTrigger = this.cm5_handleExpansionTrigger.bind(this);
		this._handleExpansionError = this.handleExpansionError.bind(this);
		this._expand = this.expand.bind(this);
		this._runExternal = this.runExternal.bind(this);

		// Setup a dfc to monitor shortcut-file notes.
		this.shortcutDfc = new Dfc(
			this, this.settings.shortcutFiles, this.setupShortcuts.bind(this), true,
			this.onShortcutFileDisabled.bind(this));
		this.shortcutDfc.setMonitorType(
			this.settings.devMode ? DfcMonitorType.OnTouch : DfcMonitorType.OnModify);

		// Connect "code mirror 5" instances to this plugin to trigger expansions
		this.registerCodeMirror(
			(cm: any) =>
				cm.on("keydown", this._cm5_handleExpansionTrigger));

		// Setup "code mirror 6" editor extension management to trigger expansions
		this.storeTransaction = state.StateEffect.define();
		this.registerEditorExtension([
			state.EditorState.transactionFilter.of(
				this.cm6_handleExpansionTrigger.bind(this))
		]);

		// This keeps track of multiple expansion error handlers for nested expansions
		this.expansionErrorHandlerStack = [];

		// Track shutdown scripts in loaded shortcut-files to be called when unloaded.
		this.shortcutFileShutdownScripts = {};

		// Log starting the plugin
		this.notifyUser("Loaded (" + this.manifest.version + ")");
	}

	public onunload()
	{
		// Shutdown the shortcutDfc
		this.shortcutDfc.destructor();

		// Call shutdown script on shortcut files
		for (const filename in this.shortcutFileShutdownScripts)
		{
			this.onShortcutFileDisabled(filename);
		}

		// Disconnect "code mirror 5" instances from this plugin
		this.app.workspace.iterateCodeMirrors(
			(cm: any) => cm.off("keydown", this._cm5_handleExpansionTrigger));

		// Log ending the plugin
		this.notifyUser("Unloaded (" + this.manifest.version + ")");
	}

	private settings: any;
	private suffixEndCharacter: string;
	private _cm5_handleExpansionTrigger: any;
	public _handleExpansionError: any;
	private _expand: any;
	private _runExternal: any;
	private shortcutDfc: Dfc;
	private storeTransaction: any;
	private expansionErrorHandlerStack: any;
	private shortcutFileShutdownScripts: any;

	// Call the given shortcut-file's shutdown script.
	// Note: This is called when shortcut-file is being disabled
	private onShortcutFileDisabled(filename: string)
	{
		this.runExpansionScript(this.shortcutFileShutdownScripts[filename]);
		delete this.shortcutFileShutdownScripts[filename];
	}

	// CM5 callback for "keydown".  Used to kick off shortcut expansion attempt
	private cm5_handleExpansionTrigger(cm: any, keydown: KeyboardEvent)
	{
		if ((event as any)?.key == this.suffixEndCharacter)
		{
			this.tryShortcutExpansion();
		}
	}

	// CM6 callback for editor events.  Used to kick off shortcut expansion attempt
	private cm6_handleExpansionTrigger(tr: any)
	{
		// Only bother with key inputs that have changed the document
		if (!tr.isUserEvent("input.type") || !tr.docChanged) { return tr; }

		let shouldTryExpansion: boolean = false;

		// Iterate over each change made to the document
		tr.changes.iterChanges(
		(fromA: number, toA: number, fromB: number, toB: number, inserted: any) =>
		{
			// Only try expansion if the shortcut suffix's end character was hit
			if (inserted.text[0] == this.suffixEndCharacter)
			{
				shouldTryExpansion = true;
			}
		}, false);

		if (shouldTryExpansion)
		{
			this.tryShortcutExpansion();
		}

		return tr;
	}

	// Tries to get shortcut beneath caret and expand it.  setTimeout pauses for a frame to
	// give the calling event the opportunity to finish processing.  This is especially
	// important for CM5, as the typed key isn't in the editor at the time this is called.
	private tryShortcutExpansion() { setTimeout(() =>
	{
		const editor: any  =
			this.app.workspace.getActiveViewOfType(obsidian.MarkdownView)?.editor;
		if (!editor) { return; }

		// Find bounds of the shortcut beneath the caret (if there is one)
		const cursor: any = editor.getCursor();
		const lineText: string = editor.getLine(cursor.line);
		const prefixIndex: number = lineText.lastIndexOf(this.settings.prefix, cursor.ch);
		const suffixIndex: number = lineText.indexOf(
			this.settings.suffix, prefixIndex + this.settings.prefix.length);

		// If the caret is not at a shortcut, early out
		if (prefixIndex == -1 || suffixIndex == -1 ||
		    (suffixIndex + this.settings.suffix.length) < cursor.ch)
		{
			return;
		}

		// Run the Expansion script on the shortcut under the caret
		const sourceText: string =
			lineText.substring(prefixIndex + this.settings.prefix.length, suffixIndex);
		let expansionText: string = this.expand(sourceText, true);
		if (expansionText === undefined) { return; }

		// Handle a string array from the Expansion result
		if (Array.isArray(expansionText))
		{
			expansionText = expansionText.join("");
		}

		// Make sure we have a proper string
		expansionText = expansionText + "";

		// Replace written shortcut with Expansion result
		editor.replaceRange(
			expansionText,
			{ line: cursor.line, ch: prefixIndex },
			{ line: cursor.line, ch: suffixIndex + this.settings.suffix.length } );
	}, 0); }

	// Take a shortcut string and return the proper Expansion string.
	// WARNING: user-facing function
	private expand(text: string,  isUserTriggered?: boolean)
	{
		if (!text) { return; }
		let foundMatch: boolean = false;
		let expansionText: string = "";
		for (const shortcut of this.shortcuts)
		{
			// Helper-block (empty shortcut) just erases helper scripts before it
			if ((!shortcut.test || shortcut.test.source == "(?:)") &&
			    !shortcut.expansion)
			{
				expansionText = "";
				continue;
			}

			// Does the shortcut fit? (or is it a helper script?)
			const matchInfo: any = text.match(shortcut.test);
			if (!matchInfo) { continue; }

			// Translate regex groups into variables
			for (let k: number = 1; k < matchInfo.length; k++)
			{
				expansionText +=
					"let $" + k + " = \"" +
					matchInfo[k].replaceAll("\"", "\\\"") + "\";\n";
			}

			// Add the shortcut's Expansion string to the total Expanson script
			expansionText += shortcut.expansion + "\n";

			// If not a helper script, stop checking shortcut matches, we're done
			if (shortcut.test.source != "(?:)")
			{
				foundMatch = true;
				break;
			}
		}

		expansionText =
			!foundMatch ?
			undefined :
			this.runExpansionScript(expansionText, isUserTriggered);

		// If shortcut parsing amounted to nothing.  Notify user of bad shortcut entry.
		if (expansionText === undefined)
		{
			this.notifyUser(
				"Shortcut unidentified:\n" + INDENT + text, "",
				"Shortcut unidentified:\n" + text, false, true);
		}
		// If there are any listeners for the expansion event, call them
		else if (isUserTriggered && window._tejs?.listeners?.tejs?.onExpansion)
		{
			for (const key in window._tejs.listeners.tejs.onExpansion)
			{
				const listener: any = window._tejs.listeners.tejs.onExpansion[key];
				if (typeof listener !== "function")
				{
					this.notifyUser(
						"Non-function listener:\n" + INDENT + listener,
						undefined,
						"Non-function listener:\n" + listener,
						false, true);
					continue;
				}
				listener(expansionText);
			}
		}

		return expansionText;
	}

	// Runs an expansion script, including error handling.
	// NOTE: Error handling is being done through window "error" event, rather than through
	// exceptions.  This is because exceptions don't provide error line numbers like the error
	// event does.  Line numbers are important to create the useful "expansion failed" message.
	private runExpansionScript(expansionScript: string, isUserTriggered?: boolean)
	{
		// Prepare for possible Expansion script error
		if (isUserTriggered || !this.expansionErrorHandlerStack.length)
		{
			// ASSERT - This should never be true
			if (this.expansionErrorHandlerStack.length > 0)
			{
				let msg: string =
					"Stack was off by " +
					this.expansionErrorHandlerStack.length + ".\n" +
					this.expansionErrorHandlerStack.join("\n-------\n");
				this.notifyUser(msg, "EXPANSION-ERROR-HANDLER-ERROR");
				this.expansionErrorHandlerStack = [];
			}
			window.addEventListener("error", this._handleExpansionError);
		}
		this.expansionErrorHandlerStack.push(expansionScript);

		// Run the Expansion script
		// Pass expand function and isUserTriggered flag for use in Expansion script
		let result: any = (new Function(
				"expand", "isUserTriggered", "runExternal", "print",
				expansionScript))
				(this._expand, isUserTriggered, this._runExternal, SHORTCUT_PRINT);

		// Clean up script error preparations (it wouldn't have got here if we'd hit one)
		this.expansionErrorHandlerStack.pop();
		if (isUserTriggered || !this.expansionErrorHandlerStack.length)
		{
			// ASSERT - This should never be true
			if (this.expansionErrorHandlerStack.length > 0)
			{
				let msg: string =
					"Stack was off by " +
					this.expansionErrorHandlerStack.length + ".\n" +
					this.expansionErrorHandlerStack.join("\n-------\n");
				this.notifyUser(msg, "EXPANSION-ERROR-HANDLER-ERROR");
				this.expansionErrorHandlerStack = [];
			}
			window.removeEventListener("error", this._handleExpansionError);
		}

		// if shortcut doesn't return anything, better to return "" than undefined
		return result ?? "";
	}


	// Called when something goes wrong during shortcut expansion.  Generates a useful
	// error in the console and notification popup.
	private handleExpansionError(e: any)
	{
		// Block default error handling
		e.preventDefault();

		// Get expansion script, modified by line numbers and arrow pointing to error
		let expansionText: string = this.expansionErrorHandlerStack.last();
		let expansionLines = expansionText.split("\n");
		// Add line numbers
		for (let i: number = 0; i < expansionText.length; i++)
		{
			expansionLines[i] = String(i+1).padStart(4, "0") + " " + expansionLines[i];
		}
		// Add arrows (pointing to error)
		expansionLines.splice(e.lineno-2, 0, "-".repeat(e.colno + 4) + "^");
		expansionLines.splice(e.lineno-3, 0, "-".repeat(e.colno + 4) + "v");
		expansionText = expansionLines.join("\n");

		let msg: string =
			e.message + "\n" + INDENT +
			"line: " + (e.lineno-2) + ", column: " + e.colno + "\n" +
			INDENT + "─".repeat(20) + "\n" + expansionText;
		this.notifyUser(
			msg, "SHORTCUT-EXPANSION-ERROR",
			"Shortcut expansion issues.", true);

		// Clean up script error preparations (now that the error is handled)
		this.expansionErrorHandlerStack = []; // Error causes nest to unwind.  Clear stack.
		window.removeEventListener("error", this._handleExpansionError);
	}

	// Parses a shortcut-file's contents into a useful data format and returns it
	private parseShortcutFile(
		filename: string, content: string, maintainCodeFence?: boolean,
		maintainAboutString?: boolean)
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
			this.notifyUser(
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
					this.notifyUser(
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
			this.notifyUser("", "ERR", "Shortcut-file issues\n" + filename, true);
		}

		return {
			shortcuts: shortcuts,
			fileAbout: fileAbout,
			shortcutAbouts: shortcutAbouts
		};
	}

	// Creates entire shortcut list based on shortcuts from settings and shortcut-files
	private async setupShortcuts()
	{
		// To fill with data for the help-shortcut creation
		let abouts: Array<any> = [];

		// Add shortcuts defined directly in the settings
		let parseResult: any =
			this.parseShortcutFile("settings", this.settings.shortcuts);
		this.shortcuts = parseResult.shortcuts;
		abouts.push({ filename: "", shortcutAbouts: parseResult.shortcutAbouts });

		// Add a helper-block to segment helper scripts within their shortcut-files
		this.shortcuts.push({});

		// Go over all shortcut-files
		for (const filename of this.settings.shortcutFiles)
		{
			const file: any = this.app.vault.fileMap[filename];
			if (!file)
			{
				this.notifyUser(
					filename, "MISSING-SHORTCUT-FILE-ERROR",
					"Missing shortcut-file\n" + filename, false);
				continue;
			}

			const content: string = await this.app.vault.cachedRead(file);

			// Parse shortcut-file contents
			parseResult = this.parseShortcutFile(filename, content)

			// Look for a "setup" script in this shortcut-file.  Run if found.
			for (const newShortcut of parseResult.shortcuts)
			{
				if (newShortcut.test.source == "^tejs setup$")
				{
					// If setup script returns TRUE, don't use shortcuts
					if (this.runExpansionScript(newShortcut.expansion))
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
					this.shortcutFileShutdownScripts[filename] =
						newShortcut.expansion;
					break;
				}
			}

			// Add new shortcuts to master list, followed by helper-block
			this.shortcuts = this.shortcuts.concat(parseResult.shortcuts);
			this.shortcuts.push({});

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

		this.setupHelpShortcuts(abouts);
	}

	// Creates systems help shortcuts and adds them to the shortcuts list
	private setupHelpShortcuts(abouts: any)
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
		this.shortcuts = result.concat(this.shortcuts);
	}

	// This function is passed into all Expansion scripts to allow them to run shell commands
	// WARNING: user-facing function
	private runExternal(command: string, silentFail?: boolean, dontFixSlashes?: boolean)
	{
		if (obsidian.Platform.isMobile)
		{
			this.notifyUser(
				"Unauthorized \"runExternal\" call " +
				"(NOT available on mobile):\n" + INDENT +
				"runExternal(\"" + command + "\")", "RUNEXTERNAL-ERROR",
				"Unauthorized \"runExternal\" call", true);
			return undefined;
		}

		// Block this function call if user hasn't turned on the "Allow external" setting
		// to explicitly allowed shortcuts to call shell commands.
		if (!this.settings.allowExternal)
		{
			this.notifyUser(
				"Unauthorized \"runExternal\" call " +
				"(disallowed by user):\n" + INDENT +
				"runExternal(\"" + command + "\")\n" + INDENT +
				"NOTE: User can allow runExternal by turning on " +
				"\"Allow external\" in the settings.", "RUNEXTERNAL-ERROR",
				"Unauthorized \"runExternal\" call", true);
			return undefined;
		}

		// Empty commands always fail
		if (!command) { return undefined; }

		// Fix slashes in Windows commands
		if (navigator.appVersion.includes("Windows") && !dontFixSlashes)
		{
			command = command.replaceAll("/", "\\");
		}

		// Do the shell command
		let vaultDir: string = this.app.fileManager.vault.adapter.basePath;
		try
		{
			let result: string = childProcess.execSync(command, { cwd: vaultDir});
			return (result + "").replaceAll("\r", "");
		}
		catch (e: any)
		{
			if (!silentFail)
			{
				this.notifyUser(
					"Failed \"runExternal\" call:\n" + INDENT +
					"curDir: " + vaultDir + "\n" + INDENT +
					e.message, "RUNEXTERNAL-ERROR",
					"Failed \"runExternal\" call", true);
			}
			return undefined;
		}
	}

	// Adds a console entry and/or a popup notification
	private notifyUser(
		consoleMessage: string, errorType?: string, popupMessage?: string,
		detailOnConsole?: boolean, isWarning?: boolean)
	{
		if (consoleMessage)
		{
			consoleMessage =
				this.manifest.name + "\n" +
				(errorType ? (INDENT + errorType + "\n") : "") +
				INDENT + consoleMessage;
			errorType ? console.error(consoleMessage) :
			isWarning ? console.warn(consoleMessage) :
			console.info(consoleMessage);
		}
		if (popupMessage)
		{
			new obsidian.Notice(
				(errorType ? "ERROR: " : "") +
				popupMessage +
				(detailOnConsole ? "\n\n(see console for details)" : ""),
				LONG_NOTE_TIME);
		}
	}

	// Adds a tinted full-screen div to prevent user-input
	private addInputBlock()
	{
		if (document.getElementById("tejs_inputBlock"))
		{
			return;
		}
		let block: any = document.createElement("div");
		block.id = "tejs_inputBlock";
		document.getElementsByTagName("body")[0].prepend(block);
	}

	// Removes the tinted full-screen div created by addInputBlock
	private removeInputBlock()
	{
		let block: any = document.getElementById("tejs_inputBlock");
		if (block) { block.remove(); }
	}
}

///////////////////////////////////////////////////////////////////////////////////////////////////

module.exports = TextExpanderJsPlugin;
