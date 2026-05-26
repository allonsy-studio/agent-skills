import { InputPathToUrlTransformPlugin } from "@11ty/eleventy";
import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";

/** @param {import('@11ty/eleventy').TemplateConfig} config */
export default async function ( config ) {
	// const isProduction = process.env.ELEVENTY_ENV === 'production';
	config.setInputDirectory(".");
	config.setTemplateFormats([
		"njk",
		"11ty.js",
	]);

	config.ignores.add("**/README.md");
	config.ignores.add("**/CLAUDE.md");

	config.addBundle("css");
	config.addBundle("js");

	config.addFilter("json", (/** @type {string} */ value) => value && JSON.stringify(value));

	config.setServerOptions( {
		// Open the browser automatically
		open: true,
		browser: "firefox",
		domDiff: false
	} );

	/* -------- PLUGINS -------- */
	config.addPlugin( InputPathToUrlTransformPlugin );
	config.addPlugin( syntaxHighlight, {
		alwaysWrapLineHighlights: true,
	} );

	config.addWatchTarget( "assets/*" );

	config.addPassthroughCopy({
		".nojekyll": ".nojekyll",
		"assets/*": "assets",
		"skills/*/assets": "assets",
		"skills/dreamlight-valley/references/sprites/*": "sprites",
	});
};
