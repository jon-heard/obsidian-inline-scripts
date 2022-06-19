"use strict";

const obsidian = require("obsidian");
const state = require("@codemirror/state");

// This is not available when on mobile, but the
// code that uses this is also blocked when on mobile.
const childProcess = require("child_process");

const DEFAULT_SETTINGS =
{
	shortcutFiles: [],
	shortcuts:
		"~~\ngreet\n~~\nreturn \"Hello.  How are you?\";\n\n" +
		"~~\n^date$\n~~\nreturn new Date().toLocaleDateString();\n\n" +
		"~~\n^time$\n~~\nreturn new Date().toLocaleTimeString();\n\n" +
		"~~\n^datetime$\n~~\nreturn new Date().toLocaleString();\n\n" +
		"~~\n~~\nfunction roll(max) { return Math.trunc(Math.random() * max + 1); }\n\n" +
		"~~\n^[d|D]([0-9]+)$\n~~\nreturn \"🎲 \" + roll($1) + \" /D\" + $1;\n\n" +
		"~~\n^[f|F][d|D]([0-9]+)$\n~~\nreturn \"<span style='background-color:lightblue;color:black;padding:0 .25em'>🎲 <b>\" + roll($1) + \"</b> /D\" + $1 + \"</span>\";\n\n" +
		"~~\n^([0-9]*)[d|D]([0-9]+)(|(?:\\+[0-9]+)|(?:\\-[0-9]+))$\n~~\n$1 = Number($1) || 1;\nlet result = 0;\nlet label = \"D\" + $2;\nif ($1 > 1) { label += \"x\" + $1; }\nfor (let i = 0; i < $1; i++) { result += roll($2); }\nif ($3) {\n\tif ($3.startsWith(\"+\")) {\n\t\tresult += Number($3.substr(1));\n\t} else {\n\t\tresult -= Number($3.substr(1));\n\t}\n\tlabel += $3;\n}\nif (isNaN(label.substr(1))) { label = \"(\" + label + \")\"; }\nreturn \"🎲 \" + result + \" /\" + label;\n\n"
	,
	prefix: ";;",
	suffix: ";",
	allowExternal: false,
	devMode: false
};
const DEFAULT_SETTINGS_MOBILE =
{
	prefix: "!!",
	suffix: "!"
};
const LONG_NOTE_TIME = 8 * 1000;

// These are set when the plugin starts
let IS_MOBILE = false;
let IS_WINDOWS = false;

Object.freeze(DEFAULT_SETTINGS);
Object.freeze(DEFAULT_SETTINGS_MOBILE);

///////////////////////////////////////////////////////////////////////////////////////////////////

