### 0.24.3
- Plugin updates
  - feature - ShortcutExpander - added event listening for expansion errors
- Library updates
  - added shortcut-file "system" - "sys lasterror", "sys runjs", "sys triggererror"
  - polish - une_ui - improved ui.  All shortcuts show one big popup instead of multiple little ones
  - feature - tablefiles - add shortcut "tbl reroll"
  - feature - tablefiles - "tbl reroll" (non-ui version) made parameters case-insensitive
  - feature - tablefiles - "tbl reroll" (non-ui version) made format parameter flexible
      - removed the need for quotes
      - allowed singular value: "comma" instead of commas"
      - allowed untrimmed value
  - polish - tablefiles - tbl roll (non-ui version) adjusted to be more useful when called from another shortcut
  - feature - tablefiles - "tbl roll" shortcut (non-ui version) now accepts a path with implicit ".md" extension
  - bug fix - tablefiles - tbl roll (non-ui version) errored each time

### 0.24.2
- Plugin updates
  - bug fix - shortcutlinks - link doesn't work if part 2 (output script) is included but not defined

### 0.24.1
- Plugin updates
  - bug fix - append & prepend shortcut links without block-ids are erroring out
  - bug fix - rare race condition causes duplicate buttons in buttons view
- Library updates
  - bug fix - cards - card images don't show when they have spaces or parenthesis
  - bug fix - lists - combo-lists fail

### 0.24.0
  Plugin updates
    - "expFormat()" adds standard expansion formatting to a string or string array.  This format is based on settings added under "Expansion format": prefix, line-prefix and suffix.      - "expUnformat()" removes standard expansion formatting from a string or string array.
    - Shortcut links - can include a block-id to define where the output should go
    - Shortcut links - can include a bit of javascript to modify expansion output
    - settings - both the autocomplete feature and the autocomplete help tooltip are togglable in the settings
    - popups.pick - allow turning the dropdown into a list box of either a fixed size, or adaptive size to it's contents
    - popups.custom - "resolveFnc()" passed to onOpen to allow early outing with custom result
    - helper function - "appendToEndOfNote()" replaced with more versatile "addToNote()" function
    - helper function - "unblock()" added to manually ublock if the input blocker is left on, such as if a shortcut errors out.
    - helper function - "getLeafForFile()" is replaced with "getLeavesForFile()"
    - bug fix - the latest Obsidian release breaks some ui in the inline scripts buttons view
  Library updates
    - tablefiles - shortcut-file added!  Allows working with files of tables in different formats.
    - cards 2.0 - a new interface for working with virtual cards.  It has a number of incompatibilities with the older interface.
    - state - state file now saved to same folder as the state shortcut-file.  This ensures the state is properly transferred with the rest of the vault, regardless of what happens to the .obsidian folder.
    - state - state saving is now done after each shortcut is run, rather than on a timer
    - notevars - resolved incompatibilities with latest Obsidian
    - notevars - resolved bug where running "notevars set" multiple times only saved one of the changes
    - general - commented entire library
    - general - shortcuts that use pick popups now show lists instead of dropdowns.
    - files - shortcut-file added!  Shortcuts for working with files, including: "extensionChange" and "files shortcutbatch"
    - lists - added "lists rename" and "lists shortcutbatch"

### 0.23.2
- bug fix - state is occasionally not saved on Obsidian quit.

### 0.23.1
- bug fix - fixed announcement to include "import latest library" message.

### 0.23.0
  LIBRARY UPDATES
	- The state system now keeps the state between Obsidian sessions without needing user interaction.
	- Shortcut added - "lists fromfile lines {list name} {file name}" reads a file and adds each of its lines to a list as an item.
	- Cards system updates:
		- Can modify the cards through the card-pile viewer panel.  Drag to reorder and double-click to rotate.
		- Custom card-backing.
		- Global card size.
		- Can predefine card-piles with the shortcut "cards pile {pile id}"
		- Square cards now rotate to any of four directions.  Non-square cards still only rotate to two directions: rightside-up and upside-down.
  PLUGIN
	- Shortcuts are now case-insensitive (useful for mobile, which auto-cases letters)
	- "getObsidianInterfaces" was merged into "helperFncs"
	- "onShortcutsLoaded" event added.
	- Shutdown scripts are called when closing Obsidian.
	- The drag-reorder system is improved.
	- Button panel's create/edit button popup has better field descriptions.
  BUG-FIXES
	- Card images in notes are absolute, so break when vault is moved or synced.
	- Drag-reorder not working on mobile.
