///////////////////////////////////////////////////////////////////////
// Popup_Confirm - Display a modal popup message to "ok" or "cancel" //
///////////////////////////////////////////////////////////////////////

"use strict";

class Popup_Confirm extends obsidian.Modal
{
	public constructor(app: any, message: string, callback: Function)
	{
		super(app);
		this._message = message;
		this._callback = callback;
		this._value = null;
		this.modalEl.classList.add("tejs_popup");
	}

	public onOpen()
	{
		const messageLines = this._message.split("\n");
		for (const line of messageLines)
		{
			this.titleEl.createEl("div", { text: line });
		}

		new obsidian.Setting(this.contentEl)
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
