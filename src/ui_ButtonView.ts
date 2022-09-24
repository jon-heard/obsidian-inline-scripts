/////////////////////////////////////////////////////////////////////////////////////////////////
// ButtonsView - A sidepanel for adding buttons to.  Each button triggers a specific shortcut. //
/////////////////////////////////////////////////////////////////////////////////////////////////

"use strict";

import { ItemView, WorkspaceLeaf, addIcon } from "obsidian";
import InlineScriptsPlugin from "./_Plugin";
import { ShortcutExpander } from "./ShortcutExpander";
import { Popups } from "./ui_Popups";
import { UserNotifier } from "./ui_userNotifier";
import { HelperFncs } from "./HelperFncs";
import { DragReorder } from "./ui_dragReorder";

const SFILE_BUTTON_PARAMETER_CAPTION: string = "Enter a value for\n<b>%1</b>\n<i>%2</i>\n";
const SFILE_GROUP_PREFIX: string = "[sfile] ";

let BUTTON_VIEW_STATES: any =
{
	normal:
	{
		prefix: "",
		onClick: async (buttonUi: any) =>
		{
			const buttonDefinition =
				ButtonView.getInstance().getButtonGroup().buttons[buttonUi.dataset.index];

			const expansion = await ShortcutExpander.expand(
					buttonDefinition.shortcut, false, { isUserTriggered: true },
					buttonDefinition.parameterData);

			HelperFncs.appendToEndOfNote(expansion);
		}
	},
	help:
	{
		prefix: "❔   ",
		onClick: async (buttonUi: any) =>
		{
			const buttonDefinition =
				ButtonView.getInstance().getButtonGroup().buttons[buttonUi.dataset.index];
			ButtonView.getInstance().helpUi.innerHTML =
				buttonDefinition.help ?
				"<b>" + buttonDefinition.display.replaceAll("<", "&lt;") + "</b><br/>" +
					HelperFncs.parseMarkdown(buttonDefinition.help) :
				"";
		},
		onStateStart: () =>
		{
			const helpUi = ButtonView.getInstance().helpUi;
			helpUi.innerText = "";
			ButtonView.getInstance().helpUi.style.display = "block";
		},
		onStateEnd: () =>
		{
			const helpUi = ButtonView.getInstance().helpUi;
			helpUi.style.display = "none";
		}
	},
	delete:
	{
		prefix: "✖   ",
		onClick: async (buttonUi: any) =>
		{
			const buttonTitle = buttonUi.innerText.slice(3);
			if (!(await Popups.getInstance().confirm(
				"Confirm removing the shortcut button \"" + buttonTitle + "\"")))
			{
				return;
			}
			buttonUi.remove();
		},
		onStateEnd: () =>
		{
			ButtonView.getInstance().refreshSettingsFromUi();
		}
	},
	edit:
	{
		prefix: "⚙   ",
		onClick: async (buttonUi: any) =>
		{
			ButtonView.getInstance().toggleState("normal");
			const buttonDefinition =
				ButtonView.getInstance().getButtonGroup().buttons[buttonUi.dataset.index];
			await Popups.getInstance().custom(
				"Modify this button", POPUP_DEFINITION_BUTTON,
				{ definition: buttonDefinition });
		}
	},
	reorder:
	{
		prefix: "↕   ",
		onButtonsAdded: (container: any) =>
		{
			BUTTON_VIEW_STATES.reorder.dragSystem = new DragReorder(container);
		},
		onStateEnd: () =>
		{
			BUTTON_VIEW_STATES.reorder.dragSystem = null;
			ButtonView.getInstance().refreshSettingsFromUi();
		}
	}
};


