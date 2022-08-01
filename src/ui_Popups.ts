///////////////////////////////////////////////////////////////////////////////
// Popup - A single class that handles all the kinds of popup modals we need //
///////////////////////////////////////////////////////////////////////////////

"use strict";

import InlineScriptsPlugin from "./_Plugin";
import { Modal, Setting } from "obsidian";

// Custom popup definition:
// 		buttons - Which buttons show at the bottom of the popup dialog
// 		onOpen(data, parent, firstButton, SettingType) - Allows creating the ui for this popup.
// 			data - An object for relaying info: passed in and passed to both onOpen() and onClose().
// 			parent - The html div to contain the popup ui.
// 			firstButton - The first html button.  Useful for triggering popup completion from code.
// 			SettingType - An Obsidian type to instantiate.  Provides an API for creating ui.
// 		onClose(data, resolveFnc, buttonText) - Called when the user is finished deciding.
// 			data - An object for relaying info: passed in and passed to both onOpen() and onClose().
// 			resolveFnc - The function to call with the result of the popup.
// 			buttonText - The text of button that was clicked (or null if no button was clicked).

export class Popups extends Modal
{
	// Singleton getter
	public static getInstance(): Popups
	{
		return this.getInstance_internal();
	}

	// A popup conveying a message until the user presses the "Ok" button
	public async alert(message: string): Promise<void>
	{
		await this.alert_internal(message);
	}

	// A popup asking for a confirmation until the user clicks the "Confirm" or "Cancel" button
	public async confirm(message: string): Promise<boolean>
	{
		return await this.confirm_internal(message);
	}

	// A popup asking for some text until the user clicks the "Ok" or "Cancel" button
	public async input(message: string, defaultValue?: string): Promise<string>
	{
		return await this.input_internal(message, defaultValue);
	}

	// A popup asking for selection from a list until the user clicks the "Ok" or "Cancel" button
	public async pick(
		message: string, options: Array<string>, defaultValue?: number): Promise<number>
	{
		return await this.pick_internal(message, options, defaultValue);
	}