### 0.22.2
  LIBRARY UPDATES
	- Interfacing with the Dice Roller plugin made possible with the new "plugin_diceroller" shortcut-file.
		- Contains a single shortcut ;;diceroller {command}::
	- Virtual cards within Obsidian made possible with the new "cards" shortcut-file.
		- Check out the tutorial video: https://www.youtube.com/watch?v=-m4n7d3aKC8
	- A new panel type to view card-piles added with the new "cards_pileviewer" shortcut-file.
	- More user-friendly versions of shortcuts added with the "cards_ui" shortcut-file.
	- notepick now uses the state system to save state between Obsidian sessions.
  FEATURES
	- Functions "addCss()" and "removeCss()" provided to allow shortcut-files to use their own CSS.  Added to "window._inlineScripts.inlineScripts.helperFncs".
	- Can now customize button texts for popup panels.
	- popups.input now takes an optional "suggestions" array that will show in a dropdown list beneath the textbox (if provided).
	- Plugin access added at "window._inlineScripts.inlineScripts.plugin"
	- Plugin has getObsidianInterfaces() function that returns some useful Obsidian interfaces.
  BUG-FIXES
	- Current parameter isn't highlighted if space-skipping past prior optional ones.
	- "window._inlineScripts" is'n't removed when plugin is disabled

### 0.22.1
- bug fix - announcement - latest has a broken link.
- polish - announcement - added bullet to announce support shortcut-files.

### 0.22.0
  FEATURES
	- A button panel has been added to plugin, allowing custom button creation for running shortcuts
		- Button panel buttons can run shortcuts with "???" run-time parameters
		- Button panel groups allow setting up groups of buttons for different tasks
		- Shortcut-files automatically get their own button panel groups
	- Shortcut links
		- Links that will trigger a shortcut on clicked, either once or on each click.
		- Can define run-time parameter captions in the link
	- In the library, many shortcut-files now have "x_ui" suppliment shortcut-files to redo complex shortcuts in a more graphical ui way.
	- Global variable setup in shortcut-files has been streamlined with the addition of "confirmObjectPath()"
	- Added video tutorials for a number of shortcut-files in the library.
	- Added a variable with list of the loaded shortcut-files and their registered order.
	- Made a collection of helper functions available to shortcuts
  BREAKING CHANGES
	- About string syntax - parameters no longer include "required" or "optional".
		- "Optional" parameters are now any parameters that specify a default value.
	- The variable where session state is stored has changed location:
		- It has moved from "_inlineScripts.state" to "_inlineScripts.state.sessionState"
	- In the library, the new "x_ui" suppliment shortcut-files redo some of the more complex shortcuts.  It's possible that this may cause some confusion, if the user isn't aware of them.
  NON-BREAKING CHANGES
	- Startup and shutdown scripts can now use helper scripts
	- Warning added when shortcut-file is registered, but has no shortcuts
	- Can display multiple version annoucements when plugin is updated
	- Buymecoffee donation method added.  Donation methods added to bottom of settings.

### 0.21.5
- bug fix - ios platform incompatible with regex look-behinds.  Replace all lookbehinds!

### 0.21.4
- bug fix - disabling plugin causes "hidden" autocomplete description div to show

### 0.21.3
- polish - made announcement message applicable to all 0.21.x

### 0.21.2
- bug fix - announcement doesn't show properly in all situations

### 0.21.1
- feature - default settings now include the plugin's current version
- polish - release announcement - Refer to plugin as "Inline Scripts"

### 0.21.0
- feature - shortcut autocomplete with shortcut descriptions
- refactor - Plugin rename: "Text Expander JS" to "Inline Scripts"
- feature - default prefix & suffix set to ";;" & "::" for all platforms
- feature - sfile sections dividied by "__" instead of "~~"
- feature - sfiles now use naming convention: "***.sfile.md"

