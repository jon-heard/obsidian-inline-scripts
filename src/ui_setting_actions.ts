/////////////////////////////////////////////////////////////////////
// Setting ui actions - Buttons to perform Inline Scripts actions. //
/////////////////////////////////////////////////////////////////////

"use strict";

import InlineScriptsPlugin from "./_Plugin";
import { ButtonView } from "./ui_ButtonView";
import { Popups } from "./ui_Popups";

export abstract class SettingUi_Actions
{
	// Create the setting ui
	public static create(parent: any): void
	{
		return this.create_internal(parent);
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	private static create_internal(parent: any): void
	{
		// Actions header & container
		parent.createEl("div").innerHTML = "&nbsp;";
		parent.createEl("h2", { text: "Actions" });
		const actionsDiv = parent.createEl("div", { cls: "iscript_actionsSection" });

		// Open button-view button
		const openButtonsView =
			actionsDiv.createEl("button", { text: "Open buttons view" });
		openButtonsView.toggleClass("iscript_button_disabled", ButtonView.isOpen());
		openButtonsView.onclick = async () =>
		{
			// Ignore disabled button
			if (openButtonsView.classList.contains("iscript_button_disbled")) { return; }

			// Add buttonview
			ButtonView.activateView(true);

			// Disable this button
			openButtonsView.toggleClass("iscript_button_disabled", true);
		};

		//Space
		actionsDiv.createEl("div").innerHTML = "&nbsp;";

		// Reset settings button
		const resetSettings = actionsDiv.createEl("button", { text: "Reset settings to defaults" });
		resetSettings.onclick = async () =>
		{
			const plugin = InlineScriptsPlugin.getInstance();
			if (await Popups.getInstance().confirm(
				"Confirm resetting ALL settings to their default values."))
			{
				plugin.settings = InlineScriptsPlugin.getDefaultSettings();
				plugin.settingsUi.display();
				plugin.settings.shortcuts = "";
			}
		};
	}
}
