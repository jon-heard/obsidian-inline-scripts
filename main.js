'use strict';

///////////////////////////////////////////////////////////////////////////////////////////////////

const SRC_PREFIX = ";;";
const SRC_SUFFIX = ";";
const PATTERN_FILE = "TextExpanderJs.json";
const HOTKEY = "Enter"; // "Enter"

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

var MyPlugin = (function (_super)
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
		result.prefixIndex = lineText.lastIndexOf(SRC_PREFIX, cursor.ch);
		result.suffixIndex = lineText.indexOf(SRC_SUFFIX, cursor.ch - SRC_SUFFIX.length);
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
			toExpand.prefixIndex + SRC_PREFIX.length,
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
			  ch: toExpand.suffixIndex + SRC_SUFFIX.length });
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

		return result;
	}

	MyPlugin.prototype.onload = function()
	{
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

	return MyPlugin;

}(obsidian.Plugin));

module.exports = MyPlugin;
