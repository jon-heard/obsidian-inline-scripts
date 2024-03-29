////////////////////////////////////////////////////////////////////////////////////////////////
// Setting ui expansionFormat - Setup an optional prefix and postfix for shortcut expansions. //
////////////////////////////////////////////////////////////////////////////////////////////////

"use strict";

import { Setting } from "obsidian";

export abstract class SettingUi_ExpansionFormat
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
		// Settings section
		this._settings =
		{
			expansionPrefix: settings.expansionPrefix,
			expansionLinePrefix: settings.expansionLinePrefix,
			expansionSuffix: settings.expansionSuffix
		};

		// Title
		parent.createEl("h2", { text: "Common expansion format" });

		// Prefix
		new Setting(parent)
			.setName("Prefix")
			.setDesc("Text added to the start of a formatted expansion.")
			.addText((text: any) =>
			{
				return text
					.setPlaceholder("")
					.setValue(settings.expansionPrefix)
					.onChange((value: string) =>
					{
						this._settings.expansionPrefix = value;
					});
			})
			.settingEl.toggleClass("iscript_settingBundledTop", true);

		// Line-prefix
		new Setting(parent)
			.setName("Line-prefix")
			.setDesc("Text added to the start of each line of a formatted expansion.")
			.addText((text: any) =>
			{
				return text
					.setPlaceholder("")
					.setValue(settings.expansionLinePrefix)
					.onChange((value: string) =>
					{
						this._settings.expansionLinePrefix = value;
					});
			})
			.settingEl.toggleClass("iscript_settingBundled", true);

		// Suffix
		new Setting(parent)
			.setName("Suffix")
			.setDesc("Text added to the end of a formatted expansion.")
			.addText((text: any) =>
			{
				return text
					.setPlaceholder("")
					.setValue(settings.expansionSuffix)
					.onChange((value: string) =>
					{
						this._settings.expansionSuffix = value;
					});
			})
			.settingEl.toggleClass("iscript_settingBundled", true);
	}
}
