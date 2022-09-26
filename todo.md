### Pre-next release
- fix state system to save periodically (save at quit is not guaranteed)

### Next release
- Update the "cards" system based on the pre-release (https://github.com/jon-heard/obsidian-inline-scripts/discussions/36)
	/ look into not loading the entire image just to get the aspect ratio
	/ put out to playtesters
- Adding more options for shortcut links
- Have shortcut autocomplete react to parameter types (when they are provided by the syntax string)
	- allow posting custom types (such as lists)
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

### Post-next release
- library - write an sfile for ironsworn (or D&D)
- Shift from beta to release (after making either a D&D system or Ironsworn system)
- plugin - typescript - use HTMLElement type wherever possible
- Find a way to allow the prefix & suffix to contain auto-closed characters - `{`, `"`, etc


- pick ui should have bottom buttons outside of scrolling (always on screen)
	- pick ui starts at bottom










I have pending changes to the cards system that, while definite improvements, will breaking existing design and require a new tutorial video.

I know that I released the cards system very recently.  In hindsight, pre-release user feedback and playtesting would have been smart.  So, I'm making `this` discussion for pre-release of the next iteration of the cards system.  Once this new plan is ready, I'll put it out for playtesting.  After playtesting, it'll become the new version of Cards.

Feedback is encouraged!  I'll keep this post updated the latest plan.

Also, non-breaking suggestions or bug-fixes will still be added to the current release of the cards system.

## How to setup prerelease
- Don't use shortcuts from cards_ui (those that start with "ui cards ").  They won't be updated until this plan is finalized.

## Open discussions
- make fromfolder more efficient
- Order of parameters for draw and pick
- Does an undo feature seem useful?

## Breaking changes coming in the new release
- Piles must be explicitly created before being used.
- Card facing (face-up or face-down) is per-pile, not per-card.
- No special card-pile (i.e. {table}).
	- If the destination card-pile is omitted from the draw or pick shortcuts, then they will use the destination card-pile entered for the prior call.
	- Cards are printed to the note when moved if the pile's {show moved} flag is set.
		- This is simpler to understand than a special pile, especially now that piles must be explicitly created before being used.

## Cards shortcuts
- `cards reset` - Clears all card-piles.
- `cards settings {size: >0, default: ""} {back-image: path text, default: ""}` - Updates the settings for the cards system.
    - __{size}__ - The width for all cards, in pixels.  Card height scales to match.
    - __{back-image}__ - The path to an image file to represent face-down cards, or "default" to reset to the default back-image.
***
- `cards pile {pile id: name text} {facing: up OR down, default: down} {show moved: y OR n, default: prior}` - Creates an empty card-pile {pile id} with all cards facing {facing} (face-up or face-down).  If {show moved}, cards that are drawn or picked into the {pile id} card-pile are also printed to the note.
- `cards remove {pile id: name text} {recall: y OR n, default: n}` - Removes the {pile id} card-pile, including all cards within it.  If {recall}, all cards in {pile id} are recalled before the {pile id} card-pile is removed.  If the {pile id} card-pile is the origin for any cards, then they are orphaned, and immediately re-origined to their current card-pile.
- `cards pilesettings {pile id: name text} {facing: up OR down, default: current} {show moved: y OR n, default: current}` - Updates the settings for the {pile id} card-pile.
    - __{facing}__ - Are the {pile id} card-pile's cards shown face-up or face-down?
    - __{show moved}__ - Are cards that are drawn or picked into the {pile id} card-pile also printed to the note?
***
- `cards fromfolder {pile id: name text} {folder: path text}` - Creates cards based on images in {folder} and puts them into the {pile id} card-pile.
	- Note that this does not randomize the new cards.  Call `cards shuffle` after this to do that.
***
- `cards list` - Lists all card-piles.
- `cards peek {count: >0 OR "all", default: 1} {pile id: name text, default: prior} {from the bottom: y OR n, default: prior OR n}` - Displays the first {count} cards in the {pile id} card-pile, or ALL cards if {count} is "all".  If {from the bottom}, displays the LAST {count} cards instead.
***
- `cards draw {count: >0 OR "all", default: 1} {destination pile id: name text, default: prior} {source pile id: name text, default: prior}` - Removes {count} cards from the {source pile id} card-pile and adds them to the {destination pile id} card-pile.
- `cards pick {destination pile id: name text, default: prior} {source pile id: name text, default: prior}` - Has the user choose cards from the {source pile id} card-pile.  Moves the chosen cards into the {destination pile id} card-pile.
***
- `cards shuffle {pile id: name text} {rotate: y OR n, default: n}` - Randomizes the card order for the {pile id}.  If {rotate}, then card rotations are also randomized.
	- Rotation typically means 0 or 180 degrees (right-side-up or up-side-down), but can also mean 90 or 270 degrees if the card is square.
- `cards unrotate {pile id: name text}` - Sets the rotation for all cards in the {pile id} card-pile to 0 (right-side-up).
- `cards reverse {pile id: name text}` - Reverses the order of the cards in the {pile id} card-pile.
- `cards recall {pile id: name text}` - Moves all cards that have the {pile id} card-pile as their origin, from their current card-piles back into the {pile id} card-pile.  If {facing} is specified, all cards in {pile id} are then put to face {facing}.
- `cards reorigin {pile id: name text}` - Sets the origin of all cards in the {pile id} card-pile to {pile id}.
***
- `cards import {pile id: name text, default: table} {data: text}` - Imports the {data} into the {pile id} card pile.
- `cards export {pile id: name text}` - Expands to a data string containing all date for the {pile id} card-pile.

## Other things (for the video, and just to do)
- Card viewer - Drag cards to reorder them.
- Card viewer - Double-tap cards to change their rotation.
- state.backgroundImage defaults to null, at which point the generic backgroundimage is used (don't put generic into state.  It's big!)
