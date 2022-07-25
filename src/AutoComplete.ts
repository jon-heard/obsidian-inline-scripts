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

	private constructor_internal(plugin: TextExpanderJsPlugin)
	{
		this._plugin = plugin;
		this._resortSyntaxes = this.resortSyntaxes.bind(this);
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
		return this._plugin.syntaxes.
			filter((p: any) =>
			{
				return context.query.match(p.regex);
			}).
			sort(this._resortSyntaxes);
	};

	private renderSuggestion_internal(suggestion: any, el: any): void
	{
		let ui = el.createDiv();
		ui.setText(suggestion.text);
		ui.setAttr("title", suggestion.description);
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
