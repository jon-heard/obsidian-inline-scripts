//////////////////////////////////////////////////////////////
// Shortcut expander - Logic to "expand" a shortcut string. //
//////////////////////////////////////////////////////////////

"use strict";

abstract class ShortcutExpander
{
	public static initialize(): void
	{
		this.initialize_internal();
	}

	// Take a shortcut string and expand it based on shortcuts active in the plugin
	public static expand(
		shortcutText: string, failSilently?: boolean, expansionInfo?: any): any
	{
		return this.expand_internal(shortcutText, failSilently, expansionInfo);
	}

	// Execute an expansion script (a string of javascript defined in a shortcut's Expansion string)
	public static runExpansionScript(
		expansionScript: string, failSilently?: boolean, expansionInfo?: any): any
	{
		return this.runExpansionScript_internal(expansionScript, failSilently, expansionInfo);
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	private static _expand_internal: any;
	private static _handleExpansionError: any;
	private static _expansionErrorHandlerStack: Array<any>;

	private static initialize_internal()
	{
		//Setup bound versons of these function for persistant use
		this._expand_internal = this.expand_internal.bind(this);
		this._handleExpansionError = this.handleExpansionError.bind(this);

		// This keeps track of multiple expansion error handlers for nested expansions
		this._expansionErrorHandlerStack = [];
	}

	// Take a shortcut string and return the proper Expansion script.
	// WARNING: user-facing function
	private static expand_internal(
		shortcutText: string, failSilently?: boolean, expansionInfo?: any): any
	{
		if (!shortcutText) { return; }

		expansionInfo = expansionInfo ||
			{
				isUserTriggered: false,
				line: shortcutText,
				inputStart: 0,
				inputEnd: shortcutText.length,
				shortcutText: shortcutText,
				prefix: "",
				suffix: ""
			};

		let foundMatch: boolean = false;

		// Build an expansion script from the master list of shortcuts
		let expansionScript: string = "";
		for (const shortcut of TextExpanderJsPlugin.getInstance().shortcuts)
		{
			// Helper-blocker (an empty shortcut) just erases any helper scripts before it
			if ((!shortcut.test || shortcut.test.source === "(?:)") && !shortcut.expansion)
			{
				expansionScript = "";
				continue;
			}

			// Does the shortcut fit the input text? (a helper script ALWAYS fits, since it's blank)
			const matchInfo: any = shortcutText.match(shortcut.test);
			if (!matchInfo) { continue; }

			// Translate any regex group results into variables/values for the expansion script
			for (let k: number = 1; k < matchInfo.length; k++)
			{
				expansionScript +=
					"let $" + k + " = \"" + matchInfo[k].replaceAll("\"", "\\\"") + "\";\n";
			}

			// Add the shortcut's Expansion string to the Expanson script
			expansionScript += shortcut.expansion;

			// If this shortcut is not a helper script, stop checking for shortcut matches
			if (shortcut.test.source !== "(?:)")
			{
				foundMatch = true;
				break;
			}
			else
			{
				expansionScript += "\n";
			}
		}

		let expansionText = null;
		if (foundMatch)
		{
			expansionText =
				this.runExpansionScript_internal(expansionScript, failSilently, expansionInfo);
		}
		expansionInfo.expansionText = expansionText;

		// If shortcut parsing amounted to nothing.  Notify user of bad shortcut entry.
		if (expansionText === null)
		{
			if (!failSilently)
			{
				UserNotifier.run(
				{
					message: "Shortcut unidentified:\n" + shortcutText,
					messageLevel: "warn"
				});
			}
		}

		// If there are any listeners for the expansion event, call them.  If any of them return
		// true, then cancel the expansion.
		else if (expansionInfo.isUserTriggered && !expansionInfo.cancel &&
		         window._tejs?.listeners?.tejs?.onExpansion)
		{
			let replacementInput: string = null;
			for (const key in window._tejs.listeners.tejs.onExpansion)
			{
				const listener: any = window._tejs.listeners.tejs.onExpansion[key];
				if (typeof listener !== "function" && !failSilently)
				{
					UserNotifier.run({ message: "Non-function listener:\n" + listener });
					continue;
				}
				const result = listener(expansionInfo);
				if (typeof result === "string")
				{
					replacementInput = result;
				}
			}
			if (typeof replacementInput === "string")
			{
				return this.expand_internal(replacementInput, false);
			}
		}

		if (expansionInfo.cancel)
		{
			expansionText = null;
		}

		return expansionText;
	}

	// Runs an expansion script, including error handling.
	// NOTE: Error handling is being done through window "error" event, rather than through
	// exceptions.  This is because exceptions don't provide error line numbers whereas error
	// events do.  Line numbers are important to create the useful "expansion failed" message.
	private static runExpansionScript_internal
		(expansionScript: string, failSilently?: boolean, expansionInfo?: any): any
	{
		expansionInfo = expansionInfo || { isUserTriggered: false };
		expansionInfo.cancel = false;

		// Prepare for possible Expansion script error
		if (expansionInfo.isUserTriggered || !this._expansionErrorHandlerStack.length)
		{
			// ASSERT - This should never be true, and signifies a potential issue.  It's not
			// intrinsically a problem, though.
			if (this._expansionErrorHandlerStack.length > 0)
			{
				this._expansionErrorHandlerStack = [];
				if (!failSilently)
				{
					UserNotifier.run(
					{
						consoleMessage:
							"Stack was off by " + this._expansionErrorHandlerStack.length + ".\n" +
							this._expansionErrorHandlerStack.join("\n-------\n"),
						messageType: "EXPANSION-ERROR-HANDLER-ERROR"
					});
				}
			}
			window.addEventListener("error", this._handleExpansionError);
		}
		this._expansionErrorHandlerStack.push({ expansionScript: expansionScript });

		// Run the Expansion script
		let result: any;
		if (!failSilently)
		{
			result = ( new Function(
				"expand", "runExternal", "print", "expansionInfo",
				expansionScript) )
				( this._expand_internal, ExternalRunner.run, UserNotifier.getFunction_print(),
				  expansionInfo );
			// if shortcut doesn't return anything, best to return ""
			result ??= "";
		}
		else
		{
			try
			{
				result = ( new Function(
					"expand", "runExternal", "print", "expansionInfo",
					expansionScript) )
					( this._expand_internal, ExternalRunner.run, UserNotifier.getFunction_print(),
					  expansionInfo );
				// if shortcut doesn't return anything, best to return ""
				result ??= "";
			}
			catch (e) {}
		}

		// Clean up script error preparations
		this._expansionErrorHandlerStack.pop();
		if (expansionInfo.isUserTriggered || !this._expansionErrorHandlerStack.length)
		{
			// ASSERT - This should never be true, and signifies a potential issue.  It's not
			// intrinsically a problem, though.
			if (this._expansionErrorHandlerStack.length > 0)
			{
				this._expansionErrorHandlerStack = [];
				if (!failSilently)
				{
					UserNotifier.run(
					{
						consoleMessage:
							"Stack was off by " + this._expansionErrorHandlerStack.length + ".\n" +
							this._expansionErrorHandlerStack.join("\n-------\n"),
						messageType: "EXPANSION-ERROR-HANDLER-ERROR"
					});
				}
			}
			window.removeEventListener("error", this._handleExpansionError);
		}

		return result;
	}

	// Callback for when something goes wrong during shortcut expansion.  Generates a useful error
	// message.
	private static handleExpansionError(e: any): void
	{
		// Block default error handling
		e.preventDefault();

		// Get the expansion script, modified by line numbers and an arrow pointing to the error
		let expansionLines =
			this._expansionErrorHandlerStack[this._expansionErrorHandlerStack.length - 1].
			expansionScript.split("\n");
		// Add line numbers
		for (let i: number = 0; i < expansionLines.length; i++)
		{
			expansionLines[i] = String(i+1).padStart(4, "0") + " " + expansionLines[i];
		}
		// Add arrows (pointing to error)
		expansionLines.splice(e.lineno-2, 0, "-".repeat(e.colno + 4) + "^");
		expansionLines.splice(e.lineno-3, 0, "-".repeat(e.colno + 4) + "v");
		const expansionText = expansionLines.join("\n");

		// Create a user message with the line and column of the error and the expansion script
		// showing where the error occurred.
		UserNotifier.run(
		{
			popupMessage: "Shortcut expansion issues.",
			consoleMessage:
				e.message + "\nline: " + (e.lineno-2) + ", column: " + e.colno + "\n" +
				"─".repeat(20) + "\n" + expansionText,
			messageType: "SHORTCUT-EXPANSION-ERROR",
			consoleHasDetails: true
		});

		// Clean up script error preparations (now that the error is handled)
		this._expansionErrorHandlerStack = []; // Error causes nesting to unwind.  Clear the stack.
		window.removeEventListener("error", this._handleExpansionError);
	}
}
