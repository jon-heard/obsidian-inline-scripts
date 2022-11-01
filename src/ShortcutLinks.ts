///////////////////////////////////////////////////////////////////////////////////////////////////
// Links - The ability to add links to a note that run expansions; either once or on each click. //
///////////////////////////////////////////////////////////////////////////////////////////////////

"use strict";

import { MarkdownPostProcessorContext } from "obsidian";
import InlineScriptsPlugin from "./_Plugin";
import { ShortcutExpander } from "./ShortcutExpander";
import { HelperFncs } from "./HelperFncs";

export abstract class ShortcutLinks
{
	public static staticConstructor(): void
	{
		this.staticConstructor_internal();
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	private static staticConstructor_internal(): void
	{
		InlineScriptsPlugin.getInstance().registerMarkdownPostProcessor(this.processor);
	}

	private static processor(el: HTMLElement, ctx: MarkdownPostProcessorContext): void
	{
		let nodeList = el.querySelectorAll("code");
		if (!nodeList.length) { return; }

		for (let index = 0; index < nodeList.length; index++)
		{
			const node = nodeList.item(index);
			const nodeInnerText = node.innerText;

			const notePath = ctx.sourcePath;

			// Block id target
			const target: string =
				(nodeInnerText.indexOf("^")==-1) ? null :
				nodeInnerText.slice(nodeInnerText.indexOf("^") + 1, nodeInnerText.indexOf(":"))
					.trim();

			// Function for resolution
			const resolutionFnc: Function =
				nodeInnerText.match("^iscript-once(?: |:)") ? ShortcutLinks.linkResolution_once :
				nodeInnerText.match("^iscript-append(?: |:)") ? ShortcutLinks.linkResolution_append :
				nodeInnerText.match("^iscript-prepend(?: |:)") ? ShortcutLinks.linkResolution_prepend :
				nodeInnerText.match("^iscript(?: |:)") ? ShortcutLinks.linkResolution_standard :
				null;
			if (!resolutionFnc)
			{
				continue;
			}

			// Split the iscript link data section into parts
			const parts = nodeInnerText.slice(nodeInnerText.indexOf(":") + 1).split(/ ?\| ?/g);
			if (parts[0] === "") { continue; }

			// Remove extra spaces around shortcut text
			if (parts[0].startsWith(" ")) { parts[0] = parts[0].slice(1); }
			if (parts[0].endsWith(" ")) { parts[0] = parts[0].slice(0, -1); }

			// New "a" element
			let a = document.createElement("a");
			a.classList.add("internal-link");
			a.classList.add("iscript-link");
			a.dataset["source"] = nodeInnerText;
			a.innerText = (parts[1]?.trim() || parts[0]).trim();
			a.setAttr("href", "#");

			// Click response
			a.onclick = async function()
			{
				let targetPos = null;

				// Bad target?  Do nothing.  Else get the target's place in the note.
				if (target)
				{
					const noteFile = (app.vault as any).fileMap[notePath];
					if (!noteFile) { return; }
					const fileCache = app.metadataCache.getFileCache(noteFile);
					if (!fileCache) { return; }
					const blockData = fileCache.blocks[target];
					if (!blockData) { return; }
					targetPos =
					{
						start: blockData.position.start.offset,
						end: blockData.position.end.offset
					};
					// Don't overwrite the block id
					const noteContent =
						await app.vault.cachedRead((app.vault as any).fileMap[notePath]);
					const blockContent = noteContent.slice(targetPos.start, targetPos.end);
					const idMatch = blockContent.match(/\s\^[^\n]+$/);
					if (idMatch)
					{
						targetPos.end -= idMatch[0].length;
					}
				}

				// Expand the iscript shortcut
				let result = await ShortcutExpander.expand(
						parts[0], false, { isUserTriggered: true },
						parts.slice(3).map(v => { return { caption: v.trim() }; })
				);

				// If iscript shortcut expanded, run output customization, then resolution
				if (result)
				{
					// Customize result
					result = HelperFncs.parseMarkdown(result);
					if (parts.length > 2)
					{
						result = (new Function('$$', "return " + parts[2]))(result);
					}
					// Resolve result
					resolutionFnc(this, result, targetPos);
				}
			};

			// Replace code node with "a" element
			node.parentNode.insertBefore(a, node);
			node.remove();
		}
	}

	private static linkResolution_standard(ui: HTMLElement, expansion: string, targetPos: any)
	{
		if (targetPos)
		{
			HelperFncs.addToNote(expansion, targetPos);
		}
		else
		{
			ui.innerHTML = expansion;
		}
	}

	private static linkResolution_once(ui: HTMLElement, expansion: string, targetPos: any)
	{
		let newUi: HTMLElement = document.createElement("span");
		if (targetPos)
		{
			newUi.innerHTML = ui.innerHTML;
			HelperFncs.addToNote(expansion, targetPos);
		}
		else
		{
			newUi.innerHTML = expansion;
		}
		ui.parentNode.insertBefore(newUi, ui);
		ui.remove();
	}

	private static linkResolution_append(ui: HTMLElement, expansion: string, targetPos: any)
	{
		if (targetPos) { targetPos.start = targetPos.end; }
		HelperFncs.addToNote(expansion, targetPos);
	}
	private static linkResolution_prepend(ui: HTMLElement, expansion: string, targetPos: any)
	{
		if (targetPos)
		{
			targetPos.end = targetPos.start;
		}
		else
		{
			targetPos = { start: 0, end: 0 };
		}
		HelperFncs.addToNote(expansion, targetPos);
	}
}
