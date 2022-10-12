### Next release
- Update the "cards" system based on the pre-release (https://github.com/jon-heard/obsidian-inline-scripts/discussions/36)
	/ look into not loading the entire image just to get the aspect ratio
	/ put out to playtesters
	- update cards_ui for new architecture
/ Adding more options for shortcut links
- make tablerunner.sfile
	/ "tables addfolder" adds folder to list.  Tables are dynamically loaded from the folder.
	/ "tables roll" opens popup with list of loaded tables to select.
		/ contains search at top for searching name, items, tags
		/ contains buttons: "Roll", "settings" and "Cancel".  Roll rolls the selected table.  cancel does nothing.
			/ settings opens the table settings panel, which adds custom settings for selected table to "state.sessionState.rollTables.settings"
				/ settings are saved per table-file
				/ offset into table file to start drawing lines from
				/ a checkbox for pulling with/without repeats
				/ config button given icon at end: up arrow if config is shown, down arrow if it is not
				/ settings include "Table start line" with readonly display of line and up/down arrows to shift it
				- settings include checkbox "weighted" for taking number at end off and using for roll
				- settings include regex for what part of the table items to display
		/ option for how many to pull
		/ option for what format to display output in (comma'd line, bullet list, table)
/ cards.sfile
	/ add "cards reverse"
	/ make fromfolder more efficient at determining aspect ratio
/ lists.sfile
	/ lists shortcutbatch {list: name text} {shortcut: text} - runs shortcut {shortcut} once for each item in {list}.  Replaces %1 in {shortcut} with each item.
	/ lists rename
/ files.sfile - file-related shortcuts.
	/ files extensionchange {file: path text} {to: unspaced text} - converts extensions for file {file} to {to}.
	/ files shortcutbatch {folder: path text} {shortcut: text} - runs shortcut {shortcut} once for each file in {folder}.  Replaces %1 in {shortcut} with each file's name.
		/ internally uses "lists shortcutbatch" - uses a temporary list to do this.
- finish mythicv2 (missing stats system)
- sublists sfile
- make sure all sfiles are represented in the readme
/ pick can show a list select instead of a dropdown select
- ui and adventurecrafter sfiles converted to use pick popup with list select

### Post-next release
- __notepick pickFromQuery {count: >0} {pick id: name text, default: ""} : {query: text}__ - Picks {count} random notes based on {query} and remembers them as {pick id}.  The query can contain:
	- __path:__ - Allows entering a path (complete or partial) that file choices will be filtered down to
	- __file:__ - Allows entering a filename (complete or partial) that file choices will be filtered down to
	- __tags:__ - Allows entering a tag that file choices will be filtered down to
- Have shortcut autocomplete react to parameter types (when they are provided by the syntax string)
	- allow posting custom types (such as lists)
- library - write an sfile for ironsworn (or D&D)
- Shift from beta to release (after making either a D&D system or Ironsworn system)
- plugin - typescript - use HTMLElement type wherever possible
- Find a way to allow the prefix & suffix to contain auto-closed characters - `{`, `"`, etc


- pick ui starts at bottom
- pick ui should have bottom buttons outside of scrolling (always on screen)
- pile viewer messes up order on drag (what a drag)
- what to do when drawing to a facedown pile that shows draws?
- what to do when picking from a facedown pile?
- what to do when picking to a facedown pile?


## Other things (for the video, and just to do)
- Card viewer - Drag cards to reorder them.
- Card viewer - Double-tap cards to change their rotation.
- state.backgroundImage defaults to null, at which point the generic backgroundimage is used (don't put generic into state.  It's big!)


## Changes in next release
- Shortcut links - ability to print result to an id'd note block.
- shortcut links - ability to adjust shortcut result (3rd part)
- helperFncs - "appendToEndOfNote" to "addToNote".  And it's more flexible.
