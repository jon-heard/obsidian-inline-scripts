///////////////////////////////////////////////////////////////////////
// Popup_Confirm - Display a modal popup message to "ok" or "cancel" //
///////////////////////////////////////////////////////////////////////

"use strict";

import { Modal, Setting } from "obsidian";

export class Popup_Confirm extends Modal
{
	public constructor(app: any, message: string, callback: Function)
	{
		super(app);
		this._message = message;
		this._callback = callback;
		this._value = null;
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
			.addButton((button: any) =>
			{
				button
					.setButtonText("Confirm")
					.onClick(() =>
					{
						this._value = true;
						this.close();
					})
			})
			.addButton((button: any) =>
			{
				button
					.setButtonText("Cancel")
					.onClick(() =>
					{
						this._value = false;
						this.close();
					})
			})
			.settingEl.style.padding = "0";
	}

	public onClose()
	{
		this.contentEl.empty();
		this._callback(this._value);
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	private _message: string;
	private _callback: Function;
	private _value: boolean;
}
