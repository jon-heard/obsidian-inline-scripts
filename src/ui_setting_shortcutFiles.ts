/////////////////////////////////////////////////////////////////////////////////////////////
// Setting ui shortcut files - Create and work with a setting of a list of shortcut-files. //
/////////////////////////////////////////////////////////////////////////////////////////////

abstract class SettingUi_ShortcutFiles
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

	private static create_internal(parent: any, settings: any, app: any): void
	{
		new obsidian.Setting(parent)
			.setName("Shortcut-files")
			.setDesc("Addresses of notes containing shortcut-file content.")
			.addButton((button: any) =>
			{
				return button
					.setButtonText("Add file reference")
					.setClass("tejs_button")
					.onClick( () => this.addShortcutFileUi(app) );
			})
			.addButton((button: any) =>
			{
				return button
					.setButtonText("Import full library")
					.setClass("tejs_button")
					.onClick(() =>
					{
						new ConfirmDialogBox(
							app,
							"Confirm importing the full shortcut-" +
							"files library into this vault.",
							(confirmation: boolean) =>
							{
								if (confirmation)
								{
									LibraryImporter.run();
								}
							}
						).open();
					});
			});
		this._shortcutFileUis = parent.createEl("div", { cls: "tejs_shortcutFiles" });
		this._shortcutFileUis.createEl("div", {
			text: "Red means the file does not exist.",
			cls: "setting-item-description tejs_extraMessage tejs_onSiblings"
		});

		// Add a filename ui item for each shortcut-file in settings
		for (const shortcutFile of settings.shortcutFiles)
		{
			this.addShortcutFileUi(app, shortcutFile);
		}
	}

	private static getContents_internal(): any
	{
		let result: Array<string> = [];
		for (const shortcutFileUi of this._shortcutFileUis.childNodes)
		{
			if (shortcutFileUi.childNodes[0].value)
			{
				result.push(obsidian.normalizePath( shortcutFileUi.childNodes[0].value + ".md" ));
			}
		}
		return { shortcutFiles: result };
	}

	private static addShortcutFileUi(app: any, filename?: string): void
	{
		let g: any = this._shortcutFileUis.createEl("div", { cls: "tejs_shortcutFile" });
		let e: any = g.createEl("input", { cls: "tejs_shortcutFileAddress" });
			e.setAttr("type", "text");
			e.setAttr("placeholder", "Filename");
			e.app = app;
			// Handle toggling red on this textfield
			e.addEventListener("input", function()
			{
				const isBadInput: boolean =
					(this.value && !this.app.vault.fileMap[this.value+".md"]);
				this.toggleClass("tejs_badInput", isBadInput);
			});
			// Assign given text argument to the textfield
			if (filename)
			{
				// Remove ".md" extension from filename
				filename = filename.substr(0, filename.length - 3);
				e.setAttr("value", filename);
			}
			e.dispatchEvent(new Event("input"));
		e = g.createEl("button", { cls: "tejs_upButton tejs_button" });
			e.group = g;
			e.onclick = SettingUi_Common.upButtonClicked;
			e.listOffset = 1;
		e = g.createEl("button", { cls: "tejs_downButton tejs_button" });
			e.group = g;
			e.onclick = SettingUi_Common.downButtonClicked;
		e = g.createEl("button", { cls: "tejs_deleteButton tejs_button" });
			e.group = g;
			e.onclick = SettingUi_Common.deleteButtonClicked;
			e.app = app;
			e.typeTitle = "shortcut-file";
	};
}
