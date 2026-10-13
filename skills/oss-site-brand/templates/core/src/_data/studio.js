// Studio layer data. Locked: the three studio components read only from here,
// so a project can change what they say only by changing the studio's own
// constants, never per site. Do not edit in a project.

export default Object.freeze({
	name: "Allons-y Studio",
	url: "https://allons-y.studio",
	// Sales call to action. Shown only in the footer block.
	contact: "contact@allons-y.studio",
	// Conduct reports & vulnerability reports, linked from the footer.
	conductUrl:
		"https://github.com/allonsy-studio/.github/blob/main/CODE_OF_CONDUCT.md",
	securityUrl:
		"https://github.com/allonsy-studio/.github/blob/main/SECURITY.md",
	banner: Object.freeze({
		src: "/assets/img/studio/oss-banner.svg",
		alt: "Brought to you by Allons-y Studio",
		width: 1600,
		height: 64,
	}),
	footer: Object.freeze({
		light: "/assets/img/studio/oss-footer-light.svg",
		dark: "/assets/img/studio/oss-footer-dark.svg",
		alt: "Brought to you by Allons-y Studio",
		width: 440,
		height: 75,
	}),
	cta: Object.freeze({
		title: "Work with Allons-y Studio",
		body: "Design systems, front-end engineering, & accessibility consulting for teams that depend on open source.",
	}),
});
