import fs from 'node:fs/promises';
import path from 'node:path';

/** @type {import('@11ty/eleventy/TemplateConfig').TemplateConfig} */
export default async function (configData) {
    const rootDir = path.resolve(configData.eleventy.env.root, '..');

    // Read in the root package.json
    const packageJson = await fs.readFile(path.join(rootDir, 'package.json'), 'utf-8');
    const pkg = JSON.parse(packageJson);
    const repoUrl = pkg?.repository?.url?.replace(/\.?git\+?/g, '');

    // Fetch the list of skills from the skills directory
    const skillsDirs = await fs.readdir(path.join(rootDir, 'skills'), { withFileTypes: true });

    // Load the skills metadata from their package.json files
    const skills = await Promise.all(skillsDirs.filter(dir => dir.isDirectory()).map(async (dir) => {
        const packageJson = await fs.readFile(path.join(dir.parentPath, dir.name, 'package.json'), 'utf-8');
        const skillData = JSON.parse(packageJson);

        return {
            name: dir?.name,
            description: skillData?.description,
            url: `${repoUrl}/blob/main/skills/${dir?.name}/SKILL.md`,
            triggers: skillData?.skill?.triggers ?? [],
            commands: skillData?.skill?.commands ?? [],
        };
    }));

    return {
        version: pkg?.version,
        title: pkg?.name,
        pkg_name: pkg?.name,
        description: pkg?.description,
        author: pkg?.author,
        url: pkg?.homepage,
        repo: {
            name: repoUrl.split('/').pop(),
            url: repoUrl,
        },
        npm_url: `https://www.npmjs.com/package/${pkg?.name}`,
        funding: pkg?.funding,
        license: {
            name: pkg?.license,
            url: `${repoUrl}/blob/main/LICENSE`
        },
        bugs: {
            url: `${repoUrl}/issues`
        },
        keywords: pkg?.keywords,
        skills,
    };
}
