"use strict";

var obsidian = require("obsidian");
var state = require("@codemirror/state");

const DEFAULT_SETTINGS =
{
	prefix: ";;",
	suffix: ";",
	hotkey: " ",
	shortcutFiles: [],
	shortcuts: [
	  {
	    regex: "^[p|P][d|D]([0-9]+)",
	    expansion: "\"🎲 \" + Math.trunc(Math.random() * $1 + 1) + \" /\" + $1"
	  },
	  {
	    regex: "^[d|D]([0-9]+)",
	    expansion: "\"<span style='background-color:lightblue;color:black;padding:0 .25em'>🎲 <b>\" + Math.trunc(Math.random() * $1 + 1) + \"</b> /\" + $1 + \"</span>\""
	  }
	]
};

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

	MyPlugin.prototype.handleExpansionTrigger_cm6 = function(tr)
	{
		if (!tr.isUserEvent("input.type") || !tr.docChanged)
		{
			return tr;
		}

		tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) =>
		{
			if (inserted.text[0] != this.shortcutEndCharacter) { return; }
			let result = {};
			result.lineIndex = tr.newDoc.lineAt(fromA).number - 1;
			let lineText = tr.newDoc.text[result.lineIndex];
			result.prefixIndex = lineText.lastIndexOf(this.settings.prefix, fromA);
			result.suffixIndex = lineText.indexOf(
				this.settings.suffix,
				result.prefixIndex + this.settings.prefix.length);
			if (result.prefixIndex != -1 && result.suffixIndex != -1)
			{
				console.log(lineText.substring(
					result.prefixIndex, result.suffixIndex + 1));
			}
		});

		return tr;
	};

	MyPlugin.prototype.refreshCodeMirrorState = function(cm)
	{
		if (this._loaded && !cm.tejs_handled)
		{
			console.log("keydown on");
			cm.on("keydown", this._handleExpansionTrigger_cm5);
			cm.tejs_handled = true;
		}
		else if (!this._loaded && cm.tejs_handled)
		{
			console.log("keydown off");
			cm.off("keydown", this._handleExpansionTrigger_cm5);
			cm.tejs_handled = false;
		}
	};

	MyPlugin.prototype.setupShortcuts = function()
	{
		this.shortcuts = this.settings.shortcuts.slice();
		for (let i = 0; i < this.shortcutDfc.files.length; i++)
		{
			if (this.shortcutDfc.files[i].content == null)
			{
				new obsidian.Notice(
					"Missing shortcut file\n" + this.shortcutDfc.files[i].name,
					8 * 1000);
				continue;
			}
			try
			{
				let newShortcuts =
					JSON.parse(this.shortcutDfc.files[i].content);
				this.shortcuts = this.shortcuts.concat(newShortcuts);
			}
			catch (e)
			{
				console.error(e);
				new obsidian.Notice(
					"Malformed shortcut file\n" +
					this.shortcutDfc.files[i].name,
					8 * 1000);
			}
		}
	};

	function MyPlugin()
	{
		let result = _super !== null && _super.apply(this, arguments) || this;

		this._handleExpansionTrigger_cm5 = this.handleExpansionTrigger_cm5.bind(this);
		this.registerCodeMirror(this.refreshCodeMirrorState.bind(this));

		this.shortcuts = [];

		this.settings = null;
		this.addSettingTab(new MySettings(this.app, this));

		return result;
	}

	MyPlugin.prototype.onload = async function()
	{
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.shortcutEndCharacter =
			this.settings.suffix.charAt(this.settings.suffix.length - 1);
		this.app.workspace.iterateCodeMirrors(this.refreshCodeMirrorState.bind(this));
		dfc.setup(this);
		this.shortcutDfc =
			dfc.create(this.settings.shortcutFiles, this.setupShortcuts.bind(this));
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
		this.shortcutFileUis = c.createEl("div", { cls: "shortcuts" });
		var shortcutFileDeleteButtonClicked = function()
		{
			new ConfirmModal(this.plugin.app, "Confirm removing a reference to a shortcut file.",
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
			let n = this.shortcutFileUis.createEl("input", { cls: "shortcut-file" });
				n.setAttr("type", "text");
				n.setAttr("placeholder", "Filename");
				if (text) { n.setAttr("value", text); }
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
			.settingEl.toggleClass("setting-bundled-top", true);
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
			.settingEl.toggleClass("setting-bundled", true);
		let exampleOuter = c.createEl("div", { cls: "setting-item setting-bundled" });
		let exampleInfo = exampleOuter.createEl("div", { cls: "setting-item-info" });
		exampleInfo.createEl("div", { text: "Example", cls: "setting-item-name" });
		exampleInfo.createEl("div",
		{
			text: "How to write the shortcut \"D100\"",
			cls: "setting-item-description"
		});
		shortcutExample = exampleOuter.createEl("div",
		{
			text: "", cls: "setting-item-control"
		});
		refreshShortcutExample();

		c.createEl("h2", { text: "Other Settings" });
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
					this.shortcutFileUis.childNodes[i].value));
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
			this.plugin.shortcutDfc.files.length >
			this.tmpSettings.shortcutFiles.length;
		this.plugin.shortcutDfc.files.length = this.tmpSettings.shortcutFiles.length;
		for (let i = 0; i < this.plugin.shortcutDfc.files.length; i++)
		{
			if (!this.plugin.shortcutDfc.files[i] ||
			    !this.plugin.shortcutDfc.files[i].hasOwnProperty("name") ||
			    this.plugin.shortcutDfc.files[i].name !=
			    this.tmpSettings.shortcutFiles[i])
			{
				this.plugin.shortcutDfc.files[i] =
					this.tmpSettings.shortcutFiles[i];
			}
		}
		dfc.refreshInstance(this.plugin.shortcutDfc, force);

		// Format
		if (!this.checkFormatErrs())
		{
			this.tmpSettings.prefix = this.plugin.settings.prefix;
			this.tmpSettings.suffix = this.plugin.settings.suffix;
		}

		// Wrapup
		this.plugin.settings = this.tmpSettings;
		this.shortcutEndCharacter =
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
// Dynamic File Content (dfc)
///////////////////////////////////////////////////////////////////////////////////////////////////

var dfc = {
	instances: [],
	hasEditorSaved: false,
	plugin: null,

	setup: function(plugin)
	{
		dfc.plugin = plugin;
		plugin.registerEvent(
			plugin.app.vault.on("modify", () => { dfc.hasEditorSaved = true; }));
		plugin.registerEvent(plugin.app.workspace.on("active-leaf-change", () =>
		{
			if (!dfc.hasEditorSaved) { return; }
			for (let i = 0; i < dfc.instances.length; i++)
			{
				dfc.refreshInstance(dfc.instances[i]);
			}
			dfc.hasEditorSaved = false;
		}));
	},

	create: function(filenames, onChangeCallback)
	{
		let result = { files: filenames.slice(), onChange: onChangeCallback };
		dfc.instances.push(result);
		dfc.refreshInstance(result);
		return result;
	},

	addFile: function(instance, filename)
	{
		instance.files.push(filename);
		dfc.refreshInstance(instance);
	},

	refreshInstance: async function(instance, force)
	{
		let hasChanged = !!force;

		// Setup any new files
		for (let i = 0; i < instance.files.length; i++)
		{
			if (typeof instance.files[i] === "string")
			{
				instance.files[i] =
					{ name: instance.files[i], modDate: 0, content: null };
				hasChanged = true;
			}
		}

		// Update modified files
		for (let i = 0; i < instance.files.length; i++)
		{
			let file = dfc.plugin.app.vault.fileMap[instance.files[i].name + ".md"];
			if (file)
			{
				if (force || instance.files[i].modDate < file.stat.mtime)
				{
					instance.files[i].modDate = file.stat.mtime;
					instance.files[i].content =
						await dfc.plugin.app.vault.read(file);
					hasChanged = true;
				}
			}
			else
			{
				if (instance.files[i].content != null)
				{
					instance.files[i].modDate = 0;
					instance.files[i].content = null;
					hasChanged = true;
				}
			}
		}

		// On changed
		if (hasChanged)
		{
			instance.onChange(instance);
		}
	}
};

///////////////////////////////////////////////////////////////////////////////////////////////////

module.exports = MyPlugin;
