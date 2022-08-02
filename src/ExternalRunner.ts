/////////////////////////////////////////////////////////////////////////////
// External runner - Functionality to run shell commands (non-mobile only) //
/////////////////////////////////////////////////////////////////////////////

"use strict";

import { Platform } from "obsidian";
import InlineScriptsPlugin from "./_Plugin";
import { UserNotifier } from "./ui_userNotifier";

let exec: any = null;

export namespace ExternalRunner
{
	export async function run(
		command: string, failSilently?: boolean, dontFixSlashes?: boolean): Promise<string>
	{
		// Error-out if on mobile platform
		if (Platform.isMobile)
		{
			UserNotifier.run(
			{
				popupMessage: "Unauthorized \"runExternal\" call",
				consoleMessage: "Unauthorized \"runExternal\" call (not available on mobile):\n" +
				"runExternal(\"" + command + "\")",
				messageType: "RUNEXTERNAL-ERROR",
				consoleHasDetails: true
			});
			return null;
		}
		else if (!exec)
		{
			try
			{
				exec = require("util").promisify(require("child_process").exec);
			}
			catch(e: any)
			{
				console.error("External runner failed to load \"child_process\": " + e);
			}
		}

		const plugin = InlineScriptsPlugin.getInstance();

		// Error-out if runExternal is not explicitly allowed by the user.
		// note - User allows runExternal by turning on the toggle "Allow external" in the settings.
		if (!plugin.settings.allowExternal)
		{
			UserNotifier.run(
			{
				popupMessage: "Unauthorized \"runExternal\" call",
				consoleMessage: "Unauthorized \"runExternal\" call (disallowed by user):\n" +
				"runExternal(\"" + command + "\")\nNOTE: User can allow runExternal by turning " +
				"on \"Allow external\" in the settings.",
				messageType: "RUNEXTERNAL-ERROR",
				consoleHasDetails: true
			});
			return null;
		}

		// Fail if command is empty
		if (!command) { return null; }

		// Slashes on a Windows platform need reversing (to blackslash).
		if (navigator.appVersion.includes("Windows") && !dontFixSlashes)
		{
			command = command.replaceAll("/", "\\");
		}

		// Run the shell command
		const vaultDir: string = (plugin.app.fileManager as any).vault.adapter.basePath;
		try
		{
			const result: string = (await exec(command, { cwd: vaultDir })).stdout;
			return (result + "").replaceAll("\r", "");
		}

		// Handle errors from running the shell command
		catch (e: any)
		{
			if (!failSilently)
			{
				UserNotifier.run(
				{
					popupMessage: "Failed \"runExternal\" call",
					consoleMessage:
						"Failed \"runExternal\" call:\ncurDir: " + vaultDir + "\n" + e.message,
					messageType: "RUNEXTERNAL-ERROR",
					consoleHasDetails: true
				});
			}
			return null;
		}
	}
}
