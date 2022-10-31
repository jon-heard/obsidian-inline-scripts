///////////////////////////////////////////////////////////////////////////
// HelperFncs - Useful functions that don't fit into a different ts file //
///////////////////////////////////////////////////////////////////////////

"use strict";

import { MarkdownRenderer, ItemView, addIcon } from "obsidian";
import { DragReorder } from "./ui_dragReorder";
import { InputBlocker } from "./ui_InputBlocker";
import InlineScriptsPlugin from "./_Plugin";

/*! getEmPixels  | Author: Tyson Matanich (http://matanich.com), 2013 | License: MIT */
(function(n,t){"use strict";var i="!important;",r="position:absolute"+i+"visibility:hidden"+i+"width:1em"+i+"font-size:1em"+i+"padding:0"+i;window.getEmPixels=function(u:any){var f,e,o;return u||(u=f=n.createElement("body"),f.style.cssText="font-size:1em"+i,t.insertBefore(f,n.body)),e=n.createElement("i"),e.style.cssText=r,u.appendChild(e),o=e.clientWidth,f?t.removeChild(f):u.removeChild(e),o}})(document,document.documentElement);

export namespace HelperFncs
{
	export function staticConstructor(): void
	{
		confirmObjectPath("_inlineScripts.inlineScripts.HelperFncs");
		Object.assign(window._inlineScripts.inlineScripts.HelperFncs,
		{
			confirmObjectPath, getLeavesForFile, addToNote, parseMarkdown,
			callEventListenerCollection, addCss, removeCss, ItemView, addIcon, DragReorder, unblock,
			expFormat, expUnformat
		});
	}

	// confirm that an object path is available
	export function confirmObjectPath(path: string, leaf?: any): void
	{
		confirmObjectPath_internal(path, leaf);
	}

	export function getLeavesForFile(file: any): Array<any>
	{
		return getLeavesForFile_internal(file);
	}

