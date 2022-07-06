
class ShortcutExpander
{
	public constructor(plugin: any)
	{
		this.plugin = plugin;
		
		//Setup bound versons of these function for persistant use
		this._expand_internal = this.expand_internal.bind(this);
		this._handleExpansionError = this.handleExpansionError.bind(this);
		
		// This keeps track of multiple expansion error handlers for nested expansions
		this.expansionErrorHandlerStack = [];
	}

	public expand(text: string,  isUserTriggered?: boolean): any
	{
		return this.expand_internal(text, isUserTriggered);
	}

	public getBoundExpand(): Function
	{
		return this._expand_internal;
	}

////////////////////////////////////////////////////////////////////////////////////////////////////

	private plugin: any;
	private _expand_internal: any;
	private _handleExpansionError: any;
	private expansionErrorHandlerStack: Array<any>;

	// Take a shortcut string and return the proper Expansion string.
	// WARNING: user-facing function
	private expand_internal(text: string,  isUserTriggered?: boolean): any
	{
		if (!text) { return; }
		let foundMatch: boolean = false;
		let expansionText: string = "";
		for (const shortcut of this.plugin.shortcuts)
		{
			// Helper-block (empty shortcut) just erases helper scripts before it
			if ((!shortcut.test || shortcut.test.source == "(?:)") &&
			    !shortcut.expansion)
			{
				expansionText = "";
				continue;
			}

			// Does the shortcut fit? (or is it a helper script?)
			const matchInfo: any = text.match(shortcut.test);
			if (!matchInfo) { continue; }

			// Translate regex groups into variables
			for (let k: number = 1; k < matchInfo.length; k++)
			{
				expansionText +=
					"let $" + k + " = \"" +
					matchInfo[k].replaceAll("\"", "\\\"") + "\";\n";
			}

			// Add the shortcut's Expansion string to the total Expanson script
			expansionText += shortcut.expansion + "\n";

			// If not a helper script, stop checking shortcut matches, we're done
			if (shortcut.test.source != "(?:)")
			{
				foundMatch = true;
				break;
			}
		}

		expansionText =
			!foundMatch ?
			undefined :
			this.runExpansionScript(expansionText, isUserTriggered);

		// If shortcut parsing amounted to nothing.  Notify user of bad shortcut entry.
		if (expansionText === undefined)
		{
			this.plugin.notifyUser(
				"Shortcut unidentified:\n" + INDENT + text, "",
				"Shortcut unidentified:\n" + text, false, true);
		}
		// If there are any listeners for the expansion event, call them
		else if (isUserTriggered && window._tejs?.listeners?.tejs?.onExpansion)
		{
			for (const key in window._tejs.listeners.tejs.onExpansion)
			{
				const listener: any = window._tejs.listeners.tejs.onExpansion[key];
				if (typeof listener !== "function")
				{
					this.plugin.notifyUser(
						"Non-function listener:\n" + INDENT + listener,
						undefined,
						"Non-function listener:\n" + listener,
						false, true);
					continue;
				}
				listener(expansionText);
			}
		}

		return expansionText;
	}

	// Runs an expansion script, including error handling.
	// NOTE: Error handling is being done through window "error" event, rather than through
	// exceptions.  This is because exceptions don't provide error line numbers like the error
	// event does.  Line numbers are important to create the useful "expansion failed" message.
	private runExpansionScript(expansionScript: string, isUserTriggered?: boolean)
	{
		// Prepare for possible Expansion script error
		if (isUserTriggered || !this.expansionErrorHandlerStack.length)
		{
			// ASSERT - This should never be true
			if (this.expansionErrorHandlerStack.length > 0)
			{
				let msg: string =
					"Stack was off by " +
					this.expansionErrorHandlerStack.length + ".\n" +
					this.expansionErrorHandlerStack.join("\n-------\n");
				this.plugin.notifyUser(msg, "EXPANSION-ERROR-HANDLER-ERROR");
				this.expansionErrorHandlerStack = [];
			}
			window.addEventListener("error", this._handleExpansionError);
		}
		this.expansionErrorHandlerStack.push(expansionScript);

		// Run the Expansion script
		// Pass expand function and isUserTriggered flag for use in Expansion script
		let result: any = (new Function(
				"expand", "isUserTriggered", "runExternal", "print",
				expansionScript))
				(this._expand_internal, isUserTriggered, this.plugin._runExternal, SHORTCUT_PRINT);

		// Clean up script error preparations (it wouldn't have got here if we'd hit one)
		this.expansionErrorHandlerStack.pop();
		if (isUserTriggered || !this.expansionErrorHandlerStack.length)
		{
			// ASSERT - This should never be true
			if (this.expansionErrorHandlerStack.length > 0)
			{
				let msg: string =
					"Stack was off by " +
					this.expansionErrorHandlerStack.length + ".\n" +
					this.expansionErrorHandlerStack.join("\n-------\n");
				this.plugin.notifyUser(msg, "EXPANSION-ERROR-HANDLER-ERROR");
				this.expansionErrorHandlerStack = [];
			}
			window.removeEventListener("error", this._handleExpansionError);
		}

		// if shortcut doesn't return anything, better to return "" than undefined
		return result ?? "";
	}

	// Called when something goes wrong during shortcut expansion.  Generates a useful
	// error in the console and notification popup.
	private handleExpansionError(e: any)
	{
		// Block default error handling
		e.preventDefault();

		// Get expansion script, modified by line numbers and arrow pointing to error
		let expansionText: string =
			this.expansionErrorHandlerStack[this.expansionErrorHandlerStack.length-1];
		let expansionLines = expansionText.split("\n");
		// Add line numbers
		for (let i: number = 0; i < expansionText.length; i++)
		{
			expansionLines[i] = String(i+1).padStart(4, "0") + " " + expansionLines[i];
		}
		// Add arrows (pointing to error)
		expansionLines.splice(e.lineno-2, 0, "-".repeat(e.colno + 4) + "^");
		expansionLines.splice(e.lineno-3, 0, "-".repeat(e.colno + 4) + "v");
		expansionText = expansionLines.join("\n");

		let msg: string =
			e.message + "\n" + INDENT +
			"line: " + (e.lineno-2) + ", column: " + e.colno + "\n" +
			INDENT + "─".repeat(20) + "\n" + expansionText;
		this.plugin.notifyUser(
			msg, "SHORTCUT-EXPANSION-ERROR",
			"Shortcut expansion issues.", true);

		// Clean up script error preparations (now that the error is handled)
		this.expansionErrorHandlerStack = []; // Error causes nest to unwind.  Clear stack.
		window.removeEventListener("error", this._handleExpansionError);
	}
}