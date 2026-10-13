// Brand & accessibility baseline for this site. Build first (yarn docs:build),
// then run: yarn docs:test. Set SITE_BASE to the path the build was served from.
import path from "node:path";

import { defineBrandSuite } from "./lib/suite.js";

defineBrandSuite({ siteDir: path.resolve(import.meta.dirname, "..") });
