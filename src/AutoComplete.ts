////////////////////////////////////////////////////////////////////
// AutoComplete - Show an autocomplete ui while typing a shortcut //
////////////////////////////////////////////////////////////////////

"use strict";

import { EditorSuggest } from "obsidian";
import InlineScriptsPlugin from "./_Plugin";
import { HelperFncs } from "./HelperFncs";

const SUGGESTION_LIMIT = 1000;

const REGEX_SYNTAX_SPLITTER: RegExp = /~~}|(?=\{)/;
const REGEX_FIRST_PARAMETER_START: RegExp = / ?\{/;

export class AutoComplete extends EditorSuggest<any>
{
	public constructor(plugin: InlineScriptsPlugin)
	{
		super(plugin.app);
		this.constructor_internal(plugin);
	}

	public destructor()
	{
		document.getElementById("shortcutSuggestionDescription")?.remove();
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
				this._suggestionDescriptionUi.classList.add("iscript_suggestionDescription");

				const parent = document.querySelector(".workspace-split.mod-root");
				parent.insertBefore(this._suggestionDescriptionUi, parent.firstChild);
			});
		}
	}

	// Called by the system to determine if auto-complete should pop up at all
	private onTrigger_internal(cursor: any, editor: any): any
	{
		// If autocomplete is turned off, early out (obviously)
		if (InlineScriptsPlugin.getInstance().settings.autocomplete === false)
		{
			return;
		}

		// Get the shortcut prefix and suffix
		const prefix: string = this._plugin.settings.prefix;
		const suffix: string = this._plugin.settings.suffix;

		// Get the current line of text up to the caret position
		const lineUpToCursor: string = editor.getLine(cursor.line).slice(0, cursor.ch);

		// Look for whether we are within a shortcut (after a prefix, and NOT after a suffix)
		let shortcutUnderCaret = null;
		let shortcutStart = lineUpToCursor.lastIndexOf(prefix);
		if (shortcutStart !== -1)
		{
			if (lineUpToCursor.indexOf(suffix, shortcutStart + prefix.length) === -1)
			{
				shortcutUnderCaret = lineUpToCursor.slice(shortcutStart + prefix.length);
			}
		}

		// If we ARE within a shortcut, auto-complete should pop up
		if (shortcutUnderCaret !== null)
		{
			return {
				end: cursor,
				start:
				{
					ch: lineUpToCursor.length - shortcutUnderCaret.length,
					line: cursor.line,
				},
				query: shortcutUnderCaret,
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
		// Early out if syntaxesSorted isn't available
		if (!this._plugin?.syntaxesSorted) { return null; }

		// Get ALL shortcut syntaxes
		const result = this._plugin.syntaxesSorted
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
			let currentParameterIndex = -1;
			// TODO - Uncomment this after fixing the TODO below
			// let inNonParameterSection = false;

			// Artificially add a dummy character to see if it's accepted.  If so, we're in a
			// parameter section, since they accept ANY character, except space.  We use the
			// "unit separator" for the dummy character as it's unlikely to show false positive.
			let match = (this.context.query + "\u241F").match(suggestion.regex);
			if (match)
			{
				// Find which parameter section accepted the dummy character.
				for (let i = 1; i < match.length; i++)
				{
					if (match[i].endsWith("\u241F"))
					{
						currentParameterIndex = i;
						break;
					}
				}
			}
			// The dummy character was NOT accepted, so we're in a hardcoded section.  Determine
			// the last parameter section that was accepted and we're in the section just beyond
			// that one.  If NO parameter sections were accepted, we're in the hardcoded section
			// before ANY parameter sections, so don't set currentParameterIndex and NO sections
			// will be highlighted.
			else
			{
				// TODO - Fix this so that it works if skipping an optional parameter section into
				// a hardcoded one.

				// inNonParameterSection = true;
				// match = suggestion.match;
				// // Find which parameter section accepted the dummy character.
				// for (let i = 1; i < match.length; i++)
				// {
					// if (match[i])
					// {
						// currentParameterIndex = i;
					// }
				// }
			}

			if (currentParameterIndex !== -1)
			{
				// Split the suggestion text into parts, including the parameter sections.
				const parts = text.replaceAll("}", "}~~}").split(REGEX_SYNTAX_SPLITTER);
				// Find and highlight the current section.
				let parameterCounter = 0;
				for (let i = 0; i < parts.length; i++)
				{
					if (parts[i].startsWith("{") && parts[i].endsWith("}"))
					{
						parameterCounter++;
						if (parameterCounter == currentParameterIndex)
						{
							// TODO - Uncomment after fixing TODO above this one
							// if (inNonParameterSection) { i++; }
							parts[i] =
								"<span class='iscript_suggestionHighlight'>" + parts[i] + "</span>";
							text = parts.join("");
							break;
						}
					}
				}
			}
		}

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
		const fill = suggestion.text.slice(0, suggestionEndIndex);

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
		// parameters satisfied? (either filled or with default)  If so, try expanding.
		else
		{
			const parts = suggestion.text.replaceAll("}", "}~~}").split(REGEX_SYNTAX_SPLITTER);
			let parameterIndex = suggestion.match.length - 1;
			for (let i = parts.length - 1; i >= 0; i--)
			{
				if (parts[i].startsWith("{"))
				{
					// If parameter isn't fulfilled and has no default, end now
					if (!suggestion.match[parameterIndex] && !parts[i].includes("default"))
					{
						break;
					}
					parameterIndex--;
				}
				if (parameterIndex === 0)
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
			if (a[i] !== b[i])
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
		this._suggestionDescriptionUi.innerHTML =
			HelperFncs.parseMarkdown(this._descriptions[this.suggestions.selectedItem]);
	}

	private open_modified()
	{
		this._open();

		if (InlineScriptsPlugin.getInstance().settings.autocompleteHelp === false)
		{
			return;
		}
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