const POPUP_DEFINITION_BUTTON: any = Object.freeze(
{
	onOpen: async (data: any, parent: any, firstButton: any, SettingType: any) =>
	{
		new SettingType(parent)
			.setName("Display")
			.setDesc("Text shown on the button.")
			.addText((text: any) =>
			{
				data.displayUi = text;
				text.setValue(data.definition?.display ?? "");
				text.inputEl.setAttr("placeholder", "Display text");
				text.inputEl.addEventListener("keypress", (e: any) =>
				{
					if (e.key === "Enter") { data.shortcutUi.inputEl.select(); }
				});
				text.inputEl.select();
				return text;
			});
		const settings = InlineScriptsPlugin.getInstance().settings;
		new SettingType(parent)
			.setName("Shortcut")
			.addText((text: any) =>
			{
				data.shortcutUi = text;
				text.setValue("" + (data.definition?.shortcut ?? ""));
				text.inputEl.setAttr("placeholder", "Shortcut text");
				text.inputEl.addEventListener("keypress", (e: any) =>
				{
					if (e.key === "Enter") { data.helpUi.inputEl.select(); }
				});
				return text;
			})
			.descEl.innerHTML +=
				"When the button is clicked, this is expanded.  The<br/>" +
				"expansion is then appended to the current note.<br/>" +
				"Don't include a prefix or suffix ( <b>" + settings.prefix + "</b> or <b>" +
				settings.suffix + "</b> ).  <br/>" +
				"Add \"???\" blocks to be defined at button click.";

		new SettingType(parent)
			.setName("Help")
			.setDesc("Help text for this button.")
			.addText((text: any) =>
			{
				data.helpUi = text;
				text.setValue("" + (data.definition?.help ?? ""));
				text.inputEl.setAttr("placeholder", "Help text");
				text.inputEl.addEventListener("keypress", (e: any) =>
				{
					if (e.key === "Enter") { firstButton.click(); }
				});
				return text;
			});

		data.detailUis = [];
		const addParameterDatum: Function = (parameterDatum: any) =>
		{
			let newDetailUi: any = { value: null, caption: null };
			new SettingType(detailsUiContainer)
				.setName("Detail #" + (data.detailUis.length + 1))
				.addText((text: any) =>
				{
					text.inputEl.setAttr("placeholder", "Default value");
					text.inputEl.classList.add("iscript_spacedUi");
					text.inputEl.style.width = "40%";
					newDetailUi.value = text;
					if (parameterDatum) { text.setValue(parameterDatum.value); }
					return text;
				})
				.addText((text: any) =>
				{
					text.inputEl.setAttr("placeholder", "Caption");
					text.inputEl.classList.add("iscript_spacedUi");
					newDetailUi.caption = text;
					if (parameterDatum) { text.setValue(parameterDatum.caption); }
					return text;
				})
				.settingEl.toggleClass("iscript_settingBundled", true);
			data.detailUis.push(newDetailUi);
		};

		const detailsUiContainer: any = parent.createDiv();
		detailsUiContainer.style["margin-bottom"] = "1em";
		new SettingType(detailsUiContainer)
			.setName("Parameter details")
			.setDesc("Details for each \"???\" in the shortcut.")
			.addButton((button: any) =>
			{
				return button
					.setButtonText("Add parameter details")
					.onClick(addParameterDatum)
			})
			.settingEl.toggleClass("iscript_settingBundledTop", true);

		if (data.definition)
		{
			for (const parameterDatum of data.definition.parameterData)
			{
				addParameterDatum(parameterDatum);
			}
		}
	},
	onClose: async (data: any, resolveFnc: Function, buttonId: string) =>
	{
		if (buttonId !== "Ok")
		{
			return;
		}
		if (!data.displayUi.getValue() || !data.shortcutUi.getValue())
		{
			return;
		}

		// Get the parameter data from the ui
		let parameterData = [];
		for (const detailUi of data.detailUis)
		{
			if (!detailUi.value.getValue() && !detailUi.caption.getValue())
			{
				continue;
			}
			parameterData.push(
			{
				value: detailUi.value.getValue(),
				caption: detailUi.caption.getValue()
			});
		}

		const buttonView = ButtonView.getInstance();

		// Setup the definitions
		if (data.definition)
		{
			data.definition.display = data.displayUi.getValue();
			data.definition.shortcut = data.shortcutUi.getValue();
			data.definition.help = data.helpUi.getValue();
			data.definition.parameterData = parameterData;
		}
		else
		{
			let definition: any = {
				display: data.displayUi.getValue(),
				shortcut: data.shortcutUi.getValue(),
				help: data.helpUi.getValue(),
				parameterData: parameterData
			};
			buttonView.getButtonGroup().buttons.push(definition);
		}

		InlineScriptsPlugin.getInstance().saveSettings();
		buttonView.refreshButtonUi();
	}
});

