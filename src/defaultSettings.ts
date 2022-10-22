/////////////////////////////
// Default plugin settings //
/////////////////////////////

"use strict";

export const DEFAULT_SETTINGS: any = Object.freeze(
{
	prefix: ";;",
	suffix: "::",
	devMode: false,
	allowExternal: false,
	autocompleteHelp: true,
	autocomplete: true,
	version: (app as any).plugins.manifests["obsidian-text-expander-js"].version,
	shortcutFiles: [],
	shortcuts: `
__
^hi$
__
return "Hello! How are you?";
__
hi - Expands into "Hello! How are you?".  A simple shortcut to see if Inline Scripts plugin is running.

__
^date$
__
return new Date().toLocaleDateString();
__
date - Expands into the current, local date.

__
^time$
__
return new Date().toLocaleTimeString();
__
time - Expands into the current, local time.

__
^datetime$
__
return new Date().toLocaleString();
__
datetime - Expands into the current, local date and time.

__
__
function roll(max) { return Math.trunc(Math.random() * max + 1); }
__
A dice roller function used in other shortcuts.

__
^[d|D]([0-9]+)$
__
return "🎲 __" + roll($1) + "__ /D" + $1;
__
d{max: >0} - A dice roller shortcut.  Expands into "🎲 {roll result} /D{max}".  {max} is the size of dice to roll.
    - Examples - d3, d20, d57, d999

__
^([0-9]*)[d|D]([1-9][0-9]*)(|(?:[\+\-][0-9]+))$
__
$1 = Number($1) || 1;
$3 ||= "+0";
let result = 0;
let label = "D" + $2;
if ($1 > 1) { label += "x" + $1; }
for (let i = 0; i < $1; i++) { result += roll($2); }
if (Number($3)) {
	result += Number($3);
	label += $3;
}
if (isNaN(label.slice(1))) { label = "(" + label + ")"; }
return "🎲 __" + result + "__ /" + label;
__
{count: >0, default: 1}d{max: >0}{add: + or \\- followed by >0, default: +0} - A dice roller shortcut, same as d{max}, but with optional {count} and {add} parameters.  {count} is the number of dice to roll and add together.  {add} is "+" or "-" followed by an amount to adjust the result by.
    - Examples - d100, 3d20, d10+5, 3d6+6
`,
	buttonView: { visible: true, groups: {} }
});
