import esbuild from "esbuild";
esbuild.build({
	entryPoints: [ "_Plugin.ts" ],
	outfile: "../main.js",
	bundle: true,
	sourcemap: false,
	minify: (process.argv.indexOf("--minify") > -1),
	external: [ "obsidian", "@codemirror/state", "acorn" ],
	format: 'cjs',
	target: 'es2021',
}).catch(() => process.exit(1));