#!/usr/bin/env node
// Refresh the studio layer's locked hashes. Run after the studio files change
// in the skill itself; never in a project.
//
// Usage: node scripts/lock-studio.js

import { writeFileSync } from "node:fs";
import path from "node:path";

import { CORE_DIR, STUDIO_LOCK, studioLockContent } from "./lib/layers.js";

const target = path.join(CORE_DIR, STUDIO_LOCK);
writeFileSync(target, studioLockContent());
console.log(`Wrote ${path.relative(process.cwd(), target)}`);
