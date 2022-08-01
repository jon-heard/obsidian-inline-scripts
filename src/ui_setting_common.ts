//////////////////////////////////////////////////////////////////////////////////////
// Setting ui common - a collection of functions used by multiple SettingUi classes //
//////////////////////////////////////////////////////////////////////////////////////

"use strict";

import { Popups } from "./ui_Popups";

export namespace SettingUi_Common
{
	export async function deleteButtonClicked(this: any): Promise<void>
	{
		if (await Popups.getInstance().confirm("Confirm removing a " + this.typeTitle + "."))
		{
			this.group.remove();
		}
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