### 0.20.1
- bug fix - format settings - added block against prefix & suffix containing characters with auto-complete

### 0.20.0
- feature - "expansionInfo" expansion parameter added, along with "cancel" settable member to cancel the expansion.
- feature - settings now have a "Reset to defaults" button.
- feature - library importer - now lets user pick the vault path for the imported library.
- bug fix - backslashes in the shortcut-text are removed when expanded.
- bug fix - library files are cached during library import.  If they are changed, during execution, repimport won't include changes.  If internet is lost, reimport won't fail.

### 0.19.1
- feature - Allow library to determine the disabled flags for importing shortcut-files.

### 0.19.0
- feature - Added a ui to disable shortcut-files without removing them from the shortcut-file settings list
- feature - help system updated.  General "help" is available to setup scripts and can be checked for loaded sfiles.
- feature - added a "failSilently" parameter to the expand() function

### 0.18.0
- bug fix - Import Library feature doesn't fail gracefully on unable to connect to repo.
- feature - Shortcut-files can be disabled, without removing them.  Feature implemented, but not yet exposed through UI.

### 0.17.2
- bug fix - shortcut-files with non-standard newlines (\r chars) cause bugs in the help system.

### 0.17.1
- polish - only run require("child_process") if on non-mobile platform.
- polish - "==" and "!=" to "===" and "!=="
- bug fix - Renaming the active note makes "_currentFilesName" inaccurate.  If the active note is a shortcut-file, this causes a minor bug until the active note is changed.

### 0.17.0
- feature - Each shortcut now has an "About" string, to store a short documentation on the shortcut.
- feature - A robust help system is now available, built around the shortcut "About" string.
- feature - shortcut-files are now parsed properly when they have a metadata frontmatter section.
- feature - Dfc now ALWAYS refreshes shortcuts when shortcut-file is modified.  Dev-mode causes refresh on sfile touch.
- feature - shortcut-files can now contain shutdown scripts: shortcuts run when shortcut-file is removed, or plugin is disabled.
- feature - A new function is available to shortcuts: print(message) shows message in popup and console, then returns the message.
- feature - If a setup script returns true, the shortcut-file's shortcuts are not loaded into the system.
- feature - Feature to allow adding callbacks for when an expansion occurs
- feature - "Import Library" now always maintains the order of library shortcut-files when imported into the shortcut-files list.
- refactor - the "getExpansion()" function, runnable from shortcuts, is now "expand()".

### 0.16.14
- polish - added pre-release test: a text file with steps to test ALL features of TEJS.

### 0.16.13
- bug fix - if expansion returns something other than string or string array, it's not handled right.

### 0.16.12
- Polish - Wrote DEFAULT_SETTING.shortcuts with backtick string for readability
- Polish - fixed typo
- Polish - changed "greet" shortcut to "hi"
- Polish - Put Object.freeze into DEFAULT_SETTINGS assignment

### 0.16.11
- Polished code - refactored "settings.getShortcutReferencesFromUi()" to "settings.getShortcutFilesFromUi()"
- Polished code - Improved code readability of DEFAULT_SETTINGS

### 0.16.10
- review response - Replaced "plugin.app.isMobile" with "obsidian.Platform.isMobile".

### 0.16.9
- bug fix - changing the shortcut-files list in the settings ui, then immediately importing the library causes the changes to be reverted.

### 0.16.8
- Responded to review: replaced plugin's platform vars with direct API references.
- Responded to review: renamed local copy of "activeFile" to better signify its meaning (a cache to reference upon the activeFile changing).
- Improved comments in Dfc class.

### 0.16.7
- Polish code - minor fixes for review

### 0.16.6
- Polish code - minor fixes for review

### 0.16.5
- Polish code - minor fixes for review

### 0.16.4
- All "classes" are now official JS classes.

### 0.16.3
- bug fix: app was glitching out at start due to not waiting for system to be ready before pulling files

### 0.16.2
- Code polish (for passing review quickly)

