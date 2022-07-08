///////////////////////////////////////////////////////////////////////////////////
// Setting ui shortcuts - Create and work with a setting of a list of shortcuts. //
///////////////////////////////////////////////////////////////////////////////////

abstract class SettingUi_Shortcuts
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

	private static _shortcutUis: any;

	private static create_internal(parent: any, settings: any, app: any): void
	{
		new obsidian.Setting(parent)
			.setName("Shortcuts")
			.setDesc("Define shortcuts here (in addition to shortcut-files)")
			.addButton((button: any) =>
			{
				return button
					.setButtonText("Add shortcut")
					.setClass("tejs_button")
					.onClick( () => this.addShortcutUi(app) );
			})
			.addButton((button: any) =>
			{
				return button
					.setButtonText("Add defaults")
					.setClass("tejs_button")
					.onClick(( () =>
					{
						let defaultShortcuts: Array<any> = ShortcutLoader.parseShortcutFile(
							"Settings", DEFAULT_SETTINGS.shortcuts, true, true).shortcuts;

						// We don't want to duplicate shortcuts, and it's important to keep
						// defaults in-order.  Remove any shortcuts from the ui list that are part
						// of the defaults before adding the defaults to the end of the ui list.
						this.removeShortcutsFromUi(DEFAULT_SETTINGS.shortcuts);

						for (const defaultShortcut of defaultShortcuts)
						{
							this.addShortcutUi(app, defaultShortcut);
						}
					} ).bind(this));
			});
		this._shortcutUis = parent.createEl("div", { cls: "tejs_shortcuts" });

		// Add a shortcut ui item for each shortcut in settings
		const shortcuts: Array<any> = ShortcutLoader.parseShortcutFile(
			"Settings", settings.shortcuts, true, true).shortcuts;
		for (const shortcut of shortcuts)
		{
			this.addShortcutUi(app, shortcut);
		}
	}

	private static getContents_internal(): any
	{
		let result: string = "";
		for (const shortcutUi of this._shortcutUis.childNodes)
		{
			// Only accept shortcuts with a non-empty Expansion string
			if (!shortcutUi.childNodes[4].value) { continue; }

			result +=
				"~~\n" + shortcutUi.childNodes[0].value + "\n" +
				"~~\n" + shortcutUi.childNodes[4].value + "\n" +
				"~~\n" + shortcutUi.childNodes[5].value + "\n\n";
		}

		return { shortcuts: result };
	}

	private static addShortcutUi(app: any, shortcut?: any): void
	{
		let g: any = this._shortcutUis.createEl("div", { cls: "tejs_shortcut" });
		let e: any = g.createEl("input", { cls: "tejs_shortcutTest" });
			e.setAttr("type", "text");
			e.setAttr("placeholder", "Test (regex)");
			if (shortcut)
			{
				e.value = shortcut.test.source;

				// Translate regex compiled "blank" test
				if (e.value == "(?:)")
				{
					e.value = "";
				}
			}
		e = g.createEl("button", { cls: "tejs_upButton tejs_button" });
			e.group = g;
			e.onclick = SettingUi_Common.upButtonClicked;
			e.listOffset = 0;
		e = g.createEl("button", { cls: "tejs_downButton tejs_button" });
			e.group = g;
			e.onclick = SettingUi_Common.downButtonClicked;
		e = g.createEl("button", { cls: "tejs_deleteButton tejs_button" });
			e.group = g;
			e.onclick = SettingUi_Common.deleteButtonClicked;
			e.app = app;
			e.typeTitle = "shortcut";
		e = g.createEl("textarea", { cls: "tejs_shortcutExpansion" });
			e.setAttr("placeholder", "Expansion (javascript)");
			if (shortcut)
			{
				e.value = shortcut.expansion;
			}
		e = g.createEl("textarea", { cls: "tejs_shortcutAbout" });
			e.setAttr("placeholder", "About (text)");
			if (shortcut)
			{
				e.value = shortcut.about;
			}
	};

	// Takes a list of shortcuts, and removes them from the ui, if they are there.
	// @ts-ignore
	private static removeShortcutsFromUi(shortcuts: any): void
	{
		let toRemove: Array<any> = [];
		for (const shortcutUi of this._shortcutUis.childNodes)
		{
			const test: string = shortcutUi.childNodes[0].value;
			const expansion: string = shortcutUi.childNodes[4].value;
			for (let k: number = 0; k < shortcuts.length; k++)
			{
				if (shortcuts[k].expansion != expansion) { continue; }
				if (shortcuts[k].test.source != test &&
				    (shortcuts[k].test.source != "(?:)" || test != ""))
				{
					continue;
				}
				toRemove.push(shortcutUi);
				break;
			}
		}
		for (const shortcutUi of toRemove)
		{
			shortcutUi.remove();
		}
	}
}
