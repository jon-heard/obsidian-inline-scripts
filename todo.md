### Next release - Critical
- sublists sfile
- __notepick pickFromQuery {count: >0} {pick id: name text, default: ""} : {query: text}__ - Picks {count} random notes based on {query} and remembers them as {pick id}.  The query can contain:
	- __path:__ - Allows entering a path (complete or partial) that file choices will be filtered down to
	- __file:__ - Allows entering a filename (complete or partial) that file choices will be filtered down to
	- __tags:__ - Allows entering a tag that file choices will be filtered down to
- fix specific situation in autcomplete:
	- number types (">0", ">=0", ">1", ">=1", etc) to keep going as long as there's a number
	- "text" types (just need to keep accepting it forever, spaces and all)
	- "path text" types, if it starts with a quote, keep accepting until end of quote
- finish mythicv2 (missing stats system)

### Next release
bug fixes
	- pick ui starts at bottom
	- pick ui should have bottom buttons outside of scrolling (always on screen)
- Go through sfiles before lists and look for places where I can use shortcut embedding (now that expUnformat is available)
- add to buttons panel to toggle printing results to the note or printing to a popup
- document all undocumented features - go through all shortcuts and note anything used, but undocumented (list here) then document it
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
