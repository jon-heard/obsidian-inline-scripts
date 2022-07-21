//////////////////////////////////////////////////////////////////////////////////////////////
// Setting ui other - Create and work with the miscelaneous settings not handled elsewhere. //
//////////////////////////////////////////////////////////////////////////////////////////////

abstract class SettingUi_Other
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
		new obsidian.Setting(parent)
			.setName("Developer mode")
			.setDesc("Shortcut-files are monitored for updates if this is on.")
			.addToggle((toggle: any) =>
			{
				return toggle
					.setValue(settings.devMode)
					.onChange((value: string) => this._settings.devMode = value );
			});

		// Allow external (not available on mobile)
		if (!obsidian.Platform.isMobile)
		{
			new obsidian.Setting(parent)
				.setName("Allow external")
				.setDesc("Shortcuts can run external commands if this is on.")
				.addToggle((toggle: any) =>
				{
					return toggle
						.setValue(settings.allowExternal)
						.onChange((value: string) => this._settings.allowExternal = value );
				})
				.descEl.createEl("div", {
					cls: "tejs_warning",
					text: "WARNING: enabling this increases the danger from malicious shortcuts" });
		}

		new obsidian.Setting(parent)
			.setName("Reset to defaults")
			.setDesc("Reset all settings to their default values.")
			.addButton((button: any) =>
			{
				return button
					.setButtonText("Reset to defaults")
					.setClass("tejs_button")
					.onClick(() =>
					{
						const plugin = TextExpanderJsPlugin.getInstance();
						new Popup_Confirm(
							plugin.app,
							"Confirm resetting ALL settings to their default values.",
							(confirmation: boolean) =>
							{
								if (confirmation)
								{
									plugin.settings = TextExpanderJsPlugin.getDefaultSettings();
									plugin.settingsUi.display();
									plugin.settings.shortcuts = "";
								}
							}
						).open();
					});
			});
	}
}
