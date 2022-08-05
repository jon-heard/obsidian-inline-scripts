/////////////////////////////////////////////////////////////////////////////////////////////////
// ButtonsVoew - A sidepanel for adding buttons to.  Each button triggers a specific shortcut. //
/////////////////////////////////////////////////////////////////////////////////////////////////

"use strict";

import { ItemView, WorkspaceLeaf, addIcon } from "obsidian";
import InlineScriptsPlugin from "./_Plugin";

const ICON_SHORTCUT_BUTTON_VIEW = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" class="widget-icon" enable-background="new 0 0 512 512" version="1.1" viewBox="0 0 2500 2500">
 <g class="layer">
  <title>Layer 1</title>
  <rect fill="currentcolor" fill-opacity="0.01" height="424" id="button" rx="62" ry="62" stroke="currentcolor" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="51" width="424" x="44" y="44"/>
  <path d="m300.34,118.66l2.4,36.42l-28.24,6.34c-71.5,16.05 -141.59,84.08 -180.61,175.33c-7,16.37 -11.69,32.14 -10.41,35.05c2.92,6.67 74.12,59.76 80.14,59.76c2.46,0 8.36,-9.76 13.11,-21.7c20.28,-50.89 72.77,-103.98 109.72,-110.97l14.98,-2.83l-2.58,31.47c-2.67,32.67 -1.92,39.54 4.33,39.54c4,0 123.41,-125.48 126.82,-133.27c2.59,-5.91 -13.83,-27.83 -72.64,-96.96c-25.54,-30.03 -49.36,-54.6 -52.94,-54.6c-5.72,0 -6.21,4.36 -4.1,36.42l0.02,0z" fill="currentcolor" id="svg_4" stroke="currentcolor" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null"/>
 </g>
</svg>`

export const BUTTON_VIEW_TYPE = "inline-scripts-button-view";

export class ButtonView extends ItemView
{
	constructor(leaf: WorkspaceLeaf)
	{
		super(leaf);
	}

	public static staticConstructor(): void
	{
		const plugin = InlineScriptsPlugin.getInstance();
		addIcon(BUTTON_VIEW_TYPE, ICON_SHORTCUT_BUTTON_VIEW);
		plugin.registerView( BUTTON_VIEW_TYPE, (leaf: any) => new ButtonView(leaf) );
		plugin.addCommand(
		{
			id: "show-inline-scripts-buttons-view",
			name: "Open buttons view",
			checkCallback: (checking: boolean): boolean =>
			{
				let isViewOpened =
					(plugin.app.workspace.getLeavesOfType(BUTTON_VIEW_TYPE).length === 0);
				if (!checking)
				{
					this.activateView();
				}
				return isViewOpened;
			}
		});
		if (plugin.settings.buttonViewSettings.visible)
		{
			plugin.app.workspace.onLayoutReady(() => this.activateView());
		}
	}

	public static staticDestructor(): void
	{
		InlineScriptsPlugin.getInstance().app.workspace.detachLeavesOfType(BUTTON_VIEW_TYPE);
	}

	public getViewType(): string
	{
		return BUTTON_VIEW_TYPE;
	}

	public getDisplayText(): string
	{
		return "Inline Scripts - Buttons";
	}

	public getIcon(): string
	{
		return BUTTON_VIEW_TYPE;
	}

	public async onOpen(): Promise<void>
	{
		const plugin: InlineScriptsPlugin = InlineScriptsPlugin.getInstance();
		if (!plugin.settings.buttonViewSettings.visible)
		{
			plugin.settings.buttonViewSettings.visible = true;
			plugin.saveSettings();
		}
	}

	public async onClose(): Promise<void>
	{
		const plugin: InlineScriptsPlugin = InlineScriptsPlugin.getInstance();
		if (!(plugin as any)._loaded) { return; }
		if (plugin.settings.buttonViewSettings.visible)
		{
			plugin.settings.buttonViewSettings.visible = false;
			plugin.saveSettings();
		}
	}

	public static async activateView()
	{
		const plugin: InlineScriptsPlugin = InlineScriptsPlugin.getInstance();
		if (plugin.app.workspace.getLeavesOfType(BUTTON_VIEW_TYPE).length)
		{
			return;
		}
        await plugin.app.workspace.getRightLeaf(false).setViewState({ type: BUTTON_VIEW_TYPE });
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

}
