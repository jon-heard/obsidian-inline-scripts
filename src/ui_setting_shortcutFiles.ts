/////////////////////////////////////////////////////////////////////////////////////////////
// Setting ui shortcut files - Create and work with a setting of a list of shortcut-files. //
/////////////////////////////////////////////////////////////////////////////////////////////

"use strict";

import { Setting, normalizePath } from "obsidian";
import { SettingUi_Common } from "./ui_setting_common";
import { LibraryImporter } from "./LibraryImporter";

export abstract class SettingUi_ShortcutFiles
{
	// Create the setting ui
	public static create(parent: any, settings: any, app: any): void
	{
		return this.create_internal(parent, settings, app);
	}

	// Get the contents of the setting ui
	public static getContents(): any
	{
		return this.getContents_internal();
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	private static _shortcutFileUis: any;
	private static _vaultFiles: Array<string>;

	private static create_internal(parent: any, settings: any, app: any): void
	{
		// Refresh the file list (it may have changed since last time)
		this._vaultFiles = [];
		for (const key in app.vault.fileMap)
		{
			if (key.endsWith(".md"))
			{
				this._vaultFiles.push(key.slice(0, -3));
			}
		}

		new Setting(parent)
			.setName("Shortcut-files")
			.setDesc("Addresses of notes containing shortcut-file content.")
			.addButton((button: any) =>
			{
				return button
					.setButtonText("Add shortcut-file")
					.setClass("iscript_button")
					.onClick( () => this.addShortcutFileUi(app) );
			})
			.addButton((button: any) =>
			{
				return button
					.setButtonText("Import full library")
					.setClass("iscript_button")
					.onClick(() =>
					{
						LibraryImporter.run();
					});
			});
		this._shortcutFileUis = parent.createEl("div", { cls: "iscript_shortcutFiles" });
		this._shortcutFileUis.createEl("div", {
			text: "Red means the file does not exist.",
			cls: "setting-item-description iscript_extraMessage iscript_onSiblings"
		});

		// Add a filename ui item for each shortcut-file in settings
		for (const shortcutFile of settings.shortcutFiles)
		{
			this.addShortcutFileUi(app, shortcutFile);
		}
	}

	private static getContents_internal(): any
	{
		let result: Array<any> = [];
		for (const shortcutFileUi of this._shortcutFileUis.childNodes)
		{
			if (shortcutFileUi.classList.contains("iscript_shortcutFile") &&
			    shortcutFileUi.childNodes[1].value)
			{
				result.push(
				{
					enabled: shortcutFileUi.childNodes[0].classList.contains("is-enabled"),
					address: normalizePath( shortcutFileUi.childNodes[1].value + ".md" )
				});
			}
		}
		return { shortcutFiles: result };
	}

	private static addShortcutFileUi(app: any, shortcutFile?: any): void
	{
		let fileListUiId = "fileList" + this._shortcutFileUis.childNodes.length;
		let g: any = this._shortcutFileUis.createEl("div", { cls: "iscript_shortcutFile" });
		let e: any = g.createEl("div", { cls: "checkbox-container iscript_checkbox" });
			e.toggleClass("is-enabled", shortcutFile ? shortcutFile.enabled : true);
			e.addEventListener("click", function(this: any)
			{
				this.toggleClass("is-enabled", !this.classList.contains("is-enabled"));
			});
		e = g.createEl("input", { cls: "iscript_shortcutFileAddress" });
			e.setAttr("type", "text");
			e.setAttr("placeholder", "Filename");
			e.setAttr("list", fileListUiId);
			e.settings = this;
			// Handle toggling red on this textfield
			e.addEventListener("input", function(this: any)
			{
				const isBadInput: boolean =
					this.value && !this.settings._vaultFiles.contains(this.value);
				this.toggleClass("iscript_badInput", isBadInput);
			});
			// Assign given text argument to the textfield
			if (shortcutFile)
			{
				// Remove ".md" extension from filename
				e.setAttr("value", shortcutFile.address.slice(0, -3));
			}
			e.dispatchEvent(new Event("input"));
		e = g.createEl("datalist");
			e.id = fileListUiId;
			for (const file of this._vaultFiles)
			{
				e.createEl("option").value = file;
			}
		e = g.createEl("button", { cls: "iscript_upButton iscript_button" });
			e.group = g;
			e.onclick = SettingUi_Common.upButtonClicked;
			e.listOffset = 1;
		e = g.createEl("button", { cls: "iscript_downButton iscript_button" });
			e.group = g;
			e.onclick = SettingUi_Common.downButtonClicked;
		e = g.createEl("button", { cls: "iscript_deleteButton iscript_button" });
			e.group = g;
			e.onclick = SettingUi_Common.deleteButtonClicked;
			e.app = app;
			e.typeTitle = "shortcut-file";
	};
}