### 0.16.1
- Code polish (for passing review quickly)

### 0.16.0
- Add defaults - doesn't allow duplicating default shortcuts that are already in the list.  Removes preexisting defaults from list, then append all defaults to list.
- __Text Expander JS__ plugin version shows at top and bottom of settings

### 0.15.3
- bug fix: Input-block was blocking a user choice that was triggered after it was added

### 0.15.2
- bug fix: Added input block for while importing library (since async file downloading does not)
- bug fix: import library function asks user for choice as if "tejs" library folder is different from "tejs".

### 0.15.1
- bug fix: "help" system doesn't recognize help shortcuts that include numbers or underscore

### 0.15.0
- new feature: "Import full library" button in settings - downloads and sets up the entire Text Expander JS shortcut-file library into the vault
- bug fix: when on mobile, settings with multiple buttons don't separate buttons enough
- bug fix: bad shortcut-file references aren't red on opening settings

### 0.14.3
- bug fix: console error for each ; typed that doesn't expand

### 0.14.2
- Merged CM5 and CM6 expansion code.

### 0.14.1
- bug fix: error with CM5 (old editor) and shortcuts that return string arrays.

### 0.14.0
- Added up/down buttons for shortcut-files and shortcuts lists in settings

### 0.13.2
- bug fix: error during expansion can cause out-of-date editor issues.

### 0.13.1
- bug fix: shortcuts without return statements have their expansion script run properly, but still trigger "shortcut unidentified".

### 0.13.0
- Add ability to run external applications through the "runExternal" function (not available through mobile).
- bug fix: erroring on a shortcut _after_ it has called getExpansion produces an "uncaught" error, rather than the proper, useful error.

### 0.12.1
- bug fix: minor: settings ui: format example misaligned

### 0.12.0
- Empty shortcut is "helperblock": it clears out helper scripts.  It is auto-added to the end of each shortcut-file
- add an automatic "help" shortcut that lists all "* help" lines.
- add to default shortcuts: date, time, datetime
- Replaced MyPlugin and MySettings titles
- Removed expansion trigger options (now only expands on final key hit)
- shortcut tests are now stored as regexp objects, instead of strings
- All CSS classes now prefixed with "tejs_" to avoid overlap with other plugins
- Expansions strings can now be surrounded with a JavaScript fenced code block.  Test strings can be surrounded with a basic fenced code block.
- Expansion scripts can now return an array of strings.  This allows segmentation of the data, though the string array is joined during expansion.
- Expansion scripts now have access to "getExpansion(text)" to allow calling other shortcuts and using their results.

### 0.11.0
- Decent error messaging for parsing shortcut-files and when shortcut isn't recognized
- change shortcut from json to custom format: "~~"
- create scripts to playtest
- Fill in rest of readme instructions
- confirm plugin works on iphone
- polish code

### 0.10.0
- Remove "expansion trigger" option for mobile
- **Settings**: Developer mode: monitor shortcut-files for changes
- polish settings ui on mobile
- Default settings different on mobile vs non-mobile (prefix/suffix)
- bug fix: expansion incorrect with non-1-sized suffix
- fix bug: changing prefix/suffix requires plugin reload

### 0.9.0
- **Settings**: Shortcuts (definable directly in settings)
- **Settings**: each shortcut-file should have a delete button (no global "Remove file" button)
- Get working on mobile

### 0.8.0
- **Settings**: Custom CSS filename
- Replace "alert" with alternative that doesn't mess up caret
- CSS file added for settings UI (replaces inline styles)

### 0.7.0
- Adjust version format (final digit has 3 spaces, not 4)
- Fix ";;"/";" bookends to work when caret is on prefix
- **Settings**: Shortcut prefix & postfix
- **Settings**: Shortcut definitions filename
- **Settings**: Shortcut expansion hotkey

### 0.6.0
- Allow building a result from multiple shortcuts (to allow common code)
- Allow replacer to be either a string, or an array of strings to be concatenated together
- Console log when loading/unloading plugin
- Have version follow format convention (##.##.####)

### 0.5.0
- Basic implementation.  All settings hardwired
