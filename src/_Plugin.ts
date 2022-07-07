//////////////////////////////////////////////////////////////////////
// plugin - Class containing the main logic for this plugin project //
//////////////////////////////////////////////////////////////////////

"use strict";

// NOTE: The "Text Expander JS" plugin uses a custom format for shortcut-files.  I tried using
// existing formats (json, xml, etc), but they were cumbersome for developing javascript code in.
// The chosen format is simple, flexible, and allows for wrapping scripts in js-fenced-code-blocks.
// This makes it easy to write Expansion scripts within Obsidian which is the intended use-case.
//
// For a summary of the format, see here:
// https://github.com/jon-heard/obsidian-text-expander-js#tutorial-create-a-new-shortcut-file
// and here:
// https://github.com/jon-heard/obsidian-text-expander-js#development-aid-fenced-code-blocks

// child_process is a node.js library, so is not available for mobile.  However, the code that uses
// it is blocked for mobile, so the plugin is still viable for mobile, just slightly more limited.
const childProcess = require("child_process");

const LONG_NOTE_TIME: number = 8 * 1000;
const INDENT: string = " ".repeat(4);

class TextExpanderJsPlugin extends obsidian.Plugin
{
	public saveSettings(): void
	{
		this.saveData(this.settings);
	}

	public async onload(): void
	{
		// Load settings
		const currentDefaultSettings: object =
			obsidian.Platform.isMobile ?
			Object.assign({}, DEFAULT_SETTINGS, DEFAULT_SUB_SETTINGS_MOBILE) :
			DEFAULT_SETTINGS;
		this.settings = Object.assign({}, currentDefaultSettings, await this.loadData());

		// Now that settings are loaded, keep track of the suffix's finishing character
		this.suffixEndCharacter = this.settings.suffix.charAt(this.settings.suffix.length - 1);

		// Attach settings UI
		this.addSettingTab(new TextExpanderJsPluginSettings(this.app, this));

		//Setup bound versons of this function for persistant use
		this._cm5_handleExpansionTrigger = this.cm5_handleExpansionTrigger.bind(this);

		// Setup support obects for various tasks
		this.shortcutLoader = new ShortcutLoader(this);
		this.shortcutExpander = new ShortcutExpander(this, this.runExternal.bind(this));

		// Setup a dfc to monitor shortcut-file notes.
		this.shortcutDfc = new Dfc(
			this, this.settings.shortcutFiles, this.shortcutLoader.getBoundSetupShortcuts(), true,
			this.onShortcutFileDisabled.bind(this));
		this.shortcutDfc.setMonitorType(
			this.settings.devMode ? DfcMonitorType.OnTouch : DfcMonitorType.OnModify);

		// Connect "code mirror 5" instances to this plugin to trigger expansions
		this.registerCodeMirror( (cm: any) => cm.on("keydown", this._cm5_handleExpansionTrigger) );

		// Setup "code mirror 6" editor extension management to trigger expansions
		this.registerEditorExtension([
			require("@codemirror/state").EditorState.transactionFilter.of(
				this.cm6_handleExpansionTrigger.bind(this))
		]);

		// Track shutdown scripts in loaded shortcut-files to be called when unloaded.
		this.shortcutFileShutdownScripts = {};

		// Log starting the plugin
		this.notifyUser("Loaded (" + this.manifest.version + ")");
	}

	public onunload(): void
	{
		// Shutdown the shortcutDfc
		this.shortcutDfc.destructor();

		// Call shutdown script on shortcut files
		for (const filename in this.shortcutFileShutdownScripts)
		{
			this.onShortcutFileDisabled(filename);
		}

		// Disconnect "code mirror 5" instances from this plugin
		this.app.workspace.iterateCodeMirrors(
			(cm: any) => cm.off("keydown", this._cm5_handleExpansionTrigger));

		// Log ending the plugin
		this.notifyUser("Unloaded (" + this.manifest.version + ")");
	}

	// Adds a console entry and/or a popup notification
	public notifyUser(
		consoleMessage: string, errorType?: string, popupMessage?: string,
		detailOnConsole?: boolean, isWarning?: boolean)
	{
		if (consoleMessage)
		{
			consoleMessage =
				this.manifest.name + "\n" +
				(errorType ? (INDENT + errorType + "\n") : "") +
				INDENT + consoleMessage;
			errorType ? console.error(consoleMessage) :
			isWarning ? console.warn(consoleMessage) :
			console.info(consoleMessage);
		}
		if (popupMessage)
		{
			new obsidian.Notice(
				(errorType ? "ERROR: " : "") +
				popupMessage +
				(detailOnConsole ? "\n\n(see console for details)" : ""),
				LONG_NOTE_TIME);
		}
	}

	// Adds a tinted full-screen div to prevent user-input
	public addInputBlock(): void
	{
		if (document.getElementById("tejs_inputBlock")) { return; }
		let block: any = document.createElement("div");
		block.id = "tejs_inputBlock";
		document.getElementsByTagName("body")[0].prepend(block);
	}