// Boilerplate code (coming from typescript)
const extendStatics = function(d, b)
{
	const extendStatics =
		Object.setPrototypeOf ||
		({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
		function (d, b)
		{
			for (let p in b)
				if (Object.prototype.hasOwnProperty.call(b, p))
					d[p] = b[p];
		};
	return extendStatics(d, b);
};
const __extends = function(d, b)
{
	extendStatics(d, b);
	function __() { this.constructor = d; }
	d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};

///////////////////////////////////////////////////////////////////////////////////////////////////

const TextExpanderJsPlugin = (function(_super)
{
	__extends(TextExpanderJsPlugin, _super);
	function TextExpanderJsPlugin()
	{
		return _super !== null && _super.apply(this, arguments) || this;
	}
	TextExpanderJsPlugin.prototype.saveSettings = function() { this.saveData(this.settings); };

	TextExpanderJsPlugin.prototype.onload = async function()
	{
		// Determine platform
		IS_MOBILE = this.app.isMobile;
		IS_WINDOWS = navigator.appVersion.contains("Windows");

		// Load settings
		const currentDefaultSettings =
			IS_MOBILE ?
			Object.assign({}, DEFAULT_SETTINGS, DEFAULT_SETTINGS_MOBILE) :
			DEFAULT_SETTINGS;
		this.settings = Object.assign({}, currentDefaultSettings, await this.loadData());

		// Now that settings are loaded, track the suffix's finishing character
		this.suffixEndCharacter =
			this.settings.suffix.charAt(this.settings.suffix.length - 1);

		// Attach settings UI
		this.addSettingTab(new TextExpanderJsPluginSettings(this.app, this));

		//Setup bound versons of these function for persistant use
		this._cm5_handleExpansionTrigger = this.cm5_handleExpansionTrigger.bind(this);
		this._handleExpansionError = this.handleExpansionError.bind(this);
		this._getExpansion = this.getExpansion.bind(this);
		this._runExternal = this.runExternal.bind(this);

		// Setup a dfc to monitor shortcut-file notes.
		dfc.setup(this);
		this.shortcutDfc = dfc.create(
			this.settings.shortcutFiles, this.setupShortcuts.bind(this),
			this.settings.devMode);

		// Connect "code mirror 5" instances to this plugin
		this.registerCodeMirror(
			cm => cm.on("keydown", this._cm5_handleExpansionTrigger));

		// Setup "code mirror 6" editor extension management
		this.storeTransaction = state.StateEffect.define();
		this.registerEditorExtension([
			state.EditorState.transactionFilter.of(
				this.cm6_handleExpansionTrigger.bind(this))
		]);

		// This keeps track of multiple expansion error handlers for nested expansions
		this.expansionErrorHandlerStack = [];

		// Log starting the plugin
		console.log(this.manifest.name + " (" + this.manifest.version + ") loaded");
	};

	TextExpanderJsPlugin.prototype.onunload = function()
	{
		// Disconnect "code mirror 5" instances from this plugin
		this.app.workspace.iterateCodeMirrors(
			cm => cm.off("keydown", this._cm5_handleExpansionTrigger));

		// Log ending the plugin
		console.log(this.manifest.name + " (" + this.manifest.version + ") unloaded");
	};


	// CM5 - React to key-down by checking for a shortcut at the caret
	TextExpanderJsPlugin.prototype.cm5_handleExpansionTrigger = function(cm, keydown)
	{
		if (event.key == this.suffixEndCharacter)
		{
			// Delay logic by a frame to allow key event to finish processing first
			setTimeout(() =>
			{
				const shortcutPosition = this.cm5_parseShortcutPosition(cm);
				if (shortcutPosition)
				{
					this.cm5_expandShortcutPosition(cm, shortcutPosition);
				}
			}, 0);
		}
	};

	// CM5 - If caret is on a shortcut, return start and end positions, else return null
	TextExpanderJsPlugin.prototype.cm5_parseShortcutPosition = function(cm)
	{
		const cursor = cm.getCursor();
		let result = { lineIndex: cursor.line, prefixIndex: -1, suffixIndex: -1 };
		const lineText = cm.getLine(cursor.line);
		result.prefixIndex = lineText.lastIndexOf(this.settings.prefix, cursor.ch);
		result.suffixIndex = lineText.indexOf(
			this.settings.suffix,
			result.prefixIndex + this.settings.prefix.length);
		if ((result.suffixIndex + this.settings.suffix.length) < cursor.ch)
		{
			result.suffixIndex = -1;
		}
		if (result.prefixIndex == -1 || result.suffixIndex == -1) { result = null; }
		return result;
	};

	// CM5 - Expand a shortcut based on its start/end positions
	TextExpanderJsPlugin.prototype.cm5_expandShortcutPosition = function(cm, shortcutPosition)
	{
		// Find and use the right shortcuts
		const sourceText = cm.getLine(shortcutPosition.lineIndex).substring(
			shortcutPosition.prefixIndex + this.settings.prefix.length,
			shortcutPosition.suffixIndex);
		const expansionText = this.getExpansion(sourceText, true);
		if (expansionText === null) { return; }
		if (Array.isArray(expansionText)) { expansionText = expansionText.join(""); }
		cm.replaceRange(
			expansionText,
			{ line: shortcutPosition.lineIndex,
			  ch: shortcutPosition.prefixIndex },
			{ line: shortcutPosition.lineIndex,
			  ch: shortcutPosition.suffixIndex +
			      this.settings.suffix.length });
	};

	// CM6 - Handle shortcut expansion for codemirror 6 (newer editor and mobile platforms)
	TextExpanderJsPlugin.prototype.cm6_handleExpansionTrigger = function(tr)
	{
		// Only bother with key inputs that have changed the document
		if (!tr.isUserEvent("input.type") || !tr.docChanged) { return tr; }

		// Maintain all changes, all reverts and final selection
		let changes = [];
		let reverts = [];
		let newSelection = tr.selection;

		// Go over each change made to the document
		tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) =>
		{
			// Only bother processing if the shortcut suffix's end character was hit
			if (inserted.text[0] != this.suffixEndCharacter) { return; }

			// Line number of change
			let lineIndex = tr.newDoc.lineAt(fromA).number - 1;

			// Get text of the line with the change
			let lineText = this.cm6_getLineFromDoc(tr.newDoc, lineIndex);
			if (!(typeof lineText === "string"))
			{
				console.error(
					"Text Expander JS: CM6: line " +
					lineIndex + " not available.");
				return;
			}

			// Work out typed shortcut's bounding indices
			const lineStart = tr.newDoc.lineAt(fromA).from;
			const prefixIndex =
				lineText.lastIndexOf(this.settings.prefix, fromA - lineStart + 1);
			const suffixIndex = lineText.indexOf(
				this.settings.suffix,
				prefixIndex + this.settings.prefix.length);

			// If we couldn't find bounding indices, we're not on a shortcut
			if (prefixIndex == -1 || suffixIndex == -1) { return; }

			// Original typed shortcut (including prefix and suffix)
			const originalText = lineText.substring(
				prefixIndex,
				suffixIndex + this.settings.suffix.length);

			// Get the shortcut's Expansion result
			let expansionText = originalText.substring(
				this.settings.prefix.length,
				originalText.length - this.settings.suffix.length);
			expansionText = this.getExpansion(expansionText, true);
			if (expansionText === null) { return; }
			if (Array.isArray(expansionText))
			{
				expansionText = expansionText.join("");
			}

			// Add the changes and selection to growing list
			const replacementLength = originalText.length - 1;
			const insertionPoint = lineStart + prefixIndex;
			const reversionPoint = lineStart + prefixIndex;
			changes.push({
				from: insertionPoint,
				to: insertionPoint + replacementLength,
				insert: expansionText });
			reverts.push({
				from: reversionPoint,
				to: reversionPoint + expansionText.length,
				insert: originalText });
			const selectionAdjustment = originalText.length - expansionText.length;
			newSelection = state.EditorSelection.create(newSelection.ranges.map((r) =>
				state.EditorSelection.range(
					r.anchor - selectionAdjustment,
					r.head - selectionAdjustment)));
		}, false);

		// If we had changes, send them in to take effect
		if (changes.length)
		{
			return [{
				effects: this.storeTransaction.of({
					effects: this.storeTransaction.of(null),
					selection: tr.selection,
					scrollIntoView: tr.scrollIntoView,
					changes: reverts,
				}),
				selection: newSelection,
				scrollIntoView: tr.scrollIntoView,
				changes: changes,
			}];
		}
		// ... else do the default
		else
		{
			return tr;
		}
	};

	// CM6 - Get a line of text from the given document
	TextExpanderJsPlugin.prototype.cm6_getLineFromDoc = function(doc, lineIndex)
	{
		// A given doc can either have a "text", or "children" attribute.  .text is
		// a list of text lines it contains.  .children is the list of docs it
		// contains, each of which can either have a "text" or "children" attribute.
		if (doc.hasOwnProperty("text"))
		{
			if (doc.text.length > lineIndex)
			{
				return doc.text[lineIndex];
			}
			else
			{
				return lineIndex - doc.text.length;
			}
		}
		else if (doc.hasOwnProperty("children"))
		{
			for (let i = 0; i < doc.children.length; i++)
			{
				let result = this.cm6_getLineFromDoc(doc.children[i], lineIndex);
				if (typeof result === "string")
				{
					return result;
				}
				else
				{
					lineIndex = result;
				}
			}
			return lineIndex;
		}
		return lineIndex;
	};

	// Take a shortcut string and return the proper Expansion string.
	// WARNING: user-facing function
	TextExpanderJsPlugin.prototype.getExpansion = function(text,  isUserTriggered)
	{
		if (!text) { return; }
		let foundMatch = false;
		let expansionText = "";
		for (let i = 0; i < this.shortcuts.length; i++)
		{
			const matchInfo = text.match(this.shortcuts[i].test);
			if (!matchInfo) { continue; }

			// Helper block (empty shortcut) erases helper scripts before it
			if (!this.shortcuts[i].test && !this.shortcuts[i].expansion)
			{
				expansionText = "";
				continue;
			}

			// Translate regex groups into variables
			for (let k = 1; k < matchInfo.length; k++)
			{
				expansionText +=
					"var $" + k + " = \"" +
					matchInfo[k].replaceAll("\"", "\\\"") + "\";\n";
			}

			// Add the shortcut's Expansion string to the total Expanson script
			expansionText += this.shortcuts[i].expansion + "\n";

			// If not a helper script, stop scanning shortcuts, we're done
			if (this.shortcuts[i].test.source != "(?:)")
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
			console.warn("Shortcut unidentified: \"" + text + "\"");
			new obsidian.Notice("ERROR: Shortcut unidentified:\n" + text);
		}

		return expansionText;
	};

	// Runs an expansion script, including error handling.
	// NOTE: Error handling is being done through window "error" event, rather than through
	// exceptions.  This is because exceptions don't provide error line numbers like the error
	// event does.  Line numbers are important to create the useful "expansion failed" message.
	TextExpanderJsPlugin.prototype.runExpansionScript =
		function(expansionScript, isUserTriggered)
	{
		// Prepare for possible Expansion script error
		if (isUserTriggered)
		{
			this.expansionErrorHandlerStack = [];
			window.addEventListener("error", this._handleExpansionError);
		}
		this.expansionErrorHandlerStack.push(expansionScript);

		// Run the Expansion script
		// Pass getExpansion function and isUserTriggered flag for use in Expansion script
		let result = (new Function(
				"getExpansion", "isUserTriggered", "runExternal", expansionScript))
				(this._getExpansion, isUserTriggered, this._runExternal);

		// Clean up script error preparations (it wouldn't have got here if we'd hit one)
		this.expansionErrorHandlerStack.pop();
		if (isUserTriggered)
		{
			if (this.expansionErrorHandlerStack.length > 0)
			{
				console.error(
					"expansionErrorHandlerStack count was off by " +
					this.expansionErrorHandlerStack.length + ".\n" +
					this.expansionErrorHandlerStack.join( "\n-------\n");
				this.expansionErrorHandlerStack = [];
			}
			window.removeEventListener("error", this._handleExpansionError);
		}

		// if shortcut doesn't return anything, better to return "" than undefined
		return result || "";
	};


	// Called when something goes wrong during shortcut expansion.  Generates a useful
	// error in the console and notification popup.
	TextExpanderJsPlugin.prototype.handleExpansionError = function(e)
	{
		// Block default error handling
		e.preventDefault();

		// Insert line numbers and arrows into code
		let expansionText = this.expansionErrorHandlerStack.last();
		expansionText = expansionText.split("\n");
		for (let i = 0; i < expansionText.length; i++)
		{
			expansionText[i] = String(i+1).padStart(4, "0") + " " + expansionText[i];
		}
		expansionText.splice(e.lineno-2, 0, "-".repeat(e.colno + 4) + "^");
		expansionText.splice(e.lineno-3, 0, "-".repeat(e.colno + 4) + "v");
		expansionText = expansionText.join("\n");

		// Notify user of error
		console.error(
			"Error in Shortcut expansion: " + e.message +
			"\nline: " + (e.lineno-2) + ", column: " + e.colno + "\n" +
			"─".repeat(20) + "\n" + expansionText);
		new obsidian.Notice(
			"ERROR: shortcut expansion issues\n\n(see console for details)",
			LONG_NOTE_TIME);

		// Clean up script error preparations (now that the error is handled)
		this.expansionErrorHandlerStack = []; // Error causes nest to unwind.  Clear stack.
		window.removeEventListener("error", this._handleExpansionError);

		// Exception was thrown to bottom, bypassing editor refresh.  Force editor refresh.
		// NOTE: If undo state is added before expansion in CM6, can probably remove this.
		let editor = this.app.workspace.activeLeaf.view.editor;
		editor.setCursor(editor.getCursor());
	};

	// Parses a shortcut-file's contents and produces a list of shortcuts
	TextExpanderJsPlugin.prototype.parseShortcutList = function(filename, content, keepFencing)
	{
		content = content.split("~~").map((v) => v.trim());
		let result = [];
		let fileHasErrors = false;

		// Check for the obvious error of misnumbered "~~"
		if (!(content.length % 2))
		{
			console.error(
				"\"Misnumbered section count\" error in Shortcut-file \"" +
				filename + "\".");
			fileHasErrors = true;
		}

		// Parse each shortcut in the file
		for (let i = 1; i < content.length; i += 2)
		{
			// Test string handling
			let testRegex = null;
			if (keepFencing)
			{
				// "keepFencing" makes no sense with a RegExp object.
				// Instead, create RegExp-style-dummy to retain fence with API.
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
					console.error(
						"\"Bad Test string\" error in shortcut-file \"" +
						filename + "\"." + "  Test: " + c);
					fileHasErrors = true;
					continue;
				}
			}

			// Content string handling
			let c = content[i+1];
			// Handle the Expansion being in a javascript fenced code-block
			if (!keepFencing)
			{
				if (c.startsWith("```js") && c.endsWith("```"))
				{
					c = c.substring(5, c.length-3).trim();
				}
			}

			// Add shortcut to result
			result.push({ test: testRegex, expansion: c });
		}

		if (fileHasErrors)
		{
			new obsidian.Notice(
				"ERROR: shortcut-file issues\n" + filename +
				"\n\n(see console for details)", LONG_NOTE_TIME);
		}

		return result;
	};

	// Creates all the shortcuts based on shortcut lists from shortcut-files and settings
	TextExpanderJsPlugin.prototype.setupShortcuts = function()
	{
		// Add shortcuts defined directly in the settings
		this.shortcuts = this.parseShortcutList("Settings", this.settings.shortcuts);
		// Add a helper block to segment helper scripts
		this.shortcuts.push({});

		// Go over all shortcut-files
		for (let i = 0; i < this.settings.shortcutFiles.length; i++)
		{
			let key = this.settings.shortcutFiles[i];
			// If shortcut-file has no content, it's missing.
			if (this.shortcutDfc.files[key].content == null)
			{
				new obsidian.Notice(
					"ERROR: Missing shortcut-file\n" + key,
					LONG_NOTE_TIME);
				continue;
			}

			// Parse shortcut-file contents and add new shortcuts to list
			const content = this.shortcutDfc.files[key].content;
			const newShortcuts = this.parseShortcutList(key, content)
			this.shortcuts = this.shortcuts.concat(newShortcuts);

			// Add a helper block to segment helper scripts
			this.shortcuts.push({});

			// Look for a "setup" script to run in this shortcut-file
			for (let i = 0; i < newShortcuts.length; i++)
			{
				if (newShortcuts[i].test.source == "^tejs setup$")
				{
					this.runExpansionScript(newShortcuts[i].expansion);
				}
			}
		}

		// Get list of all "help" shortcuts in list of shortcuts
		let helpShortcuts = [];
		const helpRegex = new RegExp(/^\^(help [a-z]+)\$$/);
		for (let i = 0; i < this.shortcuts.length; i++)
		{
			if (!this.shortcuts[i].test) { continue; }
			const r = this.shortcuts[i].test.source.match(helpRegex);
			if (r)
			{
				helpShortcuts.push(r[1]);
			}
		}

		// Manually build and add generic "help" shortcut based on "help" shortcuts list
		const helpExpansion =
			"return \"These shortcuts provide detailed help:\\n" +
			(helpShortcuts.length ?
				( "- " + helpShortcuts.join("\\n- ") ) :
				"NONE AVAILABLE") +
			"\\n\\n\";"

		// Put generic "help" shortcut in line first so it can't be short-circuited
		this.shortcuts.unshift({ test: "^help$", expansion: helpExpansion });
	};

	// Passed to expansions to allow Expansion script to run of shell commands.
	// WARNING: user-facing function
	TextExpanderJsPlugin.prototype.runExternal = function(command, silentFail, dontFixSlashes)
	{
		// This is an invalid function on mobile.  Notify user and return early.
		// Might as well fail semi-silently.  No use in spamming the user with notices.
		if (IS_MOBILE)
		{
			console.error(
				"Invalid runExternal call: runExternal unavailable on mobile.\n" +
				"runExternal(\"" + command + "\")");
			return null;
		}

		// Block this function call if user hasn't turned on the "Allow external" setting
		// to explicitly allowed shortcuts to call shell commands.
		if (!this.settings.allowExternal)
		{
			console.error(
				"Unauthorized runExternal call:\n" +
				"runExternal(\"" + command + "\")\n" +
				"NOTE: You can authorize runExternal by " +
				"enabling \"Allow external\" in the settings.");
			new obsidian.Notice(
				"ERROR: Unauthorized runExternal call." +
				"\n\n(see console for details)",
				LONG_NOTE_TIME);
			return null;
		}

		// Empty commands always fail
		if (!command) { return null; }

		// Fix slashes in command on Windows
		if (IS_WINDOWS && !dontFixSlashes)
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
				console.error(
					"runExternal failed\ncurDir: " + vaultDir + "\n" +
					e.message);
				new obsidian.Notice(
					"ERROR: runExternal(\"" + command + "\")" +
					"\n\n(see console for details)",
					LONG_NOTE_TIME);
			}
			return null;
		}
	};

	return TextExpanderJsPlugin;

}(obsidian.Plugin));

