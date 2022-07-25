///////////////////////////////////////////////////////////////////
// AutoComplete - Show an autocomplete ui when typing a shortcut //
///////////////////////////////////////////////////////////////////

"use strict";

class AutoComplete extends obsidian.EditorSuggest
{
	public constructor(plugin: TextExpanderJsPlugin)
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

	private _plugin: TextExpanderJsPlugin;
	private _resortSyntaxes: any;
	private _suggestionDescriptionUi: any;
	private _forceSetSelectedItem: Function;
	private _descriptions: Array<string>;

	private constructor_internal(plugin: TextExpanderJsPlugin)
	{
		this._plugin = plugin;
		this._resortSyntaxes = this.resortSyntaxes.bind(this);
		this._forceSetSelectedItem = this.suggestions.forceSetSelectedItem.bind(this.suggestions);
		this.suggestions.forceSetSelectedItem = (e: any,t: any) =>
		{
			this._forceSetSelectedItem(e,t);
			this._suggestionDescriptionUi.setText("");
			obsidian.MarkdownRenderer.renderMarkdown(
				this._descriptions[this.suggestions.selectedItem],
				this._suggestionDescriptionUi, '', this);
		};
		this._suggestionDescriptionUi = this.suggestEl.createDiv();
		this._suggestionDescriptionUi.classList.add("tejs_suggestionDescription");
	}

	private onTrigger_internal(cursor: any, editor: any): any
	{
		const prefix: string = this._plugin.settings.prefix;
		const suffix: string = this._plugin.settings.suffix;
		const lineToCursor: string = editor.getLine(cursor.line).substring(0, cursor.ch);
		let a: any;
		const match =
			(a = lineToCursor.match(prefix + "[^" + suffix[0] + "]*$")) === null || a === void 0 ?
			void 0 :
			a.first();
		if (match)
		{
			return {
				end: cursor,
				start:
				{
					ch: lineToCursor.lastIndexOf(match) + prefix.length,
					line: cursor.line,
				},
				query: match.substr(prefix.length),
			};
		}
		return null;
	}

	private getSuggestions_internal(context: any): any
	{
		const result = this._plugin.syntaxes.
			filter((p: any) =>
			{
				return context.query.match(p.regex);
			}).
			sort(this._resortSyntaxes);
		this._descriptions = result.map((v: any) => v.description);
		return result;
	};

	private renderSuggestion_internal(suggestion: any, el: any): void
	{
		el.classList.add("tejs_suggestion");
		el.setText(suggestion.text);
	};

	private selectSuggestion_internal(suggestion: any): void
	{
		if (!this.context) { return; }
		const suggestionEnd: number =
			suggestion.text.match(/ ?\{/)?.index || suggestion.text.length;
		const fill = suggestion.text.substr(0, suggestionEnd);
		if (this.context.query.startsWith(fill))
		{
			return;
		}
		this.context.editor.replaceRange(fill, this.context.start, this.context.end);
		this.context.start.ch += fill.length;
		this.context.editor.setCursor(this.context.start);
	};

	private resortSyntaxes(a: any, b: any): number
	{
		return this.indexOfDifference(b.text, this.context.query) -
		       this.indexOfDifference(a.text, this.context.query);
	}

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
}
