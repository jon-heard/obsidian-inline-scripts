//////////////////////////////////////////////////////////////
// Shortcut expander - Logic to "expand" a shortcut string. //
//////////////////////////////////////////////////////////////

"use strict";

import InlineScriptsPlugin from "./_Plugin";
import { UserNotifier } from "./ui_userNotifier";
import { ExternalRunner } from "./ExternalRunner";
import { AutoAsyncWrapper } from "./AutoAsyncWrapper";
import { Parser } from "./node_modules/acorn/dist/acorn";
import { Popups } from "./ui_Popups";
import { HelperFncs } from "./HelperFncs";

// Get the AsyncFunction constructor to setup and run Expansion scripts with
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

export abstract class ShortcutExpander
{
	public static staticConstructor(): void
	{
		this.staticConstructor_internal();
	}

	// Take a shortcut string and expand it based on shortcuts active in the plugin
	public static async expand(
		shortcutText: string, failSilently?: boolean, expansionInfo?: any,
		parameterData?: any): Promise<any>
	{
		return await this.expand_internal(shortcutText, failSilently, expansionInfo, parameterData);
	}

	// Execute an expansion script (a string of JavaScript defined in a shortcut's Expansion string)
	public static async runExpansionScript(
		expansionScript: string, failSilently?: boolean, expansionInfo?: any): Promise<any>
	{
		return await this.runExpansionScript_internal(expansionScript, failSilently, expansionInfo);
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	private static _boundExpand: Function;

	private static staticConstructor_internal(): void
	{
		// Initialize the AutoAsyncWrapper
		AutoAsyncWrapper.initialize([
			"expand", "popups\s*\.\s*alert", "popups\s*\.\s*confirm", "popups\s*\.\s*input",
			"popups\s*\.\s*pick", "popups\s*\.\s*custom" ]);

		// Setup bound versons of these function for persistant use
		this._boundExpand = this.expand.bind(this);

		// Add "expand()" to "window._inlineScripts.inlineScripts.HelperFncs"
		HelperFncs.confirmObjectPath("_inlineScripts.inlineScripts.HelperFncs");
		window._inlineScripts.inlineScripts.HelperFncs.expand = this._boundExpand;
	}

	// Take a shortcut string and return the proper Expansion script.
	// WARNING: user-facing function
	private static async expand_internal(
		shortcutText: string, failSilently?: boolean, expansionInfo?: any,
		parameterData?: any): Promise<any>
	{
		if (!shortcutText) { return; }

		expansionInfo = Object.assign(
			{
				isUserTriggered: false,
				line: shortcutText,
				inputStart: 0,
				inputEnd: shortcutText.length,
				shortcutText: shortcutText,
				prefix: "",
				suffix: ""
			}, expansionInfo);

		let foundMatch: boolean = false;

		// Handle any "???"
		const matches = [... shortcutText.matchAll(/\?\?\?/g) ];
		let replacements = [];
		for (let i = 0; i < matches.length; i++)
		{
			const caption = parameterData?.[i]?.caption ?? "Parameter #" + (i+1);
			const value = parameterData?.[i]?.value || "";
			const replacement = await Popups.getInstance().input(caption, value);
			if (replacement === null)
			{
				return null;
			}
			replacements.push(replacement);
		}
		for (let i = matches.length - 1; i >= 0; i--)
		{
			shortcutText =
				shortcutText.slice(0, matches[i].index) +
				replacements[i] +
				shortcutText.slice(matches[i].index + 3);
		}

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
			try
			{
				expansionText = await this.runExpansionScript(
					expansionScript, failSilently, expansionInfo);
			}
			catch (e: any)
			{
				if (!failSilently) { throw e; }
			}
		}
		expansionInfo.expansionText = expansionText;

		// If shortcut parsing amounted to nothing.  Notify user of bad shortcut entry.
		if (expansionText === null)
		{
			if (!failSilently)
			{
				UserNotifier.run(
				{
					message: "Shortcut unidentified:\n\"" + shortcutText + "\"",
					messageLevel: "warn"
				});
			}
		}

		// If there are any listeners for the onExpansion event, call them.  If any of them return
		// true, then cancel the expansion.
		else if (expansionInfo.isUserTriggered && !expansionInfo.cancel &&
		         window._inlineScripts?.inlineScripts?.listeners?.onExpansion)
		{
			let replacementInput: string = null;
			HelperFncs.callEventListenerCollection(
				"inlineScripts.onExpansion",
				window._inlineScripts.inlineScripts.listeners.onExpansion,
				expansionInfo,
				(result: any) =>
				{
					if (typeof result === "string")
					{
						replacementInput = result;
					}
				});
			if (typeof replacementInput === "string")
			{
				return this.expand(replacementInput, false);
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

		expansionScript = AutoAsyncWrapper.run(expansionScript);

		// Run a pre-parser - finds the position of a parser error, if there is one
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

		// If we should fail silently, and we found an error, just quit
		if (failSilently && errorPosition)
		{
			throw null;
		}

		try
		{
			// Run the expansion script and return the result
			return await ( new AsyncFunction(
				"expand", "runExternal", "print", "expansionInfo", "popups", "expFormat",
				"expUnformat",
				expansionScript) )
				( this._boundExpand, ExternalRunner.run, UserNotifier.getFunction_print(),
				  expansionInfo, Popups.getInstance(), HelperFncs.expFormat, HelperFncs.expUnformat
				) ?? "";
		}
		// If there was an error...
		catch (e: any)
		{
			// If we should fail silently, just quit
			if (failSilently)
			{
				throw null;
			}

			// If needed, get the error's position from the error object
			if (!errorPosition && e?.stack)
			{
				let match = e.stack.split("\n")[1].match(/([0-9]+):([0-9]+)/);
				if (match)
				{
					errorPosition = { line: Number(match[1])-2,  column: Number(match[2]) };
				}
			}

			// Display the error to the user, then quit
			this.handleExpansionError(
				expansionScript, e?.message || "Un-listed error", errorPosition,
				expansionInfo?.shortcutText);
			throw null;
		}
	}

	// Event handler for errors that occur during the expansion process
	private static handleExpansionError(
		expansionScript: string, message: string, position: any, shortcutText?: string): void
	{
		// Use spaces instead of tabs
		expansionScript = expansionScript.replaceAll("\t", "    ");

		// Setup variables to be filled based on the given position
		let positionText = "\nline,column: ?,?";
		let expansionText = "";

		if (position)
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

			// Fill message variables based on position
			positionText = "\nline,column: " + position.line + "," + position.column;
			expansionText = "\n" + "─".repeat(20) + "\n" + expansionLines.join("\n");
		}

		const errorMessage =
			message + positionText + "\nshortcut-text: \"" + (shortcutText ?? "") + "\"" +
			expansionText;

		// Create a user message with the line and column of the error and the expansion script
		// showing where the error occurred.
		UserNotifier.run(
		{
			popupMessage: "Shortcut expansion issues.",
			consoleMessage: errorMessage,
			messageType: "SHORTCUT-EXPANSION-ERROR",
			consoleHasDetails: true
		});

		// If there are any listeners for the onError event, call them
		if (window._inlineScripts?.inlineScripts?.listeners?.onError)
		{
			HelperFncs.callEventListenerCollection(
				"inlineScripts.onError",
				window._inlineScripts.inlineScripts.listeners.onError, errorMessage);
		}
	}
}
