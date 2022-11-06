
### Next release - Critical
- look into db-folder compatibility
- __notepick pickFromQuery {count: >0} {pick id: name text, default: ""} : {query: text}__ - Picks {count} random notes based on {query} and remembers them as {pick id}.  The query can contain:
	- __path:__ - Allows entering a path (complete or partial) that file choices will be filtered down to
	- __file:__ - Allows entering a filename (complete or partial) that file choices will be filtered down to
	- __tags:__ - Allows entering a tag that file choices will be filtered down to
- try and resolve delay issues with notevars set

### Next release
- sublists sfile
- location crafter sfile
- Look into adding "state save <file>" and "state load <file>" shortcuts
- adventurecrafter split into non-ui and ui shortcut variations
- document all undocumented features - go through all shortcuts and note anything used, but undocumented (list here) then document it
- add to buttons panel to toggle printing results to the note or printing to a popup
- finish mythicv2 (missing stats system)
- have shortcut that expands all unexpanded shortcuts in the note.
- fix specific situation in autcomplete:
	- path texts - "files extensionchange" doesn't work right
	- x OR y OR z (should explicitly check if text meets each value)
- add customizable parameter types to allow for things like "list name text" which would add an autocomplete for list names
- bug fixes
	- pick ui starts at bottom
	- pick ui should have bottom buttons outside of scrolling (always on screen)
- Go through sfiles before lists and look for places where I can use shortcut embedding (now that expUnformat is available)
- plugin - replace all '==' with '===' and '!=' with '!==' where appropriate

### Post-next release
- test for bug with notepick https://github.com/jon-heard/obsidian-inline-scripts/discussions/40
- check for issues with "QuickAdd" plugin: https://www.reddit.com/r/solorpgplay/comments/y41sbj/comment/itd962a/?context=3
- figure out how to determine if there's not a lot of screen resolution, and hide autocomplete and ac help panel if so
- Have shortcut autocomplete react to ALL parameter types (when they are provided by the syntax string)
	- allow creating custom types (such as lists, to allow for a special autocomplete for a list name)
- library - write an sfile for ironsworn (or D&D)
- Shift from beta to release (after making either a D&D system or Ironsworn system)
- plugin - typescript - use HTMLElement type wherever possible
- Find a way to allow the prefix & suffix to contain auto-closed characters - `{`, `"`, etc
