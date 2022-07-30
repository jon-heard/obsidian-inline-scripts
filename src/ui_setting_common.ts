//////////////////////////////////////////////////////////////////////////////////////
// Setting ui common - a collection of functions used by multiple SettingUi classes //
//////////////////////////////////////////////////////////////////////////////////////

"use strict";

import { Popup_Confirm } from "./ui_Popup_Confirm";

export namespace SettingUi_Common
{
	export function deleteButtonClicked(this: any): void
	{
		new Popup_Confirm( this.app, "Confirm removing a " + this.typeTitle + ".",
			(confirmation: boolean) =>
			{
				if (confirmation)
				{
					this.group.remove();
				}
			} ).open();
	}

	export function upButtonClicked(this: any): void
	{
		let p: any = this.group.parentElement;
		let index: number = Array.from(p.childNodes).indexOf(this.group);
		if (index === this.listOffset) { return; }
		p.insertBefore(p.childNodes[index], p.childNodes[index - 1]);
	}

	export function downButtonClicked(this: any): void
	{
		let p: any = this.group.parentElement;
		let index: number = Array.from(p.childNodes).indexOf(this.group);
		if (index === p.childNodes.length - 1) { return; }
		index++;
		p.insertBefore(p.childNodes[index], p.childNodes[index - 1]);
	}
}
