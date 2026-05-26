import fs from "node:fs";
import fsp from "node:fs/promises"
import path from "node:path";

/** @type {import('@11ty/eleventy/TemplateConfig').TemplateConfig} */
export default async function (configData) {
	const rootDir = path.resolve(configData.eleventy.env.root);

	// Pull in data from the references directory
	const references = await fsp.readdir(path.join(rootDir, "skills", "dreamlight-valley", "references"), { withFileTypes: true });
	const data = references.reduce((acc, reference) => {
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
