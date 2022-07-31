////////////////////////////////////////////////////////////////////////////////////////////////////
// Input blocker - Turn on/off input blocking in the UI.  Darkens the screen while blocking input //
////////////////////////////////////////////////////////////////////////////////////////////////////

"use strict";

import InlineScriptsPlugin from "./_Plugin";

export namespace InputBlocker
{
	// Adds/removes a tinted full-screen div to prevent user-input
	export function setEnabled(value: boolean): void
	{
		if (value)
		{
			// If Input blocker UI already exists, do nothing
			if (document.getElementById("iscript_inputBlocker")) { return; }

			// Create the input blocker UI
			let blockerUi: any = document.createElement("div");
			blockerUi.id = "iscript_inputBlocker";
			blockerUi.classList.add("iscript_preFadein");
			document.getElementsByTagName("body")[0].prepend(blockerUi);

			// Animate fadin
			window.getComputedStyle(blockerUi).opacity;
			blockerUi.classList.remove("iscript_preFadein");

			// Enable editor input blocking
			InlineScriptsPlugin.getInstance().inputDisabled = true;
		}
		else
		{
			// Remove the input blocker UI
			let blockerUi: any = document.getElementById("iscript_inputBlocker");
			if (blockerUi) { blockerUi.remove(); }

			// Disable editor input blocking
			InlineScriptsPlugin.getInstance().inputDisabled = false;
		}
	}
}