"use strict";

var obsidian = require("obsidian");
var state = require("@codemirror/state");

var DEFAULT_SETTINGS =
{
	prefix: ";;",
	suffix: ";",
	hotkey: " ",
	shortcutFiles: [],
	shortcuts:
		"~~\n~~\nfunction roll(max) { return Math.trunc(Math.random() * max + 1); }\n\n" +
		"~~\n^[d|D]([0-9]+)$\n~~\nreturn \"🎲 \" + roll($1) + \" /\" + $1;\n\n" +
		"~~\n^[f|F][d|D]([0-9]+)$\n~~\nreturn \"<span style='background-color:lightblue;color:black;padding:0 .25em'>🎲 <b>\" + roll($1) + \"</b> /\" + $1 + \"</span>\";\n"
	,
	devMode: false
};
var DEFAULT_SETTINGS_MOBILE =
{
	prefix: "!!",
	suffix: "!"
};
var IS_MOBILE = false;	// NOTE: this is set automatically during code execution

///////////////////////////////////////////////////////////////////////////////////////////////////

// Boilerplate code (coming from typescript)
var extendStatics = function(d, b)
{
	extendStatics =
		Object.setPrototypeOf ||
		({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
		function (d, b)
		{
			for (var p in b)
				if (Object.prototype.hasOwnProperty.call(b, p))
					d[p] = b[p];
		};
	return extendStatics(d, b);
};
function __extends(d, b)
{
	extendStatics(d, b);
	function __() { this.constructor = d; }
	d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

///////////////////////////////////////////////////////////////////////////////////////////////////

var MyPlugin = (function(_super)
{
	__extends(MyPlugin, _super);

	// React to key-down by checking for a shortcut at the caret
	MyPlugin.prototype.handleExpansionTrigger_cm5 = function(cm, keydown)
	{
		// React to key-down of shortcut suffix's final key
		if (this.settings.hotkey == " " && event.key == this.suffixEndCharacter)
		{
			// Delay logic by a frame to allow key event to finish processing first
			setTimeout(() =>
			{
				let shortcutPosition = this.parseShortcutPosition(cm);
				if (shortcutPosition)
				{
					this.expandShortcut(cm, shortcutPosition);
				}
			}, 0);
		}
		// React to user-determined hotkey to expand a shortcut
		else if (this.settings.hotkey != " " && event.key == this.settings.hotkey)
		{
			let shortcutPosition = this.parseShortcutPosition(cm);
			if (shortcutPosition)
			{
				event.preventDefault();
				this.expandShortcut(cm, shortcutPosition);
			}
		}
	};

	// If a shortcut is at the caret, return its start and end positions, else return null
	MyPlugin.prototype.parseShortcutPosition = function(cm)
	{
		let cursor = cm.getCursor();
		let result = { lineIndex: cursor.line, prefixIndex: -1, suffixIndex: -1 };
		let lineText = cm.getLine(cursor.line);
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

	// Expand a shortcut based on its start/end positions
	MyPlugin.prototype.expandShortcut = function(cm, shortcutPosition)
	{
		// Find and use the right shortcuts
		let text = cm.getLine(shortcutPosition.lineIndex).substring(
			shortcutPosition.prefixIndex + this.settings.prefix.length,
			shortcutPosition.suffixIndex);
		let expansion = this.getExpansion(text);
		if (expansion)
		{
			cm.replaceRange(
				expansion,
				{ line: shortcutPosition.lineIndex,
				  ch: shortcutPosition.prefixIndex },
				{ line: shortcutPosition.lineIndex,
				  ch: shortcutPosition.suffixIndex +
				      this.settings.suffix.length });
		}
	};

	// Take a shortcut string and return the proper expansion string
	MyPlugin.prototype.getExpansion = function(text)
	{
		let expansion = "";
		for (let i = 0; i < this.shortcuts.length; i++)
		{
			let matchInfo = text.match(this.shortcuts[i].test);
			if (!matchInfo) { continue; }

			for (let k = 1; k < matchInfo.length; k++)
			{
				expansion +=
					"let $" + k + " = \"" +
					matchInfo[k].replaceAll("\"", "\\\"") + "\";\n";
			}
			expansion += this.shortcuts[i].expansion + "\n";
			if (this.shortcuts[i].test)
			{
				break;
			}
		}
		this._expansion = expansion;
		window.addEventListener('error', this._handleExpansionError);
		expansion = Function(expansion)();
		window.removeEventListener('error', this._handleExpansionError);
		this._expansion = null;
		if (expansion === undefined)
		{
			console.warn("Shortcut text unidentified: \"" + text + "\"");
			new obsidian.Notice("Shortcut text unidentified:\n" + text);
		}
		return expansion;
	};

	// Handle shortcut expansion for codemirror 6 (newer editor and mobile platforms)
	MyPlugin.prototype.handleExpansionTrigger_cm6 = function(tr)
	{
		if (!tr.isUserEvent("input.type") || !tr.docChanged) { return tr; }

		const changes = [];
		const reverts = [];
		let newSelection = tr.selection;

		tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) =>
		{
			if (inserted.text[0] != this.suffixEndCharacter) { return; }

			let lineIndex = tr.newDoc.lineAt(fromA).number - 1;
			let lineText = null;
			if (tr.newDoc.hasOwnProperty("text"))
			{
				lineText = tr.newDoc.text[lineIndex];
			}
			else if (tr.newDoc.hasOwnProperty("children"))
			{
				let i = 0;
				while (lineIndex >= tr.newDoc.children[i].text.length)
				{
					lineIndex -= tr.newDoc.children[i].text.length;
					i++;
				}
				lineText = tr.newDoc.children[i].text[lineIndex];
			}
			if (lineText === null)
			{
				console.error(
					"Text Expander JS: CM6: newDoc has no text or children.");
			}
			let lineStart = tr.newDoc.lineAt(fromA).from;
			let prefixIndex =
				lineText.lastIndexOf(this.settings.prefix, fromA - lineStart + 1);
			let suffixIndex = lineText.indexOf(
				this.settings.suffix,
				prefixIndex + this.settings.prefix.length);
			if (prefixIndex == -1 || suffixIndex == -1) { return; }

			const original = lineText.substring(
				prefixIndex,
				suffixIndex + this.settings.suffix.length);
			let expansion = original.substring(
				this.settings.prefix.length,
				original.length - this.settings.suffix.length);
			expansion = this.getExpansion(expansion);
			if (!expansion) { return; }

			const replacementLength = original.length - 1;
			const insertionPoint = lineStart + prefixIndex;
			const reversionPoint = lineStart + prefixIndex;
			changes.push({
				from: insertionPoint,
				to: insertionPoint + replacementLength,
				insert: expansion });
			reverts.push({
				from: reversionPoint,
				to: reversionPoint + expansion.length,
				insert: original });
			const selectionAdjustment = original.length - expansion.length;
			newSelection = state.EditorSelection.create(newSelection.ranges.map((r) =>
				state.EditorSelection.range(
					r.anchor - selectionAdjustment,
					r.head - selectionAdjustment)));
		}, false);

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
		else
		{
			return tr;
		}
	};

	// Called when something goes wrong during shortcut expansion.  Generates a useful
	// error in the console and notification popup.
	MyPlugin.prototype.handleExpansionError = function(e)
	{
		window.removeEventListener('error', this._handleExpansionError);
		e.preventDefault();

		// Insert line numbers and arrows into code
		this._expansion = this._expansion.split("\n");
		for (let i = 0; i < this._expansion.length; i++)
		{
			this._expansion[i] =
				String(i+1).padStart(4, '0') + " " + this._expansion[i];
		}
		this._expansion .splice(e.lineno-2, 0, "^".repeat(e.colno + 5) + "^");
		this._expansion .splice(e.lineno-3, 0, "v".repeat(e.colno + 5) + "v");
		this._expansion  = this._expansion .join("\n");

		// Notify user of error
		console.error(
			"Error in Shortcut expansion: " + e.message +
			"\nline: " + (e.lineno-2) + ", column: " + e.colno + "\n" +
			"─".repeat(20) + "\n" + this._expansion);
		new obsidian.Notice("Error in shortcut expansion", 8 * 1000);
		this._expansion = null;
	};

	// Toggle reacting to keydown events for codemirror 5 (older editors) based on plugin state
	MyPlugin.prototype.refreshCodeMirrorState = function(cm)
	{
		if (this._loaded && !cm.tejs_handled)
		{
			cm.on("keydown", this._handleExpansionTrigger_cm5);
			cm.tejs_handled = true;
		}
		else if (!this._loaded && cm.tejs_handled)
		{
			cm.off("keydown", this._handleExpansionTrigger_cm5);
			cm.tejs_handled = false;
		}
	};

	// Parses a shortcut list (found in shortcut files) and produces the shortcuts
	MyPlugin.prototype.parseShortcutList = function(filename, content)
	{
		content = content.split("~~").map((v) => v.trim());
		let result = [];
		let i = 1;
		while (i < content.length)
		{
			result.push({ test: content[i], expansion: content[i+1] });
			i += 2;
		}

		// Check for obvious error
		if (!(content.length % 2))
		{
			let shortcutList = "";
			for (let i = 0; i < result.length; i++)
			{
				shortcutList += "\n\t" + result[i].shortcut;
			}
			new obsidian.Notice("Bad shortcut file format:\n" + filename, 8 * 1000);
			console.error(
				"\"" + filename + "\" has a bad shortcut file format.\n" +
				"List of recognized shortcuts in this file:" + shortcutList);
		}

		return result;
	};

	// Creates all the shortcuts based on shortcut lists from shortcut files and settings.
	MyPlugin.prototype.setupShortcuts = function()
	{
		// Add shortcuts defined directly in the settings
		this.shortcuts = this.parseShortcutList("Settings", this.settings.shortcuts);

		for (let key in this.shortcutDfc.files)
		{
			if (this.shortcutDfc.files[key].content == null)
			{
				new obsidian.Notice("Missing shortcut file\n" + key, 8 * 1000);
				continue;
			}
			let content = this.shortcutDfc.files[key].content;
			let newShortcuts = this.parseShortcutList(key, content)
			this.shortcuts = this.shortcuts.concat(newShortcuts);
			for (let i = 0; i < newShortcuts.length; i++)
			{
				if (newShortcuts[i].test == "^tejs setup$")
				{
					this._expansion = newShortcuts[i].expansion;
					window.addEventListener(
						'error', this._handleExpansionError);
					Function(newShortcuts[i].expansion)();
					window.removeEventListener(
						'error', this._handleExpansionError);
					this._expansion = null;
				}
			}
		}

		// Search all shortcuts for the "help" shortcuts
		let helpShortcuts = [];
		let helpRegex = new RegExp(/^\^(help [a-z]+)\$$/);
		for (let i = 0; i < this.shortcuts.length; i++)
		{
			let r = this.shortcuts[i].test.match(helpRegex);
			if (r)
			{
				helpShortcuts.push(r[1]);
			}
		}

		// Manually add the generic "help" shortcut
		let helpExpansion =
			"return \"These shortcuts provide detailed help:\\n" +
			(helpShortcuts.length ?
				( "- " + helpShortcuts.join("\\n- ") ) :
				"NONE AVAILABLE") +
			"\\n\\n\";"
		this.shortcuts.unshift({ test: "^help$", expansion: helpExpansion });
	};

	// Constructor - initializes most of the member variables
	function MyPlugin()
	{
		let result = _super !== null && _super.apply(this, arguments) || this;

		IS_MOBILE = this.app.isMobile;
		if (IS_MOBILE)
		{
			DEFAULT_SETTINGS =
				Object.assign(DEFAULT_SETTINGS, DEFAULT_SETTINGS_MOBILE);
		}

		this._handleExpansionTrigger_cm5 = this.handleExpansionTrigger_cm5.bind(this);
		this.registerCodeMirror(this.refreshCodeMirrorState.bind(this));
		this._handleExpansionError = this.handleExpansionError.bind(this);

		this.shortcuts = [];

		this.settings = null;
		this.addSettingTab(new MySettings(this.app, this));

		this.storeTransaction = state.StateEffect.define();

		return result;
	}

	MyPlugin.prototype.onload = async function()
	{
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.suffixEndCharacter =
			this.settings.suffix.charAt(this.settings.suffix.length - 1);
		this.app.workspace.iterateCodeMirrors(this.refreshCodeMirrorState.bind(this));
		dfc.setup(this);
		this.shortcutDfc = dfc.create(
			this.settings.shortcutFiles, this.setupShortcuts.bind(this),
			this.settings.devMode);
		this.registerEditorExtension([
			state.EditorState.transactionFilter.of(
				this.handleExpansionTrigger_cm6.bind(this))
		]);
		this.app.workspace.iterateCodeMirrors(this.refreshCodeMirrorState.bind(this));
		console.log(this.manifest.name + " (" + this.manifest.version + ") loaded");
	};

	MyPlugin.prototype.onunload = function()
	{
		this.app.workspace.iterateCodeMirrors(this.refreshCodeMirrorState.bind(this));
		console.log(this.manifest.name + " (" + this.manifest.version + ") unloaded");
 	};

	MyPlugin.prototype.saveSettings = function()
	{
		this.saveData(this.settings);
	};

	return MyPlugin;

}(obsidian.Plugin));

///////////////////////////////////////////////////////////////////////////////////////////////////

var MySettings = (function(_super)
{
	__extends(MySettings, _super);

	function MySettings(app, plugin)
	{
		let result = _super !== null && _super.apply(this, arguments) || this;
		this.plugin = plugin;
		this.tmpSettings = null;
		this.errMsgContainer = null;
		this.errMsgContent = null;
		return result;
	}

	MySettings.prototype.checkFormatErrs = function()
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
		else if (this.tmpSettings.suffix.indexOf(this.tmpSettings.prefix) != -1)
		{
			err = "Suffix cannot contain prefix";
		}

		if (!err)
		{
			this.errMsgContainer.toggleClass("err-msg-container-shown", false);
			return true;
		}
		else
		{
			this.errMsgContainer.toggleClass("err-msg-container-shown", true);
			this.errMsgContent.innerText = err;
			return false;
		}
	};


	MySettings.prototype.display = function()
	{
		this.tmpSettings = JSON.parse(JSON.stringify(this.plugin.settings));

		var c = this.containerEl;
		c.empty();

		c.createEl("h2", { text: "Shortcut Sources" });
		new obsidian.Setting(c)
			.setName("Shortcut files")
			.setDesc("JSON files containing shortcuts to use.")
			.addButton((button) =>
			{
				return button
					.setButtonText("Add file reference")
					.onClick(() =>
					{
						addShortcutFileUi();
					});
			});
		this.shortcutFileUis = c.createEl("div", { cls: "shortcutFiles" });
		this.shortcutFileUis.createEl("div", {
			text: "Red means the file does not exist.",
			cls: "setting-item-description extraMessage onSiblings"
		});
		var shortcutFileDeleteButtonClicked = function()
		{
			new ConfirmModal(
				this.plugin.app,
				"Confirm removing a reference to a shortcut file.",
				(confirmation) =>
				{
					if (confirmation)
					{
						this.assocText.remove();
						this.remove();
					}
				}).open();
		};
		var addShortcutFileUi = (text) =>
		{
			if (text) { text = text.substr(0, text.length - 3); }
			let n = this.shortcutFileUis.createEl("input", { cls: "shortcut-file" });
				n.setAttr("type", "text");
				n.setAttr("placeholder", "Filename");
				n.plugin = this.plugin;
				n.addEventListener("input", function()
				{
					let isBadInput =
						this.value &&
						!this.plugin.app.vault.fileMap[this.value+".md"]
					this.toggleClass("badInput", isBadInput);
				});
				if (text) { n.setAttr("value", text); }
				n.dispatchEvent(new Event("input"));
			let b = this.shortcutFileUis.createEl("button", { cls: "delete-button" });
				b.plugin = this.plugin;
				b.assocText = n;
				b.onclick = shortcutFileDeleteButtonClicked.bind(b);
		};
		for (let i = 0; i < this.tmpSettings.shortcutFiles.length; i++)
		{
			addShortcutFileUi(this.tmpSettings.shortcutFiles[i]);
		}
		new obsidian.Setting(c)
			.setName("Shortcuts")
			.setDesc("Define shortcuts here (in addition to shortcut files)")
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
					.onClick(() =>
					{
						for (let i = 0;
						     i < DEFAULT_SETTINGS.shortcuts.length;
						     i++)
						{
							addShortcutUi(DEFAULT_SETTINGS.shortcuts[i]);
						}
					});
			});
		this.shortcutUis = c.createEl("div", { cls: "shortcuts" });
		var shortcutDeleteButtonClicked = function()
		{
			new ConfirmModal(this.plugin.app, "Confirm deleting a shortcut.",
			(confirmation) =>
			{
				if (confirmation)
				{
					this.remove();
				}
			}).open();
		};
		var addShortcutUi = (shortcut) =>
		{
			let n = this.shortcutUis.createEl("div", { cls: "shortcut" });
			n.plugin = this.plugin;
			let testUi = n.createEl("input", { cls: "shortcut-test" });
				testUi.setAttr("type", "text");
				testUi.setAttr("placeholder", "Test (regex)");
			let deleteUi = n.createEl("button", { cls: "delete-button" });
				deleteUi.onclick = shortcutDeleteButtonClicked.bind(n);
			let expansionUi = n.createEl("textarea", { cls: "shortcut-expansion" });
				expansionUi.setAttr("placeholder", "Expansion (javascript)");
			if (shortcut)
			{
				testUi.value = shortcut.test;
				expansionUi.value = shortcut.expansion;
			}
		};
		let shortcuts = this.plugin.parseShortcutList("Settings", this.tmpSettings.shortcuts);
		for (let i = 0; i < shortcuts.length; i++)
		{
			addShortcutUi(shortcuts[i]);
		}

		c.createEl("h2", { text: "Shortcut format" });
		var shortcutExample = null;
		var refreshShortcutExample = () =>
		{
			shortcutExample.innerText =
				this.tmpSettings.prefix +
				"D100" +
				this.tmpSettings.suffix;
		};
		this.errMsgContainer = c.createEl("div", { cls: "err-msg-container" });
		let errMsgTitle = this.errMsgContainer.createEl(
			"span", { text: "ERROR", cls: "err-msg-title" });
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
			.settingEl.toggleClass("setting-bundled-top", !IS_MOBILE);
		let t = new obsidian.Setting(c)
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
			.settingEl.toggleClass("setting-bundled", !IS_MOBILE);
		let exampleOuter = c.createEl("div", { cls: "setting-item" });
			exampleOuter.toggleClass("setting-bundled", !IS_MOBILE);
		let exampleInfo = exampleOuter.createEl("div", { cls: "setting-item-info" });
		exampleInfo.createEl("div", { text: "Example", cls: "setting-item-name" });
		exampleInfo.createEl("div",
		{
			text: "How to write the shortcut \"D100\"",
			cls: "setting-item-description"
		});
		let exampleItemControl =
			exampleOuter.createEl("div", { cls: "setting-item-control" });
		shortcutExample = exampleItemControl.createEl("div", { cls: "labelControl" });
		refreshShortcutExample();

		c.createEl("h2", { text: "Other Settings" });
		if (!IS_MOBILE)
		{
			new obsidian.Setting(c)
				.setName("Expansion trigger")
				.setDesc("A shortcut is expanded when this happens.")
				.addDropdown((dropdown) =>
				{
					return dropdown
						.addOption("Enter", "Enter / Return key")
						.addOption("Tab", "Tab key")
						.addOption(" ", "Shortcut typed")
						.setValue(this.tmpSettings.hotkey)
						.onChange((value) =>
						{
							this.tmpSettings.hotkey = value;
						});
				});
		}
		new obsidian.Setting(c)
			.setName("Developer mode")
			.setDesc("Shortcut files are monitored for updates.")
			.addToggle((toggle) =>
			{
				return toggle
					.setValue(this.tmpSettings.devMode)
					.onChange((value) =>
					{
						this.tmpSettings.devMode = value;
					});
			});
	};

	MySettings.prototype.hide = function()
	{
		// Shortcut files
		this.tmpSettings.shortcutFiles = [];
		for (let i = 0; i < this.shortcutFileUis.childNodes.length; i++)
		{
			if (this.shortcutFileUis.childNodes[i].value)
			{
				this.tmpSettings.shortcutFiles.push(obsidian.normalizePath(
					this.shortcutFileUis.childNodes[i].value + ".md"));
			}
		}

		// Shortcut settings
		this.tmpSettings.shortcuts = "";
		for (let i = 0; i < this.shortcutUis.childNodes.length; i++)
		{
			let shortcutUi = this.shortcutUis.childNodes[i];
			if (shortcutUi.childNodes[2].value)
			{
				this.tmpSettings.shortcuts +=
					"~~\n" + shortcutUi.childNodes[0].value + "\n~~\n" +
					shortcutUi.childNodes[2].value + "\n";
			}
		}

		// Shortcuts refresh
		let oldShortcuts =
			this.plugin.parseShortcutList("", this.plugin.settings.shortcuts);
		let newShortcuts =
			this.plugin.parseShortcutList("", this.tmpSettings.shortcuts);
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

		// Format
		if (!this.checkFormatErrs())
		{
			this.tmpSettings.prefix = this.plugin.settings.prefix;
			this.tmpSettings.suffix = this.plugin.settings.suffix;
		}

		// Dev mode
		this.plugin.shortcutDfc.isMonitored = this.tmpSettings.devMode;

		// Wrapup
		this.plugin.settings = this.tmpSettings;
		dfc.updateFileList(	// Must wait to do this AFTER plugin.settings is updated
			this.plugin.shortcutDfc, this.tmpSettings.shortcutFiles, force);
		this.plugin.suffixEndCharacter =
			this.plugin.settings.suffix.charAt(this.plugin.settings.suffix.length - 1);
		this.plugin.saveSettings();
	};

	return MySettings;

}(obsidian.PluginSettingTab));

