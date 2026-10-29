/**
 * Export starter-lesson narration for the audio generator.
 *
 * Writes JSON with each scene's narration, its hash, and its sentences (split exactly as the
 * lesson player splits them, so caption timings line up).
 *
 * Run with: npx tsx scripts/training-audio/export-narration.ts <out.json> [course-key ...]
 * See scripts/training-audio/README.md for the full workflow.
 */

import fs from "fs"
import { LIBRARY_LESSON_SOURCES } from "../../lib/security/training-library-lessons"
import { narrationHash, splitSentences } from "../../lib/security/training-lesson"

const [outPath, ...keys] = process.argv.slice(2)
if (!outPath) {
  console.error("Usage: tsx scripts/training-audio/export-narration.ts <out.json> [course-key ...]")
  process.exit(1)
}

const selected = keys.length > 0 ? keys : Object.keys(LIBRARY_LESSON_SOURCES)
const unknown = selected.filter((k) => !LIBRARY_LESSON_SOURCES[k])
if (unknown.length > 0) {
  console.error(`Unknown course key(s): ${unknown.join(", ")}`)
  process.exit(1)
}

const output = selected.map((key) => ({
  key,
  scenes: LIBRARY_LESSON_SOURCES[key].scenes.map((scene, index) => ({
    index,
    narrationHash: narrationHash(scene.narration),
    sentences: splitSentences(scene.narration),
  })),
}))

fs.writeFileSync(outPath, JSON.stringify(output, null, 2))
console.log(`Exported narration for ${selected.length} course(s) to ${outPath}`)
