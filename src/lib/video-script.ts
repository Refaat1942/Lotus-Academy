/** A scene of a narrated lesson video, parsed from the lesson's .video.md script. */
export interface Scene { visual: string; onScreen: string | null; lines: string[] }

const NARRATOR = /^(?:\*\*)?(?:Narrator|Voice[- ]?over|VO|المعلّق|المعلق|الراوي|التعليق الصوتي)(?:\s*\([^)]*\))?(?:\*\*)?\s*[:：]\s*(?:\*\*)?\s*/i;
const ON_SCREEN = /(?:on-?screen text|text on screen|نص على الشاشة|عنوان على الشاشة)\s*[:：]\s*["“«]?([^"”»\]]+)["”»]?/i;

/** Splits a narration paragraph into speakable sentences (keeps captions short). */
export function sentences(text: string): string[] {
  return text.replace(/\s+/g, " ").split(/(?<=[.!?؟。])\s+/).map((s) => s.trim()).filter(Boolean);
}

export function parseScenes(script: string | null | undefined): Scene[] {
  if (!script) return [];
  const scenes: Scene[] = [];
  let cur: Scene | null = null;
  for (const raw of script.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const vis = line.match(/^\[(.+)\]$/);
    if (vis) {
      const inner = vis[1].replace(/^(?:Scene|المشهد)\s*\d+\s*[:：]\s*/i, "").trim();
      cur = { visual: inner, onScreen: inner.match(ON_SCREEN)?.[1]?.trim() ?? null, lines: [] };
      scenes.push(cur);
      continue;
    }
    const text = line.replace(NARRATOR, "").replace(/\*\*/g, "").trim();
    if (!text) continue;
    if (!cur) { cur = { visual: "", onScreen: null, lines: [] }; scenes.push(cur); }
    cur.lines.push(...sentences(text));
  }
  return scenes.filter((s) => s.lines.length || s.onScreen);
}
