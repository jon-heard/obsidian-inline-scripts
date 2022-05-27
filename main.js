'use strict';

///////////////////////////////////////////////////////////////////////////////////////////////////

const PATTERN_FILE = "TextExpanderJs.json";
const HOTKEY = "Enter"; // "Tab"
const DEFAULT_SETTINGS =
{
	prefix: ";;",
	suffix: ";"
}

var obsidian = require('obsidian');

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

var MyPlugin = (function(_super)
{
	__extends(MyPlugin, _super);

	MyPlugin.prototype.handleHotkey = async function(cm, keydown)
	{
		if (event.key === HOTKEY)
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
		let result = { lineIndex: cursor.line, prefixIndex: -1, postfixIndex: -1 };
		let lineText = cm.getLine(cursor.line);
		result.prefixIndex = lineText.lastIndexOf(this.settings.prefix, cursor.ch);
		result.suffixIndex = lineText.indexOf(
			this.settings.suffix,
			cursor.ch - this.settings.suffix.length);
		if (result.prefixIndex == -1 || result.suffixIndex == -1) { result = null; }
		return result;
	}

	MyPlugin.prototype.runExpander = async function(cm, toExpand)
	{
		let patterns = await this.getExpanderPatterns();
		if (!patterns)
		{
			return alert("Invalid expander patterns file\n" + PATTERN_FILE);
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
		cm.replaceRange(
			replacement,
			{ line: toExpand.lineIndex,
			  ch: toExpand.prefixIndex },
			{ line: toExpand.lineIndex,
			  ch: toExpand.suffixIndex + this.settings.suffix.length });
	};

	MyPlugin.prototype.getExpanderPatterns = async function()
	{
		let file = this.app.vault.fileMap["TextExpanderJs.json.md"];
		if (!this._patternFileModDate || this._patternFileModDate < file.stat.mtime)
		{
			let patternText = await this.app.vault.read(file);
			try
			{
				this._patterns = JSON.parse(patternText);
				this._patternFileModDate = file.stat.mtime;
			}
			catch (e)
			{
				console.error(e);
				return null;
			}
		}
		return this._patterns;
	};

	MyPlugin.prototype.refreshIsHotkeyEnabled = function()
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
				this.refreshIsHotkeyEnabled();
			}
		});

		this.settings = null;
		this.addSettingTab(new MySettings(this.app, this));

		return result;
	}

	MyPlugin.prototype.onload = async function()
	{
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this._isEnabled = true;
		this.refreshIsHotkeyEnabled();
		console.log(this.manifest.name + " (" + this.manifest.version + ") loaded");
	};

	MyPlugin.prototype.onunload = function ()
	{
		this._isEnabled = false;
		this.refreshIsHotkeyEnabled();
		console.log(this.manifest.name + " (" + this.manifest.version + ") unloaded");
 	};

	MyPlugin.prototype.saveSettings = async function()
	{
		await this.saveData(this.settings);
	};

	return MyPlugin;

}(obsidian.Plugin));

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
			this.errMsgContainer.style.display = "none";
			return true;
		}
		else
		{
			this.errMsgContainer.style.display = "";
			this.errMsgContent.innerText = err;
			return false;
		}
	};


	MySettings.prototype.display = function()
	{
		this.tmpSettings = JSON.parse(JSON.stringify(this.plugin.settings));

		var c = this.containerEl;
		c.empty();
		c.createEl("h2", { text: "Text Expander JS Settings" });

		var shortcutExample = null;
		var refreshShortcutExample = () =>
		{
			shortcutExample.innerText =
				this.tmpSettings.prefix +
				"D100" +
				this.tmpSettings.suffix;
		};

		c.createEl("h3", { text: "Shortcut format" });
		new obsidian.Setting(c)
			.setName("Prefix")
			.setDesc("What to type before a shortcut.")
			.addText((text) =>
			{
				return text
					.setPlaceholder("Prefix")
					.setValue(this.tmpSettings.prefix)
					.onChange(async (value) =>
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
					.onChange(async (value) =>
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

		this.errMsgContainer = c.createEl("div");
		this.errMsgContainer.style["background-color"] = "red";
		this.errMsgContainer.style.display = "none";
		let errMsgTitle = this.errMsgContainer.createEl("span", { text: "ERROR" });
		errMsgTitle.style["font-weight"] = "bold";
		errMsgTitle.style.margin = "0 1em";
		this.errMsgContent = this.errMsgContainer.createEl("span", { text: "Unknown error" });
	};

	MySettings.prototype.hide = async function()
	{
		if (!this.checkFormatErrs())
		{
			this.tmpSettings.prefix = this.plugin.settings.prefix;
			this.tmpSettings.suffix = this.plugin.settings.suffix;
		}
		this.plugin.settings = this.tmpSettings;
		await this.plugin.saveSettings();
	};

	return MySettings;

}(obsidian.PluginSettingTab));

module.exports = MyPlugin;