const ICONS: any = Object.freeze(
{
	buttonView: `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" class="widget-icon" enable-background="new 0 0 512 512" version="1.1" viewBox="0 0 2500 2500">
	 <g class="layer">
	  <rect fill="currentcolor" fill-opacity="0.01" height="424" id="button" rx="62" ry="62" stroke="currentcolor" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="51" width="424" x="44" y="44"/>
	  <path d="m300.34,118.66l2.4,36.42l-28.24,6.34c-71.5,16.05 -141.59,84.08 -180.61,175.33c-7,16.37 -11.69,32.14 -10.41,35.05c2.92,6.67 74.12,59.76 80.14,59.76c2.46,0 8.36,-9.76 13.11,-21.7c20.28,-50.89 72.77,-103.98 109.72,-110.97l14.98,-2.83l-2.58,31.47c-2.67,32.67 -1.92,39.54 4.33,39.54c4,0 123.41,-125.48 126.82,-133.27c2.59,-5.91 -13.83,-27.83 -72.64,-96.96c-25.54,-30.03 -49.36,-54.6 -52.94,-54.6c-5.72,0 -6.21,4.36 -4.1,36.42l0.02,0z" fill="currentcolor" id="svg_4" stroke="currentcolor" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null"/>
	 </g>
	</svg>`,
	plus: `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" class="widget-icon" enable-background="new 0 0 512 512" version="1.1">
	 <g class="layer">
	  <rect fill="currentcolor" fill-opacity="0.01" height="424" id="button" rx="62" ry="62" stroke="currentcolor" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="51" width="424" x="44" y="44"/>
	  <path d="m97.67,202.77l105.1,0l0,-105.1l107.81,0l0,105.1l105.1,0l0,107.81l-105.1,0l0,105.1l-107.81,0l0,-105.1l-105.1,0z" fill="currentcolor" fill-opacity="null" id="svg_2" stroke="currentcolor" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null"/>
	 </g>
	</svg>`,
	x: `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" class="widget-icon" enable-background="new 0 0 512 512" version="1.1">
	 <g class="layer">
	  <rect fill="currentcolor" fill-opacity="0.01" height="424" id="button" rx="62" ry="62" stroke="currentcolor" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="51" width="424" x="44" y="44"/>
	  <path d="m97.67,202.77l105.1,0l0,-105.1l107.81,0l0,105.1l105.1,0l0,107.81l-105.1,0l0,105.1l-107.81,0l0,-105.1l-105.1,0l0,-107.81z" fill="currentcolor" fill-opacity="null" id="svg_2" stroke="currentcolor" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" transform="rotate(45, 256.675, 256.675)"/>
	 </g>
	</svg>`,
	gear: `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" class="widget-icon" enable-background="new 0 0 512 512" version="1.1">
	 <g class="layer">
	  <rect fill="currentcolor" fill-opacity="0.01" height="424" id="button" rx="62" ry="62" stroke="currentcolor" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="51" width="424" x="44" y="44"/>
	  <path d="m375.12,264.74l41.05,-21.71c-0.81,-8.05 -2.37,-15.85 -4.32,-23.52l-45.59,-6.31c-3.95,-9.51 -9.16,-18.33 -15.29,-26.42l17.38,-42.75c-5.71,-5.57 -11.88,-10.65 -18.38,-15.33l-38.71,24.3c-9.08,-4.78 -18.86,-8.39 -29.13,-10.73l-13.99,-43.35c-3.97,-0.29 -7.94,-0.61 -11.98,-0.61s-8,0.31 -11.98,0.61l-13.86,42.97c-10.54,2.26 -20.54,5.92 -29.85,10.75l-38.12,-23.94c-6.49,4.68 -12.66,9.76 -18.37,15.33l16.9,41.56c-6.59,8.45 -12.1,17.76 -16.24,27.8l-44.16,6.11c-1.94,7.66 -3.51,15.46 -4.31,23.52l39.63,20.97c0.45,11.04 2.28,21.74 5.52,31.81l-29.89,33.06c3.48,7.21 7.35,14.21 11.83,20.77l44.01,-9.45c7.22,7.85 15.44,14.73 24.51,20.42l-1.67,45.04c7.23,3.26 14.74,5.99 22.48,8.17l27.85,-35.79c4.94,0.63 9.94,1.06 15.05,1.06c5.53,0 10.94,-0.5 16.26,-1.23l27.99,35.99c7.75,-2.18 15.25,-4.91 22.48,-8.17l-1.7,-45.85c8.65,-5.59 16.48,-12.29 23.4,-19.85l45.16,9.69c4.48,-6.56 8.35,-13.55 11.83,-20.77l-30.87,-34.14c2.97,-9.54 4.62,-19.61 5.1,-30zm-68.22,52.15l-19.46,12.67l-11.97,-18.39c-6.23,2.4 -12.93,3.85 -20,3.85c-30.87,0 -55.88,-25.02 -55.88,-55.88c0,-30.87 25.01,-55.88 55.88,-55.88c30.85,0 55.88,25.01 55.88,55.88c0,15.42 -6.25,29.36 -16.34,39.48l11.89,18.27z" fill="currentcolor" fill-opacity="null" id="svg_1" stroke="currentcolor" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null"/>
	 </g>
	</svg>`,
	pencil: `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" class="widget-icon" enable-background="new 0 0 512 512" version="1.1">
	 <g class="layer">
	  <rect fill="currentcolor" fill-opacity="0.01" height="424" id="button" rx="62" ry="62" stroke="currentcolor" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="51" width="424" x="44" y="44"/>
	  <path d="m365.59,110.82l-38.75,-24.35c-9.78,-6.14 -22.66,-3.18 -28.82,6.6l-15.27,24.31l74.13,46.56l15.29,-24.3c6.14,-9.79 3.21,-22.68 -6.57,-28.81zm-214.75,216.57l74.13,46.56l120.82,-192.34l-74.16,-46.57l-120.79,192.35zm-11.32,59.15l-1.64,43.73l38.69,-20.46l35.95,-18.98l-71.52,-44.94l-1.49,40.66z" fill="currentcolor" fill-opacity="null" id="svg_2" stroke="currentcolor" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null"/>
	 </g>
	</svg>`,
	upDown: `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" class="widget-icon" enable-background="new 0 0 512 512" version="1.1">
	 <g class="layer">
	  <rect fill="currentcolor" fill-opacity="0.01" height="424" id="button" rx="62" ry="62" stroke="currentcolor" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="51" width="424" x="44" y="44"/>
	  <path d="m78.29,255.78l101.47,-101.47l0,50.73l147.06,0l0,-50.73l101.47,101.47l-101.47,101.47l0,-50.73l-147.06,0l0,50.73l-101.47,-101.47z" fill="currentcolor" id="svg_1" stroke="currentcolor" transform="rotate(90, 253.289, 255.78)"/>
	 </g>
	</svg>`,
	impExp: `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" class="widget-icon" enable-background="new 0 0 512 512" version="1.1">
	 <g class="layer">
	  <g class="layer" id="svg_4">
	   <g class="layer" id="svg_2">
		<path d="m44,106c0,-33.69 28.31,-62 62,-62l185,2c-0.31,85 96,172.31 179,171l-2,189c0,33.69 -28.31,62 -62,62l-300,0c-33.69,0 -62,-28.31 -62,-62l0,-300z" fill="currentcolor" fill-opacity="0.01" id="button" stroke="currentcolor" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="51"/>
		<path d="m222.44,288.64l5.66,-159.42l38.44,38.44l119.62,-119.62l-38.44,-38.44l159.42,-5.66l-5.66,159.42l-38.44,-38.44l-119.62,119.62l38.44,38.44l-159.42,5.66z" fill="currentcolor" id="svg_1" stroke="currentcolor"/>
	   </g>
	  </g>
	 </g>
	</svg>`,
	question: `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" class="widget-icon" enable-background="new 0 0 512 512" version="1.1">
	 <g class="layer">
	  <g class="layer" id="svg_1">
	   <rect fill="currentcolor" fill-opacity="0.01" height="424" id="button" rx="62" ry="62" stroke="currentcolor" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="51" width="424" x="44" y="44"/>
	  </g>
	  <text fill="currentcolor" fill-opacity="null" font-family="Serif" font-size="512" font-weight="bold" id="svg_2" stroke="currentcolor" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="0" text-anchor="middle" x="258.4" xml:space="preserve" y="425.4">?</text>
	 </g>
	</svg>`
});

