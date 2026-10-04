import QRCode from "qrcode";
import { Award } from "lucide-react";
import { categoryIcon } from "./icons";
import { categoryTheme as certificateTheme } from "@/lib/category-theme";

export interface CertificateData {
  publicId: string;
  recipientName: string;
  courseTitle: string;
  courseTitleAr?: string | null;
  courseCode?: string | null;
  categorySlug?: string | null;
  categoryName?: string | null;
  issuedAt: Date;
  durationMinutes: number;
  lessonCount: number;
  topics: string[];
  issuerName: string;
  verifyUrl: string;
  logoSrc?: string | null;
}

/** Landscape A4 certificate, dedicated to one course (theme, icon, topics, QR). Prints edge-to-edge. */
export async function CertificateView({ c }: { c: CertificateData }) {
  const th = certificateTheme(c.categorySlug);
  const Icon = categoryIcon(c.categorySlug);
  const qr = await QRCode.toString(c.verifyUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#121C18", light: "#0000" } });
  const hours = c.durationMinutes >= 60 ? `${Math.round(c.durationMinutes / 6) / 10} hours` : `${c.durationMinutes} minutes`;
  const date = c.issuedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="cert-sheet relative mx-auto aspect-[1.4142/1] w-full max-w-[1123px] overflow-hidden bg-white text-[#121C18] shadow-lift print:max-w-none print:shadow-none" dir="ltr" style={{ ["--accent" as string]: th.accent, ["--soft" as string]: th.soft }}>
      {/* frame */}
      <div className="absolute inset-[14px] border-[3px] border-primary" />
      <div className="absolute inset-[24px] border" style={{ borderColor: "var(--accent)" }} />
      {["left-[14px] top-[14px]", "right-[14px] top-[14px] rotate-90", "bottom-[14px] right-[14px] rotate-180", "bottom-[14px] left-[14px] -rotate-90"].map((p) => (
        <svg key={p} viewBox="0 0 60 60" className={`absolute h-14 w-14 ${p}`} aria-hidden><path d="M0 0h60v6H6v54H0z" className="fill-primary" /><path d="M14 14h30v3H17v27h-3z" style={{ fill: "var(--accent)" }} /></svg>
      ))}
      {/* course watermark */}
      <Icon className="absolute -end-10 top-1/2 h-[26rem] w-[26rem] -translate-y-1/2" strokeWidth={0.6} style={{ color: "var(--accent)", opacity: 0.07 }} aria-hidden />
      <div className="absolute inset-y-[24px] start-[24px] w-3" style={{ background: "var(--accent)" }} />

      <div className="relative flex h-full flex-col px-[8%] py-[5.5%] ps-[9%] text-center">
        <div className="flex items-center justify-center gap-4">
          {c.logoSrc
            ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.logoSrc} alt="" className="h-14 w-auto max-w-[220px] object-contain" />
            : <><svg viewBox="0 0 64 64" className="h-12 w-12" aria-hidden><circle cx="32" cy="32" r="29" fill="none" className="stroke-primary" strokeWidth="3.5" /><path d="M32 12c8 7 11 17 0 33-11-16-8-26 0-33z" className="fill-primary" /><path d="M32 46C22 44 14 36 12 26c9 0 17 5 20 20zM32 46c10-2 18-10 20-20-9 0-17 5-20 20z" className="fill-primary" fillOpacity=".7" /></svg><span className="text-3xl font-extrabold tracking-wide text-primary">LOTUS</span></>}
          <span className="h-9 w-px bg-black/20" />
          <span className="text-left text-xs font-bold uppercase leading-tight tracking-[0.25em] text-primary-dark">Academy<br /><span className="font-medium tracking-normal">أكاديمية لوتس</span></span>
        </div>

        <p className="mt-[2.2%] text-[11px] font-bold uppercase tracking-[0.4em]" style={{ color: "var(--accent)" }}>{c.categoryName ?? th.label}</p>
        <h2 className="mt-1 font-serif text-[clamp(1.6rem,4.2vw,3.1rem)] leading-none text-primary-dark">Certificate of Completion</h2>
        <p className="mt-1 text-sm text-[#607068]" dir="rtl" lang="ar">شهادة إتمام</p>

        <p className="mt-[2.4%] text-sm text-[#607068]">This is to certify that</p>
        <p className="mx-auto mt-1 w-full max-w-[85%] border-b pb-1 font-serif text-[clamp(1.5rem,4vw,2.9rem)] leading-tight" style={{ borderColor: "var(--accent)" }}>{c.recipientName}</p>
        <p className="mt-[1.6%] text-sm text-[#607068]">has successfully completed the professional course</p>
        <p className="mt-1 text-[clamp(1.1rem,2.5vw,1.9rem)] font-bold leading-snug text-primary-dark">{c.courseTitle}</p>
        {c.courseTitleAr && <p className="text-[clamp(.9rem,1.7vw,1.25rem)] text-[#405048]" dir="rtl" lang="ar">{c.courseTitleAr}</p>}

        <dl className="mx-auto mt-[1.8%] flex flex-wrap items-center justify-center gap-x-8 gap-y-1 rounded-full px-6 py-1.5 text-xs" style={{ background: "var(--soft)" }}>
          {[["Course code", c.courseCode ?? "—"], ["Duration", hours], ["Lessons", String(c.lessonCount)], ["Completed", date]].map(([k, v]) => (
            <div key={k} className="flex gap-2"><dt className="text-[#607068]">{k}</dt><dd className="font-semibold">{v}</dd></div>
          ))}
        </dl>
        {c.topics.length > 0 && (
          <p className="mx-auto mt-[1.4%] max-w-[88%] text-[11px] leading-5 text-[#607068]"><span className="font-semibold" style={{ color: "var(--accent)" }}>Topics covered: </span>{c.topics.join(" · ")}</p>
        )}

        <div className="mt-auto grid grid-cols-[1fr_auto_1fr] items-end gap-6 text-xs">
          <div className="text-left">
            <div className="mb-1 h-8 border-b border-black/40" />
            <p className="font-semibold">{c.issuerName}</p><p className="text-[#607068]">Academy Director</p>
          </div>
          {/* seal */}
          <div className="relative flex h-24 w-24 items-center justify-center">
            <svg viewBox="0 0 100 100" className="absolute inset-0" aria-hidden><circle cx="50" cy="50" r="48" className="fill-primary" /><circle cx="50" cy="50" r="42" fill="none" stroke="white" strokeOpacity=".7" strokeDasharray="2 3" strokeWidth="1.5" /><circle cx="50" cy="50" r="33" style={{ fill: "var(--accent)" }} /></svg>
            <Award className="relative text-white" size={34} aria-hidden />
          </div>
          <div className="flex items-end justify-end gap-3 text-right">
            <div><p className="text-[#607068]">Certificate ID</p><p className="font-mono text-sm font-semibold">{c.publicId}</p><p className="mt-0.5 text-[10px] text-[#607068]">Verify: scan or visit<br />/verify/certificate</p></div>
            <div className="h-20 w-20 shrink-0 bg-white p-1" dangerouslySetInnerHTML={{ __html: qr }} />
          </div>
        </div>
      </div>
    </div>
  );
}
