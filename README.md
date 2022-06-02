# Obsidian Plugin - Text Expander JS

This plugin allows the user to define text-entry shortcuts to be expanded into strings built using javascript.

## Examples:
- Random dice roll: `;;d100;` -> `75 (D100)`
- Random name: `;;name male european;` -> `Bill Harrington`

## Installation
TBA

## HOW-TO: Add a text-entry shortcut file to a vault
TBA

## HOW-TO: Define a new text-entry shortcut
TBA

## HOW-TO: Creating a new text-entry shortcut file
TBA (includes dev-mode)

## REFERENCE: All Settings
TBA

## Known Issues
None

## Credits
- This project was inspired by description of Obsidian on the RPG Tips youtube video <a href='https://www.youtube.com/watch?v=XTFFzuZVcPk' target='_blank'>How I play my games in 2021</a>.
- This project was made with awareness of and deference to the <a href='https://github.com/konodyuk/obsidian-text-expander' target='_blank'>obsidian-text-expander</a> plugin (which has a more basic feature set, but includes running external scripts).
- In both cases, the goal of this plugin is to fulfill a need for effortless cross-platform operability of advanced text-expansion features.

## Release notes

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

### 00.09.000
- **Settings**: Shortcuts (definable directly in settings)
- **Settings**: each shortcut file should have a delete button (no global "Remove file" button)
- Get working on mobile

### 00.10.000
- **Settings**: Developer mode: monitor shortcut files for changes
- Test functionality: create scripts for all of mythic and mythic variations II
- Test that all mythic functionality works on mobile too
- Fill in rest of readme (instructions)

### 00.11.000b
- Submit to Obsidian community (beta)

### 01.00.000
- Respond to Obsidian community feedback for a month
