////////////////////////////////////////////////////////////////////////////////////////////////////
// Input blocker - Turn on/off input blocking in the UI.  Darkens the screen while blocking input //
////////////////////////////////////////////////////////////////////////////////////////////////////

"use strict";

abstract class InputBlocker
{
	// Adds/removes a tinted full-screen div to prevent user-input
	public static setEnabled(value: boolean): void
	{
		if (value)
		{
			// If Input blocker UI already exists, do nothing
			if (document.getElementById("tejs_inputBlocker")) { return; }

			// Create the input blocker UI
			let blockerUi: any = document.createElement("div");
			blockerUi.id = "tejs_inputBlocker";
			document.getElementsByTagName("body")[0].prepend(blockerUi);
		}
		else
		{
			// Remove the input blocker UI
			let blockerUi: any = document.getElementById("tejs_inputBlocker");
			if (blockerUi) { blockerUi.remove(); }
		}
	}
}