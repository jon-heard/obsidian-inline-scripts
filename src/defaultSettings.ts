/////////////////////////////
// Default plugin settings //
/////////////////////////////

"use strict";

const DEFAULT_SETTINGS: any = Object.freeze(
{
	prefix: ";;",
	suffix: "::",
	devMode: false,
	allowExternal: false,
	shortcutFiles: [],
	shortcuts: `
__
^hi$
__
return "Hello! How are you?";
__
hi - Expands into "Hello! How are you?".  A simple shortcut to see if Text Expander JS is running.

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
A random "roll" function for other shortcuts.

__
^[d|D]([0-9]+)$
__
return "🎲 " + roll($1) + " /D" + $1;
__
d{max} - A dice roller shortcut.  Expands into "🎲 {roll result} /D{max}".  {max} is a required parameter: a positive integer giving the size of dice to roll.
    - Examples - d3, d20, d57, d999

__
^[f|F][d|D]([0-9]+)$
__
return "<span style='background-color:lightblue;color:black;padding:0 .25em'>🎲 <b>" + roll($1) + "</b> /D" + $1 + "</span>";
__
fd{max} - Same as d{max}, but with fancy formatting.

__
^([0-9]*)[d|D]([0-9]+)(|(?:\\+[0-9]+)|(?:\\-[0-9]+))$
__
$1 = Number($1) || 1;
let result = 0;
let label = "D" + $2;
if ($1 > 1) { label += "x" + $1; }
for (let i = 0; i < $1; i++) { result += roll($2); }
if ($3) {
	if ($3.startsWith("+")) {
		result += Number($3.substr(1));
	} else {
		result -= Number($3.substr(1));
	}
	label += $3;
}
if (isNaN(label.substr(1))) { label = "(" + label + ")"; }
return "🎲 " + result + " /" + label;
__
{count}d{max}{add} - Same as d{max}, but with optional {count} and {add} parameters.  {count} is a positive integer giving the number of dice to roll and add together.  {add} is "+" or "-" followed by a positive integer giving the amount to adjust the result by.
    - Examples - d100, 3d20, d10+5, 3d6+6"
`
});
