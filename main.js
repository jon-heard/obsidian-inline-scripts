"use strict";

///////////////////////////////////////////////////////////////////////////////////////////////////

// NOTE: The "Text Expander JS" plugin uses a custom format for shortcut-file data.  I tried using
// existing formats (json, xml, etc), but they were cumbersome for developing javascript code in.
// The chosen format is simple, readable, and allows for wrapping scripts in js-fenced-code-blocks.
// This makes it easy to write code within Obsidian which is, ultimately, my intended use-case.
//
// For a summary of the format, see here:
// https://github.com/jon-heard/obsidian-text-expander-js#tutorial-create-a-new-shortcut-file
// and here:
// https://github.com/jon-heard/obsidian-text-expander-js#development-aid-fenced-code-blocks

///////////////////////////////////////////////////////////////////////////////////////////////////

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
const INDENT = " ".repeat(4);

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

		// Now that settings are loaded, keep track of the suffix's finishing character
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

		// Log starting the plugin
		this.notifyUser("Loaded (" + this.manifest.version + ")");
	};

	TextExpanderJsPlugin.prototype.onunload = function()
	{
		// Disconnect "code mirror 5" instances from this plugin
		this.app.workspace.iterateCodeMirrors(
			cm => cm.off("keydown", this._cm5_handleExpansionTrigger));

		// Log ending the plugin
		this.notifyUser("Unloaded (" + this.manifest.version + ")");
	};


	// CM5 callback for "keydown".  Used to kick off shortcut expansion attempt
	TextExpanderJsPlugin.prototype.cm5_handleExpansionTrigger = function(cm, keydown)
	{
		if (event.key == this.suffixEndCharacter)
		{
			this.tryShortcutExpansion();
		}
	};

	// CM6 callback for editor events.  Used to kick off shortcut expansion attempt
	TextExpanderJsPlugin.prototype.cm6_handleExpansionTrigger = function(tr)
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
	};

	// Tries to get shortcut beneath caret and expand it.  setTimeout pauses for a frame to
	// give the calling event the opportunity to finish processing.  This is especially
	// important for CM5, as the typed key isn't in the editor at the time this is called.
	TextExpanderJsPlugin.prototype.tryShortcutExpansion = function() {
		setTimeout(() =>
		{
			const view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
			if (!view)
			{
				return;
			}
			const editor = view.editor;

			// Find bounds of the shortcut beneath the caret (if there is one)
			const cursor = editor.getCursor();
			const lineText = editor.getLine(cursor.line);
			const prefixIndex = lineText.lastIndexOf(this.settings.prefix, cursor.ch);
			const suffixIndex = lineText.indexOf(
				this.settings.suffix,
				prefixIndex + this.settings.prefix.length);

			// If the caret is not at a shortcut, early out
			if (prefixIndex == -1 || suffixIndex == -1 ||
			    (suffixIndex + this.settings.suffix.length) < cursor.ch)
			{
				return;
			}

			// Run the Expansion script on the shortcut under the caret
			const sourceText = lineText.substring(
				prefixIndex + this.settings.prefix.length, suffixIndex);
			let expansionText = this.getExpansion(sourceText, true);
			if (expansionText === null) { return; }

			// Handle a string array from the Expansion result
			if (Array.isArray(expansionText))
			{
				expansionText = expansionText.join("");
			}

			// Replace written shortcut with Expansion result
			editor.replaceRange(
				expansionText,
				{ line: cursor.line, ch: prefixIndex },
				{ line: cursor.line,
				  ch:   suffixIndex + this.settings.suffix.length });
		}, 0);
	}

	// Take a shortcut string and return the proper Expansion string.
	// WARNING: user-facing function
	TextExpanderJsPlugin.prototype.getExpansion = function(text,  isUserTriggered)
	{
		if (!text) { return; }
		let foundMatch = false;
		let expansionText = "";
		for (let shortcut of this.shortcuts)
		{
			const matchInfo = text.match(shortcut.test);
			if (!matchInfo) { continue; }

			// Helper-block (empty shortcut) erases helper scripts before it
			if (!shortcut.test && !shortcut.expansion)
			{
				expansionText = "";
				continue;
			}

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
			let msg = "Shortcut unidentified:\n" + INDENT + text;
			this.notifyUser(msg, "", msg, false, true);
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
	};

	// Parses a shortcut-file's contents to produce a list of shortcuts
	TextExpanderJsPlugin.prototype.parseShortcutFile = function(filename, content, keepFencing)
	{
		content = content.split("~~").map((v) => v.trim());
		let result = [];
		let fileHasErrors = false;

		// Check for the obvious error of misnumbered "~~"
		if (!(content.length % 2))
		{
			this.notifyUser(
				"In Shortcut-file \"" + filename + "\"",
				"MISNUMBERED-SECTION-COUNT-ERROR");
			fileHasErrors = true;
		}

		// Parse each shortcut in the file
		// NOTE: for compares i+1 and increments by 2, since we are using i AND i+1
		for (let i = 1; i+1 < content.length; i += 2)
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
					this.notifyUser(
						"In shortcut-file \"" + filename + "\":\n" +
						INDENT + c, "BAD-TEST-STRING-ERROR");
					fileHasErrors = true;
					continue;
				}
			}

			// Expansion string handling
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
			this.notifyUser("", "ERR", "Shortcut-file issues\n" + filename, true);
		}

		return result;
	};

	// Creates all shortcuts based on shortcut lists from shortcut-files and settings
	TextExpanderJsPlugin.prototype.setupShortcuts = function()
	{
		// Add shortcuts defined directly in the settings
		this.shortcuts = this.parseShortcutFile("Settings", this.settings.shortcuts);
		// Add a helper-block to segment helper scripts
		this.shortcuts.push({});

		// Go over all shortcut-files
		for (let filename of this.settings.shortcutFiles)
		{
			const content = this.shortcutDfc.files[filename].content;
			// If shortcut-file has no content, it's missing.
			if (content == null)
			{
				this.notifyUser(
					filename, "MISSING-SHORTCUT-FILE-ERROR",
					"Missing shortcut-file\n" + filename, false);
				continue;
			}

			// Parse shortcut-file contents and add new shortcuts to list
			const newShortcuts = this.parseShortcutFile(filename, content)
			this.shortcuts = this.shortcuts.concat(newShortcuts);

			// Add a helper-block to segment helper scripts
			this.shortcuts.push({});

			// Look for a "setup" script in this shortcut-file.  Run if found.
			for (let newShortcut of newShortcuts)
			{
				if (newShortcut.test.source == "^tejs setup$")
				{
					this.runExpansionScript(newShortcut.expansion);
				}
			}
		}

		// Get list of all "help" shortcuts in list of all shortcuts
		let helpShortcuts = [];
		const helpRegex = new RegExp(/^\^(help [_a-zA-Z0-9]+)\$$/);
		for (let shortcut of this.shortcuts)
		{
			if (!shortcut.test) { continue; }
			const r = shortcut.test.source.match(helpRegex);
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

	// This function is passed into all Expansion scripts to allow them to run shell commands
	// WARNING: user-facing function
	TextExpanderJsPlugin.prototype.runExternal = function(command, silentFail, dontFixSlashes)
	{
		if (IS_MOBILE)
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
				this.notifyUser(
					"Failed \"runExternal\" call:\n" + INDENT +
					"curDir: " + vaultDir + "\n" + INDENT +
					e.message, "RUNEXTERNAL-ERROR",
					"Failed \"runExternal\" call", true);
			}
			return null;
		}
	};

	// Adds a notification and/or a console log
	TextExpanderJsPlugin.prototype.notifyUser = function(
		consoleMessage, errorType, popupMessage, detailOnConsole, isWarning)
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
	};

	// Adds a tinted full-screen div to prevent user-input
	TextExpanderJsPlugin.prototype.addInputBlock = function()
	{
		let block = document.getElementById("tejs_inputBlock");
		if (block) { return; }

		block = document.createElement("div");
		block.id = "tejs_inputBlock";
		document.getElementsByTagName("body")[0].prepend(block);
	};

	// Removes the tinted full-screen div created by addInputBlock
	TextExpanderJsPlugin.prototype.removeInputBlock = function()
	{
		let block = document.getElementById("tejs_inputBlock");
		if (block) { block.remove(); }
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
		this.formattingErrMsgContainer = null;
		this.formattingErrMsgContent = null;
		return result;
	}

	// Checks formatting settings for errors:
	//   - blank prefix or suffix
	//   - suffix contains prefix (disallowed as it messes up logic)
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
	};


	TextExpanderJsPluginSettings.prototype.display = function()
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
					.setClass("tejs_button")
					.setButtonText("Add file reference")
					.onClick(() =>
					{
						addShortcutFileUi();
					});
			})
			.addButton((button) =>
			{
				return button
					.setClass("tejs_button")
					.setButtonText("Import full library")
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
			// Remove ".md" extension from filename
			if (text) { text = text.substr(0, text.length - 3); }

			let g = this.shortcutFileUis.createEl("div");
			let e = g.createEl(
					"input", { cls: "tejs_shortcutFile" });
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
				if (text) { e.setAttr("value", text); }
				e.dispatchEvent(new Event("input"));
			e = g.createEl("button", { cls: "tejs_upButton" });
				e.group = g;
				e.onclick = upButtonClicked;
				e.listOffset = 1;
			e = g.createEl("button", { cls: "tejs_downButton" });
				e.group = g;
				e.onclick = downButtonClicked;
			e = g.createEl("button", { cls: "tejs_deleteButton" });
				e.group = g;
				e.onclick = deleteButtonClicked;
				e.plugin = this.plugin;
				e.typeTitle = "shortcut-file";
		};
		// Add a filename ui item for each shortcut-file in settings
		for (let shortcutFile of this.tmpSettings.shortcutFiles)
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
					.setClass("tejs_button")
					.setButtonText("Add shortcut")
					.onClick(() =>
					{
						addShortcutUi();
					});
			})
			.addButton((button) =>
			{
				return button
					.setClass("tejs_button")
					.setButtonText("Add defaults")
					.onClick(function()
					{
						let defaultShortcuts =
							this.plugin.parseShortcutFile("Settings",
							DEFAULT_SETTINGS.shortcuts, true);

						// We don't want to duplicate shortcuts, and it's
						// important to keep defaults in-order.  Remove
						// any shortcuts from the ui list that are part
						// of the defaults before adding the defaults to
						// the end of the ui list.
						this.removeShortcutsFromUi(defaultShortcuts);

						for (let defaultShortcut of defaultShortcuts)
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
					if (e.value == "(?:)")
					{
						e.value = "";
					}
				}
			e = g.createEl("button", { cls: "tejs_upButton" });
				e.group = g;
				e.onclick = upButtonClicked;
				e.listOffset = 0;
			e = g.createEl("button", { cls: "tejs_downButton" });
				e.group = g;
				e.onclick = downButtonClicked;
			e = g.createEl("button", { cls: "tejs_deleteButton" });
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
		};
		const shortcuts = this.plugin.parseShortcutFile(
			"Settings", this.tmpSettings.shortcuts, true);
		// Add a shortcut ui item for each shortcut in settings
		for (let shortcut of shortcuts)
		{
			addShortcutUi(shortcut);
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
		this.formattingErrMsgContainer =
			c.createEl("div", { cls: "tejs_errMsgContainer" });
		const errMsgTitle = this.formattingErrMsgContainer.createEl(
			"span", { text: "ERROR", cls: "tejs_errMsgTitle" });
		this.formattingErrMsgContent = this.formattingErrMsgContainer.createEl("span");
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
				.descEl.createEl("div", {
					cls: "tejs_warning",
					text: "WARNING: enabling this increases the danger from " +
					      "malicious shortcuts" });
		}

		c.createEl("div", { text: this.plugin.manifest.version, cls: "tejs_version" });
	};

	// THIS is where settings are saved!
	TextExpanderJsPluginSettings.prototype.hide = function()
	{
		// Get shortcut-files list
		this.tmpSettings.shortcutFiles = this.getShortcutReferencesFromUi();

		// Build Shortcuts string from UI
		let shortcuts = this.getShortcutsFromUi();
		this.tmpSettings.shortcuts = "";
		for (let shortcut of shortcuts)
		{
			this.tmpSettings.shortcuts +=
				"~~\n" + shortcut.test + "\n" +
				"~~\n" + shortcut.expansion + "\n";
		}

		// If changes to settings-based shortcuts, "force" is set
		const oldShortcuts =
			this.plugin.parseShortcutFile("", this.plugin.settings.shortcuts, true);
		const newShortcuts =
			this.plugin.parseShortcutFile("", this.tmpSettings.shortcuts, true);
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
		dfc.updateFiles(	// Must do this AFTER plugin.settings is updated
			this.plugin.shortcutDfc, this.tmpSettings.shortcutFiles, force);
		this.plugin.suffixEndCharacter =
			this.plugin.settings.suffix.charAt(this.plugin.settings.suffix.length - 1);
		this.plugin.saveSettings();
	};

	// Get shortcut-files list from UI
	TextExpanderJsPluginSettings.prototype.getShortcutReferencesFromUi = function()
	{
		let result = [];
		for (let shortcutFileUi of this.shortcutFileUis.childNodes)
		{
			if (shortcutFileUi.childNodes[0].value)
			{
				result.push(obsidian.normalizePath(
					shortcutFileUi.childNodes[0].value + ".md"));
			}
		}
		return result;
	};

	// Get shortcuts list from UI
	TextExpanderJsPluginSettings.prototype.getShortcutsFromUi = function()
	{
		let result = [];
		for (let shortcutUi of this.shortcutUis.childNodes)
		{
			if (shortcutUi.childNodes[4].value)
			{
				result.push({
					test: shortcutUi.childNodes[0].value,
					expansion: shortcutUi.childNodes[4].value
				});
			}
		}
		return result;
	}

	// Takes a list of shortcuts, and removes them from the ui list, if they are there
	TextExpanderJsPluginSettings.prototype.removeShortcutsFromUi = function(shortcuts)
	{
		let toRemove = [];
		for (let shortcutUi of this.shortcutUis.childNodes)
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
		for (let shortcutUi of toRemove)
		{
			shortcutUi.remove();
		}
	}

	// Called when user clicks "Import full library" button and accepting confirmation
	TextExpanderJsPluginSettings.prototype.importFullLibrary = async function()
	{
		const ADDRESS_REMOTE =
			"https://raw.githubusercontent.com/jon-heard/" +
			"obsidian-text-expander-js_shortcutFileLibrary/main";
		const ADDRESS_LOCAL = "tejs";
		const FILE_README = "README.md";

		// Need to manually disable input until this process is finished
		// (due to asynchronous downloading not blocking it)
		this.plugin.addInputBlock();

		// Get shortcut-file list from library readme
		let shortcutFiles = await request({
			url: ADDRESS_REMOTE + "/" + FILE_README,
			method: "GET", cache: "no-cache"
		});
		shortcutFiles =
			shortcutFiles.match(/### tejs_[_a-zA-Z0-9]+\n/g).
			map(s => s.substring(4, s.length-1));

		// Figure out library destination.  By default this is ADDRESSS_LOCAL.
		// However, if all shortcut-file references in the settings that match files in
		// the library are in a single folder, ask user if they want to use that folder
		// instead of the default library destination.
		let shortcutReferences = this.getShortcutReferencesFromUi();
		let shortcutReferenceFilenames =
			shortcutReferences.map(s => s.substring(s.lastIndexOf("/")+1, s.length-3));
		let shortcutReferencePaths = shortcutReferences.map((s,i) =>
		{
			return s.substring(0, s.length-shortcutReferenceFilenames[i].length-4)
		});
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
				commonPath + "\".<br/>Would you like to import the library " +
				"into \"" +commonPath + "\"?<br/>If not, the library will be " +
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

		// Readd input block if it was disabled for confirm dialog
		this.plugin.addInputBlock();

		// Create library destination folder if necessary
		if (!app.vault.fileMap.hasOwnProperty(libraryDestination))
		{
			this.plugin.app.vault.createFolder(libraryDestination);
		}

		// Download and create library files
		for (let shortcutFile of shortcutFiles)
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

		// Add references shortcut-files in settings
		for (let shortcutFile of shortcutFiles)
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
		// Using innerHTML to allow <br/> linebreaks in confirm message
		this.titleEl.innerHTML = this.message;

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
			for (let dcfInstance of dfc.instances)
			{
				const instance = dfcInstance;
				if (instance.isMonitored &&
				    instance.files.hasOwnProperty(dfc.currentFile))
				{
					dfc.refreshInstance(dfcInstance);
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
			dfc.updateFiles(result, filenames, true);
			dfc.instances.push(result);
		}, 0);

		return result;
	},

	updateFiles: function(instance, newFileList, force)
	{
		let hasChanged = false;
		for (let filename in instance.files)
		{
			if (!newFileList.contains(filename))
			{
				delete instance.files[filename];
				hasChanged = true;
			}
		}
		for (let newFile of newFileList)
		{
			if (!instance.files.hasOwnProperty(newFile))
			{
				instance.files[newFile] = {
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

			for (let filename in instance.files)
			{
				const file = dfc.plugin.app.vault.fileMap[filename];
				if (file)
				{
					if (instance.files[filename].modDate < file.stat.mtime ||
					    force)
					{
						instance.files[filename] = {
							modDate: file.stat.mtime,
							content: await
								dfc.plugin.app.vault.read(file)
						};
					}
					hasChanged = true;
				}
				else if (instance.files[filename].content)
				{
					instance.files[filename].modDate = Number.MIN_SAFE_INTEGER;
					instance.files[filename].content = null;
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
