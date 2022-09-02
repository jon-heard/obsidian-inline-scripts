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
	export function staticConstructor(): void
	{
		confirmObjectPath("_inlineScripts.inlineScripts.helperFncs",
		{
			confirmObjectPath,
			getLeafForFile,
			appendToEndOfNote,
			parseMarkdown,
			callEventListenerCollection,
		});
	}

	// confirm that an object path is available
	export function confirmObjectPath(path: string, leaf?: any): void
	{
		confirmObjectPath_internal(path, leaf);
	}

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

	export async function callEventListenerCollection(
		title: string, collection: any, parameters?: Array<any>, onReturn?: Function): Promise<void>
	{
		await callEventListenerCollection_internal(title, collection, parameters, onReturn);
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	function confirmObjectPath_internal(path: string, leaf?: any): void
	{
		const pathChain = path.split(".");
		let parent: any = window;
		for (let i = 0; i < pathChain.length-1; i++)
		{
			parent = (parent[pathChain[i]] ||= {});
		}
		parent[pathChain[pathChain.length-1]] ||= (leaf || {});
	}

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

	async function callEventListenerCollection_internal(
		title: string, collection: any, parameters?: Array<any>, onReturn?: Function): Promise<void>
	{
		let toCall: any =
			Object.keys(collection).map(v => { return {key: v, fnc: collection[v]}; });
		const sfileIndices = window._inlineScripts.inlineScripts.sfileIndices;
		for (const toCallItem of toCall)
		{
			if (sfileIndices[toCallItem.key])
			{
				toCallItem.key =
					(sfileIndices[toCallItem.key]+"").padStart(3, "0") + toCallItem.key;
			}
		}
		toCall =
			toCall
			.sort((lhs: any, rhs: any) => { return lhs.key.localeCompare(rhs.key); })
			.map((v: any) => v.fnc);

		for (const fnc of toCall)
		{
			if (typeof fnc === "function")
			{
				const result = await fnc(parameters);
				if (result != undefined && onReturn)
				{
					onReturn(result);
				}
			}
			else
			{
				console.warn("Non-function in collection \"" + title + "\": " + fnc);
			}
		}
	}
}
