////////////////////////////////////////////////////////////////////////////////////////////////////
// AutoAwaitWrapper - Takes a string of JS source and wraps certain functions in "await".         //
// Simplifies scripts by letting them not explicitly require "await".                             //
////////////////////////////////////////////////////////////////////////////////////////////////////

"use strict";

const REGEX_BASE: string = "(?:~1~)[\s]*\\(";
const UNNESTABLE_BLOCK_PAIRS: any = Object.freeze(
{
	"\"": "\"",
	"'": "'",
	"`": "`",
});
const NESTABLE_BLOCK_PAIRS: any = Object.freeze(
{
	"(": ")",
	"[": "]",
	"{": "}",
});

export namespace AutoAwaitWrapper
{
	export function initialize(functionsToWrap: Array<string>)
	{
		_regex_toWrap = new RegExp(REGEX_BASE.replace("~1~", functionsToWrap.join("|")), "g");
	}

	// Pull the official TEJS library from github & add it to the current vault
	export function run(source: string): string
	{
		return run_internal(source);
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	let _regex_toWrap: RegExp;

	function run_internal(source: string): string
	{
		let matchPositions: Array<any> = [];

		for (const match of source.matchAll(_regex_toWrap))
		{
			matchPositions.push({ start: match.index, end: match.index + match[0].length });
		}

		matchPositions.reverse();

		for (const matchPosition of matchPositions)
		{
			const stack: Array<string> = [ ")" ];
			let index: number = matchPosition.end;
			const sLength: number = source.length;
			let isNestable: boolean = true;
			while (index < sLength)
			{
				if (source[index] == stack[stack.length-1])
				{
					stack.pop();
					isNestable = true;
					if (!stack.length)
					{
						break;
					}
				}
				else if (isNestable)
				{
					let pairing = UNNESTABLE_BLOCK_PAIRS[source[index]];
					if (pairing)
					{
						stack.push(pairing);
						isNestable = false;
					}
					else
					{
						pairing = NESTABLE_BLOCK_PAIRS[source[index]];
						if (pairing)
						{
							stack.push(pairing);
						}
					}
				}
				index++;
			}
			
			source =
				source.slice(0, matchPosition.start) + "(await " +
				source.slice(matchPosition.start, index) + ")" + source.slice(index);
		}
		
		return source;
	}
}
