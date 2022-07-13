export {};

declare global
{
	interface Window
	{
		_tejs: any;
		request: Function;
		plugin: any;
	}
}