const BUTTON_VIEW_TYPE: string = "inline-scripts-button-view";

export class ButtonView extends ItemView
{
	constructor(leaf: WorkspaceLeaf)
	{
		super(leaf);
	}

	public helpUi: any;

	public static staticConstructor(): void
	{
		this.staticConstructor_internal();
	}

	public static staticDestructor(): void
	{
		this.staticDestructor_internal();
	}

	public static getInstance(): ButtonView
	{
		return ButtonView._instance;
	}

	public static async activateView(doUiRefresh?: boolean): Promise<void>
	{
		await this.activateView_internal(doUiRefresh);
	}

	public getButtonGroup(): any
	{
		return this.getButtonGroup_internal();
	}

	public refreshGroupUi(): void
	{
		this.refreshGroupUi_internal();
	}

	public refreshButtonUi(): void
	{
		this.refreshButtonUi_internal();
	}

	public refreshSettingsFromUi()
	{
		this.refreshSettingsFromUi_internal();
	}

	public toggleState(state: string): void
	{
		this.toggleState_internal(state);
	}

	public async onOpen(): Promise<void>
	{
		ButtonView.setVisible(true);
	}

	public async onClose(): Promise<void>
	{
		ButtonView.setVisible(false);
	}

	public load(): void
	{
		this.load_internal();
	}