///////////////////////////////////////////////////////////////////////////////////////////////////

const TextExpanderJsPluginSettings = (function(_super)
{
	__extends(TextExpanderJsPluginSettings, _super);

	function TextExpanderJsPluginSettings(app, plugin)
	{
		const result = _super !== null && _super.apply(this, arguments) || this;
		this.plugin = plugin;
		this.tmpSettings = null;
		this.errMsgContainer = null;
		this.errMsgContent = null;
		return result;
	}

	// Checks formatting settings for errors:
	//   - blank prefix or suffix
	//   - suffix contains prefix (disallowed as it messes up logic)
	// Run whenever format settings change, to show/hide error message ui
	// Also run on closing settings to determine if format settings should be reverted.
	TextExpanderJsPluginSettings.prototype.checkFormatErrs = function()
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
			this.errMsgContainer.toggleClass("tejs_errMsgContainerShown", false);
			return true;
		}
		else
		{
			this.errMsgContainer.toggleClass("tejs_errMsgContainerShown", true);
			this.errMsgContent.innerText = err;
			return false;
		}
	};


	TextExpanderJsPluginSettings.prototype.display = function()
	{
		this.tmpSettings = JSON.parse(JSON.stringify(this.plugin.settings));

		const c = this.containerEl;
		c.empty();

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
					.onClick(() =>
					{
						addShortcutFileUi();
					});
			});
		this.shortcutFileUis = c.createEl("div", { cls: "tejs_shortcutFiles" });
		this.shortcutFileUis.createEl("div", {
			text: "Red means the file does not exist.",
			cls: "setting-item-description tejs_extraMessage tejs_onSiblings"
		});
		const shortcutFileDeleteButtonClicked = function()
		{
			new ConfirmDialogBox(
				this.plugin.app,
				"Confirm removing a reference to a shortcut-file.",
				(confirmation) =>
				{
					if (confirmation)
					{
						this.assocText.remove();
						this.remove();
					}
				}).open();
		};
		const addShortcutFileUi = (text) =>
		{
			if (text) { text = text.substr(0, text.length - 3); }
			let n = this.shortcutFileUis.createEl("input", { cls: "tejs_shortcutFile" });
				n.setAttr("type", "text");
				n.setAttr("placeholder", "Filename");
				n.plugin = this.plugin;
				n.addEventListener("input", function()
				{
					const isBadInput =
						this.value &&
						!this.plugin.app.vault.fileMap[this.value+".md"]
					this.toggleClass("tejs_badInput", isBadInput);
				});
				if (text) { n.setAttr("value", text); }
				n.dispatchEvent(new Event("input"));
			let b = this.shortcutFileUis.createEl("button", { cls: "tejs_deleteButton" });
				b.plugin = this.plugin;
				b.assocText = n;
				b.onclick = shortcutFileDeleteButtonClicked.bind(b);
		};
		for (let i = 0; i < this.tmpSettings.shortcutFiles.length; i++)
		{
			addShortcutFileUi(this.tmpSettings.shortcutFiles[i]);
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
					.onClick(() =>
					{
						addShortcutUi();
					});
			})
			.addButton((button) =>
			{
				return button
					.setButtonText("Add defaults")
					.onClick(function()
					{
						let shortcuts =
							this.plugin.parseShortcutList("Settings",
							DEFAULT_SETTINGS.shortcuts, true);
						for (let i = 0;
						     i < shortcuts.length;
						     i++)
						{
							addShortcutUi(shortcuts[i]);
						}
					}.bind(this));
			});
		this.shortcutUis = c.createEl("div", { cls: "tejs_shortcuts" });
		const shortcutDeleteButtonClicked = function()
		{
			new ConfirmDialogBox(this.plugin.app, "Confirm deleting a shortcut.",
			(confirmation) =>
			{
				if (confirmation)
				{
					this.remove();
				}
			}).open();
		};
		const addShortcutUi = (shortcut) =>
		{
			let n = this.shortcutUis.createEl("div", { cls: "tejs_shortcut" });
			n.plugin = this.plugin;
			let testUi = n.createEl("input", { cls: "tejs_shortcutTest" });
				testUi.setAttr("type", "text");
				testUi.setAttr("placeholder", "Test (regex)");
			let deleteUi = n.createEl("button", { cls: "tejs_deleteButton" });
				deleteUi.onclick = shortcutDeleteButtonClicked.bind(n);
			let expansionUi = n.createEl("textarea", { cls: "tejs_shortcutExpansion" });
				expansionUi.setAttr("placeholder", "Expansion (javascript)");
			if (shortcut)
			{
				testUi.value = shortcut.test.source;
				if (testUi.value == "(?:)")
				{
					testUi.value = "";
				}
				expansionUi.value = shortcut.expansion;
			}
		};
		const shortcuts = this.plugin.parseShortcutList("Settings", this.tmpSettings.shortcuts, true);
		for (let i = 0; i < shortcuts.length; i++)
		{
			addShortcutUi(shortcuts[i]);
		}

		/////////////////////
		// SHORTCUT FORMAT //
		/////////////////////
		c.createEl("h2", { text: "Shortcut format" });
		let shortcutExample = null;
		const refreshShortcutExample = () =>
		{
			shortcutExample.innerText =
				this.tmpSettings.prefix +
				"D100" +
				this.tmpSettings.suffix;
		};
		this.errMsgContainer = c.createEl("div", { cls: "tejs_errMsgContainer" });
		const errMsgTitle = this.errMsgContainer.createEl(
			"span", { text: "ERROR", cls: "tejs_errMsgTitle" });
		this.errMsgContent = this.errMsgContainer.createEl("span");
		new obsidian.Setting(c)
			.setName("Prefix")
			.setDesc("What to type before a shortcut.")
			.addText((text) =>
			{
				return text
					.setPlaceholder("Prefix")
					.setValue(this.tmpSettings.prefix)
					.onChange((value) =>
					{
						this.tmpSettings.prefix = value;
						refreshShortcutExample();
						this.checkFormatErrs();
					});
			})
			.settingEl.toggleClass("tejs_settingBundledTop", !IS_MOBILE);
		new obsidian.Setting(c)
			.setName("Suffix")
			.setDesc("What to type after a shortcut.")
			.addText((text) =>
			{
				return text
					.setPlaceholder("Suffix")
					.setValue(this.tmpSettings.suffix)
					.onChange((value) =>
					{
						this.tmpSettings.suffix = value;
						refreshShortcutExample();
						this.checkFormatErrs();
					});
			})
			.settingEl.toggleClass("tejs_settingBundled", !IS_MOBILE);
		const exampleOuter = c.createEl("div", { cls: "setting-item" });
			exampleOuter.toggleClass("tejs_settingBundled", !IS_MOBILE);
		const exampleInfo = exampleOuter.createEl("div", { cls: "setting-item-info" });
		exampleInfo.createEl("div", { text: "Example", cls: "setting-item-name" });
		exampleInfo.createEl("div",
		{
			text: "How to write the shortcut \"D100\"",
			cls: "setting-item-description"
		});
		const exampleItemControl =
			exampleOuter.createEl("div", { cls: "setting-item-control" });
		shortcutExample = exampleItemControl.createEl("div", { cls: "tejs_labelControl" });
		refreshShortcutExample();

		////////////////////
		// OTHER SETTINGS //
		////////////////////
		c.createEl("h2", { text: "Other Settings" });
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
		if (!IS_MOBILE)
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
				.descEl.innerHTML +=
					"<div class='tejs_warning'>" +
					"WARNING: enabling this increases the " +
					"danger from malicious shortcuts</div>";
		}
	};

	// THIS is where settings are saved!
	TextExpanderJsPluginSettings.prototype.hide = function()
	{
		// Build shortcut-files list from UI
		this.tmpSettings.shortcutFiles = [];
		for (let i = 0; i < this.shortcutFileUis.childNodes.length; i++)
		{
			if (this.shortcutFileUis.childNodes[i].value)
			{
				this.tmpSettings.shortcutFiles.push(obsidian.normalizePath(
					this.shortcutFileUis.childNodes[i].value + ".md"));
			}
		}

		// Build Shortcuts string from UI
		this.tmpSettings.shortcuts = "";
		for (let i = 0; i < this.shortcutUis.childNodes.length; i++)
		{
			const shortcutUi = this.shortcutUis.childNodes[i];
			if (shortcutUi.childNodes[2].value)
			{
				this.tmpSettings.shortcuts +=
					"~~\n" + shortcutUi.childNodes[0].value + "\n~~\n" +
					shortcutUi.childNodes[2].value + "\n";
			}
		}

		// If changes to settings-based shortcuts, "force" is set
		const oldShortcuts =
			this.plugin.parseShortcutList("", this.plugin.settings.shortcuts, true);
		const newShortcuts =
			this.plugin.parseShortcutList("", this.tmpSettings.shortcuts, true);
		let force = (newShortcuts.length != oldShortcuts.length);
		if (!force)
		{
			for (let i = 0; i < newShortcuts.length; i++)
			{
				if (newShortcuts[i].test != oldShortcuts[i].test ||
				    newShortcuts[i].expansion != oldShortcuts[i].expansion)
				{
					force = true;
					break;
				}
			}
		}

		// Only keep new prefix & suffix if they have no errors
		if (!this.checkFormatErrs())
		{
			this.tmpSettings.prefix = this.plugin.settings.prefix;
			this.tmpSettings.suffix = this.plugin.settings.suffix;
		}

		// Dev mode
		this.plugin.shortcutDfc.isMonitored = this.tmpSettings.devMode;

		// Store new settings
		this.plugin.settings = this.tmpSettings;
		dfc.updateFileList(	// Must do this AFTER plugin.settings is updated
			this.plugin.shortcutDfc, this.tmpSettings.shortcutFiles, force);
		this.plugin.suffixEndCharacter =
			this.plugin.settings.suffix.charAt(this.plugin.settings.suffix.length - 1);
		this.plugin.saveSettings();
	};

	return TextExpanderJsPluginSettings;

}(obsidian.PluginSettingTab));