	// A popup that works based on a custom popup definition.  Closes when the user clicks a button.
	public async custom(message: string, definition: any, data?: any): Promise<any>
	{
		return await this.custom_internal(message, definition, data);
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	// Override inherited method
	public onOpen(): void
	{
		this.onOpen_internal();
	}

	// Override inherited method
	public onClose(): void
	{
		this.onClose_internal();
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	// The function to close the popup and define the return
	private _resolve: Function;
	// Stores the text of the popup button that was clicked
	private _clickedButtonText: string;

	// The user-supplied message
	private _message: string;
	// Definition for the current popup
	private _definition: any;
	// The object of parameters for the current popup
	private _data: any;

///////////////////////////////////////////////////////////////////////////////////////////////////

	// Customiation for an "Alert" poupup
	private ALERT_DEFINITION = Object.freeze(
	{
		buttons: [ "Ok" ]
	});

	// Customiation for a "Confirm" poupup
	private CONFIRM_DEFINITION = Object.freeze(
	{
		buttons: [ "Confirm", "Cancel" ],
		onClose: async (data: any, resolveFnc: Function, buttonText: string) =>
		{
			resolveFnc(buttonText === "Confirm");
		}
	});

	// Customiation for an "Input" poupup
	private INPUT_DEFINITION = Object.freeze(
	{
		onOpen: async (data: any, parent: any, firstButton: any, SettingType: any) =>
		{
			new SettingType(parent)
				.addText((text: any) =>
				{
					data.resultUi = text;
					text.setValue("" + (data.defaultValue ?? ""));
					text.inputEl.select();
					text.inputEl.parentElement.previousSibling.remove();
					text.inputEl.addEventListener("keypress", (e: any) =>
					{
						if (e.key === "Enter") { firstButton.click(); }
					});
				})
		},
		onClose: async (data: any, resolveFnc: Function, buttonText: string) =>
		{
			resolveFnc((buttonText == "Ok") ? data.resultUi.getValue() : null);
		}
	});

	// Customiation for a "Pick" poupup
	private PICK_DEFINITION = Object.freeze(
	{
		onOpen: async (data: any, parent: any, firstButton: any, SettingType: any) =>
		{
			let result = false;
			new SettingType(parent)
				.addDropdown((dropdown: any) =>
				{
					data.resultUi = dropdown;

					let options = data.options;
					if (options === null || options === undefined)
					{
						result = true;
						return;
					}
					if (!Array.isArray(options)) { options = [ options ]; }

					let defaultValue = parseInt(data.defaultValue ?? 0);
					if (isNaN(defaultValue)) { defaultValue = options.indexOf(data.defaultValue); }
					defaultValue = Math.clamp(defaultValue, 0, options.length - 1);

					dropdown.addOptions(options)
					dropdown.setValue(defaultValue || 0);
					dropdown.selectEl.parentElement.previousSibling.remove();
					dropdown.selectEl.addEventListener("keypress", (e: any) =>
					{
						if (e.key === "Enter") { firstButton.click(); }
					});
				});
			return result;
		},
		onClose: async (data: any, resolveFnc: Function, buttonText: string) =>
		{
			resolveFnc((buttonText == "Ok") ? data.resultUi.getValue() : null);
		}
	});

///////////////////////////////////////////////////////////////////////////////////////////////////

	// Singleton instance
	private static _instance: Popups;

	// Singleton getter
	private static getInstance_internal(): Popups
	{
		if (!this._instance) { this._instance = new Popups(); }
		return this._instance;
	}

	// Private constructor for singleton
	private constructor()
	{
		super(InlineScriptsPlugin.getInstance().app);
		this.modalEl.classList.add("iscript_popup");
	}

	// An event handler used for all buttons - records the button text, then closes the popup
	private onButton(this: any): void
	{
		const p = Popups.getInstance();
		p._clickedButtonText = this.getText();
		p.close();
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	// A popup conveying a message until the user presses the "Ok" button
	private async alert_internal(message: string): Promise<void>
	{
		return await this.custom_internal(message, this.ALERT_DEFINITION);
	}

	// A popup asking for a confirmation until the user clicks the "Confirm" or "Cancel" button
	private async confirm_internal(message: string): Promise<boolean>
	{
		return await this.custom_internal(message, this.CONFIRM_DEFINITION);
	}

	// A popup asking for some text until the user clicks the "Ok" or "Cancel" button
	public async input_internal(message: string, defaultValue?: string) : Promise<string>
	{
		return await this.custom_internal(
			message, this.INPUT_DEFINITION, { defaultValue: defaultValue });
	}

	// A popup asking for selection from a list until the user clicks the "Ok" or "Cancel" button
	public async pick_internal(
		message: string, options: Array<string>, defaultValue?: number): Promise<number>
	{
		return await this.custom_internal(
			message, this.PICK_DEFINITION, { options: options, defaultValue: defaultValue });
	}

	// A popup that works based on a custom popup definition.  Closes when the user clicks a button.
	public async custom_internal(message: string, definition: any, data?: any): Promise<any>
	{
		// Sanitize parameters
		message = message ?? "";
		definition = definition || {};
		data = data || {};

		// Return a promise, which resolves once the user clicks one of the buttons
		return await new Promise((resolve) =>
		{
			// Initialize the popup
			this._resolve = resolve;
			this._clickedButtonText = null;

			// Store all user-input
			this._message = message;
			this._definition = definition;
			this._data = data;

			// Open the popup
			this.open();
		});
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	private async onOpen_internal(): Promise<void>
	{
		// Hide input blocker dimmer
		let inputBlockerDimmer = document.getElementById("iscript_inputBlocker");
		if (inputBlockerDimmer) { inputBlockerDimmer.style.display = "none"; }

		// Clear UI
		this.contentEl.setText("");
		this.titleEl.setText("");

		// Setup message
		if (typeof this._message === "string")
		{
			const messageLines = this._message.split("\n");
			for (const line of messageLines)
			{
				this.titleEl.createEl("div", { text: line });
			}
		}
		else if (this._message)
		{
			this.titleEl.createEl("div", { text: this._message });
		}

		// Setup type-specific ui container
		const typeSpecificUi: any = document.createElement("div");
		this.contentEl.appendChild(typeSpecificUi);

		// Setup buttons
		let firstButton: any = null;
		let buttonsUi = new Setting(this.contentEl);
		buttonsUi.settingEl.style.padding = "0";
		for (const buttonText of this._definition.buttons || [ "Ok", "Cancel" ])
		{
			buttonsUi.addButton((button: any) =>
			{
				button
					.setButtonText(buttonText)
					.onClick(this.onButton.bind(button.buttonEl));
				if (!firstButton)
				{
					button.setCta();
					firstButton = button.buttonEl;
				}
			});
		}

		// Setup type-specific ui
		if (this._definition.onOpen)
		{
			// If type-specific onOpen returns true, we should early out (something went wrong)
			if (await this._definition.onOpen(this._data, typeSpecificUi, firstButton, Setting))
			{
				this._definition = {};
				this.close();
			}
		}
	}

	private async onClose_internal(): Promise<void>
	{
		// Unhide blocker dimmer
		let inputBlockerDimmer = document.getElementById("iscript_inputBlocker");
		if (inputBlockerDimmer) { inputBlockerDimmer.style.display = "unset"; }

		// Call type-specific onClose
		if (this._definition.onClose)
		{
			await this._definition.onClose(this._data, this._resolve, this._clickedButtonText);
		}

		// Do extra resolve, in case _onClose isn't available, or didn't end up resolving.
		this._resolve(null);
	}
}