	public getViewType(): string
	{
		return BUTTON_VIEW_TYPE;
	}

	public getDisplayText(): string
	{
		return "Inline Scripts - Buttons";
	}

	public getIcon(): string
	{
		return BUTTON_VIEW_TYPE;
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	private static _instance: ButtonView;

	private _currentGroup: string = "";
	private _groupSelect: any;
	private _settingsUi: any = {};
	private _buttonUiParent: any;
	private _state: any = BUTTON_VIEW_STATES.normal;
	private _sfileGroupDefinitions: any;

	private static staticConstructor_internal(): void
	{
		const plugin = InlineScriptsPlugin.getInstance();
		addIcon(BUTTON_VIEW_TYPE, ICONS.buttonView);
		plugin.registerView( BUTTON_VIEW_TYPE, (leaf: any) => new ButtonView(leaf) );
		plugin.addCommand(
		{
			id: "show-inline-scripts-buttons-view",
			name: "Open buttons view",
			checkCallback: (checking: boolean): boolean =>
			{
				let isViewOpened =
					(plugin.app.workspace.getLeavesOfType(BUTTON_VIEW_TYPE).length !== 0);
				if (!checking && !isViewOpened)
				{
					this.activateView(true);
				}
				return !isViewOpened;
			}
		});
		if (plugin.settings.buttonView.visible)
		{
			plugin.app.workspace.onLayoutReady(() => this.activateView());
		}
	}

	private static staticDestructor_internal(): void
	{
		InlineScriptsPlugin.getInstance().app.workspace.detachLeavesOfType(BUTTON_VIEW_TYPE);
	}

	private static setVisible(visible: boolean): void
	{
		const plugin: InlineScriptsPlugin = InlineScriptsPlugin.getInstance();
		if (!(plugin as any)._loaded) { return; }
		if (plugin.settings.buttonView.visible !== visible)
		{
			plugin.settings.buttonView.visible = visible;
			plugin.saveSettings();
		}
	}

	private static async activateView_internal(doUiRefresh?: boolean): Promise<void>
	{
		const plugin: InlineScriptsPlugin = InlineScriptsPlugin.getInstance();
		if (plugin.app.workspace.getLeavesOfType(BUTTON_VIEW_TYPE).length)
		{
			return;
		}
		await plugin.app.workspace.getRightLeaf(false).setViewState({ type: BUTTON_VIEW_TYPE });
		if (doUiRefresh)
		{
			ButtonView.getInstance().refreshGroupUi();
		}
	}

	private load_internal(): void
	{
		// Keep track of this as the single instance
		ButtonView._instance = this;
		const root = document.createElement('div');

		this._groupSelect = document.createElement("select");
		this._groupSelect.classList.add("iscript_buttonView_groupSelect");
		this._groupSelect.onchange = () =>
		{
			ButtonView.getInstance().toggleState("normal");
			this._currentGroup =
				ButtonView.getInstance()._groupSelect.value;
			ButtonView.getInstance().refreshButtonUi();
		}
		root.appendChild(this._groupSelect);

		var buttonGroup = root.createDiv({ cls: "nav-buttons-container" });
		this.addSettingsButton(buttonGroup, "plus", "New group", async () =>
		{
			const groups = InlineScriptsPlugin.getInstance().settings.buttonView.groups;
			let name: string;
			let id = 0;
			do
			{
				id++;
				name = "Group " + (id+"").padStart(2, "0");
			}
			while (groups[name]);

			groups[name] = { buttons: [] };
			this._currentGroup = name;
			InlineScriptsPlugin.getInstance().saveSettings();
			this.refreshGroupUi();
		});
		this._settingsUi.groupRename = this.addSettingsButton(buttonGroup, "pencil", "Rename group",
			async () =>
			{
				if (this._currentGroup.startsWith(SFILE_GROUP_PREFIX)) { return; }
				const name = await Popups.getInstance().input("Enter a new name for group \"" +
					this._currentGroup + "\"", this._currentGroup);
				if (name === "")
				{
					await Popups.getInstance().alert("Name not changed.\nInvalid name: blank");
					return;
				}
				if (!name || name === this._currentGroup)
				{
					return;
				}
				let groups = InlineScriptsPlugin.getInstance().settings.buttonView.groups;
				if (groups[name])
				{
					await Popups.getInstance().alert(
						"Name not changed.\nThe name \"" + name + "\" is already taken");
					return;
				}

				groups[name] = groups[this._currentGroup];
				delete groups[this._currentGroup];
				this._currentGroup = name;
				InlineScriptsPlugin.getInstance().saveSettings();
				this.refreshGroupUi();
			});
		this.addSettingsButton(buttonGroup, "impExp", "Import / Export group", async () =>
		{
			const plugin = InlineScriptsPlugin.getInstance();
			let oldGroupCode = JSON.stringify(this.getButtonGroup().buttons).slice(1, -1);
			oldGroupCode += oldGroupCode ? "," : "";
			const isSFile: boolean = this._currentGroup.startsWith(SFILE_GROUP_PREFIX);
			let message = "Copy this code to export from group \"" + this._currentGroup + "\"\n" +
				(isSFile ?
				"This group is locked, so ignores importing." :
				"Replace this code to import to group \"" + this._currentGroup + "\"");
			let newGroupCode = await Popups.getInstance().input(message, oldGroupCode);
			if (isSFile || newGroupCode === null)
			{
				return;
			}
			if (newGroupCode !== oldGroupCode)
			{
				try
				{
					plugin.settings.buttonView.groups[this._currentGroup].buttons =
						JSON.parse("[" + newGroupCode.replace(/,$/, "") + "]");
					plugin.saveSettings();
					this.refreshButtonUi();
				}
				catch (e)
				{
					UserNotifier.run(
					{
						message: "Import failed.\nThe given group code had errors"
					});
				}
			}
		});
		this._settingsUi.groupRemove = this.addSettingsButton(buttonGroup, "x", "Remove group",
			async () =>
			{
				if (this._currentGroup.startsWith(SFILE_GROUP_PREFIX)) { return; }
				if (!(await Popups.getInstance().confirm(
					"Confirm removing the group \"" + this._currentGroup + "\"")))
				{
					return;
				}
				let groups = InlineScriptsPlugin.getInstance().settings.buttonView.groups;
				delete groups[this._currentGroup];
				InlineScriptsPlugin.getInstance().saveSettings();
				this._currentGroup = null;
				this.refreshGroupUi();
			});

		const hr = document.createElement("hr");
		hr.classList.add("iscript_buttonView_hr");
		root.appendChild(hr);

		const allButtonSettings = root.createDiv({ cls: "nav-buttons-container" });
		BUTTON_VIEW_STATES["help"].button = this.addSettingsButton(
			allButtonSettings, "question", "Help with buttons", function ()
			{
				ButtonView.getInstance().toggleState("help");
			});
		this._settingsUi.buttonSettings =
			allButtonSettings.createDiv({ cls: "nav-buttons-container" });
		this.addSettingsButton(
			this._settingsUi.buttonSettings, "plus", "Add button", async function ()
			{
				ButtonView.getInstance().toggleState("normal");
				await Popups.getInstance().custom("Define a new button", POPUP_DEFINITION_BUTTON);
			});
		BUTTON_VIEW_STATES["edit"].button = this.addSettingsButton(
			this._settingsUi.buttonSettings, "gear", "Edit button", function ()
			{
				ButtonView.getInstance().toggleState("edit");
			});
		BUTTON_VIEW_STATES["reorder"].button = this.addSettingsButton(
			this._settingsUi.buttonSettings, "upDown", "Re-order buttons", function ()
			{
				ButtonView.getInstance().toggleState("reorder");
			});
		BUTTON_VIEW_STATES["delete"].button = this.addSettingsButton(
			this._settingsUi.buttonSettings, "x", "Remove buttons", function ()
			{
				ButtonView.getInstance().toggleState("delete");
			});

		this._settingsUi.buttonSettingsBlock = allButtonSettings.createDiv(
			{ text: "   Group locked", cls: "iscript_buttonSettingsBlock iscript_hidden" });

		this.helpUi = root.createDiv({ cls: "iscript_buttonSettingsHelp" });

		this._buttonUiParent = root.createDiv();

		// Add new ui to view
		const container = this.containerEl.children[1];
		container.empty();
		container.appendChild(root);

		// DON'T DO THIS - refreshGroupUi is called after shortcuts are loaded.  This is too early.
		//this.refreshGroupUi();
	}

	private addSettingsButton(parent: any, icon: string, title: string, fnc: Function): any
	{
		let newButton = parent.createDiv({ cls: "nav-action-button", title: title });
		newButton.onclick = fnc;
		newButton.appendChild(
			(new DOMParser()).parseFromString(ICONS[icon], "text/xml").documentElement
		);
		return newButton;
	};

	private getButtonGroup_internal(): any
	{
		const plugin: InlineScriptsPlugin = InlineScriptsPlugin.getInstance();

		if (!this._currentGroup.startsWith(SFILE_GROUP_PREFIX))
		{
			return plugin.settings.buttonView.groups[this._currentGroup];
		}

		if (!this._sfileGroupDefinitions[this._currentGroup])
		{
			let buttonDefinitions: Array<any> = [];
			const sfile: string = this._currentGroup.slice(SFILE_GROUP_PREFIX.length);
			const syntaxes: Array<any> =
				plugin.syntaxes.filter(v => v.sfile === sfile);
			for (const syntax of syntaxes)
			{
				let display: string = syntax.text;
				let shortcut: string = syntax.text;
				let parameterData: Array<any> = [];
				const matches = [... syntax.text.matchAll(/{[^}]+}/g) ];
				for (let i = matches.length - 1; i >= 0; i--)
				{
					display =
						display.slice(0, matches[i].index) +
						matches[i][0].replace(/:[^}]*/, "") +
						display.slice(matches[i].index + matches[i][0].length);
					shortcut =
						shortcut.slice(0, matches[i].index) + "???" +
						shortcut.slice(matches[i].index + matches[i][0].length);
					const pName: string = matches[i][0].slice(1, matches[i][0].indexOf(":"));
					const pFeatures: string =
						matches[i][0].slice(matches[i][0].indexOf(":") + 2, -1)
						.replaceAll(/, ?/g, "<br/>");
					const caption: string =
						SFILE_BUTTON_PARAMETER_CAPTION
						.replace("%1", pName.toUpperCase()).replace("%2", pFeatures);
					parameterData.push({ value: "", caption: caption });
				}
				parameterData.reverse();

				let help: string = syntax.description;
				const helpCutoff = help.indexOf("	- Alternative");
				if (helpCutoff >= 0)
				{
					help = help.slice(0, helpCutoff);
				}

				buttonDefinitions.push({ display, shortcut, parameterData, help });
			}
			this._sfileGroupDefinitions[this._currentGroup] = { buttons: buttonDefinitions };
		}

