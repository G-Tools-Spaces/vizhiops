#!/usr/bin/env node
/**
 * Generate the "last updated" date for every docs page, from git history.
 *
 * Walks every page.tsx under src/app/docs, asks git for each file's last
 * commit date,
 * and writes a { "/docs/...": "ISO date" } map to
 * src/lib/page-dates.generated.json. The LastUpdated component in the docs
 * layout reads it, so every page shows when its content last changed —
 * no hand-maintained dates to forget.
 *
 * Runs automatically before `next build`; also available as `npm run dates`.
 */

import { execFileSync } from "node:child_process";
import { readdir, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const APP_DIR = resolve(ROOT, "src/app");
const DOCS_DIR = join(APP_DIR, "docs");
const OUT_FILE = resolve(ROOT, "src/lib/page-dates.generated.json");

/** Recursively collect every page.tsx under the docs route. */
async function findPages(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const pages = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      pages.push(...(await findPages(full)));
    } else if (entry.name === "page.tsx") {
      pages.push(full);
    }
  }
  return pages;
}

/** Last commit date of a file, or null when it has no history yet. */
function lastCommitDate(file) {
  try {
    const out = execFileSync(
      "git",
      ["log", "-1", "--format=%cI", "--", relative(ROOT, file)],
      { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] },
    )
      .toString()
      .trim();
    return out || null;
  } catch {
    return null; // not a git repo, or git missing — dates simply stay hidden
  }
}

const pages = await findPages(DOCS_DIR);
const dates = {};

for (const page of pages) {
  const rel = relative(APP_DIR, page).replace(/\/page\.tsx$/, "");
  const href = rel === "docs" ? "/docs" : `/${rel}`;
  const iso = lastCommitDate(page);
  if (iso) dates[href] = iso;
}

await mkdir(dirname(OUT_FILE), { recursive: true });
await writeFile(OUT_FILE, JSON.stringify(dates, null, 2) + "\n", "utf8");

console.log(
  `Wrote last-updated dates for ${Object.keys(dates).length}/${pages.length} pages → ${relative(ROOT, OUT_FILE)}`,
);
