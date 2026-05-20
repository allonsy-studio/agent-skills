import { InputPathToUrlTransformPlugin } from "@11ty/eleventy";
import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";

/** @param {import('@11ty/eleventy').TemplateConfig} config */
export default async function ( config ) {
	// const isProduction = process.env.ELEVENTY_ENV === 'production';

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

	config.addWatchTarget( "styles.css" );
};
