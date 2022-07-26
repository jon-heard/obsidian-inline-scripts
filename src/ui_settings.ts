//////////////////////////////////////////////////////////////////
// Settings - the settings ui and logic for this plugin project //
//////////////////////////////////////////////////////////////////

"use strict";

class InlineScriptsPluginSettings extends obsidian.PluginSettingTab
{
	public constructor(plugin: InlineScriptsPlugin)
	{
		super(plugin.app, plugin);
	}

	public display(): void
	{
		this.display_internal();
	}

	public hide(): void
	{
		this.hide_internal();
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	private display_internal(): void
	{
		const c: any = this.containerEl;
		c.empty();

		// App version (in header)
		c.createEl("div", { text: this.plugin.manifest.version, cls: "iscript_version" });

		c.createEl("h2", { text: "Shortcut Sources" });

		// Shortcut-files setting
		SettingUi_ShortcutFiles.create(c, this.plugin.settings, this.plugin.app);

		// Shortcuts setting
		SettingUi_Shortcuts.create(c, this.plugin.settings, this.plugin.app);

		// Shortcut format settings
		SettingUi_ShortcutFormat.create(c, this.plugin.settings);

		// Other settings
		SettingUi_Other.create(c, this.plugin.settings);

		// App version (in footer)
		c.createEl("div", { text: this.plugin.manifest.version, cls: "iscript_version" });
	}

	// THIS is where settings are saved!
	private hide_internal(): void
	{
		let newSettings: any = {};

		// Get the format settings
		SettingUi_ShortcutFormat.finalize();
		Object.assign(newSettings, SettingUi_ShortcutFormat.getContents());

		// Get the other settings
		Object.assign(newSettings, SettingUi_Other.getContents());

		// Get shortcut-files list
		Object.assign(newSettings, SettingUi_ShortcutFiles.getContents());

		// Get shortcuts list
		Object.assign(newSettings, SettingUi_Shortcuts.getContents());

		/////////////////////////////////////////////////////
		// Determine if shortcuts setting was changed.     //
		// If so, set "forceRefreshShortcuts" for the Dfc. //
		/////////////////////////////////////////////////////
		const oldShortcuts: any = ShortcutLoader.parseShortcutFile(
			"", this.plugin.settings.shortcuts, true, true).shortcuts;
		const newShortcuts: any = ShortcutLoader.parseShortcutFile(
			"", newSettings.shortcuts, true, true).shortcuts;
		// Start by comparing list counts
		let forceRefreshShortcuts: boolean = (newShortcuts.length !== oldShortcuts.length);
		// If old & new shortcut settings have the same list count, check each individual shortcut
		// for a change between old and new
		if (!forceRefreshShortcuts)
		{
			for (let i: number = 0; i < newShortcuts.length; i++)
			{
				if (newShortcuts[i].test.source !== oldShortcuts[i].test.source ||
				    newShortcuts[i].expansion !== oldShortcuts[i].expansion ||
				    newShortcuts[i].about !== oldShortcuts[i].about)
				{
					forceRefreshShortcuts = true;
					break;
				}
			}
		}

		// Replace old settings with new
		this.plugin.settings = newSettings;

		// Update the Dfc monitor-mode based on devmode setting.
		this.plugin.shortcutDfc.setMonitorType(
			this.plugin.settings.devMode ? DfcMonitorType.OnTouch : DfcMonitorType.OnModify);

		// Update the Dfc file-list based on list of shortcut files.
		this.plugin.shortcutDfc.updateFileList(
			this.plugin.getActiveShortcutFileAddresses(), forceRefreshShortcuts);

		// Update variable for the suffix's final character
		this.plugin.suffixEndCharacter =
			this.plugin.settings.suffix.charAt(this.plugin.settings.suffix.length - 1);

		// Store the settings to file
		this.plugin.saveSettings();
	}
}
