///////////////////////////////////////////////////////////////////////////////////////////////////
// Setting ui shortcut format - Create and work with a setting for the format of shortcut input. //
///////////////////////////////////////////////////////////////////////////////////////////////////

"use strict";

import { Setting, Platform } from "obsidian";

export abstract class SettingUi_ShortcutFormat
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

	// Called before recording settings changes
	public static finalize(): void
	{
		this.finalize_internal();
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	private static _settings: any;
	private static _originalSettings: any;
	private static _formatErrMsgContainerUi: any;
	private static _formatErrMsgContentUi: any;
	private static _shortcutExampleUi: any;

	private static create_internal(parent: any, settings: any): void
	{
		this._settings = { prefix: settings.prefix, suffix: settings.suffix };
		this._originalSettings = { prefix: settings.prefix, suffix: settings.suffix };

		parent.createEl("h2", { text: "Shortcut format" });

		// A ui for showing errors in shortcut format settings
		this._formatErrMsgContainerUi = parent.createEl("div", { cls: "iscript_errMsgContainer" });
		this._formatErrMsgContainerUi.createEl("span", { text: "ERROR", cls: "iscript_errMsgTitle" });
		this._formatErrMsgContentUi = this._formatErrMsgContainerUi.createEl("span");

		// Prefix
		new Setting(parent)
			.setName("Shortcut prefix")
			.setDesc("What to type BEFORE a shortcut.")
			.addText((text: any) =>
			{
				return text
					.setPlaceholder("Prefix")
					.setValue(settings.prefix)
					.onChange((value: string) =>
					{
						this._settings.prefix = value;
						this.refreshShortcutExample();
						this.isFormatValid();
					});
			})
			.settingEl.toggleClass("iscript_settingBundledTop", !Platform.isMobile);

		// Suffix
		new Setting(parent)
			.setName("Shortcut suffix")
			.setDesc("What to type AFTER a shortcut.")
			.addText((text: any) =>
			{
				return text
					.setPlaceholder("Suffix")
					.setValue(settings.suffix)
					.onChange((value: string) =>
					{
						this._settings.suffix = value;
						this.refreshShortcutExample();
						this.isFormatValid();
					});
			})
			.settingEl.toggleClass("iscript_settingBundled", !Platform.isMobile);

		// Example
		const exampleOuter: any = parent.createEl("div", { cls: "setting-item" });
		exampleOuter.toggleClass("iscript_settingBundled", !Platform.isMobile);
		const exampleInfo: any = exampleOuter.createEl("div", { cls: "setting-item-info" });
		exampleInfo.createEl("div", { text: "Example", cls: "setting-item-name" });
		exampleInfo.createEl("div",
		{
			text: "How to write the shortcut \"D100\"",
			cls: "setting-item-description"
		});
		const exampleItemControl: any =
			exampleOuter.createEl("div", { cls: "setting-item-control" });
		this._shortcutExampleUi = exampleItemControl.createEl("div", { cls: "iscript_labelControl" });

		// Finish by filling example
		this.refreshShortcutExample();
	}

	private static finalize_internal(): void
	{
		if (!this.isFormatValid())
		{
			this._settings.prefix = this._originalSettings.prefix;
			this._settings.suffix = this._originalSettings.suffix;
		}
	}

	// Checks format settings for errors:
	//   - blank prefix or suffix
	//   - suffix contains prefix (disallowed as it messes up logic)
	private static isFormatValid(): boolean
	{
		let err: string = "";
		if (!this._settings.prefix)
		{
			err = "Prefix cannot be blank";
		}
		else if (!this._settings.suffix)
		{
			err = "Suffix cannot be blank";
		}
		else if (this._settings.suffix.includes(this._settings.prefix))
		{
			err = "Suffix cannot contain prefix";
		}
		else if (this._settings.prefix.match(/\*|\(|\_|\{|\[|\'|\"|\`/) ||
		         this._settings.suffix.match(/\*|\(|\_|\{|\[|\'|\"|\`/))
		{
			err = "Prefix and suffix cannot contain characters with auto-complete: * ( _ { [ ' \" `";
		}

		if (!err)
		{
			this._formatErrMsgContainerUi.toggleClass(
				"iscript_errMsgContainerShown", false);
			return true;
		}
		else
		{
			this._formatErrMsgContainerUi.toggleClass(
				"iscript_errMsgContainerShown", true);
			this._formatErrMsgContentUi.innerText = err;
			return false;
		}
	}

	private static refreshShortcutExample(): void
	{
		this._shortcutExampleUi.innerText = this._settings.prefix + "D100" + this._settings.suffix;
	};
}
