/////////////////////////////////////////////////////////////////////////////
// External runner - Functionality to run shell commands (non-mobile only) //
/////////////////////////////////////////////////////////////////////////////

"use strict";

let childProcess: any;

abstract class ExternalRunner
{
	public static initialize(plugin: any): void
	{
		this.initialize_internal(plugin);
	}

	// Offer "runExternal" function for use by user-written shortcuts.
	// Function calls a shell command.
	public static getFunction_runExternal(): Function
	{
		if (!this._runExternal)
		{
			this._runExternal = this.runExternal.bind(this);
		}
		return this._runExternal;
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	private static _plugin: any = null;
	private static _runExternal: Function = null;

	public static initialize_internal(plugin: any): void
	{
		this._plugin = plugin;

		// Setup the childProcess for use in running shell commands
		// - If we are NOT on a mobile platform, then we can safely use the node.js library.
		// - If we ARE on a mobile platform, we can NOT use the node.js library.  This is checked
		//   during "runExternal()", so childProcess is never referenced.
		if (!obsidian.Platform.isMobile)
		{
			childProcess = require("child_process");
		}
	}

	private static runExternal(command: string, failSilently?: boolean, dontFixSlashes?: boolean)
	{
		// Error-out if on mobile platform
		if (obsidian.Platform.isMobile)
		{
			UserNotifier.run(
			{
				popupMessage: "Unauthorized \"runExternal\" call",
				consoleMessage: "Unauthorized \"runExternal\" call (not available on mobile):\n" +
				"runExternal(\"" + command + "\")",
				messageType: "RUNEXTERNAL-ERROR",
				consoleHasDetails: true
			});
			return undefined;
		}

		// Error-out if runExternal is not explicitly allowed by the user.
		// note - User allows runExternal by turning on the toggle "Allow external" in the settings.
		if (!(this._plugin?.settings.allowExternal))
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
			return undefined;
		}

		// Fail if command is empty
		if (!command) { return undefined; }

		// Slashes on a Windows platform need reversing (to blackslash).
		if (navigator.appVersion.includes("Windows") && !dontFixSlashes)
		{
			command = command.replaceAll("/", "\\");
		}

		// Run the shell command
		let vaultDir: string = this._plugin.app.fileManager.vault.adapter.basePath;
		try
		{
			let result: string = childProcess.execSync(command, { cwd: vaultDir});
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
			return undefined;
		}
	}
}
