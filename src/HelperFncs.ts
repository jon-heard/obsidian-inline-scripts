///////////////////////////////////////////////////////////////////////////
// HelperFncs - Useful functions that don't fit into a different ts file //
///////////////////////////////////////////////////////////////////////////

"use strict";

import { MarkdownRenderer } from "obsidian";
import InlineScriptsPlugin from "./_Plugin";

/*! getEmPixels  | Author: Tyson Matanich (http://matanich.com), 2013 | License: MIT */
(function(n,t){"use strict";var i="!important;",r="position:absolute"+i+"visibility:hidden"+i+"width:1em"+i+"font-size:1em"+i+"padding:0"+i;window.getEmPixels=function(u:any){var f,e,o;return u||(u=f=n.createElement("body"),f.style.cssText="font-size:1em"+i,t.insertBefore(f,n.body)),e=n.createElement("i"),e.style.cssText=r,u.appendChild(e),o=e.clientWidth,f?t.removeChild(f):u.removeChild(e),o}})(document,document.documentElement);

export namespace HelperFncs
{
	export function getLeafForFile(file: any): any
	{
		return getLeafForFile_internal(file);
	}

	// Takes some text and places it at the end of the current notee, then focuses on the note with
	// with the carat at the end.
	export function appendToEndOfNote(toAppend: string): void
	{
		appendToEndOfNote_internal(toAppend);
	}

	export function parseMarkdown(md: string): string
	{
		return parseMarkdown_internal(md);
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	function getLeafForFile_internal(file: any): any
	{
		for (const leaf of
			InlineScriptsPlugin.getInstance().app.workspace.getLeavesOfType("markdown"))
		{
			if ((leaf.view as any)?.file === file)
			{
				return leaf;
			}
		}
		return null;
	}

	function appendToEndOfNote_internal(toAppend: string): void
	{
		const plugin = InlineScriptsPlugin.getInstance();

		const file = plugin.app.workspace.getActiveFile();
		if (!file) { return; }
		const leaf = HelperFncs.getLeafForFile(file);
		if (!leaf) { return; }
		const currentMode = leaf.view.currentMode;

		if (currentMode.type === "source")
		{
			// Refocus on the editor
			plugin.app.workspace.setActiveLeaf(leaf, false, true);

			if (!toAppend) { return; }

			// Append to the editor
			if (Array.isArray(toAppend))
			{
				toAppend = toAppend.join("");
			}
			leaf.view.editor.setValue( leaf.view.editor.getValue() + toAppend );

			// Move caret to the note's end (only if "toAppend" isn't null)
			const scroller = currentMode.contentContainerEl.parentElement;
			const oldScrollTop = scroller.scrollTop;
			leaf.view.editor.setSelection({line: Number.MAX_SAFE_INTEGER, ch: 0});
			setTimeout(() =>
			{
				if (scroller.scrollTop != oldScrollTop)
				{
					scroller.scrollTop += window.getEmPixels(scroller) * 2;
				}
			}, 100);
		}
		else
		{
			if (!toAppend) { return; }

			if (Array.isArray(toAppend))
			{
				toAppend = toAppend.join("");
			}
			plugin.app.vault.modify(file, leaf.view.data + toAppend);

			// Scroll to note's end
			const scroller = currentMode.containerEl.childNodes[0];
			const content = scroller.childNodes[0];
			const paddingBottom = content.style["padding-bottom"];
			content.style["padding-bottom"] = 0;
			setTimeout(() =>
			{
				scroller.scrollTop = scroller.scrollHeight;
				content.style["padding-bottom"] = paddingBottom;
			}, 100);
		}
	}

	function parseMarkdown_internal(md: string): string
	{
		const ui = document.createElement("div");
		MarkdownRenderer.renderMarkdown(md, ui, '', null);
		let result = ui.innerHTML;
		if (result.startsWith("<p>") && result.endsWith("</p>"))
		{
			result = result.slice(3, -4);
		}
		return result;
	}
}
