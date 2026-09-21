import fs from "node:fs";
import fsp from "node:fs/promises"
import path from "node:path";

/**
 * Eleventy preview data: loads recipes/gatherables/coords JSON for the
 * dreamlight-valley skill's preview page.
 *
 * @param {{ eleventy: { env: { root: string } } }} configData
 */
export default async function (configData) {
	const rootDir = path.resolve(configData.eleventy.env.root);

	// Pull in data from the references directory
	const references = await fsp.readdir(path.join(rootDir, "skills", "dreamlight-valley", "references"), { withFileTypes: true });
	/** @type {Record<string, any>} */
	const data = references.reduce((/** @type {Record<string, any>} */ acc, reference) => {
		if (reference.isFile() && reference.name.endsWith(".json")) {
			const content = fs.readFileSync(path.join(rootDir, "skills", "dreamlight-valley", "references", reference.name), "utf-8");
			if (!content) return acc;

			acc[reference.name.replace(".json", "")] = JSON.parse(content);
		}
		return acc;
	}, {});

	return {
		recipes: data.recipes?.recipes ?? [],
		gatherables: data.gatherables?.categories ?? {},
		coords: data["sprite-coords"]?.sheets ?? {},
	}
}
