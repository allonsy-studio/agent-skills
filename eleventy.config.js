import { HtmlBasePlugin, InputPathToUrlTransformPlugin } from "@11ty/eleventy";
import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";

/** @param {import('@11ty/eleventy').TemplateConfig} config */
export default async function ( config ) {
	// const isProduction = process.env.ELEVENTY_ENV === 'production';
	config.setInputDirectory(".");
	config.setTemplateFormats([
		"njk",
		"css",
		"js",
		"11ty.js",
	]);

	config.ignores.add("**/README.md");
	config.ignores.add("**/CLAUDE.md");
	/* ignore top-level config files */
	config.ignores.add("./*.js");
	config.ignores.add("scripts/*");
	config.ignores.add("bin/*");
	config.ignores.add("skills/*/*.js");
	config.ignores.add("skills/*/evals/**");
	config.ignores.add("skills/*/commands/**");
	config.ignores.add("skills/*/scripts/**");
	config.ignores.add("skills/*/tests/**");
	config.ignores.add("skills/*/references/**");

	config.addBundle("css");
	config.addBundle("js");
	config.addBundle("footer");

	config.addFilter("json", (/** @type {string} */ value) => value && JSON.stringify(value));
	config.addFilter("categories", (/** @type {{ category: string }[]} */ array) => {
		return [...array.reduce((acc, item) => {
			if (item.category) acc.add(item.category);
			return acc;
		}, new Set())].sort();
	});

	config.setServerOptions( {
		// Open the browser automatically
		open: true,
		browser: "firefox",
		domDiff: false
	} );

	/* -------- PLUGINS -------- */
	// Rewrites root-relative URLs (nav links, favicons, images) to include the
	// configured pathPrefix. A no-op at the default prefix ("/") so production is
	// unchanged; PR previews build with --pathprefix=/pr-preview/pr-N/ so links
	// stay inside the preview instead of pointing back at the live site.
	config.addPlugin( HtmlBasePlugin );
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
