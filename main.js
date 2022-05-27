'use strict';

const DEFAULT_SETTINGS =
{
	prefix: ";;",
	suffix: ";",
	hotkey: "Enter",
	patternFiles: [],
	cssFile: ""
}

var obsidian = require('obsidian');

///////////////////////////////////////////////////////////////////////////////////////////////////

var extendStatics = function(d, b) {
	extendStatics =
		Object.setPrototypeOf ||
		(
			{ __proto__: [] } instanceof Array &&
			function (d, b) { d.__proto__ = b; }
		) ||
		function (d, b)
		{
			for (var p in b)
				if (Object.prototype.hasOwnProperty.call(b, p))
					d[p] = b[p];
		};
	return extendStatics(d, b);
};
function __extends(d, b) {
	extendStatics(d, b);
	function __() { this.constructor = d; }
	d.prototype =
		b === null ?
		Object.create(b) :
		(__.prototype = b.prototype, new __());
}

///////////////////////////////////////////////////////////////////////////////////////////////////

var MyPlugin = (function(_super)
{
	__extends(MyPlugin, _super);

	MyPlugin.prototype.handleHotkey = async function(cm, keydown)
	{
		if (event.key === this.settings.hotkey)
		{
			let toExpand = this.getToExpand(cm);
			if (toExpand)
			{
				event.preventDefault();
				await this.runExpander(cm, toExpand);
			}
		}
	};

	MyPlugin.prototype.getToExpand = function(cm)
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
	}

	MyPlugin.prototype.runExpander = async function(cm, toExpand)
	{
		let patterns = [];
		for (let i = 0; i < this.settings.patternFiles.length; i++)
		{
			let newPatterns =
				await this.getPatternsFromFile(this.settings.patternFiles[i]);
			if (newPatterns)
			{
				patterns = patterns.concat(newPatterns);
			}
			else
			{
				new obsidian.Notice("Invalid expander patterns file\n" +
					this.settings.patternFiles[i], 8 * 1000);
			}
		}

		let text = cm.getLine(toExpand.lineIndex).substring(
			toExpand.prefixIndex + this.settings.prefix.length,
			toExpand.suffixIndex);

		// Find and use the right expander patterns
		let replacement = "";
		for (let i = 0; i < patterns.length; i++)
		{
			let result = text.match(patterns[i].regex);
			if (!result) { continue; }

			for (let k = 1; k < result.length; k++)
			{
				replacement += "let $" + k + " = " + result[k] + ";\n";
			}
			replacement +=
				Array.isArray(patterns[i].replacer) ?
				patterns[i].replacer.join("\n") + "\n" :
				patterns[i].replacer + "\n";
		}
		replacement = eval(replacement);
		if (replacement)
		{
			cm.replaceRange(
				replacement,
				{ line: toExpand.lineIndex,
				  ch: toExpand.prefixIndex },
				{ line: toExpand.lineIndex,
				  ch: toExpand.suffixIndex + this.settings.suffix.length });
		}
	};

	MyPlugin.prototype.getPatternsFromFile = async function(filename)
	{
		if (!filename) { return []; }
		let file = this.app.vault.fileMap[filename + ".md"];
		if (!file) { return null; }
		if (!this.patternFilesCache.hasOwnProperty(filename) ||
		    this.patternFilesCache[filename].modDate < file.stat.mtime)
		{
			let patternText = await this.app.vault.read(file);
			try
			{
				let patterns = JSON.parse(patternText);
				this.patternFilesCache[filename] =
					{ patterns: patterns, modDate: file.stat.mtime};
			}
			catch (e)
			{
				console.error(e);
				return null;
			}
		}
		return this.patternFilesCache[filename].patterns;
	};

	MyPlugin.prototype.refreshIsEventTrackingEnabled = function()
	{
		for (let i = 0; i < this._codeMirrors.length; i++)
		{
			if (this._isEnabled)
			{
				this._codeMirrors[i].on('keydown', this._handleHotkey);
			}
			else
			{
				this._codeMirrors[i].off('keydown', this._handleHotkey);
			}
		}
	};

	MyPlugin.prototype.refreshCss = async function()
	{
		let file = this.app.vault.fileMap[this.settings.cssFile + ".md"];
		if (!file)
		{
			if (this.cssFile.filename)
			{
				this.cssFile.filename = this.cssFile.modDate = null;
				this.cssFile.ui.innerHTML = "";
			}
		}
		else if (!this.cssFile.filename || !this.cssFile.modDate ||
		    this.cssFile.filename != this.settings.cssFile ||
		    this.cssFile.modDate < file.stat.mtime)
		{
			this.cssFile.filename = this.settings.cssFile;
			this.cssFile.modDate = file.stat.mtime;
			this.cssFile.ui.innerHTML = await this.app.vault.read(file);
		}
	};

	function MyPlugin()
	{
		let result = _super !== null && _super.apply(this, arguments) || this;

		this._isEnabled = false;

		// Create version that forces "this" to be "MyPlugin" for file access
		this._handleHotkey = this.handleHotkey.bind(this);

		this._codeMirrors = this._codeMirrors || [];
		this.registerCodeMirror((cm) =>
		{
			if (!this._codeMirrors.contains(cm))
			{
				this._codeMirrors.push(cm);
				this.refreshIsEventTrackingEnabled();
			}
		});

		this.patternFilesCache = {};

		this.settings = null;
		this.addSettingTab(new MySettings(this.app, this));

		this.cssFile = {
			filename: null,
			modDate: null,
			ui: document.createElement("style")
		};

		return result;
	}

	MyPlugin.prototype.onload = async function()
	{
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.registerMarkdownPostProcessor(this.refreshCss.bind(this));
		this.refreshCss();

		this._isEnabled = true;
		this.refreshIsEventTrackingEnabled();
		document.head.appendChild(this.cssFile.ui);
		console.log(this.manifest.name + " (" + this.manifest.version + ") loaded");
	};

	MyPlugin.prototype.onunload = function ()
	{
		this._isEnabled = false;
		this.refreshIsEventTrackingEnabled();
		document.head.removeChild(this.cssFile.ui);
		console.log(this.manifest.name + " (" + this.manifest.version + ") unloaded");
 	};

	MyPlugin.prototype.saveSettings = async function()
	{
		await this.saveData(this.settings);
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
			.setDesc("List of files containing shortcuts to use.")
			.addButton((button) =>
			{
				return button
					.setButtonText("Add file")
					.onClick(() =>
					{
						addPatternFileUi();
					});
			})
			.addButton((button) =>
			{
				return button
					.setButtonText("Remove file")
					.onClick(() =>
					{
						if (this.patternFileUis.childNodes.length > 1)
						{
							this.patternFileUis.lastChild.remove();
						}
					});
			});
		this.patternFileUis = c.createEl("div", { cls: "pattern-file-uis" });
		var addPatternFileUi = (text) =>
		{
			let t = this.patternFileUis.createEl("input", { cls: "pattern-file-ui" });
			t.setAttr("type", "text");
			t.setAttr("placeholder", "Filename");
			if (text)
			{
				t.setAttr("value", text);
			}
		};
		for (let i = 0; i < this.tmpSettings.patternFiles.length; i++)
		{
			addPatternFileUi(this.tmpSettings.patternFiles[i]);
		}
		if (this.tmpSettings.patternFiles.length <= 0)
		{
			addPatternFileUi();
		}

		c.createEl("h2", { text: "General Settings" });
		new obsidian.Setting(c)
			.setName("Expansion Hotkey")
			.setDesc("Key to expand the shortcut at the caret.")
			.addDropdown((dropdown) =>
			{
				return dropdown
					.addOption("Enter", "Enter / Return")
					.addOption("Tab", "Tab")
					.setValue(this.tmpSettings.hotkey)
					.onChange((value) =>
					{
						this.tmpSettings.hotkey = value;
					});
			});
		new obsidian.Setting(c)
			.setName("CSS File")
			.setDesc("File to load custom CSS from")
			.addText((text) =>
			{
				return text
					.setPlaceholder('Filename')
					.setValue(this.tmpSettings.cssFile)
					.onChange((value) =>
					{
						this.tmpSettings.cssFile = value;
					});
			});

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
			});
		new obsidian.Setting(c)
			.setName("Suffix")
			.setDesc("What to type after a shortcut.")
			.addText((text) =>
			{
				return text
					.setPlaceholder('Suffix')
					.setValue(this.tmpSettings.suffix)
					.onChange((value) =>
					{
						this.tmpSettings.suffix = value;
						refreshShortcutExample();
						this.checkFormatErrs();
					});
			});
		let exampleOuter = c.createEl("div", { cls: "setting-item" });
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
	};

	MySettings.prototype.hide = async function()
	{
		if (!this.checkFormatErrs())
		{
			this.tmpSettings.prefix = this.plugin.settings.prefix;
			this.tmpSettings.suffix = this.plugin.settings.suffix;
		}
		this.tmpSettings.patternFiles = [];
		for (let i = 0; i < this.patternFileUis.childNodes.length; i++)
		{
			if (this.patternFileUis.childNodes[i].value)
			{
				this.tmpSettings.patternFiles.push(obsidian.normalizePath(
					this.patternFileUis.childNodes[i].value));
			}
		}
		this.tmpSettings.cssFile = this.tmpSettings.cssFile;
		if (this.tmpSettings.cssFile)
		{
			this.tmpSettings.cssFile =
				obsidian.normalizePath(this.tmpSettings.cssFile);
		}
		this.plugin.settings = this.tmpSettings;
		this.plugin.refreshCss();
		await this.plugin.saveSettings();
	};

	return MySettings;

}(obsidian.PluginSettingTab));

///////////////////////////////////////////////////////////////////////////////////////////////////

module.exports = MyPlugin;
