////////////////////////////////////////////////////////////////////////////////////////////////////
// AutoAsyncWrapper - Takes a string of JS source and wraps certain functions in "await".         //
// Simplifies scripts by letting them not explicitly require "await".                             //
////////////////////////////////////////////////////////////////////////////////////////////////////

"use strict";

const REGEX_AWAIT_TEMPLATE: string = "(?:~1~)[\s]*\\(";
const REGEX_ASYNC: RegExp = /function[\s]*\(/g;
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

export namespace AutoAsyncWrapper
{
	export function initialize(toAwaitWrap: Array<string>)
	{
		_regex_await = new RegExp(REGEX_AWAIT_TEMPLATE.replace("~1~", toAwaitWrap.join("|")), "g");
	}

	// Pull the official TEJS library from github & add it to the current vault
	export function run(source: string): string
	{
		return run_internal(source);
	}

///////////////////////////////////////////////////////////////////////////////////////////////////

	let _regex_await: RegExp;

	function run_internal(source: string): string
	{
		source = addPrefixToAllInstances(source, "async ", REGEX_ASYNC);
		source = wrapPrefixToAllInstances(source, "await ", _regex_await);
		return source;
	}

	function addPrefixToAllInstances(
		source: string, prefix: string, regex_searchToWrap: RegExp): string
	{
		let matchPositions: Array<any> = [];

		for (const match of source.matchAll(regex_searchToWrap))
		{
			matchPositions.push({ start: match.index, end: match.index + match[0].length });
		}

		matchPositions.reverse();

		for (const matchPosition of matchPositions)
		{
			source =
				source.slice(0, matchPosition.start) + prefix +
				source.slice(matchPosition.start);
		}

		return source;
	}

	function wrapPrefixToAllInstances(
		source: string, prefix: string, regex_searchToWrap: RegExp): string
	{
		let matchPositions: Array<any> = [];

		for (const match of source.matchAll(regex_searchToWrap))
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
				if (source[index] === stack[stack.length-1])
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
				source.slice(0, matchPosition.start) + "(" + prefix +
				source.slice(matchPosition.start, index) + ")" + source.slice(index);
		}

		return source;
	}
}
