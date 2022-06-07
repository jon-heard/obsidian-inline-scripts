# Obsidian Plugin - Text Expander JS

This plugin allows the user to define text-entry shortcuts to be expanded into strings built using javascript.

## Examples:
- Random dice roll: `;;d100;` -> `75 (D100)`
- Random name: `;;name male european;` -> `Bill Harrington`

## Installation
TBA

## HOW-TO: Add a text-entry shortcut file to a vault
1) Install and enable the __Text Expander JS__ plugin in your vault if it is not already installed and enabled.
2) Get the contents of the shortcut file into the vault.  You can do this one of two ways.
    * copy the shortcut file's text into an empty note.
    * copy the shortcut file directly into your vault's folder.
3) Open the plugin options for the __Text Expander JS__ plugin.
    * click the settings button on the lower-left of the Obsidian window.
    * Scroll the left menu down and click on __Text Expander JS__.  It should be near the bottom, beneath "Plugin Options".
4) Add a file reference for the shortcut file you added at step 2.
    * In the main panel of the settings popup, beneath "Shortcut Sources" is the "Shortcut files" setting.  Click the "Add file reference" button to the right of that.
    * Clicking the button should have added a new, empty textbox beneath "Shortut files".  It should say "Filename".  Click on this.
    * Type the folder-path and filename to the shortcut file added at step 2.  The textbox will be red until its contents match an actual file's name.
        - Example: TEJS/TEJS_mythicV2
5) Close the __Text Expander JS__ plugin options.
    * You can click outside of the panel to close it.
    * You can also hit the X button on the top right of the pane.
6) The shortcuts in the shortcut file should work now.  Try typing one of them out to confirm.

## HOW-TO: Define a new text-entry shortcut
1) Install and enable the __Text Expander JS__ plugin in your vault if it is not already installed and enabled.
2) Open the plugin options for the __Text Expander JS__ plugin.
    * click the settings button on the lower-left of the Obsidian window.
    * Scroll the left menu down and click on "Text Expander JS".  It should be near the bottom, beneath "Plugin Options".
3) Go down to the "Shortcuts" setting.  It's the second setting, after "Shortcut files".
4) The setting has two buttons, "Add shortcut" and "Add defaults".  Click on ""Add shortcut".
5) Step 4 should have added a space for a new shortcut ("Shortcut (regex)" and "Expansion (javascript)").  You may need to scroll down to see this.
6) Fill the new shortcut in.  I suggest starting with something simple like 'test', 'return "Test success";', for shortcut and expansion respectively.
7) Close the plugin options panel and try typing the shortcut into a note.
8) If something goes wrong with the new shortcut and you can't work out what it is, the javascript console can help you.
    * Type ctrl-shift-i to open the console.
    * Review the console contents for a clue as to what is going wrong with the shortcut.
    * Try typing the shortcut while the console is open to see if it triggers an error message.

## HOW-TO: Creating a new text-entry shortcut file
1) I suggest you get comfortable with defining a new text-entry shortcut directly (the previous HOW-TO).  This is a similar, but simpler process.
2) A shortcut file contains multiple shortcut(regex)/Expansion(javascript) pairs.  Each text value is separated by "~~"
3) So the format is:
    A) Any notes about this file.
    B) "~~"
    C) a shortcut(regex)
    D) "~~"
    E) the associated expansion(javascript)
    F) repeat sections _B_ to _E_ once for each shortcut in the shorcut file.
4) In addition to the javascript console, discussed in the previous HOW-TO, making shortcut files is much easier when "Dev-mode" is turned on in the _Text Expander JS_ plugin options.
    * Turning Dev-mode on causes all shortcut files to be reloaded on each page change, ensuring that changes to shortcuts are immediately testable.
5) A minimal example of a shorcut file:
>~~
>test
>~~
>return "The test worked.";

6) A more meaty example.
> This is a test shortcut file.
> It was written as an example for the HOW-TO.
>
> ~~
> ^name$
> ~~
> return "John Smith";
>
> ~~
> ^expand ([a-zA-Z])$
> ~~
> return $1.repeat(10);
>


