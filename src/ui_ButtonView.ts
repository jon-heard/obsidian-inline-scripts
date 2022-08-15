/////////////////////////////////////////////////////////////////////////////////////////////////
// ButtonsVoew - A sidepanel for adding buttons to.  Each button triggers a specific shortcut. //
/////////////////////////////////////////////////////////////////////////////////////////////////

"use strict";

import { ItemView, MarkdownView, WorkspaceLeaf, addIcon } from "obsidian";
import InlineScriptsPlugin from "./_Plugin";
import { ShortcutExpander } from "./ShortcutExpander";
import { Popups } from "./ui_Popups";

const BUTTON_VIEW_TYPE: string = "inline-scripts-button-view";

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
	imp: `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" class="widget-icon" enable-background="new 0 0 512 512" version="1.1">
	 <g class="layer">
	  <rect fill="currentcolor" fill-opacity="0.01" height="278" id="button" rx="62" ry="62" stroke="currentcolor" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="51" transform="matrix(1, 0, 0, 1, 0, 0)" width="278" x="44" y="188"/>
	  <path d="m358.66,9.86l-1.69,18.2l19.91,3.17c50.41,8.02 99.82,42.03 127.33,87.64c4.94,8.18 8.24,16.07 7.34,17.52c-2.06,3.33 -52.25,29.87 -56.5,29.87c-1.73,0 -5.89,-4.88 -9.24,-10.85c-14.3,-25.44 -51.3,-51.97 -77.35,-55.47l-10.56,-1.42l1.82,15.73c1.89,16.33 1.36,19.76 -3.06,19.76c-2.82,0 -87,-62.72 -89.41,-66.61c-1.83,-2.95 9.75,-13.91 51.21,-48.47c18.01,-15.01 34.8,-27.29 37.32,-27.29c4.03,0 4.38,2.18 2.89,18.2l-0.01,0.02z" fill="currentcolor" id="svg_1" stroke="currentcolor" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" transform="rotate(-56.7572, 389.382, 78.9606)"/>
	 </g>
	</svg>`,
	exp: `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" class="widget-icon" enable-background="new 0 0 512 512" version="1.1">
	 <g class="layer">
	  <rect fill="currentcolor" fill-opacity="0.01" height="278" id="button" rx="62" ry="62" stroke="currentcolor" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="51" transform="matrix(1, 0, 0, 1, 0, 0)" width="278" x="44" y="188"/>
	  <path d="m391.96,52.38l-1.56,17l18.43,2.96c46.66,7.49 92.4,39.26 117.87,81.87c4.57,7.64 7.63,15.01 6.79,16.37c-1.91,3.11 -48.37,27.9 -52.3,27.9c-1.6,0 -5.45,-4.56 -8.55,-10.14c-13.24,-23.77 -47.49,-48.55 -71.6,-51.82l-9.78,-1.33l1.68,14.69c1.75,15.26 1.26,18.46 -2.83,18.46c-2.61,0 -80.54,-58.59 -82.77,-62.23c-1.69,-2.76 9.03,-12.99 47.41,-45.28c16.67,-14.02 32.21,-25.49 34.55,-25.49c3.73,0 4.05,2.04 2.68,17l-0.01,0.02z" fill="currentcolor" id="svg_1" stroke="currentcolor" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" transform="rotate(98.3071, 420.404, 116.923)"/>
	 </g>
	</svg>`
});

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
				text.setValue(data.priorDisplay ?? "");
				text.inputEl.setAttr("placeholder", "Button text");
				text.inputEl.addEventListener("keypress", (e: any) =>
				{
					if (e.key === "Enter") { data.shortcutUi.inputEl.select(); }
				});
				text.inputEl.select();
				return text;
			});
		new SettingType(parent)
			.setName("Shortcut")
			.setDesc("On click, this is added to the current note then expanded.")
			.addText((text: any) =>
			{
				data.shortcutUi = text;
				text.setValue("" + (data.priorShortcut ?? ""));
				text.inputEl.setAttr("placeholder", "Shortcut text");
				text.inputEl.addEventListener("keypress", (e: any) =>
				{
					if (e.key === "Enter") { firstButton.click(); }
				});
				return text;
			})
			.descEl.innerHTML +=
				"<br/>Each \"???\" triggers user-input to replace the \"???\".";

		const detailsUiContainer: any = parent.createDiv();
		detailsUiContainer.style["margin-bottom"] = "1em";

		data.detailUis = [];
		const addDetailUi = () =>
		{
			let newDetailUi = { value: null, caption: null };
			new SettingType(detailsUiContainer)
				.setName("Detail #" + (data.detailUis.length + 1))
				.addText((text: any) =>
				{
					text.inputEl.setAttr("placeholder", "Default value");
					text.inputEl.classList.add("iscript_spacedUi");
					text.inputEl.style.width = "40%";
					newDetailUi.value = text;
					return text;
				})
				.addText((text: any) =>
				{
					text.inputEl.setAttr("placeholder", "Caption");
					text.inputEl.classList.add("iscript_spacedUi");
					newDetailUi.caption = text;
					return text;
				})
				.settingEl.toggleClass("iscript_settingBundled", true);
			data.detailUis.push(newDetailUi);
		};

		new SettingType(detailsUiContainer)
			.setName("Parameter details")
			.setDesc("Details for each \"???\" in the shortcut-text.")
			.addButton((button: any) =>
			{
				return button
					.setButtonText("Add details for one \"???\"")
					.onClick(addDetailUi)
			})
			.settingEl.toggleClass("iscript_settingBundledTop", true);
	},
	onClose: async (data: any, resolveFnc: Function, buttonText: string) =>
	{
		if (!data.displayUi.getValue() || !data.shortcutUi.getValue())
		{
			return;
		}
		let definition: any = {
			display: data.displayUi.getValue(),
			shortcut: data.shortcutUi.getValue(),
			parameterData: []
		};
		for (const detailUi of data.detailUis)
		{
			if (!detailUi.value.getValue() && !detailUi.caption.getValue())
			{
				continue;
			}
			definition.parameterData.push(
			{
				value: detailUi.value.getValue(),
				caption: detailUi.caption.getValue()
			});
		}
		ButtonView.getInstance().addShortcutButton(definition);
	}
});