	// Removes the tinted full-screen div created by addInputBlock
	public removeInputBlock(): void
	{
		let block: any = document.getElementById("tejs_inputBlock");
		if (block) { block.remove(); }
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	private settings: any;
	private suffixEndCharacter: string;
	private _cm5_handleExpansionTrigger: any;
	private shortcutDfc: Dfc;
	private shortcutFileShutdownScripts: any;
	private shortcutLoader: ShortcutLoader;
	private shortcutExpander: ShortcutExpander;

	// Call the given shortcut-file's shutdown script.
	// Note: This is called when shortcut-file is being disabled
	private onShortcutFileDisabled(filename: string): void
	{
		this.runExpansionScript(this.shortcutFileShutdownScripts[filename]);
		delete this.shortcutFileShutdownScripts[filename];
	}

	// CM5 callback for "keydown".  Used to kick off shortcut expansion attempt
	private cm5_handleExpansionTrigger(cm: any, keydown: KeyboardEvent): void
	{
		if ((event as any)?.key == this.suffixEndCharacter)
		{
			this.tryShortcutExpansion();
		}
	}

	// CM6 callback for editor events.  Used to kick off shortcut expansion attempt
	private cm6_handleExpansionTrigger(tr: any): any
	{
		// Only bother with key inputs that have changed the document
		if (!tr.isUserEvent("input.type") || !tr.docChanged) { return tr; }

		let shouldTryExpansion: boolean = false;

		// Iterate over each change made to the document
		tr.changes.iterChanges(
		(fromA: number, toA: number, fromB: number, toB: number, inserted: any) =>
		{
			// Only try expansion if the shortcut suffix's end character was hit
			if (inserted.text[0] == this.suffixEndCharacter)
			{
				shouldTryExpansion = true;
			}
		}, false);

		if (shouldTryExpansion)
		{
			this.tryShortcutExpansion();
		}

		return tr;
	}

	// Tries to get shortcut beneath caret and expand it.  setTimeout pauses for a frame to
	// give the calling event the opportunity to finish processing.  This is especially
	// important for CM5, as the typed key isn't in the editor at the time this is called.
	private tryShortcutExpansion(): void { setTimeout(() =>
	{
		const editor: any  = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView)?.editor;
		if (!editor) { return; }

		// Find bounds of the shortcut beneath the caret (if there is one)
		const cursor: any = editor.getCursor();
		const lineText: string = editor.getLine(cursor.line);
		const prefixIndex: number = lineText.lastIndexOf(this.settings.prefix, cursor.ch);
		const suffixIndex: number = lineText.indexOf(
			this.settings.suffix, prefixIndex + this.settings.prefix.length);

		// If the caret is not at a shortcut, early out
		if (prefixIndex == -1 || suffixIndex == -1 ||
		    (suffixIndex + this.settings.suffix.length) < cursor.ch)
		{
			return;
		}

		// Run the Expansion script on the shortcut under the caret
		const sourceText: string =
			lineText.substring(prefixIndex + this.settings.prefix.length, suffixIndex);
		let expansionText: string = this.shortcutExpander.expand(sourceText, true);
		if (expansionText === undefined) { return; }

		// Handle a string array from the Expansion result
		if (Array.isArray(expansionText))
		{
			expansionText = expansionText.join("");
		}

		// Make sure we have a proper string
		expansionText = expansionText + "";

		// Replace written shortcut with Expansion result
		editor.replaceRange(
			expansionText,
			{ line: cursor.line, ch: prefixIndex },
			{ line: cursor.line, ch: suffixIndex + this.settings.suffix.length } );
	}, 0); }

	// This function is passed into all Expansion scripts to allow them to run shell commands
	// WARNING: user-facing function
	private runExternal(command: string, silentFail?: boolean, dontFixSlashes?: boolean): string
	{
		if (obsidian.Platform.isMobile)
		{
			this.notifyUser(
				"Unauthorized \"runExternal\" call " +
				"(NOT available on mobile):\n" + INDENT +
				"runExternal(\"" + command + "\")", "RUNEXTERNAL-ERROR",
				"Unauthorized \"runExternal\" call", true);
			return undefined;
		}

		// Block this function call if user hasn't turned on the "Allow external" setting
		// to explicitly allowed shortcuts to call shell commands.
		if (!this.settings.allowExternal)
		{
			this.notifyUser(
				"Unauthorized \"runExternal\" call " +
				"(disallowed by user):\n" + INDENT +
				"runExternal(\"" + command + "\")\n" + INDENT +
				"NOTE: User can allow runExternal by turning on " +
				"\"Allow external\" in the settings.", "RUNEXTERNAL-ERROR",
				"Unauthorized \"runExternal\" call", true);
			return undefined;
		}

		// Empty commands always fail
		if (!command) { return undefined; }

		// Fix slashes in Windows commands
		if (navigator.appVersion.includes("Windows") && !dontFixSlashes)
		{
			command = command.replaceAll("/", "\\");
		}

		// Do the shell command
		let vaultDir: string = this.app.fileManager.vault.adapter.basePath;
		try
		{
			let result: string = childProcess.execSync(command, { cwd: vaultDir});
			return (result + "").replaceAll("\r", "");
		}
		catch (e: any)
		{
			if (!silentFail)
			{
				this.notifyUser(
					"Failed \"runExternal\" call:\n" + INDENT +
					"curDir: " + vaultDir + "\n" + INDENT +
					e.message, "RUNEXTERNAL-ERROR",
					"Failed \"runExternal\" call", true);
			}
			return undefined;
		}
	}
}

module.exports = TextExpanderJsPlugin;