## REFERENCE: Settings
- Shortcut files - A list of references to files that contain shortcuts to be available.
    * The "Add file reference" button adds a space for a new shortcut file.  You can then type in the folder/filename path of the file in the new space.
    * To the right of each shortcut file entry is a trashcan button.  This lets you delete the associated shortcut file entry.
- Shortcuts - A list of shortcuts (Shortcut/expansion pairs).  This lets you add individual shortcuts directly, whithout needing a file.
    * The "Add shortcut" button adds a blank space for a new shortcut to the bottom of the list.
    * The "Add defaults" button adds the default shortcuts to the end of the list.
    * To the right of each shortcut entry is a trashcan button.  This lets you delete the associated shortcut.
- Prefix & Suffix - These settings let you define what to type on either side of a shortcut to signify it as a shortcut.
    * Both the prefix and suffix must be defined.  If not, they will revert when you leave the __Text Expander JS__ plugin options.
    * The suffix mist mpt contain the prefix (example prefix="//", suffix="//").  If it does, these settings will revert when you leave the __Text Expander JS__ plugin options.
- Expansion trigger _(not available in mobile)_ - This lets you define when a shortcut is expanded.  By default, it expands as soon as it's typed.  The other options make it expand on a key-press.
- Developer mode - When turned on, the shortcut files will be reloaded whenever the current file changes.  This adds a bit of overhead, but lets you develop shortcut files more rapidly, as they are auto-refreshed when you go to another file to test the shorcuts out.

## Known Issues
- Undo of expansion doesn't work the same on mobile vs PC.  On mobile, the triggering character doesn't show on undo.

## Credits
- This project was inspired by description of Obsidian on the RPG Tips youtube video <a href='https://www.youtube.com/watch?v=XTFFzuZVcPk' target='_blank'>How I play my games in 2021</a>.
- This project was made with awareness of and deference to the <a href='https://github.com/konodyuk/obsidian-text-expander' target='_blank'>obsidian-text-expander</a> plugin (which has a more basic feature set, but includes running external scripts).
- In both cases, the goal of this plugin is to fulfill a need for effortless cross-platform operability of advanced text-expansion features.

## Release notes

### 00.10.000
- Remove "expansion trigger" option for mobile
- **Settings**: Developer mode: monitor shortcut files for changes
- polish settings ui on mobile
- Default settings different on mobile vs non-mobile (prefix/suffix)
- bug fix: expansion incorrect with non-1-sized suffix
- fix bug: changing prefix/suffix requires plugin reload

### 00.09.000
- **Settings**: Shortcuts (definable directly in settings)
- **Settings**: each shortcut file should have a delete button (no global "Remove file" button)
- Get working on mobile

### 00.08.000
- **Settings**: Custom CSS filename
- Replace "alert" with alternative that doesn't mess up caret
- CSS file added for settings UI (replaces inline styles)

### 00.07.000
- Adjust version format (final digit has 3 spaces, not 4)
- Fix ";;"/";" bookends to work when caret is on prefix
- **Settings**: Shortcut prefix & postfix
- **Settings**: Shortcut definitions filename
- **Settings**: Shortcut expansion hotkey

### 00.06.000
- Allow building a result from multiple shortcuts (to allow common code)
- Allow replacer to be either a string, or an array of strings to be concatenated together
- Console log when loading/unloading plugin
- Have version follow format convention (##.##.####)

### 00.05.000
- Basic implementation.  All settings hardwired

## TODO

### 00.11.000
/ Decent error messaging for parsing shortcut files
/ add details substring to Detail check (and italicized substrings)
/ "regex" to "shortcut"
/ change shortcut from json to custom format "~~" separates
/ create scripts
/ Fill in rest of readme (instructions)
- confirm plugin works on iphone
- polish code

### 00.12.000b
- Submit to Obsidian community (beta)

### 01.00.000
- Respond to Obsidian community feedback for a month
