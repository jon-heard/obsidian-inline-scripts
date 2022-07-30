////////////////////////////////////////////////////////////////////
// AutoComplete - Show an autocomplete ui while typing a shortcut //
////////////////////////////////////////////////////////////////////

"use strict";

import { EditorSuggest, MarkdownRenderer } from "obsidian";
import InlineScriptsPlugin from "./_Plugin";

const SUGGESTION_LIMIT = 1000;

const REGEX_SYNTAX_SPLITTER: RegExp = /(?<=\})|(?=\{)/;
const REGEX_FIRST_PARAMETER_START: RegExp = / ?\{/;

export class AutoComplete extends EditorSuggest<any>
{
	public constructor(plugin: InlineScriptsPlugin)
	{
		super(plugin.app);
		this.constructor_internal(plugin);
	}

	public onTrigger(cursor: any, editor: any): any
	{
		return this.onTrigger_internal(cursor, editor);
	}

	public getSuggestions(context: any): any
	{
		return this.getSuggestions_internal(context);
	};

	public renderSuggestion(suggestion: any, el: any): void
	{
		this.renderSuggestion_internal(suggestion, el);
	};

	selectSuggestion(suggestion: any): void
	{
		this.selectSuggestion_internal(suggestion);
	};

///////////////////////////////////////////////////////////////////////////////////////////////////

	// Keep the plugin for a few different uses
	private _plugin: InlineScriptsPlugin;
	// Keep a bound version of this method to pass into a sort method
	private _resortSyntaxes: any;
	// The original function called on a modification to an internal function
	private _forceSetSelectedItem: Function;
	// The original function called on showing the suggestion list ui
	private _open: Function;
	// The original function called on hiding the suggestion list ui
	private _close: Function;
	// A UI panel created to display the description of the currently suggested shortcut
	private _suggestionDescriptionUi: any;
	// A list of the descriptions for the currently suggested shortcuts
	private _descriptions: Array<string>;

	// Members of EditorSuggest not included in it's type definition
	private suggestions: any;
	private suggestEl: any;

	private constructor_internal(plugin: InlineScriptsPlugin)
	{
		// Plugin stored for a few different uses
		this._plugin = plugin;

		this.limit = SUGGESTION_LIMIT;

		// Keep a bound version of this method to pass into a sort method
		this._resortSyntaxes = this.resortSyntaxes.bind(this);

		// Modify original functions - forceSelectedItem, open, close
		this._forceSetSelectedItem = this.suggestions.forceSetSelectedItem.bind(this.suggestions);
		this.suggestions.forceSetSelectedItem = this.forceSelectedItem_modified.bind(this);
		this._open = this.open;
		this.open = this.open_modified;
		this._close = this.close;
		this.close = this.close_modified;

		// Get or create a new UI panel to show the description of the currently suggested shortcut
		this._suggestionDescriptionUi = document.getElementById("shortcutSuggestionDescription");
		if (!this._suggestionDescriptionUi)
		{
			plugin.app.workspace.onLayoutReady(() =>
			{
				this._suggestionDescriptionUi = document.createElement("div");
				this._suggestionDescriptionUi.id = "shortcutSuggestionDescription";
				document.querySelector(".workspace-split.mod-root").
					appendChild(this._suggestionDescriptionUi);
				this._suggestionDescriptionUi.classList.add("iscript_suggestionDescription");
			});
		}
	}

	// Called by the system to determine if auto-complete should pop up
	private onTrigger_internal(cursor: any, editor: any): any
	{
		// Keep track of the shortcut prefix and suffix
		const prefix: string = this._plugin.settings.prefix;
		const suffix: string = this._plugin.settings.suffix;

		// Get the current line of text up to the caret position
		const lineUpToCursor: string = editor.getLine(cursor.line).substring(0, cursor.ch);

		// Look for whether we are within a shortcut (after a prefix, and NOT after a suffix)
		let match: any = lineUpToCursor.match(prefix + "[^" + suffix[0] + "]*$");
		match = match?.first();

		// If we ARE within a shortcut, auto-complete should pop up
		if (match)
		{
			return {
				end: cursor,
				start:
				{
					ch: lineUpToCursor.lastIndexOf(match) + prefix.length,
					line: cursor.line,
				},
				query: match.substr(prefix.length),
			};
		}
		else
		{
			return null;
		}
	}

	// Called by the system to get a list of suggestions to display in auto-complete
	private getSuggestions_internal(context: any): any
	{
		// Get ALL shortcut syntaxes
		const result = this._plugin.syntaxes
		// Check each syntax against the query (i.e. the user's current shortcut-text)
			.map((p: any) =>
			{
				p.match = context.query.match(p.regex);
				return p;
			})
		// Filter syntaxes down to those that match the query
			.filter((p: any) =>
			{
				return p.match;
			})
		// Sort syntaxes by how much they match the query
			.sort(this._resortSyntaxes);
		// Fill the descriptions list with descriptions of the listed syntaxes
		this._descriptions = result.map((v: any) => v.description);
		return result;
	};

	// Called by the system to determine HOW to render a given suggestion
	private renderSuggestion_internal(suggestion: any, el: any): void
	{
		// Get the normal suggestion text
		let text = suggestion.text.replace("<", "&lt;");

		// If the suggestion contains parameters, try and modify the suggestion text to highlight
		// the parameter the user is currently on.
		if (suggestion.match.length > 1)
		{
			// Split the suggestion text into parts, including the parameter sections, the
			// non-parameter sections and the spaces between the sections
			const parts = text.split(REGEX_SYNTAX_SPLITTER);

			// Determine if the current shortcut-text is beyond the first part, and if it is just
			// past its current part.  If so, we should highlight the NEXT part instead of the
			// current part.
			const isPassedAParameter =
				this.context.query.startsWith(parts[0]) && this.context.query.endsWith(" ");

			// Figure out the part to higlight
			let partToHighlight = parts.length-1;
			for (let i = suggestion.match.length-1; i >= 0; i--)
			{
				let part = parts[partToHighlight];
				while (!part.startsWith("{") || !part.endsWith("}"))
				{
					partToHighlight--;
					part = parts[partToHighlight];
				}
				if (suggestion.match[i])
				{
					break;
				}
				if (!isPassedAParameter || i < suggestion.match.length-1)
				{
					partToHighlight--;
					if (partToHighlight <= 0)
					{
						break;
					}
				}
			}

			// If the part to highlight is beyond the first (i.e. past the non-parameter part), then
			// highlight that part
			if (partToHighlight > 0 || parts[partToHighlight]?.startsWith("{"))
			{
				parts[partToHighlight] =
					"<span class='iscript_suggestionHighlight'>" + parts[partToHighlight] +
					"</span>";
			}

			// Put the parts back together in the text
			text = parts.join("");
		}

		// Fill the ui with the suggestion text
		el.innerHTML = text;
	};

	// Called by the system when the user selects one of the suggestions
	private selectSuggestion_internal(suggestion: any): void
	{
		// Do nothing if this is called without any context
		if (!this.context) { return; }

		// Get the suggestion's "fill": all of the suggestion text before the first parameter
		const suggestionEndIndex: number =
			suggestion.text.match(REGEX_FIRST_PARAMETER_START)?.index ?? suggestion.text.length;
		const fill = suggestion.text.substr(0, suggestionEndIndex);

		// If the current shortcut-text doesn't yet have all the fill, set it to the fill
		if (!this.context.query.startsWith(fill))
		{
			this.context.editor.replaceRange(fill, this.context.start, this.context.end);
			this.context.start.ch += fill.length;
			this.context.editor.setCursor(this.context.start);
		}

		// The current shortcut-text already has all the fill, and the fill is all there is (no
		// parameters).  Try expanding the shortcut text.
		else if (fill === suggestion.text)
		{
			const plugin: InlineScriptsPlugin = InlineScriptsPlugin.getInstance();
			this.context.editor.replaceRange(
				plugin.settings.suffix, this.context.end, this.context.end);
			this.context.end.ch += plugin.settings.suffix.length;
			this.context.editor.setCursor(this.context.end);
			plugin.tryShortcutExpansion();
		}

		// The current shortcut-text already has all the fill, but there are parameters.  Are all
		// parameters satisfied (filled or optional)?  If so, try expanding the shortcut text.
		else
		{
			const parts = suggestion.text.split(REGEX_SYNTAX_SPLITTER);
			let parameterIndex = suggestion.match.length - 1;
			for (let i = parts.length - 1; i >= 0; i--)
			{
				if (parts[i].startsWith("{"))
				{
					// If parameter isn't fulfilled and isn't optional, end now
					if (!suggestion.match[parameterIndex] &&
					    parts[i].indexOf("optional") == -1)
					{
						break;
					}
					parameterIndex--;
				}
				if (parameterIndex == 0)
				{
					const plugin: InlineScriptsPlugin = InlineScriptsPlugin.getInstance();
					this.context.editor.replaceRange(
						plugin.settings.suffix, this.context.end, this.context.end);
					this.context.end.ch += plugin.settings.suffix.length;
					this.context.editor.setCursor(this.context.end);
					plugin.tryShortcutExpansion();
					break;
				}
			}
		}
	};

	// Used to sort syntaxes by how far they match the query (i.e. the user's current shortcut-text)
	private resortSyntaxes(a: any, b: any): number
	{
		return this.indexOfDifference(b.text, this.context.query) -
		       this.indexOfDifference(a.text, this.context.query);
	}

	// Determine the index of the first non-matching character of two strings
	private indexOfDifference(a: string, b: string): number
	{
		for (let i = 0; i < a.length; i++)
		{
			if (i >= b.length)
			{
				return b.length;
			}
			if (a[i] != b[i])
			{
				return i;
			}
		}
		return a.length;
	}

	// The internal function "forceSelectedItem" is modified to do it's usual job AND to update the
	// suggestion description UI
	private forceSelectedItem_modified(e: any,t: any)
	{
		this._forceSetSelectedItem(e, t);
		this._suggestionDescriptionUi.setText("");
		MarkdownRenderer.renderMarkdown(
			this._descriptions[this.suggestions.selectedItem],
			this._suggestionDescriptionUi, '', null);
	}

	private open_modified()
	{
		this._open();
		this._suggestionDescriptionUi.style.display = "unset";
		// Put descriptionUi at top or bottom of suggestions?
		setTimeout(() =>
		{
			const suggestListRect: any = this.suggestEl.getBoundingClientRect();
			const bottom = suggestListRect.y + suggestListRect.height;
			if (bottom > window.innerHeight * 0.7)
			{
				this._suggestionDescriptionUi.classList.add("iscript_suggestionDescription_above");
			}
			else
			{
				this._suggestionDescriptionUi.classList.
					remove("iscript_suggestionDescription_above");
			}
		}, 0);
	}

	private close_modified()
	{
		this._close();
		this._suggestionDescriptionUi.style.display = "none";
	}
}