	// Takes some text and places it into the current note, replacing the text at targetPosition,
	// if it is assigned, or appending to the document end if not.
	export async function addToNote(toAdd: string, targetPosition?: any, path?: string):
		Promise<void>
	{
		await addToNote_internal(toAdd, targetPosition, path);
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

	export function unblock(): void
	{
		InputBlocker.setEnabled(false);
	}

	// Modify a string ("expansion") to add the expansion format: prefix, lineprefix and suffix
	export function expFormat(
		expansion: string, skipPrefix: boolean, skipLinePrefix: boolean, skipSuffix: boolean)
		: string
	{
		return expFormat_internal(expansion, skipPrefix, skipLinePrefix, skipSuffix);
	}

	// Modify a string ("expansion") to remove the expansion format: prefix, lineprefix and suffix
	export function expUnformat(
		expansion: string, skipPrefix: boolean, skipLinePrefix: boolean, skipSuffix: boolean)
		: string
	{
		return expUnformat_internal(expansion, skipPrefix, skipLinePrefix, skipSuffix);
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

	function getLeavesForFile_internal(file: any): Array<any>
	{
		let result = [];
		for (const leaf of
			InlineScriptsPlugin.getInstance().app.workspace.getLeavesOfType("markdown"))
		{
			if ((leaf.view as any)?.file === file)
			{
				result.push(leaf);
			}
		}
		return result;
	}

	async function addToNote_internal(toAdd: string, targetPosition?: any, path?: string)
		: Promise<void>
	{
		// targetPosition defaults to last position possible
		targetPosition ||= { start: Number.MAX_SAFE_INTEGER, end: Number.MAX_SAFE_INTEGER };

		const plugin = InlineScriptsPlugin.getInstance();

		// Get file object for the file to edit
		const file =
			!path ? plugin.app.workspace.getActiveFile() : (plugin.app.vault as any).fileMap[path];
		if (!file || file.children) { return; }

		// Check if we're editing the ACTIVE file
		let isNoteActive = (!path || file === plugin.app.workspace.getActiveFile());

		const leaves = HelperFncs.getLeavesForFile(file);
		const currentMode = leaves[0]?.view?.currentMode;

		if (isNoteActive && currentMode?.type === "source")
		{
			plugin.app.workspace.setActiveLeaf(leaves[0], false, true);
		}

		if (!toAdd) { return; }
		if (Array.isArray(toAdd))
		{
			toAdd = toAdd.join("");
		}

		if (!leaves.length)
		{
			// Read the content
			let content = await plugin.app.vault.cachedRead(file);

			// Modify the content
			content =
				content.slice(0, targetPosition.start) + toAdd + content.slice(targetPosition.end);

			// Write the content back
			await plugin.app.vault.modify(file, content);
		}
		else if (currentMode.type === "source")
		{
			// Temporarily remove plugin input blocking (since disabling it breaks the note editing)
			const inputDisabled = plugin.inputDisabled;
			plugin.inputDisabled = false;

			// Append to the editor
			let content = leaves[0].view.editor.getValue();
			const oldContentSize = content.length;
			content =
				content.slice(0, targetPosition.start) + toAdd + content.slice(targetPosition.end);
			leaves[0].view.editor.setValue(content);

			// Restore plugin input blocking
			plugin.inputDisabled = inputDisabled;

			// Move caret to the note's end (only if editing the active note & edit is at the end of file)
			if (isNoteActive && targetPosition.start >= oldContentSize)
			{
				const scroller = currentMode?.contentContainerEl?.parentElement;
				if (scroller)
				{
					const oldScrollTop = scroller.scrollTop;
					leaves[0].view.editor.setSelection({line: Number.MAX_SAFE_INTEGER, ch: 0});
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
					leaves[0].view.editor.setSelection({line: Number.MAX_SAFE_INTEGER, ch: 0});
				}
			}
		}
		else
		{
			// Read the content
			let content = leaves[0].view.data;
			const oldContentSize = content.length;

			// Modify the content
			content =
				content.slice(0, targetPosition.start) + toAdd + content.slice(targetPosition.end);

			// Write the content back
			await plugin.app.vault.modify(file, content);

			// Scroll to note's end (only if editing the active note & edit is at the end of file)
			if (isNoteActive && targetPosition.start >= oldContentSize)
			{
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

	function addCss_internal(id: string, css: string): void
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

	function removeCss_internal(id: string): void
	{
		id = id + "_css";
		const e = document.getElementById(id);
		e?.remove();
	}

	function expFormat_internal(
		expansion: string, skipPrefix: boolean, skipLinePrefix: boolean, skipSuffix: boolean)
		: string
	{
		// Used on all prefixes and suffixes to allow user to specify newlines, tabs and quotes.
		function unescapeText(src: string)
		{
			return src.replaceAll("\\n", "\n").replaceAll("\\t", "\t").replaceAll("\\\"", "\"");
		}

		// Expansion can be a string or an array-of-strings.  If expansion is NOT an
		// array-of-strings, make it an array-of-strings, temporarily, to simplify formatting logic.
		let result = Array.isArray(expansion) ? expansion : [ expansion ];

		const settings = InlineScriptsPlugin.getInstance().settings;

		// linePrefix handling - @ start of result[0] & after each newline in all result elements.
		if (!skipLinePrefix)
		{
			const linePrefix = unescapeText(settings.expansionLinePrefix);
			result[0] = linePrefix + result[0];
			for (let i = 0; i < result.length; i++)
			{
				if (!result[i].replaceAll) { continue; }
				result[i] = result[i].replaceAll("\n", "\n" + linePrefix);
			}
		}

		// Prefix handling - at start of first element
		if (!skipPrefix)
		{
			const prefix = unescapeText(settings.expansionPrefix);
			result[0] = prefix + result[0];
		}

		// Suffix handling - after end of last element
		if (!skipSuffix)
		{
			const suffix = unescapeText(settings.expansionSuffix);
			result[result.length-1] = result[result.length-1] + suffix;
		}

		// If passed expansion wasn't an array, turn result back into a non-array.
		return Array.isArray(expansion) ? result : result[0];
	}

	function expUnformat_internal(
		expansion: string, skipPrefix: boolean, skipLinePrefix: boolean, skipSuffix: boolean)
		: string
	{
		// Used on all prefixes and suffixes to allow user to specify newlines, tabs and quotes.
		function unescapeText(src: string)
		{
			return src.replaceAll("\\n", "\n").replaceAll("\\t", "\t").replaceAll("\\\"", "\"");
		}

		// Expansion can be a string or an array-of-strings.  If expansion is NOT an
		// array-of-strings, make it an array-of-strings, temporarily, to simplify formatting logic.
		let result = Array.isArray(expansion) ? expansion : [ expansion ];

		const settings = InlineScriptsPlugin.getInstance().settings;

		// Prefix handling - at start of first element
		if (!skipPrefix)
		{
			const prefix = unescapeText(settings.expansionPrefix);
			result[0] = result[0].replace(new RegExp("^" + prefix), "");
		}

		// Suffix handling - after end of last element
		if (!skipSuffix)
		{
			const suffix = unescapeText(settings.expansionSuffix);
			result[result.length-1] = result[result.length-1].replace(new RegExp(suffix + "$"), "");
		}

		// linePrefix handling - @ start of result[0] & after each newline in all result elements.
		if (!skipLinePrefix)
		{
			const linePrefix = unescapeText(settings.expansionLinePrefix);
			result[0] = result[0].replace(new RegExp("^" + linePrefix), "");
			for (let i = 0; i < result.length; i++)
			{
				if (!result[i].replaceAll) { continue; }
				result[i] = result[i].replaceAll("\n" + linePrefix, "\n");
			}
		}

		// If passed expansion wasn't an array, turn result back into a non-array.
		return Array.isArray(expansion) ? result : result[0];
	}
}
