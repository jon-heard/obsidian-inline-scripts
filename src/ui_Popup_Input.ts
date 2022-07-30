/////////////////////////////////////////////////////////////////////
// Popup_Input - Display a modal popup message to allow text entry //
/////////////////////////////////////////////////////////////////////

"use strict";

import { Modal, Setting } from "obsidian";

export class Popup_Input extends Modal
{
	public constructor(app: any, message: string, defaultValue: string, callback: Function)
	{
		super(app);
		this._message = message;
		this._callback = callback;
		this._value = defaultValue;
		this.modalEl.classList.add("iscript_popup");
	}

	public onOpen()
	{
		const messageLines = this._message.split("\n");
		for (const line of messageLines)
		{
			this.titleEl.createEl("div", { text: line });
		}

		new Setting(this.contentEl)
			.addText((text: any) =>
			{
				text.setValue(this._value);
				text.inputEl.parentElement.previousSibling.remove();
				text.inputEl.classList.add("iscript_soloControl");
				this._control = text;
				this._value = null;
			})

		new Setting(this.contentEl)
			.addButton((button: any) =>
			{
				button
					.setButtonText("Ok")
					.onClick(() =>
					{
						this._value = this._control.getValue();
						this.close();
					});
			})
			.addButton((button: any) =>
			{
				button
					.setButtonText("Cancel")
					.onClick(() =>
					{
						this.close();
					});
			})
			.settingEl.style.padding = "0";
	}

	public onClose()
	{
		this._callback(this._value);
		this.contentEl.empty();
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	private _message: string;
	private _callback: Function;
	private _value: string;
	private _control: any;
}
