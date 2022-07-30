//////////////////////////////////////////////////////////////
// Shortcut expander - Logic to "expand" a shortcut string. //
//////////////////////////////////////////////////////////////

"use strict";

import InlineScriptsPlugin from "./_Plugin";
import { UserNotifier } from "./ui_userNotifier";
import { ExternalRunner } from "./ExternalRunner";
import { AutoAwaitWrapper } from "./AutoAwaitWrapper";
import { Parser } from "./node_modules/acorn/dist/acorn";

// Get the AsyncFunction constructor to setup and run Expansion scripts with
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

export abstract class ShortcutExpander
{
	public static initialize(): void
	{
		this.initialize_internal();
	}

	// Take a shortcut string and expand it based on shortcuts active in the plugin
	public static async expand(
		shortcutText: string, failSilently?: boolean, expansionInfo?: any): Promise<any>
	{
		return await this.expand_internal(shortcutText, failSilently, expansionInfo);
	}

	// Execute an expansion script (a string of JavaScript defined in a shortcut's Expansion string)
	public static async runExpansionScript(
		expansionScript: string, failSilently?: boolean, expansionInfo?: any): Promise<any>
	{
		return await this.runExpansionScript_internal(expansionScript, failSilently, expansionInfo);
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	private static _expand_internal: any;

	private static initialize_internal()
	{
		// Initialize the AutoAwaitWrapper
		AutoAwaitWrapper.initialize([ "expand" ]);

		//Setup bound versons of these function for persistant use
		this._expand_internal = this.expand_internal.bind(this);
	}

	// Take a shortcut string and return the proper Expansion script.
	// WARNING: user-facing function
	private static async expand_internal(
		shortcutText: string, failSilently?: boolean, expansionInfo?: any): Promise<any>
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
		for (const shortcut of InlineScriptsPlugin.getInstance().shortcuts)
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
					"let $" + k + " = \"" +
					matchInfo[k].replaceAll("\\", "\\\\").replaceAll("\"", "\\\"") + "\";\n";
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
			expansionText = await this.runExpansionScript_internal(
				expansionScript, failSilently, expansionInfo);
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
		         window._inlineScripts?.listeners?.inlineScripts?.onExpansion)
		{
			let replacementInput: string = null;
			for (const key in window._inlineScripts.listeners.inlineScripts.onExpansion)
			{
				const listener: any = window._inlineScripts.listeners.inlineScripts.onExpansion[key];
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
	private static async runExpansionScript_internal
		(expansionScript: string, failSilently?: boolean, expansionInfo?: any):  Promise<any>
	{
		expansionInfo = expansionInfo || { isUserTriggered: false };
		expansionInfo.cancel = false;

		expansionScript = AutoAwaitWrapper.run(expansionScript);

		// Run the Expansion script
		let errorPosition = null;
		try
		{
			Parser.parse(
				"(async function(){\n" + expansionScript + "\n})", { ecmaVersion: 2021 });
		}
		catch (e: any)
		{
			errorPosition =
			{
				line:   e.loc.line - 1,
				column: e.loc.column + 1
			};
		}

		if (failSilently && errorPosition)
		{
			throw null;
		}

		try
		{
			return await ( new AsyncFunction(
				"expand", "runExternal", "print", "expansionInfo",
				expansionScript) )
				( this._expand_internal, ExternalRunner.run, UserNotifier.getFunction_print(),
				  expansionInfo ) ?? "";
		}
		catch (e: any)
		{
			if (failSilently)
			{
				throw null;
			}

			if (!errorPosition)
			{
				let match = e.stack.split("\n")[1].match(/([0-9]+):([0-9]+)/);
				errorPosition =
				{
					line:   Number(match[1])-2,
					column: Number(match[2])
				};
			}

			this.handleExpansionError(expansionScript, e.message, errorPosition);
			throw null;
		}
	}

	private static handleExpansionError(
		expansionScript: string, message: string, position: any): void
	{
		// Get the expansion script, modified by line numbers and an arrow pointing to the error
		let expansionLines = expansionScript.split("\n");
		// Add line numbers
		for (let i: number = 0; i < expansionLines.length; i++)
		{
			expansionLines[i] = String(i+1).padStart(4, "0") + " " + expansionLines[i];
		}
		// Add arrows (pointing to error)
		expansionLines.splice(position.line, 0, "-".repeat(position.column + 4) + "^");
		expansionLines.splice(position.line-1, 0, "-".repeat(position.column + 4) + "v");
		const expansionText = expansionLines.join("\n");

		// Create a user message with the line and column of the error and the expansion script
		// showing where the error occurred.
		UserNotifier.run(
		{
			popupMessage: "Shortcut expansion issues.",
			consoleMessage:
				message + "\nline: " + position.line + ", column: " + position.column + "\n" +
				"─".repeat(20) + "\n" + expansionText,
			messageType: "SHORTCUT-EXPANSION-ERROR",
			consoleHasDetails: true
		});
	}
}
