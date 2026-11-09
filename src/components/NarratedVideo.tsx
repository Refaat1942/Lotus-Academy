"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Captions, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import type { Scene } from "@/lib/video-script";

type Lang = "en" | "ar";
const L = {
  en: { title: "Video lesson", play: "Play", pause: "Pause", restart: "Restart", prev: "Previous scene", next: "Next scene", scene: "Scene", mute: "Mute narration", unmute: "Turn narration on", noVoice: "No voice for this language on this device — captions will play on their own.", speed: "Speed", narrated: "Narrated by your device's voice" },
  ar: { title: "فيديو الدرس", play: "تشغيل", pause: "إيقاف مؤقت", restart: "من البداية", prev: "المشهد السابق", next: "المشهد التالي", scene: "مشهد", mute: "كتم الصوت", unmute: "تشغيل الصوت", noVoice: "لا يوجد صوت عربي على هذا الجهاز — ستُعرض الترجمة تلقائيًا.", speed: "السرعة", narrated: "بصوت جهازك" },
};

function pickVoice(lang: Lang) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
  // Prefer Egyptian Arabic, then any natural/online voice, then the first match.
  return voices.find((v) => /ar-eg/i.test(v.lang)) ?? voices.find((v) => /natural|online|google/i.test(v.name)) ?? voices[0] ?? null;
}

/**
 * Plays a lesson's video script as a narrated, animated slideshow (scene by scene, sentence by sentence) using the
 * browser's speech synthesis. Works offline and needs no recording; replaced automatically when a real video exists.
 */
