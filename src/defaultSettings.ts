/////////////////////////////
// Default plugin settings //
/////////////////////////////

const DEFAULT_SUB_SETTINGS_MOBILE: object = Object.freeze(
{
	prefix: "!!",
	suffix: "!"
});

const DEFAULT_SETTINGS: any = Object.freeze(
{
	prefix: ";;",
	suffix: ";",
	devMode: false,
	allowExternal: false,
	shortcutFiles: [],
	shortcuts: `
~~
^hi$
~~
return "Hello! How are you?";
~~
hi - Expands into "Hello! How are you?".  A simple shortcut to see if Text Expander JS is running.

~~
^date$
~~
return new Date().toLocaleDateString();
~~
date - Expands into the current, local date.

~~
^time$
~~
return new Date().toLocaleTimeString();
~~
time - Expands into the current, local time.

~~
^datetime$
~~
return new Date().toLocaleString();
~~
datetime - Expands into the current, local date and time.

~~
~~
function roll(max) { return Math.trunc(Math.random() * max + 1); }
~~
A random "roll" function for other shortcuts.

~~
^[d|D]([0-9]+)$
~~
return "🎲 " + roll($1) + " /D" + $1;
~~
d{max} - A dice roller shortcut.  Expands into "🎲 {roll result} /D{max}".  {max} is a required parameter: a positive integer giving the size of dice to roll.
    - Examples - d3, d20, d57, d999

~~
^[f|F][d|D]([0-9]+)$
~~
return "<span style='background-color:lightblue;color:black;padding:0 .25em'>🎲 <b>" + roll($1) + "</b> /D" + $1 + "</span>";
~~
fd{max} - Same as d{max}, but with fancy formatting.

~~
^([0-9]*)[d|D]([0-9]+)(|(?:\\+[0-9]+)|(?:\\-[0-9]+))$
~~
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
~~
{count}d{max}{add} - Same as d{max}, but with optional {count} and {add} parameters.  {count} is a positive integer giving the number of dice to roll and add together.  {add} is "+" or "-" followed by a positive integer giving the amount to adjust the result by.
    - Examples - d100, 3d20, d10+5, 3d6+6"
`
});
