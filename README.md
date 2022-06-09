# Obsidian Plugin - Text Expander JS
This plugin allows the user to type custom "shortcut" texts, which are then replaced (or "expanded") into javascript generated text.

## Examples:
- Typing `;;date;` can cause the text to expand into `6/7/2021`
- Typing `;;name male european;` can cause the text to expand into -> `Bill Harrington`

## Overview
Shortcuts are defined in shortcut files, to be added to the vault as notes.  When one or more shortcut-file notes are in the vault and connected to this plugin, their shortcuts will expand when they are typed into any note in the vault.  Users can download prewritten shortcut files into their vault, or write their own.  A sample of shortcut files can be found [here](https://github.com/jon-heard/obsidian-text-expander-js_shortcutFiles).  For example, [this](https://raw.githubusercontent.com/jon-heard/obsidian-text-expander-js_shortcutFiles/main/TEJS_mythicV2.md) file contains shortcuts to perform actions defined by the [Mythic GME RPG system](https://www.drivethrurpg.com/product/229391/Mythic-Variations-2?manufacturers_id=480).

Individual shortcuts can also be defined in the settings.  This is useful for one-off shortcuts as it requires less work and file clutter.  It is also less flexible with shortcut organization and transfer.  This plugin, __Text Expander JS__, comes with a few shortcuts predefined in the settings.  Try typing `;;d100;` (or `!!d100!` on mobile) in a note to see a shortcut in action.

## HOW-TO: Install and enable the plugin
TBA

## HOW-TO: Add a text-entry shortcut file to a vault
1. Make sure that the __Text Expander JS__ plugin is installed and enabled in your vault. (see HOW-TO: Install and enable the plugin.)
2. Get the contents of a shortcut file into a note in your vault.  You can do this one of two ways.
    - copy the shortcut file's text content into an empty note.
    - copy the shortcut file directly into your vault's folder.
3. Determine and remember the shortcut-file note's address.  This is the note's folder-path, followed by the note's name.
    - Example: `support/TEJS/TEJS_mythicV2`.  The name of this shortcut-file note is `TEJS_mythicV2`, the folder-path is `support/TEJS`.
4. Open the plugin options for the __Text Expander JS__ plugin.
    1. click the settings button on the lower-left of the Obsidian window.  This pops up the settings panel.
    2. In the left menu of the settings panel, find and click __Text Expander JS__.  It is beneath "Plugin Options", near the bottom.  This opens the Plugin options for __Text Expander JS__.
5. Add a reference to the shortcut file.
    1. Find the "Shortcut files" setting.  It is in plugin options, beneath "Shortcut Sources".
    2. In the "Shortcut files" setting, click the "Add file reference" button on the right side.  This adds an empty textbox to the bottom of the "Shortcut files" setting.  The new textbox should show the word "Filename" in grey text.
    3. Click on the new textbox and type in the shortcut-file note's address, determined in step 3.  The textbox will be red until a valid note address is fully entered.
        - Example: `support/TEJS/TEJS_mythicV2`.
6. Close the settings panel.
    - You can hit the X button on the top right of the settings panel to close it.
    - You can click outside of the settings panel to close it.
7. The shortcuts defined in the shortcut file should now work.  Try typing one of the shortcuts to confirm this.

## HOW-TO: Define a new text-entry shortcut
Each shortcut is defined by a pair of strings.
- __Test string__ - This is a regex.  That means that it is a code used to identify a pattern in another string.  The Test string is regex used to determine whether a shortcut the user has typed matches _this_ shortcut.
- __Expansion string__ - This is a javascript script.  It is used to define what this shortcut expands into.  If the user types a shortcut, and it is accepted by the Test string, the Expansion string script is called and the result is added to the note, replacing the user-typed shortcut.

### Examples
| Test | Expansion | Overview |
| ---- | --------- | -------- |
| greet | return&nbsp;"Hello!&nbsp;How&nbsp;are&nbsp;you?"; | At its most basic, a Test string can just be the shortcut itself.  This shortcut will be triggered when the user types `;;greet;` (or `!!greet!` on mobile).  Once triggered, the Expansion string's javascript is run.  In this case the javascript produces the string "Hello! How are you?".  The shortcut that the user typed (`;;greet;` or `!!greet!`) will be replaced by `Hello! How are you?`. |
| ^date$ | return&nbsp;new&nbsp;Date().toLocaleDateString(); | This Test string is a bit more involved.  The symbols `^` and `$` are regex code to ensure that shortcuts like "mydate" and "datetomorrow" are not accepted, only "date".  I suggest using `^` and `$` in your shortcuts, unless there is a good reason not to.  The Expansion string is also less obvious, but is just a javascript way to get the current date.  When the user types `;;date;` (or `!!date!` on mobile) it will be replaced with the current date. |
| ^age&nbsp;([0-9]+)$ | return&nbsp;"I&nbsp;am&nbsp;"&nbsp;+&nbsp;$1&nbsp;+&nbsp;"&nbsp;years&nbsp;old."; |  This shortcut's Test string has some advanced regex.  There are plenty of references and tutorials for regex online if it's not clear.  Notice the parenthesis `(`, `)`.  These collect whatever is recognized within them and put them into a variable.  The first parenthesis make variable `$1`, a second parenthesis would make the variable `$2`, and so on.  These variables are available to the Expansion string.  In this case the Expansion string _does_ reference variable `$1`.  The result of this shortcut is: if the user types `;;age 3;` (or `!!age 3!` on mobile) the shortcut expands to `I am 3 years old.`  If the user types `;;age 21;` (or `!!age 21!`), the expansion produces `I am 21 years old.` |

### Empty Test strings
If you add a shortcut with an empty Test string, then that shortcut's Expansion string will be added to the top of the Expansion string for all shortcuts after it.  This feature lets you write helper shortcuts that other shortcuts can use.

Here is an example:
| Test  | Expansion |
| ----  | --------- |
| greet | return "Hello!  How are you?";                                 |
|       | function roll(x) { return Math.trunc(Math.random() * x) + 1; } |
| d10   | return "Rolled " + roll(10) + " on a D10.";                    |
| d20   | return "Rolled " + roll(20) + " on a D20.";                    |

In this list of shortcuts, the second one has an empty test string.  That means that its Expansion string (which defines the `roll` function) is added to the top of all shortcuts after it.  The result is that the final two shortcuts can use the `roll` function as if they had defined it themselves.  The first shortcut, however, cannot.

### Adding a shortcut, step by step
1. Make sure that the __Text Expander JS__ plugin is installed and enabled in your vault. (see HOW-TO: Install and enable the plugin.)
2. Open the plugin options for the __Text Expander JS__ plugin.
    1. click the settings button on the lower-left of the Obsidian window.  This pops up the settings panel.
    2. In the left menu of the settings panel, find and click __Text Expander JS__.  It is beneath "Plugin Options", near the bottom.  This opens the Plugin options for __Text Expander JS__.
3. Go down to the "Shortcuts" setting.  It's the second setting, after "Shortcut files".
4. The setting has two buttons: "Add shortcut" and "Add defaults".  Click on the "Add shortcut" button.  This adds a shortcut entry to the bottom of the "Shortcuts" setting.  The new entry should include two textboxes with the words "Test (regex)" and "Expansion (javascript)" in grey text.
5. Fill the new entry with a shortcut's Test and Expansion strings.  I suggest starting with something simple like `test` and `return "Test success";`, for Test string and Expansion string respectively.
6. Close the settings panel.
    - You can hit the X button on the top right of the settings panel to close it.
    - You can click outside of the settings panel to close it.
7. Try typing your new shortcut in a note to make sure it works.
8. If the new shortcut doesn't work and it's not clear why, then the javascript console can help you.
    1. Type ctrl-shift-i to open the console.
    2. Review the console contents for a clue as to what is going wrong with the shortcut.
    3. Try typing out the shortcut while the console is open to see if an error is generated.  You can review the error message to help discover what's wrong.

## HOW-TO: Create a new text-entry shortcut file
This HOW-TO assumes that you have read and understood `HOW-TO: Define a new text-entry shortcut`, and are at least aware that `HOW-TO: Add a text-entry shortcut file to a vault` shows how to setup an existing shortcut file.

A shortcut file contains multiple shortcuts.  Each shortcut contains a Test string and an Expansion string.  A shortcut file will typically bundle collections of shortcuts that work toward a common goal, such as particular functionality (saving & loading) or particular systems (the Mythic RPG system).

Here is a minimal example of a shortcut file's contents:
> ~~<br/>
> test<br/>
> ~~<br/>
> return "The test worked.";<br/>

This shortcut file contains a single shortcut.  Notice that `~~` separate each section.

Here is another, more meaty, example:
> This is a test shortcut file.<br/>
> It was written as an example for the plugin's HOW-TO documentation.<br/>
> <br/>
> ~~<br/>
> ^name$<br/>
> ~~<br/>
> return "John Smith";<br/>
> <br/>
> ~~<br/>
> ^expand ([a-zA-Z])$<br/>
> ~~<br/>
> return $1.repeat(10);<br/>

This shortcut file starts with some comments, then ocontains two shortcuts.  Notice that the first `~~` is placed after the comments.  Every shortcut file has a place at the top for comments.  This includes the minimal example before this one, though in that case the comments are empty.  Also notice that there are empty lines between sections.  Empty lines are ignored by __Text Expander JS__, so use them to help organize your shortcut files.

The `## HOW-TO: Define a new text-entry shortcut` introduced the javascript console, which is a useful tool while developing shortcuts and shortcut files.  Another useful tool is "Developer mode", which can be turned on in the __Text Expander JS__ plugin options.  When "Developer mode" is on, all shortcut files will be reloaded each time you move from one note to another.  This lets you edit a shortcut file, then move to a testing note to immediately try out your changes without manually refreshing anything.  "Developer mode" adds a slight delay when switching notes, so I suggest keeping it off unless you are actively developing a shortcut file.

The `## HOW-TO: Define a new text-entry shortcut` also discusses shortcuts with empty Test strings.  This feature is quite useful for larger shortcut files.

One more feature worth mentioning: if a shortcut file contains a shortcut with the Test string of `^tejs setup$`, then that shortcut's Expansion script will be run whenever the shortcut is loaded, including when switching notes while "Developer mode" is turned on.  This feature is useful if your shortcut file requires initialization before its shortcuts will work.

## REFERENCE: Settings
- __Shortcut files__ - A list of addresses to notes with shortcut file contents.
    - The "Add file reference" button adds a new textbox for a shortcut file reference.
    - To the right of each shortcut file textbox is a trashcan button.  This button lets you delete the textbox.
- __Shortcuts__ - A list of shortcuts, which are Test and Expansion string pairs.  This lets you add individual shortcuts directly, whithout needing a shortcut file.
    - The "Add shortcut" button adds a blank entry for a new shortcut to the bottom of the Shortcuts setting.
    - The "Add defaults" button adds the default shortcuts to the end of Shortcut setting.
    - To the right of each shortcut entry is a trashcan button.  This button lets you delete the associated shortcut.
- __Prefix & Suffix__ - These settings let you define what to type on either side of a shortcut to signify it as a shortcut.  They default to `;;` and `;` on desktop platforms and `!!` and `!` on mobile platforms.
    - Both the prefix and suffix _must_ be defined.  If not then they will revert when you leave the __Text Expander JS__ plugin options.
    - The suffix string must _not_ contain the prefix string (such as prefix=`;`, suffix=`;;`).  If it does then these settings will revert when you leave the __Text Expander JS__ plugin options.
- __Expansion trigger__ _(not available in mobile)_ - This lets you define when a shortcut is expanded.  By default, a shortcut expands as soon as it's typed.  The other options let you trigger Expansion with a key-press.
- __Developer mode__ - When turned on, the shortcut files will be reloaded whenever you change from one note to another.  This adds a bit of delay, but lets you develop shortcut files more rapidly, as they are auto-refreshed when moving to a testing note to try out changes.

## Known Issues
- Undo of expansion works a bit differently between mobile and PC.  On mobile, the triggering character doesn't show on undo.

## Credits
- This project was inspired by description of Obsidian on the RPG Tips youtube video <a href='https://www.youtube.com/watch?v=XTFFzuZVcPk' target='_blank'>How I play my games in 2021</a>.
- This project was made with awareness of and deference to the <a href='https://github.com/konodyuk/obsidian-text-expander' target='_blank'>obsidian-text-expander</a> plugin (which has a more basic feature set, but includes running external scripts).
- In both cases, the goal of this plugin is to fulfill a need for effortless cross-platform operability of advanced text-expansion features.

## Release notes

### 00.11.000
- Decent error messaging for parsing shortcut files and when shortcut isn't recognized
- change shortcut from json to custom format: "~~"
- create scripts to playtest
- Fill in rest of readme instructions
- confirm plugin works on iphone
- polish code

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

### 00.12.000b
- Submit to Obsidian community (beta)

### 01.00.000
- Respond to Obsidian community feedback for a month
