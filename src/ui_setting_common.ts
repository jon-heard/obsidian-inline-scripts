////////////////////////////////////////////////////////////////////////////////////
// Setting ui base - a collection of functions used by multiple SettingUi classes //
////////////////////////////////////////////////////////////////////////////////////

namespace SettingUi_Common
{
	export function deleteButtonClicked(): void
	{
		new ConfirmDialogBox( this.app, "Confirm removing a " + this.typeTitle + ".",
			(confirmation: boolean) =>
			{
				if (confirmation)
				{
					this.group.remove();
				}
			} ).open();
	}

	export function upButtonClicked(): void
	{
		let p: any = this.group.parentElement;
		let index: number = Array.from(p.childNodes).indexOf(this.group);
		if (index === this.listOffset) { return; }
		p.insertBefore(p.childNodes[index], p.childNodes[index - 1]);
	}

	export function downButtonClicked(): void
	{
		let p: any = this.group.parentElement;
		let index: number = Array.from(p.childNodes).indexOf(this.group);
		if (index === p.childNodes.length - 1) { return; }
		index++;
		p.insertBefore(p.childNodes[index], p.childNodes[index - 1]);
	}
}
