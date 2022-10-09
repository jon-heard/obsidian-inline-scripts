///////////////////////////////////////////////////////////////////////////
// HelperFncs - Useful functions that don't fit into a different ts file //
///////////////////////////////////////////////////////////////////////////

"use strict";

import { MarkdownRenderer, ItemView, addIcon } from "obsidian";
import { DragReorder } from "./ui_dragReorder";
import InlineScriptsPlugin from "./_Plugin";

/*! getEmPixels  | Author: Tyson Matanich (http://matanich.com), 2013 | License: MIT */
(function(n,t){"use strict";var i="!important;",r="position:absolute"+i+"visibility:hidden"+i+"width:1em"+i+"font-size:1em"+i+"padding:0"+i;window.getEmPixels=function(u:any){var f,e,o;return u||(u=f=n.createElement("body"),f.style.cssText="font-size:1em"+i,t.insertBefore(f,n.body)),e=n.createElement("i"),e.style.cssText=r,u.appendChild(e),o=e.clientWidth,f?t.removeChild(f):u.removeChild(e),o}})(document,document.documentElement);

export namespace HelperFncs
{
	export function staticConstructor(): void
	{
		confirmObjectPath("_inlineScripts.inlineScripts.helperFncs");
		Object.assign(window._inlineScripts.inlineScripts.helperFncs,
		{
			confirmObjectPath, getLeafForFile, addToNote, parseMarkdown,
			callEventListenerCollection, addCss, removeCss, ItemView, addIcon, DragReorder
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

	// Takes some text and places it into the current note, replacing the text at targetPosition,
	// if it is assigned, or appending to the document end if not.
	export function addToNote(toAdd: string, targetPosition?: any): void
	{
		addToNote_internal(toAdd, targetPosition);
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

	export function addCss(id: string, css: string): void
	{
		addCss_internal(id, css);
	}

	export function removeCss(id: string): void
	{
		removeCss_internal(id);
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
		parent[pathChain[pathChain.length-1]] ||= (leaf === undefined ? {} : leaf);
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

	function addToNote_internal(toAdd: string, targetPosition?: any): void
	{
		targetPosition ||= { start: Number.MAX_SAFE_INTEGER, end: Number.MAX_SAFE_INTEGER };

		const plugin = InlineScriptsPlugin.getInstance();

		const file = plugin.app.workspace.getActiveFile();
		if (!file) { return; }
		const leaf = HelperFncs.getLeafForFile(file);
		if (!leaf) { return; }
		const currentMode = leaf.view.currentMode;

		if (Array.isArray(toAdd))
		{
			toAdd = toAdd.join("");
		}

		if (currentMode.type === "source")
		{
			// Refocus on the editor
			plugin.app.workspace.setActiveLeaf(leaf, false, true);

			if (!toAdd) { return; }

			// Append to the editor
			let content = leaf.view.editor.getValue();
			content =
				content.slice(0, targetPosition.start) + toAdd + content.slice(targetPosition.end);

			leaf.view.editor.setValue(content);

			// Move caret to the note's end (only if "toAdd" isn't null)
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
			if (!toAdd) { return; }

			let content = leaf.view.data;
			content =
				content.slice(0, targetPosition.start) + toAdd + content.slice(targetPosition.end);

			plugin.app.vault.modify(file, content);

			// Scroll to note's end
			const scroller = currentMode.containerEl.childNodes[0];
			const scrollerChild = scroller.childNodes[0];
			const paddingBottom = scrollerChild.style["padding-bottom"];
			scrollerChild.style["padding-bottom"] = 0;
			setTimeout(() =>
			{
				scroller.scrollTop = scroller.scrollHeight;
				scrollerChild.style["padding-bottom"] = paddingBottom;
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
		if (!collection)
		{
			return;
		}
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

	export function addCss_internal(id: string, css: string): void
	{
		id = id + "_css";
		let e = document.getElementById(id);
		if (!e)
		{
			e = document.createElement("style");
			e.id = id;
			document.head.appendChild(e);
		}
		e.innerText = css;
	}

	export function removeCss_internal(id: string): void
	{
		id = id + "_css";
		const e = document.getElementById(id);
		e?.remove();
	}
}
