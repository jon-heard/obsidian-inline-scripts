///////////////////////////////////////////////////////////////////////////////////////////////////
// Setting ui alerts - Alert ribbons that show when the plugin or library has updates available. //
///////////////////////////////////////////////////////////////////////////////////////////////////

"use strict";

import InlineScriptsPlugin from "./_Plugin";
import { HelperFncs } from "./HelperFncs";

export abstract class SettingUi_Alerts
{
	// Create the setting ui
	public static create(parent: any): void
	{
		return this.create_internal(parent);
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	private static create_internal(parent: any): void
	{
		// Plugin update alert
		let alert_pluginUpdate = parent.createEl("div", { cls: "iscript_alert iscript_hidden" });
		alert_pluginUpdate.innerText = "Plugin update available";
		alert_pluginUpdate.style["margin-top"] = "1em";

		// Plugin update check
		(async () => { try {
			// Get the latest version
			const latestVersion = (await window.request(
			{
				url: "https://api.github.com/repos/jon-heard/obsidian-inline-scripts/releases/latest",
				method: "GET", headers: { "Cache-Control": "no-cache" }
			})).match(/\"name\": \"(.*)\"/)[1];

			// Get the current version
			const currentVersion = InlineScriptsPlugin.getInstance().manifest.version;

			if (HelperFncs.versionCompare(currentVersion, latestVersion) < 0)
			{
				alert_pluginUpdate.toggleClass("iscript_hidden", false);
				alert_pluginUpdate.innerHTML += ": &nbsp; <b>" + latestVersion + "</b>";
			}
		} catch {} })();

		// Library update alert
		let alert_libraryUpdate = parent.createEl("div", { cls: "iscript_alert iscript_hidden" });
		alert_libraryUpdate.innerHTML = "Library update available <i>(re-import)</i>";
		alert_libraryUpdate.style["margin-top"] = "1em";
		alert_libraryUpdate.id = "alert_libraryUpdates";

		// Library update check
		(async () => { try {
			const plugin = InlineScriptsPlugin.getInstance();

			// Get the latest version
			const latestVersion = (await window.request(
			{
				url: "https://raw.githubusercontent.com/jon-heard/obsidian-inline-scripts-library/main/README.md",
				method: "GET", headers: { "Cache-Control": "no-cache" }
			})).match(/# Version (.*)/)[1] || "";

			// Get the current version
			let versionFilePath = "";
			const shortcutFiles = plugin.settings.shortcutFiles;
			for (const shortcutFile of shortcutFiles)
			{
				if (shortcutFile.address.endsWith("state.sfile.md"))
				{
					versionFilePath = shortcutFile.address.slice(0, 14) + "Ξ_libraryVersion.md";
					break;
				}
			}
			const versionFile = (plugin.app.vault as any).fileMap[versionFilePath];
			const currentVersion =
				!versionFile ? "" : (await plugin.app.vault.cachedRead(versionFile)) || "";

			if (HelperFncs.versionCompare(currentVersion, latestVersion) < 0)
			{
				alert_libraryUpdate.toggleClass("iscript_hidden", false);
				alert_libraryUpdate.innerHTML += ": &nbsp; <b>" + latestVersion + "</b>";
			}
		} catch {} })();
	}
}
