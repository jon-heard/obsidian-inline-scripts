///////////////////////////////////////////////////////////////////////////////////////////////////
// Setting ui shortcut format - Create and work with a setting for the format of shortcut input. //
///////////////////////////////////////////////////////////////////////////////////////////////////

abstract class SettingUi_ShortcutFormat
{
	// Create the setting ui
	public static create(parent: any, settings: any): void
	{
		return this.create_internal(parent, settings);
	}

	// Get the contents of the setting ui
	public static getContents(): any
	{
		return this.settings;
	}

	// Called before recording settings changes
	public static finalize(): void
	{
		this.finalize_internal();
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	private static settings: any;
	private static originalSettings: any;
	private static formatErrMsgContainerUi: any;
	private static formatErrMsgContentUi: any;
	private static shortcutExampleUi: any;

	private static create_internal(parent: any, settings: any): void
	{
		this.settings = { prefix: settings.prefix, suffix: settings.suffix };
		this.originalSettings = { prefix: settings.prefix, suffix: settings.suffix };

		parent.createEl("h2", { text: "Shortcut format" });

		// A ui for showing errors in shortcut format settings
		this.formatErrMsgContainerUi = parent.createEl("div", { cls: "tejs_errMsgContainer" });
		this.formatErrMsgContainerUi.createEl("span", { text: "ERROR", cls: "tejs_errMsgTitle" });
		this.formatErrMsgContentUi = this.formatErrMsgContainerUi.createEl("span");

		// Prefix
		new obsidian.Setting(parent)
			.setName("Prefix")
			.setDesc("What to type BEFORE a shortcut.")
			.addText((text: any) =>
			{
				return text
					.setPlaceholder("Prefix")
					.setValue(settings.prefix)
					.onChange((value: string) =>
					{
						this.settings.prefix = value;
						this.refreshShortcutExample();
						this.isFormatValid();
					});
			})
			.settingEl.toggleClass("tejs_settingBundledTop", !obsidian.Platform.isMobile);

		// Suffix
		new obsidian.Setting(parent)
			.setName("Suffix")
			.setDesc("What to type AFTER a shortcut.")
			.addText((text: any) =>
			{
				return text
					.setPlaceholder("Suffix")
					.setValue(settings.suffix)
					.onChange((value: string) =>
					{
						this.settings.suffix = value;
						this.refreshShortcutExample();
						this.isFormatValid();
					});
			})
			.settingEl.toggleClass("tejs_settingBundled", !obsidian.Platform.isMobile);

		// Example
		const exampleOuter: any = parent.createEl("div", { cls: "setting-item" });
		exampleOuter.toggleClass("tejs_settingBundled", !obsidian.Platform.isMobile);
		const exampleInfo: any = exampleOuter.createEl("div", { cls: "setting-item-info" });
		exampleInfo.createEl("div", { text: "Example", cls: "setting-item-name" });
		exampleInfo.createEl("div",
		{
			text: "How to write the shortcut \"D100\"",
			cls: "setting-item-description"
		});
		const exampleItemControl: any =
			exampleOuter.createEl("div", { cls: "setting-item-control" });
		this.shortcutExampleUi = exampleItemControl.createEl("div", { cls: "tejs_labelControl" });

		// Finish by filling example
		this.refreshShortcutExample();
	}

	private static finalize_internal(): void
	{
		if (!this.isFormatValid())
		{
			this.settings.prefix = this.originalSettings.prefix;
			this.settings.suffix = this.originalSettings.suffix;
		}
	}

	// Checks format settings for errors:
	//   - blank prefix or suffix
	//   - suffix contains prefix (disallowed as it messes up logic)
	private static isFormatValid(): boolean
	{
		let err: string = "";
		if (!this.settings.prefix)
		{
			err = "Prefix cannot be blank";
		}
		else if (!this.settings.suffix)
		{
			err = "Suffix cannot be blank";
		}
		else if (this.settings.suffix.includes(this.settings.prefix))
		{
			err = "Suffix cannot contain prefix";
		}

		if (!err)
		{
			this.formatErrMsgContainerUi.toggleClass(
				"tejs_errMsgContainerShown", false);
			return true;
		}
		else
		{
			this.formatErrMsgContainerUi.toggleClass(
				"tejs_errMsgContainerShown", true);
			this.formatErrMsgContentUi.innerText = err;
			return false;
		}
	}

	private static refreshShortcutExample(): void
	{
		this.shortcutExampleUi.innerText = this.settings.prefix + "D100" + this.settings.suffix;
	};
}