export class ButtonView extends ItemView
{
	constructor(leaf: WorkspaceLeaf)
	{
		super(leaf);
	}

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

	public static async activateView(): Promise<void>
	{
		await this.activateView_internal();
	}

	public addShortcutButton(buttonDefinition: any): void
	{
		this.addShortcutButton_internal(buttonDefinition);
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

	private _buttonUiParent: any;

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
					(plugin.app.workspace.getLeavesOfType(BUTTON_VIEW_TYPE).length === 0);
				if (!checking && !isViewOpened)
				{
					this.activateView();
				}
				return isViewOpened;
			}
		});
		if (plugin.settings.buttonViewSettings.visible)
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
		if (plugin.settings.buttonViewSettings.visible !== visible)
		{
			plugin.settings.buttonViewSettings.visible = visible;
			plugin.saveSettings();
		}
	}

	private static async activateView_internal(): Promise<void>
	{
		const plugin: InlineScriptsPlugin = InlineScriptsPlugin.getInstance();
		if (plugin.app.workspace.getLeavesOfType(BUTTON_VIEW_TYPE).length)
		{
			return;
		}
        await plugin.app.workspace.getRightLeaf(false).setViewState({ type: BUTTON_VIEW_TYPE });
	}

	private load_internal(): void
	{
		// Keep track of this as the single instance
		ButtonView._instance = this;

		const root = document.createElement('div');

		const groupSelect = document.createElement("select");
		groupSelect.classList.add("iscript_buttonView_groupSelect");
		root.appendChild(groupSelect);

		var buttonGroup = root.createDiv({ cls: "nav-buttons-container" });
		this.addSettingsButton(buttonGroup, "plus", "New group", function () {
			console.log("Button clicked: new");
		});
		this.addSettingsButton(buttonGroup, "pencil", "Rename group", function () {
			console.log("Button clicked: rename");
		});
		this.addSettingsButton(buttonGroup, "imp", "Import group", function () {
			console.log("Button clicked: import");
		});
		this.addSettingsButton(buttonGroup, "exp", "Export group", function () {
			console.log("Button clicked: export");
		});
		this.addSettingsButton(buttonGroup, "x", "Remove group", function () {
			console.log("Button clicked: x");
		});

		const hr = document.createElement("hr");
		hr.classList.add("iscript_buttonView_hr");
		root.appendChild(hr);

		buttonGroup = root.createDiv({ cls: "nav-buttons-container" });
		this.addSettingsButton(buttonGroup, "plus", "Add button", async function () {
			await Popups.getInstance().custom("Define a new button", POPUP_DEFINITION_BUTTON);
		});
		this.addSettingsButton(buttonGroup, "gear", "Edit button", function () {
			console.log("Button clicked: edit");
		});
		this.addSettingsButton(buttonGroup, "upDown", "Reorder buttons", function () {
			console.log("Button clicked: reorder");
		});
		this.addSettingsButton(buttonGroup, "x", "Remove buttons", function () {
			console.log("Button clicked: x");
		});

		this._buttonUiParent = root.createDiv();
		ButtonView.getInstance().addShortcutButton({ display: "Hi", shortcut: "hi", parameterData: [] });
		ButtonView.getInstance().addShortcutButton({ display: "Date", shortcut: "date", parameterData: [] });
		ButtonView.getInstance().addShortcutButton({ display: "Roll dice", shortcut: "d???", parameterData: [ { value: 6, caption: "Die size" } ] });
		ButtonView.getInstance().addShortcutButton({ display: "Advanced dice", shortcut: "???d??????", parameterData: [ { value: 1, caption: "Dice count" }, { value: 6, caption: "Die size" }, { value: "+0", caption: "Roll adjust: [+ or -] followed by a positive number" }, { value: 999, caption: "unused" } ] });
		ButtonView.getInstance().addShortcutButton({ display: "Advanced dice #2", shortcut: "???d??????", parameterData: [ { value: 1, caption: "Dice count" } ] });

		// Add new ui to view
		const container = this.containerEl.children[1];
		container.empty();
		container.appendChild(root);
	}

	private addSettingsButton(parent: any, icon: string, title: string, fnc: Function): void
	{
		let newButton = parent.createDiv({ cls: "nav-action-button", title: title });
		newButton.onClickEvent(fnc);
		newButton.appendChild(
			(new DOMParser()).parseFromString(ICONS[icon], "text/xml").documentElement
		);
	};

	private addShortcutButton_internal(buttonDefinition: any): void
	{
		let newButton = document.createElement("button");
		newButton.classList.add("iscript_shortcutButton");
		newButton.innerText = buttonDefinition.display;
		this._buttonUiParent.appendChild(newButton);
		newButton.onclick = async (source) =>
		{
			// Get shortcut text (including replacing ??? with user-input)
			let shortcutText = buttonDefinition.shortcut;
			const matches = [... shortcutText.matchAll(/\?\?\?/g) ];
			let replacements = [];
			for (let i = 0; i < matches.length; i++)
			{
				const caption = buttonDefinition.parameterData[i]?.caption ?? "Parameter #" + (i+1);
				const value = buttonDefinition.parameterData[i]?.value || "";
				const replacement = await Popups.getInstance().input(caption, value);
				if (replacement === null)
				{
					return;
				}
				replacements.push(replacement);
			}
			for (let i = matches.length - 1; i >= 0; i--)
			{
				shortcutText =
					shortcutText.slice(0, matches[i].index) +
					replacements[i] +
					shortcutText.slice(matches[i].index + 3);
			}

			// Run expansion
			const expansion = await ShortcutExpander.expand(shortcutText);
			if (expansion === null)
			{
				return;
			}

			// Append to the current file's editor, refocus on it, set caret at the end
			const file = InlineScriptsPlugin.getInstance().app.workspace.getActiveFile();
			if (!file)
			{
				return;
			}
			for (const leaf of app.workspace.getLeavesOfType("markdown"))
			{
				const view: MarkdownView = (leaf.view as MarkdownView);
				if (view.file === file)
				{
					// Append to the editor
					view.editor.setValue(view.editor.getValue() + expansion);

					// Refocus on the editor
					app.workspace.setActiveLeaf(leaf, false, true);

					// Caret at the end
					view.editor.setSelection({line: Number.MAX_SAFE_INTEGER, ch: 0});
					break;
				}
			}
		};
	}
}
