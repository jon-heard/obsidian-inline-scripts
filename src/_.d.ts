export {};

declare global
{
	interface Window
	{
		_inlineScripts: any;
		request: Function;
		plugin: any;
		dbg: boolean;
		brk: Function;
	}
}