///////////////////////////////////////////////////////////////////////////////////////////////////

const ConfirmDialogBox = (function(_super)
{
	__extends(ConfirmDialogBox, _super);
	function ConfirmDialogBox(app, message, callback) {
		const result = _super.call(this, app) || this;
		this.message = message;
		this.callback = callback;
		return result;
	}
	ConfirmDialogBox.prototype.onOpen = function ()
	{
		this.titleEl.setText(this.message);
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
	};
	ConfirmDialogBox.prototype.onClose = function ()
	{
		this.contentEl.empty();
	};
	return ConfirmDialogBox;
}(obsidian.Modal));

///////////////////////////////////////////////////////////////////////////////////////////////////
// Dynamic File Content (dfc) - Maintain a list of files to (optionally) monitor for updates
///////////////////////////////////////////////////////////////////////////////////////////////////

const dfc = {
	instances: [],
	hasEditorSaved: false,
	plugin: null,
	currentFile: null,

	setup: function(plugin)
	{
		dfc.plugin = plugin;
		plugin.registerEvent(
			plugin.app.vault.on("modify", () => { dfc.hasEditorSaved = true; }));
		plugin.registerEvent(
			plugin.app.workspace.on("active-leaf-change", dfc.onActiveLeafChange));

		// If run on app start, active file won't be available yet
		if (plugin.app.workspace.getActiveFile())
		{
			dfc.currentFile = plugin.app.workspace.getActiveFile().path;
		}
	},

	onActiveLeafChange: function(leaf)
	{
		// In practice, it's easier to recalculate even on no changes.  This allows user to
		// see an error without needing to make token changes.
		if (dfc.hasEditorSaved || true)
		{
			for (let i = 0; i < dfc.instances.length; i++)
			{
				const instance = dfc.instances[i];
				if (instance.isMonitored &&
				    instance.files.hasOwnProperty(dfc.currentFile))
				{
					dfc.refreshInstance(dfc.instances[i]);
				}
			}
		}
		dfc.hasEditorSaved = false;
		const activeFile = leaf.workspace.getActiveFile();
		dfc.currentFile = activeFile ? activeFile.path : "";
	},

	create: function(filenames, onChangeCallback, isMonitored)
	{
		const result = {
			files: {},
			onChange: onChangeCallback,
			isMonitored: isMonitored
		};

		// Delay final steps to allow assignment of return value before refreshing
		setTimeout(() =>
		{
			dfc.updateFileList(result, filenames, true);
			dfc.instances.push(result);
		}, 0);

		return result;
	},

	updateFileList: function(instance, newFileList, force)
	{
		let hasChanged = false;
		for (let key in instance.files)
		{
			if (!newFileList.contains(key))
			{
				delete instance.files[key];
				hasChanged = true;
			}
		}
		for (let i = 0; i < newFileList.length; i++)
		{
			if (!instance.files.hasOwnProperty(newFileList[i]))
			{
				instance.files[newFileList[i]] = {
					modDate: Number.MIN_SAFE_INTEGER,
					content: null
				};
				hasChanged = true;
			}
		}
		dfc.refreshInstance(instance, hasChanged || force);
	},

	refreshInstance: function(instance, force)
	{
		dfc.plugin.app.workspace.onLayoutReady(async () =>
		{
			let hasChanged = false;

			for (let key in instance.files)
			{
				const file = dfc.plugin.app.vault.fileMap[key];
				if (file)
				{
					if (instance.files[key].modDate < file.stat.mtime || force)
					{
						instance.files[key] = {
							modDate: file.stat.mtime,
							content: await
								dfc.plugin.app.vault.read(file)
						};
					}
					hasChanged = true;
				}
				else if (instance.files[key].content)
				{
					instance.files[key].modDate = Number.MIN_SAFE_INTEGER;
					instance.files[key].content = null;
					hasChanged = true;
				}
			}

			if ((hasChanged || force) && instance.onChange)
			{
				instance.onChange(instance);
			}
		});
	}
};

///////////////////////////////////////////////////////////////////////////////////////////////////

module.exports = TextExpanderJsPlugin;
