"use client";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, X } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };
const SUGGESTIONS = ["Summarize this lesson in 5 points", "Explain the key idea simply", "Give me a memory trick", "Quiz me on this lesson"];

export function AssistantChat({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || loaded) return;
    fetch(`/api/assistant?courseId=${encodeURIComponent(courseId)}`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) { setMsgs(d.messages); setAi(d.ai); } setLoaded(true); }).catch(() => setLoaded(true));
  }, [open, loaded, courseId]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy, open]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput(""); setBusy(true);
    setMsgs((m) => [...m, { role: "user", content: message }]);
    try {
      const r = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId, lessonId, message }) });
      const d = await r.json();
      setMsgs((m) => [...m, { role: "assistant", content: r.ok ? d.reply : d.error ?? "Something went wrong." }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "I couldn't reach the server. Please try again." }]);
    } finally { setBusy(false); }
  }

  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} className="fixed bottom-5 end-5 z-40 flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lift transition-transform hover:scale-105 print:hidden" style={{ background: "linear-gradient(135deg, var(--accent, #006F3C), var(--accent-dark, #004A28))" }} aria-label="Open study assistant">
          <Sparkles size={18} aria-hidden className="animate-pulse" /> Ask the assistant
        </button>
      )}
      {open && (
        <section role="dialog" aria-label="Study assistant" className="fixed bottom-4 end-4 z-50 flex h-[min(34rem,calc(100vh-2rem))] w-[min(24rem,calc(100vw-2rem))] animate-fade-up flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-lift print:hidden">
          <header className="flex items-center justify-between px-4 py-3 text-white" style={{ background: "linear-gradient(135deg, var(--accent, #006F3C), var(--accent-dark, #004A28))" }}>
            <div className="flex items-center gap-2"><Bot size={20} aria-hidden /><div><p className="text-sm font-bold leading-tight">Study assistant</p><p className="text-[11px] text-white/80">{ai ? "Answers from your lesson" : "Search mode (AI not enabled)"}</p></div></div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-white/20" aria-label="Close assistant"><X size={18} aria-hidden /></button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto bg-background p-4 text-sm" aria-live="polite">
            {!msgs.length && loaded && (
              <div className="space-y-3">
                <p className="text-muted">Hi! I can explain this lesson, summarize it, give you memory tricks or quiz you. What would you like?</p>
                <div className="flex flex-wrap gap-2">{SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:border-primary hover:text-primary">{s}</button>)}</div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <p dir="auto" className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 leading-6 ${m.role === "user" ? "rounded-ee-sm text-white" : "rounded-es-sm border border-border bg-surface"}`} style={m.role === "user" ? { background: "var(--accent, #006F3C)" } : undefined}>{m.content}</p>
              </div>
            ))}
            {busy && <div className="flex gap-1 px-2" aria-label="Assistant is typing">{[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d * 120}ms` }} />)}</div>}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t border-border bg-surface p-3">
            <div className="flex items-end gap-2">
              <label htmlFor="assistant-input" className="sr-only">Your question</label>
              <textarea id="assistant-input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} rows={1} maxLength={1000} placeholder="Ask about this lesson…" className="input max-h-28 min-h-[42px] resize-none" />
              <button type="submit" disabled={busy || !input.trim()} className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg text-white disabled:opacity-50" style={{ background: "var(--accent, #006F3C)" }} aria-label="Send"><Send size={18} aria-hidden /></button>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-muted">Learning aid only — not for patient-specific decisions. Verify against your guidelines.</p>
          </form>
        </section>
      )}
    </>
  );
}
