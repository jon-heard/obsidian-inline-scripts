# Obsidian Plugin - Text Expander JS (open beta)
![Demo animation](readmeMedia/demo.gif)

***

This Obsidian plugin allows the user to type text shortcuts that are replaced by (or "expanded into") javascript generated text.

This plugin works on all platforms, including mobile.

This plugin is currently in __open beta__.

***

## Table of contents
- General
    - [Overview](#overview)
    - [REFERENCE: Settings](#reference-settings)
    - [User support, bugs, feedback, dontations, etc.](#user-support-bugs-feedback-donations-etc)
- Tutorials &nbsp; _(suggest reading in-order)_
    1. [Setup the plugin and try it out](#tutorial-setup-the-plugin-and-try-it-out)
    2. [Create a new shortcut](#tutorial-create-a-new-shortcut)
    3. [Add an existing shortcut-file to a vault](#tutorial-add-an-existing-shortcut-file-to-a-vault)
    4. [Create a new shortcut-file](#tutorial-create-a-new-shortcut-file)
- Shortcut development topics
    - Development aids
        - [The console](#development-aid-the-console)
        - [Fenced code blocks](#development-aid-fenced-code-blocks)
    - Advanced shortcuts
        - [The print() function](#advanced-shortcuts-the-print-function)
        - [Running external applications and scripts](#advanced-shortcuts-running-external-applications-and-scripts)
        - [Calling shortcuts from shortcuts](#advanced-shortcuts-calling-shortcuts-from-shortcuts)
        - [Helper scripts](#advanced-shortcuts-helper-scripts)
        - [Setup and shutdown scripts](#advanced-shortcuts-setup-and-shutdown-scripts)
        - [Hiding shortcuts](#advanced-shortcuts-hiding-shortcuts)
        - [Reacting to shortcut expansions](#advanced-shortcuts-reacting-to-shortcut-expansions)
        - [Checking for loaded shortcut-files](#advanced-shortcuts-checking-for-loaded-shortcut-files)
- Technical
    - [Known Issues](#known-issues)
    - [Credits](#credits)
    - [Release notes](#release-notes)
    - [Todo](#todo)
    - [Future feature possibilities](#future-feature-possibilities)

***

## Overview

__Text Expander JS__ expands typed shortucts into predefined results, for example:
- Typing `;;date;` can cause the text to be replaced with (or "expanded into") `6/7/2022`
- Typing `;;name male european;` can cause the text to be replaced with (or "expanded into") -> `Bill Harrington`

The second example shows how shortcuts can include parameter text (`male european`) that can affect the resulting expansion.

Shortcuts can be defined in the settings.  __Text Expander JS__ comes with some sample shortcuts defined by default.  See the tutorials "[Setup the plugin and try it out](#tutorial-setup-the-plugin-and-try-it-out)" and "[Create a new shortcut](#tutorial-create-a-new-shortcut)" for details.

Shortcuts can also be defined in shortcut-files, to be added to the vault as notes.  This requires more work, but offers better organization and easier sharing of shortcuts.  Users can download prewritten shortcut-files into their vault, or write their own.  See the tutorials "[Add an existing shortcut-file to a vault](#tutorial-add-an-existing-shortcut-file-to-a-vault)" and "[Create a new shortcut-file](#tutorial-create-a-new-shortcut-file)" for details.

***

## REFERENCE: Settings
- __Shortcut-files__ - A list of addresses (folder-paths and filenames) of notes containing shortcut-files.
    - The "Add file reference" button adds a new entry for a shortcut-file address.
    - The "Import full library" button downloads and sets up the entire __Text Expander JS__ shortcut-file library into your vault.  Any existing library files are updated to the latest version.
    - To the left of each shortcut-file entry is a toggle button.  Turning this off causes the shortcut-file entry to be ignored by _Text Expander JS__.  It has the same effect as removing this shortcut-file entry from the list.
    - To the right of each shortcut-file entry are a set of buttons.
        - The up and down button let you shift the shortcut-file entry up and down in the list.
        - The trashcan button lets you delete the shortcut-file entry.
- __Shortcuts__ - A list of shortcuts, each of which includes a Test, Expansion and About string.  This lets you add individual shortcuts directly, without needing a shortcut-file.
    - The "Add shortcut" button adds a blank shortcut entry to the bottom of the Shortcuts setting.
    - The "Add defaults" button adds default shortcuts to the Shortcuts setting.
    - To the right of each shortcut entry are a set of buttons.
        - The up and down button let you shift the shortcut entry up and down in the list.
        - The trashcan button lets you delete the shortcut entry.
- __Prefix & Suffix__ - These settings let you define what a typed shortcut starts and ends with to signify that it is a shortcut.  They default to `;;` and `;` on desktop platforms and `!!` and `!` on mobile platforms.
    - Both the prefix and suffix _must_ be defined.  If not then they will revert when you leave the __Text Expander JS__ plugin options.
    - The suffix string must _not_ contain the prefix string (such as prefix=`;`, suffix=`;;`).  If it does then these settings will revert when you leave the __Text Expander JS__ plugin options.
    - If there are any errors with the prefix & suffix entries, a an error message in a red box will appear above the prefix & suffix textboxes.
- __Developer mode__ - When turned on, all shortcuts will be reloaded whenever you leave a shortcut-file note (by selecting a different note, or closing the shortcut-file note).  This adds a slight delay, but lets you develop shortcut-files more rapidly.
- __Allow external__ - When turned on, shortcuts are able to run shell commands.  This is a powerful ability that a maliciously written shortcut can abuse to do serious damage to your computer.  Make sure you trust your shortcuts before turning this on.

***

## User support, bugs, feedback, donations, etc.
If you...
- Need help with this plugin
- Have a bug or issue to report
- Want to share a shortcut-file or extra-useful shortcut
- Want to offer feedback

... then visit the [discussions page](https://github.com/jon-heard/obsidian-text-expander-js/discussions).

### Donations
If you've found this plugin useful, then a small donation lets me know that I should keep it up.  Thanks!

[![paypal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://paypal.me/jonheard99?country.x=US&locale.x=en_US)

***
***

## TUTORIAL: Setup the plugin and try it out
### Setup the plugin
NOTE: This will be _much_ easier once the plugin has been reviewed and added to the community plugins list.

1. Open the vault to install __Text Expander JS__ into.  If you don't yet have a vault ready, create one now.
2. Get the "BRAT" plugin _(Beta Reviewers Auto-update Tester)_
    1. Go to Settings > "Community Plugins".  Turn safe mode off, if it is on.
    2. Click the "Browse" button beside the "Community Plugins" setting
    3. Search for, install and enable the "BRAT" plugin
3. Add the __Text Expander JS__ plugin to "BRAT"
    1. Go to Settings > "Obsidian42 - Brat" (it's near the bottom of the Settings menu)
    2. Click on the button "Add Beta plugin" (in the "Beta Plugin List" section)
    3. Enter the text `https://github.com/jon-heard/obsidian-text-expander-js`
    4. Click "Add Plugin"
4. Enable the __Text Expander JS__ plugin
    1. Go to Settings > "Community Plugins".
    2. Find the __Text Expander JS__ plugin entry (it's near the bottom of the settings)
    3. Turn on the toggle to the right of the entry.
5. _(optional, but recommended)_ Enable auto-update for the __Text Expander JS__ plugin
    1. Go to Settings > "Obsidian42 - Brat" (it's near the bottom of the Settings menu)
    2. Turn on the setting "Auto-update plugins at startup" (it's the first setting).

### Try out the plugin
1. Open a note to try out the plugin.
2. In the note, type `;;hi;` (`!!hi!` on mobile).  Notice that the shortcut expands to "Hello! How are you?" as soon as you've finished typing it.
3. In the note, type `;;d100;` (`!!d100!` on mobile).  Notice that the shortcut expands to a roll-result as soon as you've finished typing it.
4. Repeat step 3.  Note that the roll result is (most likely) different.  If it is _not_ different, then you just got lucky so try step 3 again.

### Default shortcut samples
__Text Expander JS__ comes with the following sample shortcuts defined by default:
- hi
- date
- time
- datetime
- d{max} - Dice roller.
    - Examples - d3, d20, d57, d999
- fd{max} - Same as d{max}, but with fancier formatting.
- {count}d{max}{add} - Same as d{max}, but with optional {count} and {add}.
    - Examples - d100, 3d20, d10+5, 3d6+6

### Help shortcuts
__Text Expander JS__ has a collection of shortcuts that describe all of the shortcuts that are currently loaded.  The `help` shortcut shows a summary of this collection.

***
***

## TUTORIAL: Create a new shortcut
### Shortcut components
Each shortcut is defined by three strings.
- __Test string__ - This is a regex.  That means that it is a code used to identify a pattern in another string.  The Test string is regex used to determine whether a shortcut the user has typed matches _this_ shortcut.
- __Expansion string__ - This is a javascript script.  It is used to define what this shortcut expands into.  If the user types a shortcut, and it is accepted by the Test string, the Expansion string script is called and the result is added to the note, replacing the user-typed shortcut.
- __About string__ - This is formatted prose to describe this shortcut's syntax, expansion and purpose.  It begins with the shortcut's syntax, then there is a dash, followed by a description of the shortcut.  __The About string _can_ be safely left blank.__

| Id | Test string | Expansion string | About string |
| -- | ----------- | ---------------- | ------------ |
|  1 | hi | return&nbsp;"Hello!&nbsp;How&nbsp;are&nbsp;you?"; | hi - Expands into "Hello! How are you?".  A simple shortcut to see if Text Expander JS is running. |
|  2 | ^date$ | return&nbsp;new&nbsp;Date().toLocaleDateString(); | Expands into the current, local date. |
|  3 | ^age&nbsp;([0-9]+)$ | return&nbsp;"I&nbsp;am&nbsp;"&nbsp;+&nbsp;$1&nbsp;+&nbsp;"&nbsp;years&nbsp;old."; | age {how old} - Expands into "I am {how old} years old".  {how old} is a required parameter that can be any positive integer.  This is a demo shortcut written for this documentation. |

#### Shortcut #1 - hi (basic)
At its most basic, a Test string can just be the shortcut itself.  This example shortcut will be triggered when the user types `;;hi;` (`!!hi!` on mobile).  Once triggered, the Expansion string's javascript is run.  In this example the javascript produces the string "Hello! How are you?".  The shortcut that the user typed (`;;hi;` or `!!hi!`) will be replaced with `Hello! How are you?`.

Note the format of the About string.  It contains the syntax ("hi"), a dash, then the description: the shortcut's expansion and purpose.

#### Shortcut #2 - date (intermediate)
This shortcut's Test string is a bit more involved.  The symbols `^` and `$` are regex tokens to ensure that shortcuts like "mydate" and "datetomorrow" are not accepted, only "date".  I suggest using `^` and `$` in all of your test strings, unless there is a good reason not to.  The Expansion string is also less obvious, but is just a javascript way to get the current date.  The result of this example shortcut is: if the user types `;;date;` (`!!date!` on mobile) it will be replaced with the current date.

This About string contains no syntax or purpose, only the expansion.  The purpose is obvious, so is left out.  The syntax, if ommitted, always defaults to the Test string.  For this shortcut, the About syntax is `^date$`.

#### Shortcut #3 - age (advanced)
This shortcut's Test string has some advanced regex.  There are plenty of references and tutorials for regex online if it's not clear.  Notice the parenthesis `(`, `)`.  These are regex tokens to collect whatever is recognized within them and put it into a variable.  The first parenthesis are put into variable `$1`, a second parenthesis would be put into variable `$2`, and so on.  These variables are available to the Expansion string.  In this example, the Expansion string _does_ reference variable `$1`.  The result of this example shortcut is: if the user types `;;age 3;` (`!!age 3!` on mobile) the shortcut will be replaced with `I am 3 years old.`  If the user types `;;age 21;` (`!!age 21!` on mobile), it will be replaced with `I am 21 years old`.

The About string starts with the syntax, including a named descriptor `{how old}` representing the single parameter text.  After the syntax (and dash) is the expansion.  Then `{how old}` is described, including whether the parameter is __required__ or __optional__ and what format it accepts.

### Step-by-step: Adding a shortcut
1. Make sure that the __Text Expander JS__ plugin is installed and enabled in your vault. (see the tutorial [Setup the plugin and try it out](#tutorial-setup-the-plugin-and-try-it-out).)
2. Open the plugin options for the __Text Expander JS__ plugin.
    1. click the settings button on the lower-left of the Obsidian window.  This opens the settings panel.
    2. In the left menu of the settings panel, find and click __Text Expander JS__.  It is beneath "Plugin Options", near the bottom.  This opens the Plugin options for __Text Expander JS__.
3. Go down to the "Shortcuts" setting.  It's the second setting in the panel, just after "Shortcut-files". _(see picture below)_
4. The setting has two buttons: "Add shortcut" and "Add defaults".  Click on the "Add shortcut" button.  This adds a shortcut entry to the bottom of the "Shortcuts" setting.  The new entry should include three textboxes with the greyed text "Test (regex)", "Expansion (javascript)" and "About (text)".  _(see picture below)_
5. Enter a shortcut's Test and Expansion strings into the new entry.  I suggest starting with something simple like: `test` and `return "The test worked.";`.  The About string is optional.  If entered, follow the format: syntax, dash, description.  _(see picture below)_

    ![Shortcuts](readmeMedia/shortcuts.png)

6. Close the settings panel.
    - You can hit the X button on the top right of the settings panel to close it.
    - You can click outside of the settings panel to close it.
7. Try typing your new shortcut into a note to make sure it works.

***
***

## TUTORIAL: Add an existing shortcut-file to a vault

### A warning
Shortcuts, by their Javscript nature, have a risk of being malicious.  Make sure you trust a shortcut or shortcut-file before using it.

### Shortcut-file sources
There is a library of shortcut-files for __Text Expander JS__ [here](https://github.com/jon-heard/obsidian-text-expander-js_shortcutFileLibrary).  You can bring individual shortcut-files into your vault from this library, or from any other source you find.  Alternately, __Text Expander JS__ has a button to import the entire library to your vault at once.

### Step-by-step: Importing the entire shortcut-file library to the vault
1. Make sure that the __Text Expander JS__ plugin is installed and enabled in your vault. (see [HOW-TO: Setup the plugin and try it out](#how-to-setup-the-plugin-and-try-it-out).)
2. Open the plugin options for the __Text Expander JS__ plugin.
    1. click the settings button on the lower-left of the Obsidian window.  This opens the settings panel.
    2. In the left menu of the settings panel, find and click __Text Expander JS__.  It is beneath "Plugin Options", near the bottom.  This opens the Plugin options for __Text Expander JS__.
3. Find the "Shortcut-files" setting.  It is just beneath "Shortcut Sources.
4. To the right of the setting is the button "Import full library".  Click on that button and then confirm.  This will trigger the import.  It might take a minute to download, depending on your internet connection and device.

    ![Import full library](readmeMedia/importFullLibrary.png)

6. Once the import is finished, you should see a bunch of file names added beneath the "Shortcut-files" setting (unless they were already there from a previous import).  Close the settings panel.
    - You can hit the X button on the top right of the settings panel to close it.
    - You can click outside of the settings panel to close it.
7. All the shortcuts defined in the shortcut-file library should now work.  Try typing one of the shortcuts to confirm this, such as `;;event;` or `;;une;` (`!!event!` or `!!une!` on mobile).
8. You can type `;;help;` (`!!help!` on mobile) to start learning about all of the shortcuts provided by the library.
9. If you find that you need to _not_ use some shortcut-files from the library, you can always disable them by turning off the toggle button to the left of their address text-box.

### Step-by-step: Adding a SINGLE shortcut-file to the vault
1. Make sure that the __Text Expander JS__ plugin is installed and enabled in your vault. (see [HOW-TO: Setup the plugin and try it out](#how-to-setup-the-plugin-and-try-it-out).)
2. Get the contents of a shortcut-file into a note in your vault.  You can do this one of two ways.
    - Copy the shortcut-file's text content into an empty note.
        - If the shortcut-file is on github, I suggest copying from the "raw file", though this isn't mandatory.
    - Copy the shortcut-file directly into your vault's folder.
3. Determine and remember the shortcut-file note's address in your vault.  This is the note's folder-path, followed by the note's name.
    - Example: `support/tejs/TEJS_state`.  The name of this shortcut-file note is `TEJS_state`, the folder-path is `support/tejs`.
4. Open the plugin options for the __Text Expander JS__ plugin.
    1. click the settings button on the lower-left of the Obsidian window.  This opens the settings panel.
    2. In the left menu of the settings panel, find and click __Text Expander JS__.  It is beneath "Plugin Options", near the bottom.  This opens the Plugin options for __Text Expander JS__.
5. Add a reference to the shortcut-file.
    1. Find the "Shortcut-files" setting.  It is just beneath "Shortcut Sources" _(see picture below)_.
    2. In the "Shortcut-files" setting, click the "Add file reference" button on the right side.  This adds an empty textbox to the bottom of the "Shortcut-files" setting.  The new textbox should show the word "Filename" in grey text. _(see picture below)_
    3. Click on the new textbox and type in the shortcut-file note's address, determined in step 3.  The textbox will be red until a valid note address is entered. _(see picture below)_
        - Example: `support/tejs/TEJS_state`.
    4. (optional) Turning off the toggle button to the left of the textbox will disable this shortcut-file, as if it was removed from this list.  This is is useful to temporarily turn off shortcut-files, without needing to retype them later.
        
        ![Shortcut-files setting](readmeMedia/shortcutFiles.png)

6. Close the settings panel.
    - You can hit the X button on the top right of the settings panel to close it.
    - You can click outside of the settings panel to close it.
7. The shortcuts defined in the shortcut-file should now work.  Try typing one of the shortcuts to confirm this.
8. You can type `;;help;` (`!!help!` on mobile) to start learning about all of the shortcuts provided by the new shortcut-file.

***
***

## TUTORIAL: Create a new shortcut-file

### NOTE: If you make a shortcut-file you think others would like, it'd be real nice if you could share it [here](https://github.com/jon-heard/obsidian-text-expander-js/discussions)!  If it is polished and generally useful, then I'll even add it to the [library of shortcut-files](https://github.com/jon-heard/obsidian-text-expander-js_shortcutFileLibrary).

This tutorial assumes that you have read and understood the tutorial "[Create a new shortcut](#tutorial-create-a-new-shortcut)", and are at least aware that the tutorial "[Add an existing shortcut-file to a vault](#tutorial-add-an-existing-shortcut-file-to-a-vault)" shows how to setup an existing shortcut-file.

A shortcut-file contains multiple shortcuts.  Each shortcut contains a Test string, an Expansion string and an About string.  A shortcut-file will typically bundle collections of shortcuts that work toward a common goal, such as a particular functionality (saving & loading) or a particular system (Dungeons and Dragons).

### Examples
Here is a minimal example of a shortcut-file's contents:
> ~~<br/>
> test<br/>
> ~~<br/>
> return "The test worked.";<br/>
> ~~

This shortcut-file contains a single shortcut.  Notice that `~~` separate each section.

Here is another, more meaty, example:
> This is a test shortcut-file.<br/>
> It was written as an example for the plugin's HOW-TO documentation.<br/>
> <br/>
> ~~<br/>
> ^name$<br/>
> ~~<br/>
> return "Maggie Smith";<br/>
> ~~<br/>
> name - Expands to "Maggie smith".<br/>
> <br/>
> ~~<br/>
> ^repeat ([a-zA-Z])$<br/>
> ~~<br/>
> return $1.repeat(5);<br/>
> ~~<br/>
> repeat {to repeat} - Expands to 5 repetitions of {to repeat}: "aaaaa".  {to repeat} is a required parameter that contains a single alpha character.<br/>
>

This shortcut-file begins with an About string (a description of itself), then it contains two shortcuts.  Notice that the first `~~` is placed after the shorcut-file's About string.  Every shortcut-file starts with an About string, including the minimal example, though in that case the About string is empty.  Also notice that there are empty lines between each section of this shortcut-file.  Empty lines are ignored by __Text Expander JS__, so use them to help organize your shortcut-files.

### Developer mode
Developer mode is an on/off setting available at the bottom of the __Text Expander JS__ plugin options _(see picture below)_.  When "Developer mode" is on, all shortcuts will be reloaded whenever you leave a shortcut-file note (by selecting a different note, or closing the shortcut-file note).  This lets you edit a shortcut-file note, then move to another note to try out your changes without needing to manually refreshing anything.  "Developer mode" adds a slight delay when switching notes, so I suggest keeping it off unless you are actively developing a shortcut-file.

![Developer mode](readmeMedia/devMode.png)

### Help shortcuts
A shortcut-file's About text, and each shortcut's about text are used to create help shortcuts for the user.  See the section [Help shortcuts](#help-shortcuts) for more information about this.

***
***

## DEVELOPMENT AID: The console
If a new shortcut doesn't work and it's not clear why, then the javascript console can help.
1. Type ctrl-shift-i to open the dev-tools panel. _(see picture below)_
2. Click on the "Console" tab at the top of the dev-tools panel. _(see picture below)_
3. Review the console contents for a clue as to what is going wrong with the shortcut. _(see picture below)_
4. Try typing the shortcut into a note while the console is open to see if an error is added to the console.  You can review the error message for a clue as to what's wrong.
5. If you are struggling with too much information in the console, you can always clear it.  There's a button to do so on the top-left of the dev-tools panel. _(see picture below)_

    ![Console](readmeMedia/console.png)

***

## DEVELOPMENT AID: Fenced code blocks
If you want a nicer experience while developing a shortcut, you can surround the Expansion string in a "Javascript fenced code block".  For example, this Expansion string:

> return "Hello!  How are you?";

can be written as:

> \`\`\`js
>
> return "Hello!  How are you?";
>
> \`\`\`

__Note__: The `` ` `` characters (before the "js") are backticks, the character that typically shares a key with tilde (~).

The result of the expansion is the same for both Expansion strings above, even though the second uses a "Javascript fenced code block".

Benefits to using a "Javascript fenced code blocks":
- Syntax highlighting
- No unwanted markdown formatting

Drawbacks:
- Takes longer to write
- Takes up more space

### Fencing test strings
You can also surround a Test string in a basic "fenced code block".  This provides no syntax highlighting, but still prevents unwanted markdown formatting.  For example, this Test string:

> ^date$

can be written as:

> \`\`\`
>
> ^date$
>
> \`\`\`

### Warning
The fenced code block _must_ be exact: ` ```js ` for Expansion string and ` ``` ` for Test string!  ` ```javascript `, ` ```JS `, or anything else will break the shortcut.

***

## ADVANCED SHORTCUTS: The print() function
Within a shortcut, print(message) can be called.  This will take the given message and add both a console entry and a popup notification with it.

## ADVANCED SHORTCUTS: Running external applications and scripts
This feature is unavailable on mobile (Obsidian's backend doesn't allow it).

There is a function `runExternal(command)` which can be called from any shortcut.  It will execute the `command` parameter as a shell command and return the command's console output.  This lets one run external executables and scripts such as python, M, bash, etc, then get the output and expand it into the note (or do something else with it).

NOTE: The full function is `runExternal(command, failSilently, dontFixSlashes)`.  The second two parameters are optional and are explained later in this section.

### The "Allow external" setting
Be aware that the runExternal function will _always_ fail with an authorization error, _unless_ the on/off setting "Allow external" is turned __on__ in the plugin options.  It is off by default.

![Allow external setting](readmeMedia/allowExternal.png)

### Examples
| Test string | Expansion string | Overview |
| ----------- | ---------------- | -------- |
| ^test&nbsp;shell$ | return&nbsp;runExternal("echo&nbsp;Hello&nbsp;from&nbsp;the&nbsp;shell"); | When the user types `;;test shell;`, the shell command `echo Hello from the shell` is run, which prints "Hello from the shell" to the console.  Once the echo command is finished, its console output is returned from runExternal, then that is returned from the Expansion script and, finally, expanded into the note. |
| ^runMyScript$ | return&nbsp;runExternal("python&nbsp;myscript.py"); | When the user types `;;runMyScript;`, the command will execute python on "myscript.py", which may print something to the console.  Once the command is finished, runExternal will return any console output (or an empty string if there was none), which is then returned from the Expansion script and, thus, expanded into the note.<br/><br/>If Python is setup properly, the Expansion script could have simply been `return runExternal("myscript.py");`.<br/><br/>If python is not installed, or myscript.py is not in the vault's root folder, or even if myscript.py has a python error, then the shell command will fail.  This will cause runExternal to return null, and an error notification and console log to show up. |
| ^exec&nbsp;(.*)$ | let&nbsp;result&nbsp;=&nbsp;runExternal($1);<br/>if&nbsp;(result === null)&nbsp;{&nbsp;result&nbsp;=&nbsp;"FAILED";&nbsp;}<br/>return&nbsp;"Shell&nbsp;command&nbsp;result&nbsp;=&nbsp;\""&nbsp;+&nbsp;result&nbsp;+&nbsp;"\"."; | This shortcut allows the user to run _any_ shell command.  For example, typing `;;exec dir;` will get the vault root-folder's contents and expand them into the note. |

### Command errors
When a command produces an error:
1. The runExternal call returns null (instead of the console output)
2. A popup notification tells the user that an error has occurred
3. A console error provides detailed information:
    - The folder that the command was run from (always the vault root)
    - The command that failed
    - The error message provided by the shell

The second, optional, parameter of `runExternal(command, failSilently, dontFixSlashes)` is "failSilently".  When failSilently is true and the command produces an error, runExternal still returns null, but no notification or console error are created.

### The working folder for commands
runExternal always runs commands at the vault's root folder.  This allows you to run scripts that are within the vault, meaning the scripts can be copied/synced as part of the vault.

### Obsidian pauses until a command completes
When runExternal is used to run a command, Obsidian will freeze until that command is completely finished.  This can be disconcerting if you are not ready for it, but it is harmless... unless your command runs forever, of course.

### Cross-platform slashes
By default, on Windows, any forward-slashes in the shell command are automatically flipped to back-slashes.  This helps keep commands cross-platform (always use forward-slashes).  If this slash-flipping isn't wanted, though, `runExternal(command, failSilently, dontFixSlashes)` third parameter, "dontFixSlashes" can be set to true to disable it.

***

## ADVANCED SHORTCUTS: Calling shortcuts from shortcuts.
There are two features that work in tandem to allow you to nest shortcuts (i.e. use shortcut results as part of other shortcuts).  The first is the ability for an Expansion script to return a string array.  The second is the ability for an Expansion script to trigger another shortcut expansion, then get and use the result.

### Returning string arrays
Firstly: an Expansion script typically returns a string.  This string is what replaces the user-typed shortcut.  An Expansion script can, instead, return an array of strings.  This collection of strings gets joined into a single string when replacing a user-typed shortcut.

### Calling one shortcut from another
Secondly: within an Expansion script you can call the function `expand(text)`.  This function takes some text and tries to (a) find a matching shortcut (b) create an expansion result for it and (c) return that expansion result.  This works just like a shortcut text that you type directly into a note, except that `expand(text)` returns the result (a string or string array), _instead_ of writing the result to the note.

### Nesting shortcuts
Given these features, here's how you can nest a shortcut within another.  The first shortcut's Expansion script calls expand(), passing in the second shortcut.  What it gets back is the second shortcut's Expansion result: a string or array of strings.  It can then use that result, or a piece of that result, as needed.

### Example
| id | Test string | Expansion string |
| -- | ----------- | ---------------- |
|  1 | firstname   | return ["FirstName: ", "Maggie"]; |
|  2 | lastname    | return ["LastName: ", "Smith"]; |
|  3 | fullname    | return [ "FullName: ", expand("firstname")[1], " ", expand("lastname")[1] ]; |

Notice that shortcut #1 returns an array of strings, but if you type `;;firstname;` (`!!firstname!` on mobile), then the expansion is "FirstName: Maggie", since the array gets joined into a single string.  This is true for shortcut #2 as well (expanding into "LastName: Smith").

If you type `;;fullname;` (`!!fullname!` on mobile), the expansion is "FullName: Maggie Smith".  This is because the array it returns is ["FullName: ", "Maggie", " ", "Smith"].  THIS is because the two calls to expand get the result from shortcuts #1 and #2, which are arrays, then the following `[1]` gets the second string of the array.

### The "isUserTriggered" variable
Note: There is a variable "isUserTriggered" that is accessible from any Expansion script.  It is set to true if the Expansion script was triggered directly by a user-typed shortcut, and false if the Expansion script was triggered by another Expansion script (using the expand function).

***

## ADVANCED SHORTCUTS: Helper scripts
If you add a shortcut with an empty Test string, then that shortcut is a "helper script".  A helper script provides common code that any shortcuts listed after it can use.

### Helper-blockers
If you add a shortcut with an empty Test string AND an empty Expansion string, then that shortcut is a "helper-blocker".  A helper-blocker prevents any helper scripts above it from being available to any shortcuts after it.  You probably won't need helper-blockers, but they are there in case you do.  They are also inserted between shortcuts from different shortcut-files so that the helper scripts from one shortcut-file won't affect the shortcuts of any other files.

### Example
| id | Test string | Expansion string                                               |
| -- | ----------- | -------------------------------------------------------------- |
|  1 | hi          | return "Hello! How are you?";                                  |
|  2 |             | function roll(x) { return Math.trunc(Math.random() * x) + 1; } |
|  3 | d10         | return "Rolled " + roll(10) + " on a D10.";                    |
|  4 | d20         | return "Rolled " + roll(20) + " on a D20.";                    |
|  5 |             |                                                                |
|  6 | bye         | return "Goodbye.  Thanks for your time!";                      |

In this list of shortcuts, the shortcut #2 has an empty Test string.  That means that it is a "helper script". The code in its Expansion string (a function called "roll") is available to shortcuts after it.  Shortcut #5 is empty in both its Test AND Expansion strings.  That means that it is a "helper-blocker".  Shortcuts after it do not have access to helper scripts before it.  The net effect is that shortcuts #3 and #4 have access to the helper script, while shortcuts #1 and #6 do not.

***

## ADVANCED SHORTCUTS: Setup and shutdown scripts
A shortcut-file can contain a "setup script".  A setup script will run whenever the shortcut-file is loaded, including when switching notes while in "Developer mode".  A setup script is defined as a shortcut with a specific Test string of `^tejs setup$`.  This feature is useful if your shortcut-file requires initialization before its shortcuts will work.  Also, if the setup script returns something evaluating to true, this shortcut-file's shortcuts will _not_ be added.

A shortcut-file can contain a "shutdown script".  A shutdown script will run when a shortcut-file is being disabled, either when it is removed from the shortcut-file list, or when __Text Expander JS__ is being disabled or uninstalled.  A shutdown script is defined as a shortcut with a specific Test string of `^tejs shutdown$`.  This feature is useful if your shortcut-file needs to clean-up when being disabled.

### Example
| Test string | Expansion string | Overview |
| ----------- | ---------------- | -------- |
| ^tejs&nbsp;setup$ | window._tejsState&nbsp;\|\|=&nbsp;{};<br/>window._tejsState.clips&nbsp;\|\|=&nbsp;{}; | This setup script creates some global variables that shortcuts in the shortcut-file presumably rely upon.<br/><br/>Notice that the setup script only creates the global variables if they don't yet exist (`\|\|=`).  This is important as a setup script _may_ be run many times during a session.  We don't want later runs to wipe out anything that was created earlier. |

***

## ADVANCED SHORTCUTS: Hiding shortcuts
If the syntax string that starts a shortcut's About string is "hidden", then that shortcut will not show up in the help system (the "ref" shortcuts), though it can still be used.  This is helpful to prevent cluttering the help system with shortcuts that are not useful to the user, only to other shortcuts.

***

## ADVANCED SHORTCUTS: Reacting to shortcut expansions
If a shortcut-file needs to react to user-triggered shortcut expansions, it can now setup a callback function to be called on such an event.  The callback should take two parameters: the input text and the expansion text.  Registration is done by assigning the function to a unique key in `window._tejs.listeners.tejs.onExpansion`.  Note that this object heirarchy isn't created automatically.

In addition, if the callback function returns a string, then _that_ string is expanded as a shortcut and the result replaces the old expansion.

### Example shortcut-file
```
~~
^tejs setup$
~~
window._tejs ||= {};
window._tejs.listeners ||= {};
window._tejs.listeners.tejs ||= {};
window._tejs.listeners.tejs.onExpansion ||= {};
window._tejs.listeners.tejs.onExpansion.testCallback ||= (input, expansion) =>
{
	if (input.contains("d"))
	{
		// Force expansion to be result of the "hi" shortcut
		return "hi";
	}
	else
	{
		print("Shortcut input '" + input + "' expanded to '" + expansion + "'.");
	}
};
~~

~~
^tejs shutdown$
~~
delete window._tejs.listeners?.tejs?.onExpansion?.testCallback;
~~
```

***

## ADVANCED SHORTCUTS: Checking for loaded shortcut-files
There is a read-only array, "tejsInfo.shortcutFiles", that lists all shortcut-files who's shortcuts are currently loaded in the master shortcut list.  This can be useful in a number of ways.  Perhaps we want to disable a shortcut-file if an incompatible one is loaded.  Perhaps we want to modify shortcut-logic based on what other shortcuts are available.

***

## Known Issues
- Undo of expansion works a bit differently between the old editor (CodeMirror 5, non-mobile) and the new editor (CodeMirror 6, mobile and new non-mobile).  When using the new editor, the character that was typed just prior to the expansion does not show on undo.

***

## Credits
- This project was inspired by the description of Obsidian on the RPG Tips youtube video <a href='https://www.youtube.com/watch?v=XTFFzuZVcPk' target='_blank'>How I play my games in 2021</a>.
- This project was made with awareness of and deference to the <a href='https://github.com/konodyuk/obsidian-text-expander' target='_blank'>obsidian-text-expander</a> plugin (which has a more rudamentary feature set, but allows running external scripts).
- In both cases, the goal of this plugin is to fulfill a need for effortless cross-system, cross-platform operability of advanced text-expansion features.

***

## Release notes

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
- Expansions strings can now be surrounded with a javascript fenced code block.  Test strings can be surrounded with a basic fenced code block.
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

***

## Todo
- React to community feedback until plugin is accepted into the community.
- fix so it works with auto-added characters (example: prefix={{ and suffix-}})
- force undo between shortcut entered and expansion on cm6
- From beta to release (after responding to Obsidian community for, hopefully, a month)

## Future feature possibilities
- autocomplete based on about syntax string
