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

			let headerLength: number = 0;
			let resolutionFnc: Function = null;

			if (nodeInnerText.startsWith("iscript:"))
			{
				headerLength = (nodeInnerText[8] == " ") ? 9 : 8;
				resolutionFnc = ShortcutLinks.linkResolution_standard;
			}
			else if (nodeInnerText.startsWith("iscript-once:"))
			{
				headerLength = (nodeInnerText[13] == " ") ? 14 : 13;
				resolutionFnc = ShortcutLinks.linkResolution_once;
			}
			else if (nodeInnerText.startsWith("iscript-append:"))
			{
				headerLength = (nodeInnerText[15] == " ") ? 16 : 15;
				resolutionFnc = ShortcutLinks.linkResolution_append;
			}
			else
			{
				continue;
			}

			const parts = nodeInnerText.slice(headerLength).split(/ ?\| ?/g);
			if (parts[0] === "") { continue; }

			const parameterData = parts.slice(2).map(v => { return { caption: v.trim() }; });
			let a = document.createElement("a");
			a.classList.add("internal-link");
			a.innerText = (parts[1]?.trim() || parts[0]).trim();
			a.setAttr("href", "#");
			a.onclick = async function()
			{
				const result =
					await ShortcutExpander.expand(parts[0], false, { isUserTriggered: true },
					parameterData);
				if (result)
				{
					resolutionFnc(this, result);
				}
			};
			node.parentNode.insertBefore(a, node);
			node.remove();
		}
	}

	private static linkResolution_standard(ui: HTMLElement, expansion: string)
	{
		ui.innerHTML = HelperFncs.parseMarkdown(expansion);
	}

	private static linkResolution_once(ui: HTMLElement, expansion: string)
	{
		let newUi: HTMLElement = document.createElement("span");
		newUi.innerHTML = HelperFncs.parseMarkdown(expansion);
		ui.parentNode.insertBefore(newUi, ui);
		ui.remove();
	}

	private static linkResolution_append(ui: HTMLElement, expansion: string)
	{
		HelperFncs.appendToEndOfNote(expansion);
	}
}