///////////////////////////////////////////////////////////////////////////////////////////////////

var ConfirmModal = (function(_super)
{
	__extends(ConfirmModal, _super);
	function ConfirmModal(app, message, callback) {
		let result = _super.call(this, app) || this;
		this.message = message;
		this.callback = callback;
		return result;
	}
	ConfirmModal.prototype.onOpen = function ()
	{
		this.titleEl.setText(this.message);
		let s = new obsidian.Setting(this.contentEl)
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
			});
		s.settingEl.style.padding = "0";
	};
	ConfirmModal.prototype.onClose = function ()
	{
		this.contentEl.empty();
	};
	return ConfirmModal;
}(obsidian.Modal));

///////////////////////////////////////////////////////////////////////////////////////////////////
// Dynamic File Content (dfc) - Maintain a list of files to (optionally) monitor for updates
///////////////////////////////////////////////////////////////////////////////////////////////////

var dfc = {
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
				let instance = dfc.instances[i];
				if (instance.isMonitored &&
				    instance.files.hasOwnProperty(dfc.currentFile))
				{
					dfc.refreshInstance(dfc.instances[i]);
				}
			}
		}
		dfc.hasEditorSaved = false;
		dfc.currentFile = leaf.workspace.getActiveFile().path;
	},

	create: function(filenames, onChangeCallback, isMonitored)
	{
		let result = {
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
			let file = dfc.plugin.app.vault.fileMap[newFileList[i]];
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
				let file = dfc.plugin.app.vault.fileMap[key];
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

module.exports = MyPlugin;
