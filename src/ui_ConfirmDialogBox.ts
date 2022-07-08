//////////////////////////////////////////////////////////////////////////
// ConfirmDialogBox - Display a modal popup message to "ok" or "cancel" //
//////////////////////////////////////////////////////////////////////////

"use strict";

class ConfirmDialogBox extends obsidian.Modal
{
	public constructor(app: any, message: string, callback: Function)
	{
		super(app);
		this._message = message;
		this._callback = callback;
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
						this._callback(true);
						this.close();
					})
			})
			.addButton((button: any) =>
			{
				button
					.setButtonText("Cancel")
					.setCta()
					.onClick(() =>
					{
						this._callback(false);
						this.close();
					})
			})
			.settingEl.style.padding = "0";
	}

	public onClose()
	{
		this.contentEl.empty();
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	private _message: string;
	private _callback: Function;
}
