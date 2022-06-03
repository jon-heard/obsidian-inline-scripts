"use strict";

var obsidian = require("obsidian");
var state = require("@codemirror/state");

var DEFAULT_SETTINGS =
{
	prefix: ";;",
	suffix: ";",
	hotkey: " ",
	shortcutFiles: [],
	shortcuts: [
	  {
	    regex: "^[p|P][d|D]([0-9]+)$",
	    expansion: "\"🎲 \" + Math.trunc(Math.random() * $1 + 1) + \" /\" + $1"
	  },
	  {
	    regex: "^[d|D]([0-9]+)$",
	    expansion: "\"<span style='background-color:lightblue;color:black;padding:0 .25em'>🎲 <b>\" + Math.trunc(Math.random() * $1 + 1) + \"</b> /\" + $1 + \"</span>\""
	  }
	],
	devMode: false
};
var DEFAULT_SETTINGS_MOBILE =
{
	prefix: "!!",
	suffix: "!"
};
var IS_MOBILE = false;

///////////////////////////////////////////////////////////////////////////////////////////////////

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

	MyPlugin.prototype.handleExpansionTrigger_cm5 = function(cm, keydown)
	{
		if (this.settings.hotkey == " " && event.key == this.shortcutEndCharacter)
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

	MyPlugin.prototype.getExpansion = function(text)
	{
		let expansion = "";
		for (let i = 0; i < this.shortcuts.length; i++)
		{
			let matchInfo = text.match(this.shortcuts[i].regex);
			if (!matchInfo) { continue; }

			for (let k = 1; k < matchInfo.length; k++)
			{
				expansion += "let $" + k + " = " + matchInfo[k] + ";\n";
			}
			expansion +=
				Array.isArray(this.shortcuts[i].expansion) ?
				this.shortcuts[i].expansion.join("\n") + "\n" :
				this.shortcuts[i].expansion + "\n";
			if (this.shortcuts[i].regex)
			{
				break;
			}
		}
		try
		{
			expansion = eval(expansion);
		}
		catch (e)
		{
			console.error(e);
			console.error("Malformed shortcut expansion:\n" + expansion);
			new obsidian.Notice(
				"Malformed shortcut expansion",
				8 * 1000);
			expansion = null;
		}
		return expansion;
	};

	MyPlugin.prototype.handleExpansionTrigger_cm6 = function(tr)
	{
		if (!tr.isUserEvent("input.type") || !tr.docChanged) { return tr; }

		const changes = [];
		const reverts = [];
		let newSelection = tr.selection;

		tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) =>
		{
			if (inserted.text[0] != this.shortcutEndCharacter) { return; }

			let lineIndex = tr.newDoc.lineAt(fromA).number - 1;
			let lineText = tr.newDoc.text[lineIndex];
			let prefixIndex = lineText.lastIndexOf(this.settings.prefix, fromA);
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
			const insertionPoint = fromA - replacementLength;
			const reversionPoint = fromB - replacementLength;
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

	MyPlugin.prototype.setupShortcuts = function()
	{
		this.shortcuts = this.settings.shortcuts.slice();
		for (let key in this.shortcutDfc.files)
		{
			if (this.shortcutDfc.files[key].content == null)
			{
				new obsidian.Notice("Missing shortcut file\n" + key, 8 * 1000);
				continue;
			}
			try
			{
				let newShortcuts = JSON.parse(this.shortcutDfc.files[key].content);
				this.shortcuts = this.shortcuts.concat(newShortcuts);
			}
			catch (e)
			{
				console.error(e);
				new obsidian.Notice( "Malformed shortcut file\n" + key, 8 * 1000);
			}
		}
	};

	function MyPlugin()
	{
		let result = _super !== null && _super.apply(this, arguments) || this;

		IS_MOBILE = this.app.isMobile;
		if (IS_MOBILE)
		{
			DEFAULT_SETTINGS = Object.assign(DEFAULT_SETTINGS, DEFAULT_SETTINGS_MOBILE);
		}

		this._handleExpansionTrigger_cm5 = this.handleExpansionTrigger_cm5.bind(this);
		this.registerCodeMirror(this.refreshCodeMirrorState.bind(this));

		this.shortcuts = [];

		this.settings = null;
		this.addSettingTab(new MySettings(this.app, this));

		this.storeTransaction = state.StateEffect.define();

		return result;
	}

	MyPlugin.prototype.onload = async function()
	{
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.shortcutEndCharacter =
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
			let regexUi = n.createEl("input", { cls: "shortcut-regex" });
				regexUi.setAttr("type", "text");
				regexUi.setAttr("placeholder", "Shortcut (regex)");
			let deleteUi = n.createEl("button", { cls: "delete-button" });
				deleteUi.onclick = shortcutDeleteButtonClicked.bind(n);
			let expansionUi = n.createEl("textarea", { cls: "shortcut-expansion" });
				expansionUi.setAttr("placeholder", "Expansion (javascript)");
			if (shortcut)
			{
				regexUi.value = shortcut.regex;
				expansionUi.value = shortcut.expansion;
			}
		};
		for (let i = 0; i < this.tmpSettings.shortcuts.length; i++)
		{
			addShortcutUi(this.tmpSettings.shortcuts[i]);
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
		this.tmpSettings.shortcuts = [];
		for (let i = 0; i < this.shortcutUis.childNodes.length; i++)
		{
			let shortcutUi = this.shortcutUis.childNodes[i];
			if (shortcutUi.childNodes[2].value)
			{
				this.tmpSettings.shortcuts.push({
					regex: shortcutUi.childNodes[0].value,
					expansion: shortcutUi.childNodes[2].value
				});
			}
		}

		// Shortcuts refresh
		let force =
			(this.plugin.settings.shortcuts.length !=
				this.tmpSettings.shortcuts.length);
		if (!force)
		{
			for (let i = 0; i < this.tmpSettings.shortcuts.length; i++)
			{
				if (this.tmpSettings.shortcuts[i].regex !=
				    this.plugin.settings.shortcuts[i].regex ||
				    this.tmpSettings.shortcuts[i].expansion !=
				    this.plugin.settings.shortcuts[i].expansion)
				{
					force = true;
					break;
				}
			}
		}
		dfc.updateFileList(
			this.plugin.shortcutDfc, this.tmpSettings.shortcutFiles, force);

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
		this.plugin.shortcutEndCharacter =
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
		if (dfc.hasEditorSaved)
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

	refreshInstance: async function(instance, force)
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
						content: await dfc.plugin.app.vault.read(file)
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
	}
};

///////////////////////////////////////////////////////////////////////////////////////////////////

module.exports = MyPlugin;
