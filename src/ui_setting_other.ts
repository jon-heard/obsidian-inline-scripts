//////////////////////////////////////////////////////////////////////////////////////////////
// Setting ui other - Create and work with the miscelaneous settings not handled elsewhere. //
//////////////////////////////////////////////////////////////////////////////////////////////

"use strict";

import { Setting, Platform } from "obsidian";
import InlineScriptsPlugin from "./_Plugin";
import { Popups } from "./ui_Popups";

export abstract class SettingUi_Other
{
	// Create the setting ui
	public static create(parent: any, settings: any): void
	{
		return this.create_internal(parent, settings);
	}

	// Get the contents of the setting ui
	public static getContents(): any
	{
		return this._settings;
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	private static _settings: any;

	private static create_internal(parent: any, settings: any): void
	{
		this._settings = { devMode: settings.devMode, allowExternal: settings.allowExternal };

		parent.createEl("h2", { text: "Other Settings" });

		// Developer mode
		new Setting(parent)
			.setName("Developer mode")
			.setDesc("Shortcut-files are monitored for updates if this is on.")
			.addToggle((toggle: any) =>
			{
				return toggle
					.setValue(settings.devMode)
					.onChange((value: string) => this._settings.devMode = value );
			});

		// Allow external (not available on mobile)
		if (!Platform.isMobile)
		{
			new Setting(parent)
				.setName("Allow external")
				.setDesc("Shortcuts can run external commands if this is on.")
				.addToggle((toggle: any) =>
				{
					return toggle
						.setValue(settings.allowExternal)
						.onChange((value: string) => this._settings.allowExternal = value );
				})
				.descEl.createEl("div", {
					cls: "iscript_warning",
					text: "WARNING: enabling this increases the danger from malicious shortcuts" });
		}

		new Setting(parent)
			.setName("Reset to defaults")
			.setDesc("Reset all settings to their default values.")
			.addButton((button: any) =>
			{
				return button
					.setButtonText("Reset to defaults")
					.onClick(async () =>
					{
						const plugin = InlineScriptsPlugin.getInstance();
						if (await Popups.getInstance().confirm(
							"Confirm resetting ALL settings to their default values."))
						{
							plugin.settings = InlineScriptsPlugin.getDefaultSettings();
							plugin.settingsUi.display();
							plugin.settings.shortcuts = "";
						}
					});
			});
	}
}