		return this._sfileGroupDefinitions[this._currentGroup];
	}

	private toggleState_internal(state: string): void
	{
		if (!BUTTON_VIEW_STATES[state])
		{
			return;
		}
		if (state === "normal" && this._state === BUTTON_VIEW_STATES["normal"])
		{
			return;
		}

		if (this._state.onStateEnd)
		{
			this._state.onStateEnd();
		}

		this._state =
			(this._state === BUTTON_VIEW_STATES[state]) ?
			BUTTON_VIEW_STATES["normal"] :
			BUTTON_VIEW_STATES[state];

		if (this._state.onStateStart)
		{
			this._state.onStateStart();
		}

		this.refreshButtonUi();
	}

	private refreshGroupUi_internal()
	{
		let plugin = InlineScriptsPlugin.getInstance();

		let groups = plugin.settings.buttonView.groups;
		let groupList = Object.keys(groups);
		if (!groupList.length)
		{
			groups["Group 01"] = { buttons: [] };
			groupList = Object.keys(groups);
		}
		groupList.sort();

		let sfileGroups =
			[... new Set(plugin.syntaxes.map(v => v.sfile)) ]
			.filter(v => v)
			.map(v => SFILE_GROUP_PREFIX + v)
			.sort();
		groupList = groupList.concat(sfileGroups);

		this._sfileGroupDefinitions = [];

		this._currentGroup ||= groupList[0];
		this._groupSelect.options.length = 0;
		for (const groupName of groupList)
		{
			const selected: boolean =
				(groupName === this._currentGroup);
			this._groupSelect.options[this._groupSelect.options.length] =
				new Option(groupName, undefined, undefined, selected);
		}
		this.refreshButtonUi();
	}

	private refreshButtonUi_internal()
	{
		// System ui
		if (this._currentGroup.startsWith(SFILE_GROUP_PREFIX))
		{
			this._settingsUi.buttonSettings.classList.add("iscript_hidden");
			this._settingsUi.buttonSettingsBlock.classList.remove("iscript_hidden");
			this._settingsUi.groupRename.classList.remove("nav-action-button");
			this._settingsUi.groupRename.classList.add("iscript_buttonViewDisabled");
			this._settingsUi.groupRemove.classList.remove("nav-action-button");
			this._settingsUi.groupRemove.classList.add("iscript_buttonViewDisabled");
		}
		else
		{
			this._settingsUi.buttonSettings.classList.remove("iscript_hidden");
			this._settingsUi.buttonSettingsBlock.classList.add("iscript_hidden");
			this._settingsUi.groupRename.classList.add("nav-action-button");
			this._settingsUi.groupRename.classList.remove("iscript_buttonViewDisabled");
			this._settingsUi.groupRemove.classList.add("nav-action-button");
			this._settingsUi.groupRemove.classList.remove("iscript_buttonViewDisabled");
		}

		// Shortcut buttons
		this._buttonUiParent.innerText = "";
		const buttonDefinitions = this.getButtonGroup().buttons;
		for (let i = 0; i < buttonDefinitions.length; i++)
		{
			let newButton = document.createElement("button");
			newButton.classList.add("iscript_shortcutButton");
			newButton.innerText = this._state.prefix + buttonDefinitions[i].display;
			newButton.dataset.index = i + "";
			this._buttonUiParent.appendChild(newButton);
			if (this._state.onClick)
			{
				newButton.onclick = this._state.onClick.bind(newButton, newButton);
			}
		}
		if (this._state.onButtonsAdded)
		{
			this._state.onButtonsAdded(this._buttonUiParent);
		}

		// System button highlighting
		for (const key in BUTTON_VIEW_STATES)
		{
			if (!BUTTON_VIEW_STATES[key].button) { continue; }
			if (this._state === BUTTON_VIEW_STATES[key])
			{
				BUTTON_VIEW_STATES[key].button.classList.add("iscript_selectedButton");
			}
			else
			{
				BUTTON_VIEW_STATES[key].button.classList.remove("iscript_selectedButton");
			}
		}

		// Clear the help display
		this.helpUi.innerText = "";
	}

	private refreshSettingsFromUi_internal()
	{
		const buttonDefinitions: Array<any> = this.getButtonGroup().buttons;
		let newButtonDefinitions: Array<any> = [];
		for (const button of this._buttonUiParent.childNodes)
		{
			newButtonDefinitions.push(buttonDefinitions[button.dataset.index]);
		}
		this.getButtonGroup().buttons = newButtonDefinitions;
		InlineScriptsPlugin.getInstance().saveSettings();
	}
}