export function NarratedVideo({ scripts, initialLang, title }: { scripts: Partial<Record<Lang, Scene[]>>; initialLang: Lang; title: string }) {
  const langs = (Object.keys(scripts) as Lang[]).filter((k) => scripts[k]?.length);
  const [lang, setLang] = useState<Lang>(langs.includes(initialLang) ? initialLang : langs[0]);
  const scenes = scripts[lang] ?? [];
  const [si, setSi] = useState(0);
  const [li, setLi] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [voiceOk, setVoiceOk] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = L[lang];
  const scene = scenes[si];
  const line = scene?.lines[li] ?? "";
  const total = scenes.reduce((s, x) => s + Math.max(1, x.lines.length), 0);
  const pos = scenes.slice(0, si).reduce((s, x) => s + Math.max(1, x.lines.length), 0) + li;

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const advance = useCallback(() => {
    setLi((l) => {
      const sc = scenes[si];
      if (sc && l + 1 < sc.lines.length) return l + 1;
      if (si + 1 < scenes.length) { setSi(si + 1); return 0; }
      setPlaying(false);
      return l;
    });
  }, [scenes, si]);

  useEffect(() => {
    const update = () => setVoiceOk(!!pickVoice(lang));
    update();
    if ("speechSynthesis" in window) window.speechSynthesis.onvoiceschanged = update;
  }, [lang]);

  // Speak (or time) the current sentence, then move on.
  useEffect(() => {
    stop();
    if (!playing || !scene) return;
    const text = line || scene.onScreen || "";
    const fallbackMs = Math.max(2500, (text.split(/\s+/).length / (2.6 * rate)) * 1000);
    const voice = muted ? null : pickVoice(lang);
    if (!voice || !text) { timer.current = setTimeout(advance, fallbackMs); return stop; }
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice; u.lang = voice.lang; u.rate = rate;
    u.onend = () => { timer.current = setTimeout(advance, 350); };
    u.onerror = () => { timer.current = setTimeout(advance, fallbackMs); };
    window.speechSynthesis.speak(u);
    return stop;
  }, [playing, si, li, lang, muted, rate, line, scene, advance, stop]);

  useEffect(() => stop, [stop]);

  if (!scenes.length) return null;
  const go = (n: number) => { setSi(Math.max(0, Math.min(scenes.length - 1, n))); setLi(0); };
  const Prev = lang === "ar" ? ChevronRight : ChevronLeft;
  const Next = lang === "ar" ? ChevronLeft : ChevronRight;
  const ended = !playing && si === scenes.length - 1 && li === Math.max(0, scene.lines.length - 1) && pos > 0;

  return (
    <section aria-label={t.title} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card" dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}>
      <div className="relative aspect-video overflow-hidden text-white" style={{ background: "linear-gradient(135deg, var(--accent-dark, #0b4a44), var(--accent, #0e5e57))" }}>
        <div aria-hidden className="pointer-events-none absolute -end-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -start-10 h-72 w-72 rounded-full bg-black/10 blur-2xl" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/80 sm:px-6">
          <span className="truncate">{title}</span>
          <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1">{t.scene} {si + 1} / {scenes.length}</span>
        </div>
        <div key={`${lang}-${si}`} className="absolute inset-0 flex flex-col items-center justify-center px-6 pb-20 pt-12 text-center sm:px-14 animate-fade-up">
          {scene.onScreen
            ? <p className="max-w-3xl text-2xl font-extrabold leading-tight drop-shadow sm:text-4xl">{scene.onScreen}</p>
            : <p className="max-w-2xl text-sm italic leading-relaxed text-white/75 sm:text-base">{scene.visual}</p>}
        </div>
        {line && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-10 sm:px-8">
            <p key={`${si}-${li}`} className="mx-auto max-w-3xl text-center text-sm font-medium leading-relaxed sm:text-lg animate-pop"><Captions size={16} className="me-2 inline-block opacity-70" aria-hidden />{line}</p>
          </div>
        )}
        {!playing && (
          <button type="button" onClick={() => { if (ended) { setSi(0); setLi(0); } setPlaying(true); }} className="absolute inset-0 m-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/90 text-[var(--accent-dark,#0b4a44)] shadow-lift transition-transform hover:scale-105" aria-label={ended ? t.restart : t.play}>
            {ended ? <RotateCcw size={34} aria-hidden /> : <Play size={36} className="ms-1" aria-hidden />}
          </button>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20"><div className="h-full bg-white transition-[width] duration-500" style={{ width: `${Math.round(((pos + (playing ? 1 : 0)) / Math.max(1, total)) * 100)}%` }} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2 text-sm">
        <button type="button" className="btn-secondary !px-3 !py-1.5" onClick={() => setPlaying((p) => !p)} aria-label={playing ? t.pause : t.play}>{playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}</button>
        <button type="button" className="btn-secondary !px-3 !py-1.5" onClick={() => go(si - 1)} disabled={si === 0} aria-label={t.prev}><Prev size={16} aria-hidden /></button>
        <button type="button" className="btn-secondary !px-3 !py-1.5" onClick={() => go(si + 1)} disabled={si === scenes.length - 1} aria-label={t.next}><Next size={16} aria-hidden /></button>
        <button type="button" className="btn-secondary !px-3 !py-1.5" onClick={() => setMuted((m) => !m)} aria-label={muted ? t.unmute : t.mute} aria-pressed={muted}>{muted ? <VolumeX size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />}</button>
        <label className="flex items-center gap-1 text-xs text-muted">{t.speed}
          <select className="input !w-auto !py-1 !text-xs" value={rate} onChange={(e) => setRate(Number(e.target.value))}>{[0.8, 1, 1.2, 1.4].map((r) => <option key={r} value={r}>{r}×</option>)}</select>
        </label>
        {langs.length > 1 && (
          <div className="ms-auto flex overflow-hidden rounded-lg border border-border text-xs font-semibold" role="group" aria-label="Language">
            {langs.map((k) => <button key={k} type="button" onClick={() => { setPlaying(false); setLang(k); setSi(0); setLi(0); }} aria-pressed={lang === k} className={`px-3 py-1.5 ${lang === k ? "bg-primary text-white" : "hover:bg-primary-light"}`}>{k === "ar" ? "العربية" : "English"}</button>)}
          </div>
        )}
        <p className="w-full text-xs text-muted">{voiceOk ? t.narrated : t.noVoice}</p>
      </div>
    </section>
  );
}
