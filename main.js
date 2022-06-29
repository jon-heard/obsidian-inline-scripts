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

const obsidian = require("obsidian");
const state = require("@codemirror/state");

// This is a node.js library, so is not available for mobile.  However, the code that uses it is
// blocked for mobile, so the plugin is still useful for mobile, just slightly more limited.
const childProcess = require("child_process");

const DEFAULT_SETTINGS = Object.freeze(
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

const DEFAULT_SETTINGS_MOBILE = Object.freeze(
{
	prefix: "!!",
	suffix: "!"
});

const LONG_NOTE_TIME = 8 * 1000;
const INDENT = " ".repeat(4);
const REGEX_LIBRARY_README_SHORTCUT_FILE = /### tejs_[_a-zA-Z0-9]+\n/g;
const REGEX_NOTE_METADATA = /^\n*---\n(?:[^-]+\n)?---\n/;
const REGEX_SPLIT_FIRST_DASH = / - (.*)/s;
const SHORTCUT_PRINT = function(message)
{
	console.info("TEJS Shortcut:\n\t" + message);
	new obsidian.Notice("TEJS Shortcut:\n" + message, LONG_NOTE_TIME);
};

///////////////////////////////////////////////////////////////////////////////////////////////////

class TextExpanderJsPlugin extends obsidian.Plugin
{
	saveSettings()
	{
		this.saveData(this.settings);
	}

	async onload()
	{
		// Load settings
		const currentDefaultSettings =
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
			cm => cm.on("keydown", this._cm5_handleExpansionTrigger));

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

	onunload()
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
			cm => cm.off("keydown", this._cm5_handleExpansionTrigger));

		// Log ending the plugin
		this.notifyUser("Unloaded (" + this.manifest.version + ")");
	}

	// Call the given shortcut-file's shutdown script.
	// Note: This is called when shortcut-file is being disabled
	onShortcutFileDisabled(filename)
	{
		this.runExpansionScript(this.shortcutFileShutdownScripts[filename]);
		delete this.shortcutFileShutdownScripts[filename];
	}

	// CM5 callback for "keydown".  Used to kick off shortcut expansion attempt
	cm5_handleExpansionTrigger(cm, keydown)
	{
		if (event.key == this.suffixEndCharacter)
		{
			this.tryShortcutExpansion();
		}
	}

	// CM6 callback for editor events.  Used to kick off shortcut expansion attempt
	cm6_handleExpansionTrigger(tr)
	{
		// Only bother with key inputs that have changed the document
		if (!tr.isUserEvent("input.type") || !tr.docChanged) { return tr; }

		let shouldTryExpansion = false;

		// Iterate over each change made to the document
		tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) =>
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
	tryShortcutExpansion() { setTimeout(() =>
	{
		const editor =
			this.app.workspace.getActiveViewOfType(obsidian.MarkdownView)?.editor;
		if (!editor) { return; }

		// Find bounds of the shortcut beneath the caret (if there is one)
		const cursor = editor.getCursor();
		const lineText = editor.getLine(cursor.line);
		const prefixIndex = lineText.lastIndexOf(this.settings.prefix, cursor.ch);
		const suffixIndex = lineText.indexOf(
			this.settings.suffix, prefixIndex + this.settings.prefix.length);

		// If the caret is not at a shortcut, early out
		if (prefixIndex == -1 || suffixIndex == -1 ||
		    (suffixIndex + this.settings.suffix.length) < cursor.ch)
		{
			return;
		}

		// Run the Expansion script on the shortcut under the caret
		const sourceText =
			lineText.substring(prefixIndex + this.settings.prefix.length, suffixIndex);
		let expansionText = this.expand(sourceText, true);
		if (expansionText === null) { return; }

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
	expand(text,  isUserTriggered)
	{
		if (!text) { return; }
		let foundMatch = false;
		let expansionText = "";
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
			const matchInfo = text.match(shortcut.test);
			if (!matchInfo) { continue; }

			// Translate regex groups into variables
			for (let k = 1; k < matchInfo.length; k++)
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
			null :
			this.runExpansionScript(expansionText, isUserTriggered);

		// If shortcut parsing amounted to nothing.  Notify user of bad shortcut entry.
		if (expansionText === null)
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
				const listener = window._tejs.listeners.tejs.onExpansion[key];
				if (typeof listener !== "function")
				{
					this.notifyUser(
						"Non-function listener:\n" + INDENT + listener,
						null,
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
	runExpansionScript(expansionScript, isUserTriggered)
	{
		// Prepare for possible Expansion script error
		if (isUserTriggered || !this.expansionErrorHandlerStack.length)
		{
			// ASSERT - This should never be true
			if (this.expansionErrorHandlerStack.length > 0)
			{
				let msg =
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
		let result = (new Function(
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
				let msg =
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
	handleExpansionError(e)
	{
		// Block default error handling
		e.preventDefault();

		// Get expansion script, modified by line numbers and arrow pointing to error
		let expansionText = this.expansionErrorHandlerStack.last();
		expansionText = expansionText.split("\n");
		// Add line numbers
		for (let i = 0; i < expansionText.length; i++)
		{
			expansionText[i] = String(i+1).padStart(4, "0") + " " + expansionText[i];
		}
		// Add arrows (pointing to error)
		expansionText.splice(e.lineno-2, 0, "-".repeat(e.colno + 4) + "^");
		expansionText.splice(e.lineno-3, 0, "-".repeat(e.colno + 4) + "v");
		expansionText = expansionText.join("\n");

		let msg =
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
	parseShortcutFile(filename, content, maintainCodeFence, maintainAboutString)
	{
		// Remove any note metadata
		content = content.replace(REGEX_NOTE_METADATA, "");

		// Result vars
		let fileAbout = "";
		let shortcuts = [];
		let shortcutAbouts = [];

		// Flag set when an error occurs.  Used for single popup for ALL file errors.
		let fileHasErrors = false;

		content = content.split("~~").map(v => v.trim());
		fileAbout = content[0];

		// Check for the obvious error of misnumbered sections (bounded by "~~")
		if (!!((content.length-1) % 3))
		{
			this.notifyUser(
				"In Shortcut-file \"" + filename + "\"",
				"MISNUMBERED-SECTION-COUNT-ERROR");
			fileHasErrors = true;
		}

		// Parse each shortcut in the file
		// NOTE: this loop checks i+2 and increments by 3 as it uses i, i+1 and i+2.
		for (let i = 1; i+2 < content.length; i += 3)
		{
			// Test string handling
			let testRegex = null;
			if (maintainCodeFence)
			{
				// "maintainCodeFence" is not possible with a real RegExp object.
				// Instead, create RegExp-style-dummy to retain fence within API.
				testRegex = { source: content[i] };
			}
			else
			{
				let c = content[i];

				// Handle the Test being in a basic fenced code-block
				if (c.startsWith("```") && c.endsWith("```"))
				{
					c = c.substring(3, c.length-3).trim();
				}

				try
				{
					testRegex = new RegExp(c);
				}
				catch (e)
				{
					this.notifyUser(
						"In shortcut-file \"" + filename + "\":\n" +
						INDENT + c, "BAD-TEST-STRING-ERROR");
					fileHasErrors = true;
					continue;
				}
			}

			// Expansion string handling
			let exp = content[i+1];
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
					test: testRegex, expansion: exp, about: content[i+2] });
			}
			else
			{
				shortcuts.push({ test: testRegex, expansion: exp });
			}

			// About string handling
			// Skip if a helper script, helper block or setup script
			if (testRegex.source != "(?:)" && testRegex.source != "^tejs setup$" &&
			    testRegex.source != "^tejs shutdown$")
			{
				let about = content[i+2];
				about = about.split(REGEX_SPLIT_FIRST_DASH).map(v => v.trim());
				// If no syntax string is included, use the Regex string instead
				if (about.length == 1)
				{
					about = [testRegex.source, about[0]];
				}
				shortcutAbouts.push({ syntax: about[0], description: about[1] });
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
	async setupShortcuts()
	{
		// To fill with data for the help-shortcut creation
		let abouts = [];

		// Add shortcuts defined directly in the settings
		let parseResult = this.parseShortcutFile("settings", this.settings.shortcuts);
		this.shortcuts = parseResult.shortcuts;
		abouts.push({ filename: "", shortcutAbouts: parseResult.shortcutAbouts });

		// Add a helper-block to segment helper scripts within their shortcut-files
		this.shortcuts.push({});

		// Go over all shortcut-files
		for (const filename of this.settings.shortcutFiles)
		{
			const file = this.app.vault.fileMap[filename];
			if (!file)
			{
				this.notifyUser(
					filename, "MISSING-SHORTCUT-FILE-ERROR",
					"Missing shortcut-file\n" + filename, false);
				continue;
			}

			const content = await this.app.vault.cachedRead(file);

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
						parseResults.shortcuts = null;
					}
					break;
				}
			}

			// If setup script returned true, abort adding the new shortcuts
			if (!parseResults.shortcuts) { continue; }

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
			let baseName =
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
	setupHelpShortcuts(abouts)
	{
		let result = [];

		// Support functions
		function capitalize(s)
		{
			return s.charAt(0).toUpperCase() + s.slice(1);
		}
		function stringifyString(s)
		{
			return s.replaceAll("\"", "\\\"").replaceAll("\n", "\\n");
		}
		function makeRefShortcut(groupName, abouts, displayName)
		{
			displayName = displayName || capitalize(groupName);
			let expansion =
				"let result = \"### Reference - " + displayName + "\\n\";\n";
			for (const about of abouts)
			{
				let description = "";
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
				expansion += "result += \"   No shortcuts\\n\";\n";
			}
			expansion += "return result + \"\\n\";";
			const test = new RegExp("^ref(?:erence)? " + groupName + "$");
			result.push({ test: test, expansion: expansion });
		}
		function makeAboutShortcut(name, about)
		{
			about ||= "No information available.";
			const expansion =
				"return \"### About - " + capitalize(name) + "\\n" +
				stringifyString(about) + "\\n\\n\";";
			const test = new RegExp("^about " + name + "$");
			result.push({ test: test, expansion: expansion });
		}

		// Gather info
		let settingsAbouts = [];
		let shortcutFileAbouts = [];
		let shortcutFileList = "";
		for (const about of abouts)
		{
			if (about.filename)
			{
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
		let expansion =
			"return \"The following shortcuts provide help for all shortcuts and " +
			"shortcut-files currently setup with __Text Expander JS__:\\n" +
			"- __help__ - Shows this text.\\n" +
			"- __ref settings__ - Summarizes shortcuts defined in the Settings.\\n" +
			"- __ref all__ - Summarizes all shortcuts (except the ones in " +
			"this list).\\n" +
			shortcutFileList + "\\n\";";
		const test = new RegExp("^help$");
		result.push({ test: test, expansion: expansion });

		// Reversing ensures that "ref all" and "ref settings" aren't superseded
		// by a poorly named shortcut-file
		result.reverse();

		// Prepend help shortcuts to start of main shortcuts list
		this.shortcuts = result.concat(this.shortcuts);
	}

	// This function is passed into all Expansion scripts to allow them to run shell commands
	// WARNING: user-facing function
	runExternal(command, silentFail, dontFixSlashes)
	{
		if (obsidian.Platform.isMobile)
		{
			this.notifyUser(
				"Unauthorized \"runExternal\" call " +
				"(NOT available on mobile):\n" + INDENT +
				"runExternal(\"" + command + "\")", "RUNEXTERNAL-ERROR",
				"Unauthorized \"runExternal\" call", true);
			return null;
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
			return null;
		}

		// Empty commands always fail
		if (!command) { return null; }

		// Fix slashes in Windows commands
		if (navigator.appVersion.contains("Windows") && !dontFixSlashes)
		{
			command = command.replaceAll("/", "\\");
		}

		// Do the shell command
		let vaultDir = app.fileManager.vault.adapter.basePath;
		try
		{
			let result = childProcess.execSync(command, { cwd: vaultDir});
			return (result + "").replaceAll("\r", "");
		}
		catch (e)
		{
			if (!silentFail)
			{
				this.notifyUser(
					"Failed \"runExternal\" call:\n" + INDENT +
					"curDir: " + vaultDir + "\n" + INDENT +
					e.message, "RUNEXTERNAL-ERROR",
					"Failed \"runExternal\" call", true);
			}
			return null;
		}
	}

	// Adds a console entry and/or a popup notification
	notifyUser(consoleMessage, errorType, popupMessage, detailOnConsole, isWarning)
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
	addInputBlock()
	{
		if (document.getElementById("tejs_inputBlock"))
		{
			return;
		}
		let block = document.createElement("div");
		block.id = "tejs_inputBlock";
		document.getElementsByTagName("body")[0].prepend(block);
	}

	// Removes the tinted full-screen div created by addInputBlock
	removeInputBlock()
	{
		let block = document.getElementById("tejs_inputBlock");
		if (block) { block.remove(); }
	}
}

///////////////////////////////////////////////////////////////////////////////////////////////////

class TextExpanderJsPluginSettings extends obsidian.PluginSettingTab
{
	constructor(app, plugin)
	{
		super(app, plugin);
		this.plugin = plugin;

		// Keep a copy of the current settings to modify
		this.tmpSettings = null;

		// Keep the ui for format errors, for updating
		this.formattingErrMsgContainer = null;
		this.formattingErrMsgContent = null;
	}

	// Checks formatting settings for errors:
	//   - blank prefix or suffix
	//   - suffix contains prefix (disallowed as it messes up logic)
	checkFormatValid()
	{
		let err = "";
		if (!this.tmpSettings.prefix)
		{
			err = "Prefix cannot be blank";
		}
		else if (!this.tmpSettings.suffix)
		{
			err = "Suffix cannot be blank";
		}
		else if (this.tmpSettings.suffix.contains(this.tmpSettings.prefix))
		{
			err = "Suffix cannot contain prefix";
		}

		if (!err)
		{
			this.formattingErrMsgContainer.toggleClass(
				"tejs_errMsgContainerShown", false);
			return true;
		}
		else
		{
			this.formattingErrMsgContainer.toggleClass(
				"tejs_errMsgContainerShown", true);
			this.formattingErrMsgContent.innerText = err;
			return false;
		}
	}


	display()
	{
		// Clone temporary settings from plugin's settings
		this.tmpSettings = JSON.parse(JSON.stringify(this.plugin.settings));

		const c = this.containerEl;
		c.empty();

		// General button callbacks
		const deleteButtonClicked = function()
		{
			new ConfirmDialogBox(
				this.plugin.app,
				"Confirm removing a " + this.typeTitle + ".",
				(confirmation) =>
				{
					if (confirmation)
					{
						this.group.remove();
					}
				}
			).open();
		};
		const upButtonClicked = function()
		{
			let p = this.group.parentElement;
			let index = Array.from(p.childNodes).indexOf(this.group);
			if (index == this.listOffset) { return; }
			p.insertBefore(p.childNodes[index], p.childNodes[index - 1]);
		};
		const downButtonClicked = function()
		{
			let p = this.group.parentElement;
			let index = Array.from(p.childNodes).indexOf(this.group);
			if (index == p.childNodes.length - 1) { return; }
			index++;
			p.insertBefore(p.childNodes[index], p.childNodes[index - 1]);
		};

		// App version (in header)
		c.createEl("div", { text: this.plugin.manifest.version, cls: "tejs_version" });

		c.createEl("h2", { text: "Shortcut Sources" });

		////////////////////
		// SHORTCUT-FILES //
		////////////////////
		new obsidian.Setting(c)
			.setName("Shortcut-files")
			.setDesc("Addresses of notes containing shortcut-file content.")
			.addButton((button) =>
			{
				return button
					.setButtonText("Add file reference")
					.setClass("tejs_button")
					.onClick(() =>
					{
						addShortcutFileUi();
					});
			})
			.addButton((button) =>
			{
				return button
					.setButtonText("Import full library")
					.setClass("tejs_button")
					.onClick(() =>
					{
						new ConfirmDialogBox(
							this.plugin.app,
							"Confirm importing the full shortcut-" +
							"files library into this vault.",
							(confirmation) =>
							{
								if (confirmation)
								{
									this.importFullLibrary();
								}
							}
						).open();
					});
			});
		this.shortcutFileUis = c.createEl("div", { cls: "tejs_shortcutFiles" });
		this.shortcutFileUis.createEl("div", {
			text: "Red means the file does not exist.",
			cls: "setting-item-description tejs_extraMessage tejs_onSiblings"
		});
		const addShortcutFileUi = (text) =>
		{
			let g = this.shortcutFileUis.createEl("div", { cls: "tejs_shortcutFile" });
			let e = g.createEl("input", { cls: "tejs_shortcutFileAddress" });
				e.setAttr("type", "text");
				e.setAttr("placeholder", "Filename");
				e.plugin = this.plugin;
				// Handle toggling red on this textfield
				e.addEventListener("input", function()
				{
					const isBadInput =
						this.value &&
						!this.plugin.app.vault.fileMap[this.value+".md"]
					this.toggleClass("tejs_badInput", isBadInput);
				});
				// Assign given text argument to the textfield
				if (text)
				{
					// Remove ".md" extension from filename
					text = text.substr(0, text.length - 3);
					e.setAttr("value", text);
				}
				e.dispatchEvent(new Event("input"));
			e = g.createEl("button", { cls: "tejs_upButton tejs_button" });
				e.group = g;
				e.onclick = upButtonClicked;
				e.listOffset = 1;
			e = g.createEl("button", { cls: "tejs_downButton tejs_button" });
				e.group = g;
				e.onclick = downButtonClicked;
			e = g.createEl("button", { cls: "tejs_deleteButton tejs_button" });
				e.group = g;
				e.onclick = deleteButtonClicked;
				e.plugin = this.plugin;
				e.typeTitle = "shortcut-file";
		};
		// Add a filename ui item for each shortcut-file in settings
		for (const shortcutFile of this.tmpSettings.shortcutFiles)
		{
			addShortcutFileUi(shortcutFile);
		}

		///////////////
		// SHORTCUTS //
		///////////////
		new obsidian.Setting(c)
			.setName("Shortcuts")
			.setDesc("Define shortcuts here (in addition to shortcut-files)")
			.addButton((button) =>
			{
				return button
					.setButtonText("Add shortcut")
					.setClass("tejs_button")
					.onClick(() =>
					{
						addShortcutUi();
					});
			})
			.addButton((button) =>
			{
				return button
					.setButtonText("Add defaults")
					.setClass("tejs_button")
					.onClick(function()
					{
						let defaultShortcuts =
							this.plugin.parseShortcutFile("Settings",
							DEFAULT_SETTINGS.shortcuts, true, true).
							shortcuts;

						// We don't want to duplicate shortcuts, and it's
						// important to keep defaults in-order.  Remove
						// any shortcuts from the ui list that are part
						// of the defaults before adding the defaults to
						// the end of the ui list.
						this.removeShortcutsFromUi(defaultShortcuts);

						for (const defaultShortcut of defaultShortcuts)
						{
							addShortcutUi(defaultShortcut);
						}
					}.bind(this));
			});
		this.shortcutUis = c.createEl("div", { cls: "tejs_shortcuts" });
		const addShortcutUi = (shortcut) =>
		{
			let g = this.shortcutUis.createEl("div", { cls: "tejs_shortcut" });
			let e = g.createEl("input", { cls: "tejs_shortcutTest" });
				e.setAttr("type", "text");
				e.setAttr("placeholder", "Test (regex)");
				if (shortcut)
				{
					e.value = shortcut.test.source;

					// Translate regex compiled "blank" test
					if (e.value == "(?:)")
					{
						e.value = "";
					}
				}
			e = g.createEl("button", { cls: "tejs_upButton tejs_button" });
				e.group = g;
				e.onclick = upButtonClicked;
				e.listOffset = 0;
			e = g.createEl("button", { cls: "tejs_downButton tejs_button" });
				e.group = g;
				e.onclick = downButtonClicked;
			e = g.createEl("button", { cls: "tejs_deleteButton tejs_button" });
				e.group = g;
				e.onclick = deleteButtonClicked;
				e.plugin = this.plugin;
				e.typeTitle = "shortcut";
			e = g.createEl("textarea", { cls: "tejs_shortcutExpansion" });
				e.setAttr("placeholder", "Expansion (javascript)");
				if (shortcut)
				{
					e.value = shortcut.expansion;
				}
			e = g.createEl("textarea", { cls: "tejs_shortcutAbout" });
				e.setAttr("placeholder", "About (text)");
				if (shortcut)
				{
					e.value = shortcut.about;
				}
		};
		// Add a shortcut ui item for each shortcut in settings
		const shortcuts = this.plugin.parseShortcutFile(
			"Settings", this.tmpSettings.shortcuts, true, true).shortcuts;
		for (const shortcut of shortcuts)
		{
			addShortcutUi(shortcut);
		}

		/////////////////////
		// SHORTCUT FORMAT //
		/////////////////////
		c.createEl("h2", { text: "Shortcut format" });

		// A ui for showing errors in shortcut format settings
		this.formattingErrMsgContainer =
			c.createEl("div", { cls: "tejs_errMsgContainer" });
		const errMsgTitle = this.formattingErrMsgContainer.createEl(
			"span", { text: "ERROR", cls: "tejs_errMsgTitle" });
		this.formattingErrMsgContent = this.formattingErrMsgContainer.createEl("span");

		// Prefix
		new obsidian.Setting(c)
			.setName("Prefix")
			.setDesc("What to type BEFORE a shortcut.")
			.addText((text) =>
			{
				return text
					.setPlaceholder("Prefix")
					.setValue(this.tmpSettings.prefix)
					.onChange((value) =>
					{
						this.tmpSettings.prefix = value;
						refreshShortcutExample();
						this.checkFormatValid();
					});
			})
			.settingEl.toggleClass("tejs_settingBundledTop", !obsidian.Platform.isMobile);

		// Suffix
		new obsidian.Setting(c)
			.setName("Suffix")
			.setDesc("What to type AFTER a shortcut.")
			.addText((text) =>
			{
				return text
					.setPlaceholder("Suffix")
					.setValue(this.tmpSettings.suffix)
					.onChange((value) =>
					{
						this.tmpSettings.suffix = value;
						refreshShortcutExample();
						this.checkFormatValid();
					});
			})
			.settingEl.toggleClass("tejs_settingBundled", !obsidian.Platform.isMobile);

		// Example
		const exampleOuter = c.createEl("div", { cls: "setting-item" });
			exampleOuter.toggleClass("tejs_settingBundled", !obsidian.Platform.isMobile);
		const exampleInfo = exampleOuter.createEl("div", { cls: "setting-item-info" });
		exampleInfo.createEl("div", { text: "Example", cls: "setting-item-name" });
		exampleInfo.createEl("div",
		{
			text: "How to write the shortcut \"D100\"",
			cls: "setting-item-description"
		});
		const exampleItemControl =
			exampleOuter.createEl("div", { cls: "setting-item-control" });
		let shortcutExample = exampleItemControl.createEl("div", { cls: "tejs_labelControl" });
		const refreshShortcutExample = () =>
		{
			shortcutExample.innerText =
				this.tmpSettings.prefix +
				"D100" +
				this.tmpSettings.suffix;
		};
		refreshShortcutExample();

		////////////////////
		// OTHER SETTINGS //
		////////////////////
		c.createEl("h2", { text: "Other Settings" });

		// Developer mode
		new obsidian.Setting(c)
			.setName("Developer mode")
			.setDesc("Shortcut-files are monitored for updates if this is on.")
			.addToggle((toggle) =>
			{
				return toggle
					.setValue(this.tmpSettings.devMode)
					.onChange((value) =>
					{
						this.tmpSettings.devMode = value;
					});
			});

		// Allow external (not available on mobile)
		if (!obsidian.Platform.isMobile)
		{
			new obsidian.Setting(c)
				.setName("Allow external")
				.setDesc("Shortcuts can run external commands if this is on.")
				.addToggle((toggle) =>
				{
					return toggle
						.setValue(this.tmpSettings.allowExternal)
						.onChange((value) =>
						{
							this.tmpSettings.allowExternal = value;
						});
				})
				.descEl.createEl("div", {
					cls: "tejs_warning",
					text: "WARNING: enabling this increases the danger from " +
					      "malicious shortcuts" });
		}

		// App version (in footer)
		c.createEl("div", { text: this.plugin.manifest.version, cls: "tejs_version" });
	}

	// THIS is where settings are saved!
	hide()
	{
		// Get shortcut-files list
		this.tmpSettings.shortcutFiles = this.getShortcutFilesFromUi();

		// Build Shortcuts setting from UI (a string in Shortcut-file format)
		let shortcuts = this.getShortcutsFromUi();
		this.tmpSettings.shortcuts = "";
		for (const shortcut of shortcuts)
		{
			this.tmpSettings.shortcuts +=
				"~~\n" + shortcut.test + "\n" +
				"~~\n" + shortcut.expansion + "\n" +
				"~~\n" + shortcut.about + "\n\n";
		}

		// If the shortcut setting was changed, set the "forceRefreshShortcuts" variable.
		// Start easy: check for a change in the number of shortcuts in the setting.
		const oldShortcuts = this.plugin.parseShortcutFile(
			"", this.plugin.settings.shortcuts, true, true).shortcuts;
		const newShortcuts = this.plugin.parseShortcutFile(
			"", this.tmpSettings.shortcuts, true, true).shortcuts;
		let forceRefreshShortcuts = (newShortcuts.length != oldShortcuts.length);

		// If old & new shortcut settings have the same shortcut count, check each
		// individual shortcut for a change between old and new
		if (!forceRefreshShortcuts)
		{
			for (let i = 0; i < newShortcuts.length; i++)
			{
				if (newShortcuts[i].test.source != oldShortcuts[i].test.source ||
				    newShortcuts[i].expansion != oldShortcuts[i].expansion ||
				    newShortcuts[i].about != oldShortcuts[i].about)
				{
					forceRefreshShortcuts = true;
					break;
				}
			}
		}

		// If the new settings for prefix & suffix have errors in them, revert to the old
		// settings.
		if (!this.checkFormatValid())
		{
			this.tmpSettings.prefix = this.plugin.settings.prefix;
			this.tmpSettings.suffix = this.plugin.settings.suffix;
		}

		// Copy the old settings into the new settings
		this.plugin.settings = this.tmpSettings;

		// Dev mode - update setting from ui
		this.plugin.shortcutDfc.setMonitorType(
			this.plugin.settings.devMode ? DfcMonitorType.OnTouch : DfcMonitorType.OnModify);

		// Update the shortcut-files list data.  This needs to happen After the copy above
		this.plugin.shortcutDfc.updateFileList(
			this.plugin.settings.shortcutFiles, forceRefreshShortcuts);

		// Keep track of the last character in the shortcut suffix
		this.plugin.suffixEndCharacter =
			this.plugin.settings.suffix.charAt(this.plugin.settings.suffix.length - 1);

		// Store the settings to file
		this.plugin.saveSettings();
	}

	// Create a shortcut-files list from the shortcut-files UI
	getShortcutFilesFromUi()
	{
		let result = [];
		for (const shortcutFileUi of this.shortcutFileUis.childNodes)
		{
			if (shortcutFileUi.childNodes[0].value)
			{
				result.push(obsidian.normalizePath(
					shortcutFileUi.childNodes[0].value + ".md"));
			}
		}
		return result;
	}

	// Create a shortcuts list from the shortcuts UI
	getShortcutsFromUi()
	{
		let result = [];
		for (const shortcutUi of this.shortcutUis.childNodes)
		{
			// Accept any shortcuts with a non-empty Expansion string
			if (shortcutUi.childNodes[4].value)
			{
				result.push({
					test: shortcutUi.childNodes[0].value,
					expansion: shortcutUi.childNodes[4].value,
					about: shortcutUi.childNodes[5].value
				});
			}
		}
		return result;
	}

	// Takes a list of shortcuts, and removes them from the ui, if they are there.
	removeShortcutsFromUi(shortcuts)
	{
		let toRemove = [];
		for (const shortcutUi of this.shortcutUis.childNodes)
		{
			const test = shortcutUi.childNodes[0].value;
			const expansion = shortcutUi.childNodes[4].value;
			for (let k = 0; k < shortcuts.length; k++)
			{
				if (shortcuts[k].expansion != expansion)
				{
					continue;
				}
				if (shortcuts[k].test.source != test &&
				    (shortcuts[k].test.source != "(?:)" || test != ""))
				{
					continue;
				}
				toRemove.push(shortcutUi);
				break;
			}
		}
		for (const shortcutUi of toRemove)
		{
			shortcutUi.remove();
		}
	}

	// Called when user clicks the "Import full library" button
	async importFullLibrary()
	{
		const ADDRESS_REMOTE =
			"https://raw.githubusercontent.com/jon-heard/" +
			"obsidian-text-expander-js_shortcutFileLibrary/main";
		const ADDRESS_LOCAL = "tejs";
		const FILE_README = "README.md";

		// Need to manually disable user-input until this process is finished
		// (due to asynchronous downloads not otherwise blocking user-input)
		this.plugin.addInputBlock();

		// Get list of shortcut-files from the projects github readme
		let shortcutFiles = await request({
			url: ADDRESS_REMOTE + "/" + FILE_README,
			method: "GET", cache: "no-cache"
		});
		shortcutFiles =
			shortcutFiles.match(REGEX_LIBRARY_README_SHORTCUT_FILE).
			map(s => s.substring(4, s.length-1));

		// Figure out library destination.  By default this is ADDRESSS_LOCAL.
		// However, if all shortcut-file references in the settings that match files in
		// the library are in a single folder, ask user if they want to use that folder
		// instead of the default library destination.
		let shortcutReferences = this.getShortcutFilesFromUi();
		// The filenames of referenced shortcut-files
		let shortcutReferenceFilenames =
			shortcutReferences.map(s => s.substring(s.lastIndexOf("/")+1, s.length-3));
		// The paths of referenced shortcut-files
		let shortcutReferencePaths = shortcutReferences.map((s,i) =>
		{
			return s.substring(0, s.length-shortcutReferenceFilenames[i].length-4)
		});
		// Find a common path, or lack thereof, to shortcut-files belonging to the library
		let commonPath = null;
		for (let i = 0; i < shortcutReferences.length; i++)
		{
			if(shortcutFiles.contains(shortcutReferenceFilenames[i]))
			{
				if (commonPath === null)
				{
					commonPath = shortcutReferencePaths[i];
				}
				else
				{
					if (shortcutReferencePaths[i] != commonPath)
					{
						commonPath = null;
						break;
					}
				}
			}
		}
		if (commonPath == ADDRESS_LOCAL) { commonPath = null; }
		let libraryDestination = await new Promise((resolve, reject) =>
		{
			if (commonPath == null)
			{
				resolve(ADDRESS_LOCAL);
				return;
			}

			// We need to remove the input block to let the user choose
			this.plugin.removeInputBlock();

			new ConfirmDialogBox(
				this.plugin.app,
				"All library references are currently in the folder \"" +
				commonPath + "\".\nWould you like to import the library " +
				"into \"" +commonPath + "\"?\nIf not, the library will be " +
				"imported into the folder \"" + ADDRESS_LOCAL + "\".",
				(confirmation) =>
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

		// Put the input block back (if it was disabled for confirm dialog)
		this.plugin.addInputBlock();

		// Create the choosen library destination folder, if necessary
		if (!app.vault.fileMap.hasOwnProperty(libraryDestination))
		{
			this.plugin.app.vault.createFolder(libraryDestination);
		}

		// Download and create library files
		for (const shortcutFile of shortcutFiles)
		{
			// Download the file
			let content = await request({
				url: ADDRESS_REMOTE + "/" + shortcutFile + ".md",
				method: "GET", cache: "no-cache"
			});

			let filename = libraryDestination + "/" + shortcutFile + ".md";
			let file = app.vault.fileMap[filename];
			if (file)
			{
				await this.plugin.app.vault.modify(file, content);
			}
			else
			{
				await this.plugin.app.vault.create(filename, content);
			}
		}

		// Before adding the library shortcut-files to the plugin settings, we should
		// update the plugin settings with the latest changes made in the settings ui.
		this.plugin.settings.shortcutFiles = this.getShortcutFilesFromUi();

		// Add shortcut-file references, for new shortcut-files, to the settings
		for (const shortcutFile of shortcutFiles)
		{
			let filename = libraryDestination + "/" + shortcutFile + ".md";
			if (!this.plugin.settings.shortcutFiles.contains(filename))
			{
				this.plugin.settings.shortcutFiles.push(filename);
			}
		}

		// Refresh settings ui with the new shortcut-file references
		this.plugin.removeInputBlock();
		this.display();
	}
}

///////////////////////////////////////////////////////////////////////////////////////////////////

class ConfirmDialogBox extends obsidian.Modal
{
	constructor(app, message, callback)
	{
		super(app);
		this.message = message;
		this.callback = callback;
	}

	onOpen()
	{
		this.message = this.message.split("\n");
		for (const line of this.message)
		{
			this.titleEl.createEl("div", { text: line });
		}

		new obsidian.Setting(this.contentEl)
			.addButton((btn) =>
			{
				btn
					.setButtonText("Confirm")
					.onClick(() =>
					{
						this.callback(true);
						this.close();
					})
			})
			.addButton((btn) =>
			{
				btn
					.setButtonText("Cancel")
					.setCta()
					.onClick(() =>
					{
						this.callback(false);
						this.close();
					})
			})
			.settingEl.style.padding = "0";
	}

	onClose()
	{
		this.contentEl.empty();
	}
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// Dynamic File Content (dfc) - Maintain a list of files to (optionally) monitor for updates
///////////////////////////////////////////////////////////////////////////////////////////////////

class Dfc
{
	constructor(plugin, filenames, refreshFnc, fileOrderImportant, onFileRemoved)
	{
		this.plugin = plugin;

		// The callback for when monitored files have triggered a refresh
		this.refreshFnc = refreshFnc;

		// If true, changes to the file order are considered changes to the files
		this.fileOrderImportant = fileOrderImportant;

		// A callback for when files are removed from the list
		this.onFileRemoved = onFileRemoved;

		// The list of files this Dfc monitors
		this.fileData = {};

		// This var determines What need to happen to monitored files to trigger calling
		// refreshFnc.  (DfcMonitorType: None, OnModify or OnTouch).  It has a setter.
		this.monitorType = DfcMonitorType.None;

		// Maintain the current active file, so that when "active-leaf-change" hits
		// (i.e. a new active file) you can still refererence the prior active file.
		this.currentFilesName = this.plugin.app.workspace.getActiveFile()?.path ?? "";

		// Flag set when current file modified and this is monitoring changes to files
		this.currentFileWasModified = false;

		// Setup bound versions of these functions for persistent use
		this._onAnyFileModified = this.onAnyFileModified.bind(this);
		this._onActiveLeafChange = this.onActiveLeafChange.bind(this);
		this._onAnyFileAddedOrRemoved = this.onAnyFileAddedOrRemoved.bind(this);

		// Delay setting up the monitored files list, since it will trigger a refreshFnc
		// call, and refreshFnc might expect this Dfc to already be assigned to a variable,
		// which it won't be until AFTER this constructor is finished.
		setTimeout(() =>
		{
			this.updateFileList(filenames, true);
		}, 0);
	}

	destructor()
	{
		this.setMonitorType(DfcMonitorType.None);
	}

	// Setup
	setMonitorType(monitorType)
	{
		if (monitorType == this.monitorType)
		{
			return;
		}

		// At Obsidian start, some Obsidian events trigger haphazardly.  We use
		// onLayoutReady to wait to connect to the events until AFTER the random triggering
		// has passed.
		this.plugin.app.workspace.onLayoutReady(() =>
		{
			// React to old monitor type
			if (this.monitorType != DfcMonitorType.None)
			{
				this.plugin.app.vault.off(
					"modify",
					this._onAnyFileModified);
				this.plugin.app.workspace.off(
					"active-leaf-change",
					this._onActiveLeafChange);
				this.plugin.app.vault.off(
					"create",
					this._onAnyFileAddedOrRemoved);
				this.plugin.app.vault.off(
					"delete",
					this._onAnyFileAddedOrRemoved);
			}

			this.monitorType = monitorType;

			// React to new monitor type
			if (this.monitorType != DfcMonitorType.None)
			{
				this.plugin.app.vault.on(
					"modify",
					this._onAnyFileModified);
				this.plugin.app.workspace.on(
					"active-leaf-change",
					this._onActiveLeafChange);
				this.plugin.app.vault.on(
					"create",
					this._onAnyFileAddedOrRemoved);
				this.plugin.app.vault.on(
					"delete",
					this._onAnyFileAddedOrRemoved);
			}

			// Update Dfc state to monitor the active file
			this.currentFilesName =
				this.plugin.app.workspace.getActiveFile()?.path ?? "";
		});
	}

	// Monitor when the current file is modified.  If it is, turn on "active leaf changed"
	// event to handle refreshFnc call.
	onAnyFileModified(file)
	{
		// Ignore unmonitored files
		if (!this.fileData[file.path])
		{
			return;
		}

		// If current file was modified, remember to call refreshFnc when leaving the file
		// the file
		if (file.path == this.currentFilesName)
		{
			this.currentFileWasModified = true;
		}

		// If non-current file was modified, call refreshFnc immediately
		else
		{
			this.refresh(true);
		}
	}

	// Monitor when a different file becomes the active one. If the prior active file is one
	// of the files being monitored then this can trigger a refreshFnc call.
	onActiveLeafChange()
	{
		// Ignore unmonitored files
		if (this.fileData[this.currentFilesName])
		{
			// If leaving a file and it was changed, or monitorType == OnTouch, refresh
			if (this.currentFileWasModified ||
			    this.monitorType == DfcMonitorType.OnTouch)
			{
				this.refresh(true);
			}
		}

		// Update Dfc state to monitor the active file
		this.currentFileWasModified = false;
		this.currentFilesName = this.plugin.app.workspace.getActiveFile()?.path ?? "";
	}

	// Monitor when files are added to or removed from the vault. If the file is one of the
	// ones being monitored, refreshFnc is called.
	onAnyFileAddedOrRemoved(file)
	{
		// Ignore unmonitored files
		if (!this.fileData[file.path])
		{
			return;
		}

		if (this.fileData.hasOwnProperty(file.path))
		{
			this.refresh(true);
		}
	}

	// Pass in a new list of files to monitor.
	// The Dfc's current monitored files list is updated to match.
	// If this ends up changing the Dfc's list, refreshFnc called.
	// Alternately, forceRefresh being true will force refreshFnc to be called.
	updateFileList(newFileList, forceRefresh)
	{
		let hasChanged = false;

		// Synchronize this.fileData with newFileList
		for (const filename in this.fileData)
		{
			if (!newFileList.contains(filename))
			{
				if (this.onFileRemoved)
				{
					this.onFileRemoved(filename);
				}
				delete this.fileData[filename];
				hasChanged = true;
			}
		}
		for (const newFile of newFileList)
		{
			if (!this.fileData.hasOwnProperty(newFile))
			{
				this.fileData[newFile] = {
					modDate: Number.MIN_SAFE_INTEGER
				};
				if (this.fileOrderImportant)
				{
					this.fileData[newFile].ordering = -1;
				}
				hasChanged = true;
			}
		}

		// Check changes to file order
		if (this.fileOrderImportant)
		{
			for (let i = 0; i < newFileList.length; i++)
			{
				if (this.fileData[newFileList[i]].ordering != i)
				{
					this.fileData[newFileList[i]].ordering = i;
					hasChanged = true;
				}
			}
		}

		this.refresh(hasChanged || forceRefresh);
	}

	// Calls refreshFnc if warranted.  refreshFnc is the callback for when monitored files
	// require a refresh.  This calls refreshFnc either when forceRefresh is true, or if one or
	// more of the monitored files have changed (i.e. their modified date has changed).
	refresh(forceRefresh)
	{
		this.plugin.app.workspace.onLayoutReady(async () =>
		{
			let hasChanged = false;

			// If forceRefresh, then we know we're going to call refreshFnc, but we
			// still need check modified dates to keep our records up to date.
			for (const filename in this.fileData)
			{
				const file = this.plugin.app.vault.fileMap[filename];

				// If file exists...
				if (file)
				{
					// Check mod-date.  If newer then recorded, record new
					// mod-date and that refreshFnc should be called
					if (this.fileData[filename].modDate < file.stat.mtime)
					{
						this.fileData[filename].modDate = file.stat.mtime;
						hasChanged = true;
					}
				}

				// If file doesn't exist, but a valid mod-date is recorded for it,
				// invalidate mod-date and record that refreshFnc should be called
				else if (this.fileData[filename].modDate !=
				         Number.MIN_SAFE_INTEGER)
				{
					this.fileData[filename].modDate = Number.MIN_SAFE_INTEGER;
					hasChanged = true;
				}
			}

			// call refreshFnc if a file has changed, or refresh is being forced
			if ((hasChanged || forceRefresh) && this.refreshFnc)
			{
				this.refreshFnc();
			}
		});
	}
}

let DfcMonitorType =
	{ None: "None", OnModify: "OnModify", OnTouch: "OnTouch" };

///////////////////////////////////////////////////////////////////////////////////////////////////

module.exports = TextExpanderJsPlugin;
