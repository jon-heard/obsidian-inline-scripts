
class TextExpanderJsPluginSettings extends obsidian.PluginSettingTab
{
	public constructor(app: any, plugin: any)
	{
		super(app, plugin);
		this.plugin = plugin;

		// Keep a copy of the current settings to modify
		this.tmpSettings = undefined;

		// Keep the ui for format errors, for updating
		this.formattingErrMsgContainer = undefined;
		this.formattingErrMsgContent = undefined;

		// Hold a LibraryImporter instance, in case the user opts to import the library
		this.libraryImporter = new LibraryImporter(plugin, this);
	}

	public display()
	{
		// Clone temporary settings from plugin's settings
		this.tmpSettings = JSON.parse(JSON.stringify(this.plugin.settings));

		const c: any = this.containerEl;
		c.empty();

		// General button callbacks
		const deleteButtonClicked: Function = function()
		{
			new ConfirmDialogBox(
				this.plugin.app,
				"Confirm removing a " + this.typeTitle + ".",
				(confirmation: boolean) =>
				{
					if (confirmation)
					{
						this.group.remove();
					}
				}
			).open();
		};
		const upButtonClicked: Function = function()
		{
			let p: any = this.group.parentElement;
			let index: number = Array.from(p.childNodes).indexOf(this.group);
			if (index == this.listOffset) { return; }
			p.insertBefore(p.childNodes[index], p.childNodes[index - 1]);
		};
		const downButtonClicked: Function = function()
		{
			let p: any = this.group.parentElement;
			let index: number = Array.from(p.childNodes).indexOf(this.group);
			if (index == p.childNodes.length - 1) { return; }
			index++;
			p.insertBefore(p.childNodes[index], p.childNodes[index - 1]);
		};

		// App version (in header)
		c.createEl("div", { text: this.plugin.manifest.version, cls: "tejs_version" });

		c.createEl("h2", { text: "Shortcut Sources" });

		////////////////////
		// SHORTCUT-FILES //
		////////////////////
		new obsidian.Setting(c)
			.setName("Shortcut-files")
			.setDesc("Addresses of notes containing shortcut-file content.")
			.addButton((button: any) =>
			{
				return button
					.setButtonText("Add file reference")
					.setClass("tejs_button")
					.onClick(() =>
					{
						addShortcutFileUi();
					});
			})
			.addButton((button: any) =>
			{
				return button
					.setButtonText("Import full library")
					.setClass("tejs_button")
					.onClick(() =>
					{
						new ConfirmDialogBox(
							this.plugin.app,
							"Confirm importing the full shortcut-" +
							"files library into this vault.",
							(confirmation: boolean) =>
							{
								if (confirmation)
								{
									this.libraryImporter.execute();
								}
							}
						).open();
					});
			});
		this.shortcutFileUis = c.createEl("div", { cls: "tejs_shortcutFiles" });
		this.shortcutFileUis.createEl("div", {
			text: "Red means the file does not exist.",
			cls: "setting-item-description tejs_extraMessage tejs_onSiblings"
		});
		const addShortcutFileUi: Function = (text?: string) =>
		{
			let g: any = this.shortcutFileUis.createEl("div", { cls: "tejs_shortcutFile" });
			let e: any = g.createEl("input", { cls: "tejs_shortcutFileAddress" });
				e.setAttr("type", "text");
				e.setAttr("placeholder", "Filename");
				e.plugin = this.plugin;
				// Handle toggling red on this textfield
				e.addEventListener("input", function()
				{
					const isBadInput: boolean =
						this.value &&
						!this.plugin.app.vault.fileMap[this.value+".md"]
					this.toggleClass("tejs_badInput", isBadInput);
				});
				// Assign given text argument to the textfield
				if (text)
				{
					// Remove ".md" extension from filename
					text = text.substr(0, text.length - 3);
					e.setAttr("value", text);
				}
				e.dispatchEvent(new Event("input"));
			e = g.createEl("button", { cls: "tejs_upButton tejs_button" });
				e.group = g;
				e.onclick = upButtonClicked;
				e.listOffset = 1;
			e = g.createEl("button", { cls: "tejs_downButton tejs_button" });
				e.group = g;
				e.onclick = downButtonClicked;
			e = g.createEl("button", { cls: "tejs_deleteButton tejs_button" });
				e.group = g;
				e.onclick = deleteButtonClicked;
				e.plugin = this.plugin;
				e.typeTitle = "shortcut-file";
		};
		// Add a filename ui item for each shortcut-file in settings
		for (const shortcutFile of this.tmpSettings.shortcutFiles)
		{
			addShortcutFileUi(shortcutFile);
		}

		///////////////
		// SHORTCUTS //
		///////////////
		new obsidian.Setting(c)
			.setName("Shortcuts")
			.setDesc("Define shortcuts here (in addition to shortcut-files)")
			.addButton((button: any) =>
			{
				return button
					.setButtonText("Add shortcut")
					.setClass("tejs_button")
					.onClick(() =>
					{
						addShortcutUi();
					});
			})
			.addButton((button: any) =>
			{
				return button
					.setButtonText("Add defaults")
					.setClass("tejs_button")
					.onClick(function()
					{
						let defaultShortcuts: Array<any> =
							this.plugin.parseShortcutFile("Settings",
							DEFAULT_SETTINGS.shortcuts, true, true).
							shortcuts;

						// We don't want to duplicate shortcuts, and it's
						// important to keep defaults in-order.  Remove
						// any shortcuts from the ui list that are part
						// of the defaults before adding the defaults to
						// the end of the ui list.
						this.removeShortcutsFromUi(defaultShortcuts);

						for (const defaultShortcut of defaultShortcuts)
						{
							addShortcutUi(defaultShortcut);
						}
					}.bind(this));
			});
		this.shortcutUis = c.createEl("div", { cls: "tejs_shortcuts" });
		const addShortcutUi: Function = (shortcut?: any) =>
		{
			let g: any = this.shortcutUis.createEl("div", { cls: "tejs_shortcut" });
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
				e.onclick = upButtonClicked;
				e.listOffset = 0;
			e = g.createEl("button", { cls: "tejs_downButton tejs_button" });
				e.group = g;
				e.onclick = downButtonClicked;
			e = g.createEl("button", { cls: "tejs_deleteButton tejs_button" });
				e.group = g;
				e.onclick = deleteButtonClicked;
				e.plugin = this.plugin;
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
		// Add a shortcut ui item for each shortcut in settings
		const shortcuts: any = this.plugin.parseShortcutFile(
			"Settings", this.tmpSettings.shortcuts, true, true).shortcuts;
		for (const shortcut of shortcuts)
		{
			addShortcutUi(shortcut);
		}

		/////////////////////
		// SHORTCUT FORMAT //
		/////////////////////
		c.createEl("h2", { text: "Shortcut format" });

		// A ui for showing errors in shortcut format settings
		this.formattingErrMsgContainer =
			c.createEl("div", { cls: "tejs_errMsgContainer" });
		const errMsgTitle: any = this.formattingErrMsgContainer.createEl(
			"span", { text: "ERROR", cls: "tejs_errMsgTitle" });
		this.formattingErrMsgContent = this.formattingErrMsgContainer.createEl("span");

		// Prefix
		new obsidian.Setting(c)
			.setName("Prefix")
			.setDesc("What to type BEFORE a shortcut.")
			.addText((text: any) =>
			{
				return text
					.setPlaceholder("Prefix")
					.setValue(this.tmpSettings.prefix)
					.onChange((value: string) =>
					{
						this.tmpSettings.prefix = value;
						refreshShortcutExample();
						this.checkFormatValid();
					});
			})
			.settingEl.toggleClass("tejs_settingBundledTop", !obsidian.Platform.isMobile);

		// Suffix
		new obsidian.Setting(c)
			.setName("Suffix")
			.setDesc("What to type AFTER a shortcut.")
			.addText((text: any) =>
			{
				return text
					.setPlaceholder("Suffix")
					.setValue(this.tmpSettings.suffix)
					.onChange((value: string) =>
					{
						this.tmpSettings.suffix = value;
						refreshShortcutExample();
						this.checkFormatValid();
					});
			})
			.settingEl.toggleClass("tejs_settingBundled", !obsidian.Platform.isMobile);

		// Example
		const exampleOuter: any = c.createEl("div", { cls: "setting-item" });
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
		let shortcutExample: any = exampleItemControl.createEl("div", { cls: "tejs_labelControl" });
		const refreshShortcutExample: Function = () =>
		{
			shortcutExample.innerText =
				this.tmpSettings.prefix +
				"D100" +
				this.tmpSettings.suffix;
		};
		refreshShortcutExample();

		////////////////////
		// OTHER SETTINGS //
		////////////////////
		c.createEl("h2", { text: "Other Settings" });

		// Developer mode
		new obsidian.Setting(c)
			.setName("Developer mode")
			.setDesc("Shortcut-files are monitored for updates if this is on.")
			.addToggle((toggle: any) =>
			{
				return toggle
					.setValue(this.tmpSettings.devMode)
					.onChange((value: string) =>
					{
						this.tmpSettings.devMode = value;
					});
			});

		// Allow external (not available on mobile)
		if (!obsidian.Platform.isMobile)
		{
			new obsidian.Setting(c)
				.setName("Allow external")
				.setDesc("Shortcuts can run external commands if this is on.")
				.addToggle((toggle: any) =>
				{
					return toggle
						.setValue(this.tmpSettings.allowExternal)
						.onChange((value: string) =>
						{
							this.tmpSettings.allowExternal = value;
						});
				})
				.descEl.createEl("div", {
					cls: "tejs_warning",
					text: "WARNING: enabling this increases the danger from " +
					      "malicious shortcuts" });
		}

		// App version (in footer)
		c.createEl("div", { text: this.plugin.manifest.version, cls: "tejs_version" });
	}

	// THIS is where settings are saved!
	public hide()
	{
		// Get shortcut-files list
		this.tmpSettings.shortcutFiles = this.getShortcutFilesFromUi();

		// Build Shortcuts setting from UI (a string in Shortcut-file format)
		let shortcuts: Array<any> = this.getShortcutsFromUi();
		this.tmpSettings.shortcuts = "";
		for (const shortcut of shortcuts)
		{
			this.tmpSettings.shortcuts +=
				"~~\n" + shortcut.test + "\n" +
				"~~\n" + shortcut.expansion + "\n" +
				"~~\n" + shortcut.about + "\n\n";
		}

		// If the shortcut setting was changed, set the "forceRefreshShortcuts" variable.
		// Start easy: check for a change in the number of shortcuts in the setting.
		const oldShortcuts: any = this.plugin.parseShortcutFile(
			"", this.plugin.settings.shortcuts, true, true).shortcuts;
		const newShortcuts: any = this.plugin.parseShortcutFile(
			"", this.tmpSettings.shortcuts, true, true).shortcuts;
		let forceRefreshShortcuts: boolean = (newShortcuts.length != oldShortcuts.length);

		// If old & new shortcut settings have the same shortcut count, check each
		// individual shortcut for a change between old and new
		if (!forceRefreshShortcuts)
		{
			for (let i: number = 0; i < newShortcuts.length; i++)
			{
				if (newShortcuts[i].test.source != oldShortcuts[i].test.source ||
				    newShortcuts[i].expansion != oldShortcuts[i].expansion ||
				    newShortcuts[i].about != oldShortcuts[i].about)
				{
					forceRefreshShortcuts = true;
					break;
				}
			}
		}

		// If the new settings for prefix & suffix have errors in them, revert to the old
		// settings.
		if (!this.checkFormatValid())
		{
			this.tmpSettings.prefix = this.plugin.settings.prefix;
			this.tmpSettings.suffix = this.plugin.settings.suffix;
		}

		// Copy the old settings into the new settings
		this.plugin.settings = this.tmpSettings;

		// Dev mode - update setting from ui
		this.plugin.shortcutDfc.setMonitorType(
			this.plugin.settings.devMode ? DfcMonitorType.OnTouch : DfcMonitorType.OnModify);

		// Update the shortcut-files list data.  This needs to happen After the copy above
		this.plugin.shortcutDfc.updateFileList(
			this.plugin.settings.shortcutFiles, forceRefreshShortcuts);

		// Keep track of the last character in the shortcut suffix
		this.plugin.suffixEndCharacter =
			this.plugin.settings.suffix.charAt(this.plugin.settings.suffix.length - 1);

		// Store the settings to file
		this.plugin.saveSettings();
	}

	// Create a shortcut-files list from the shortcut-files UI
	public getShortcutFilesFromUi()
	{
		let result: Array<string> = [];
		for (const shortcutFileUi of this.shortcutFileUis.childNodes)
		{
			if (shortcutFileUi.childNodes[0].value)
			{
				result.push(obsidian.normalizePath(
					shortcutFileUi.childNodes[0].value + ".md"));
			}
		}
		return result;
	}


	private tmpSettings: any;
	private formattingErrMsgContainer: any;
	private formattingErrMsgContent: any;
	private libraryImporter: LibraryImporter;

	// Checks formatting settings for errors:
	//   - blank prefix or suffix
	//   - suffix contains prefix (disallowed as it messes up logic)
	private checkFormatValid()
	{
		let err: string = "";
		if (!this.tmpSettings.prefix)
		{
			err = "Prefix cannot be blank";
		}
		else if (!this.tmpSettings.suffix)
		{
			err = "Suffix cannot be blank";
		}
		else if (this.tmpSettings.suffix.includes(this.tmpSettings.prefix))
		{
			err = "Suffix cannot contain prefix";
		}

		if (!err)
		{
			this.formattingErrMsgContainer.toggleClass(
				"tejs_errMsgContainerShown", false);
			return true;
		}
		else
		{
			this.formattingErrMsgContainer.toggleClass(
				"tejs_errMsgContainerShown", true);
			this.formattingErrMsgContent.innerText = err;
			return false;
		}
	}

	// Create a shortcuts list from the shortcuts UI
	private getShortcutsFromUi()
	{
		let result: Array<any> = [];
		for (const shortcutUi of this.shortcutUis.childNodes)
		{
			// Accept any shortcuts with a non-empty Expansion string
			if (shortcutUi.childNodes[4].value)
			{
				result.push({
					test: shortcutUi.childNodes[0].value,
					expansion: shortcutUi.childNodes[4].value,
					about: shortcutUi.childNodes[5].value
				});
			}
		}
		return result;
	}

	// Takes a list of shortcuts, and removes them from the ui, if they are there.
	private removeShortcutsFromUi(shortcuts: any)
	{
		let toRemove: Array<any> = [];
		for (const shortcutUi of this.shortcutUis.childNodes)
		{
			const test: string = shortcutUi.childNodes[0].value;
			const expansion: string = shortcutUi.childNodes[4].value;
			for (let k: number = 0; k < shortcuts.length; k++)
			{
				if (shortcuts[k].expansion != expansion)
				{
					continue;
				}
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
