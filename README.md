# Obsidian Plugin - Text Expander JS

This plugin allows the user to define text-entry shortcuts to be expanded into strings built using javascript.

## Examples:
- Random dice roll: `;;d100;` -> `75 (D100)`
- Random name: `;;name male european;` -> `Bill Harrington`

## Installation
TBA

## Settings
TBA

## Defining a text-entry shortcut
TBA

## Known Issues
None

## Credits
- This project was inspired by description of Obsidian on the RPG Tips youtube video <a href='https://www.youtube.com/watch?v=XTFFzuZVcPk' target='_blank'>How I play my games in 2021</a>.

- This project was made with some reference and allusion to the <a href='https://github.com/konodyuk/obsidian-text-expander' target='_blank'>obsidian-text-expander</a> plugin.

## Release notes

### 00.06.000
- Allow building a result from multiple shortcuts (to allow common code)
- Allow replacer to be either a string, or an array of strings to be concatenated together
- Console log when loading/unloading plugin
- Have version follow format convention (##.##.####)

### 00.05.000
- Basic implementation.  All settings hardwired

## TODO

### 00.07.000
- Adjust version format (final digit has 3 spaces, not 4)
- Fix ";;"/";" bookends to work when caret is on prefix
- **Settings**: Shortcut prefix & postfix
- **Settings**: Shortcut definitions filename
- **Settings**: Shortcut expansion hotkey

### 00.08.000
- **Settings**: Custom CSS filename

### 00.09.000
- **Settings**: Shortcuts (definable directly in settings)
- Test functionality: create scripts for all of mythic VII
- Fill in rest of readme (instructions)

### 00.10.000
- Submit to Obsidian community (beta)

### 01.00.000
- Respond to Obsidian community feedback for a month
