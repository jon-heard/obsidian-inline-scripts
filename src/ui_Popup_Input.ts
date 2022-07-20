/////////////////////////////////////////////////////////////////////
// Popup_Input - Display a modal popup message to allow text entry //
/////////////////////////////////////////////////////////////////////

"use strict";

class Popup_Input extends obsidian.Modal
{
	public constructor(app: any, message: string, defaultValue: string, callback: Function)
	{
		super(app);
		this._message = message;
		this._callback = callback;
		this._value = defaultValue;
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
			.addText((text: any) =>
			{
				text.setValue(this._value);
				text.inputEl.parentElement.previousSibling.remove();
				text.inputEl.classList.add("tejs_soloControl");
				this._control = text;
				this._value = null;
			})

		new obsidian.Setting(this.contentEl)
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
