import QRCode from "qrcode";
import { categoryIcon } from "./icons";
import { categoryTheme } from "@/lib/category-theme";
import { CertificateClassic } from "./CertificateClassic";

export interface Signatory { name?: string; title?: string; titleAr?: string }
export interface CertificateData {
  publicId: string;
  recipientName: string;
  courseTitle: string;
  courseTitleAr?: string | null;
  courseCode?: string | null;
  categorySlug?: string | null;
  categoryName?: string | null;
  categoryNameAr?: string | null;
  issuedAt: Date;
  renewedAt?: Date | null;
  expiresAt?: Date | null;
  durationMinutes: number;
  lessonCount: number;
  topics: string[];
  issuerName: string;
  issuerNameAr?: string | null;
  verifyUrl: string;
  logoSrc?: string | null;
  signatories?: Signatory[];
  template?: string;
}

const GOLD = "linear-gradient(120deg,#8a6a22 0%,#c9a24a 22%,#f3df9b 45%,#d4ac52 62%,#9a7628 85%,#c9a24a 100%)";
const gold = { backgroundImage: GOLD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } as const;
const fmt = (d: Date, l: "en" | "ar") => d.toLocaleDateString(l === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long", year: "numeric" });

/** Picks the design chosen in Admin → Settings (default: the bilingual "Lotus gold" design). */
export async function CertificateView({ c }: { c: CertificateData }) {
  return c.template === "classic" ? <CertificateClassic c={c} /> : <CertificateGold c={c} />;
}

/** Bilingual landscape A4 certificate: Lotus-green side panel with gold seal, course-themed accents, QR verification. */
async function CertificateGold({ c }: { c: CertificateData }) {
  const th = categoryTheme(c.categorySlug);
  const Icon = categoryIcon(c.categorySlug);
  const qr = await QRCode.toString(c.verifyUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0b3f39", light: "#0000" } });
  const hours = c.durationMinutes >= 60 ? `${Math.round(c.durationMinutes / 6) / 10}` : null;
  const date = c.renewedAt ?? c.issuedAt;
  const sigs = (c.signatories?.length ? c.signatories : [{}, {}]).slice(0, 2).map((s, i) => ({
    name: s.name || (i === 0 ? c.issuerName : ""),
    title: s.title || (i === 0 ? "Academy Director" : "Head of Training"),
    titleAr: s.titleAr || (i === 0 ? "مدير الأكاديمية" : "رئيس قطاع التدريب"),
  }));
  const details: [string, string, string][] = [
    ["Course code", "رمز الكورس", c.courseCode ?? "—"],
    ...(hours ? [["Training hours", "ساعات التدريب", hours] as [string, string, string]] : []),
    ["Lessons", "الدروس", String(c.lessonCount)],
    [c.renewedAt ? "Renewed" : "Completed", c.renewedAt ? "تاريخ التجديد" : "تاريخ الإتمام", fmt(date, "en")],
    ...(c.expiresAt ? [["Valid until", "صالحة حتى", fmt(c.expiresAt, "en")] as [string, string, string]] : []),
  ];

  return (
    <div className="cert-sheet relative mx-auto aspect-[1.4142/1] w-full max-w-[1123px] overflow-hidden bg-[#fbf8f0] text-[#14211d] shadow-lift [container-type:inline-size] print:max-w-none print:shadow-none" dir="ltr">
      {/* guilloche background */}
      <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 1414 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#0e5e57" fillOpacity=".05" /></pattern>
        </defs>
        <rect width="1414" height="1000" fill="url(#dots)" />
        <g fill="none" stroke="#b8933f" strokeOpacity=".16" strokeWidth="1">
          {Array.from({ length: 26 }, (_, i) => <ellipse key={i} cx="1230" cy="880" rx={120 + i * 22} ry={90 + i * 17} transform={`rotate(${i * 7} 1230 880)`} />)}
        </g>
        <g fill="none" stroke="#0e5e57" strokeOpacity=".06" strokeWidth="1.2">
          {Array.from({ length: 18 }, (_, i) => <circle key={i} cx="1300" cy="90" r={30 + i * 18} />)}
        </g>
      </svg>

      {/* gold frame */}
      <div className="absolute inset-[1.6%] rounded-[2px] border-[0.25cqw] border-transparent [border-image:linear-gradient(120deg,#8a6a22,#e9cf82,#9a7628,#e9cf82,#8a6a22)_1]" />
      <div className="absolute inset-[2.4%] border border-[#c9a24a]/50" />

      {/* left panel */}
      <div className="absolute inset-y-[2.4%] start-[2.4%] flex w-[26%] flex-col items-center px-[2.2%] py-[3%] text-center text-white" style={{ background: "linear-gradient(165deg,#0a3b35 0%,#0e5e57 55%,#0b4a44 100%)" }}>
        <div aria-hidden className="absolute inset-y-0 end-0 w-[0.45cqw]" style={{ backgroundImage: GOLD }} />
        <svg aria-hidden className="absolute inset-0 h-full w-full opacity-[.07]" viewBox="0 0 100 160" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="#fff" strokeWidth=".3">{Array.from({ length: 14 }, (_, i) => <path key={i} d={`M50 ${160 - i * 9} C ${20 - i} ${120 - i * 9}, ${80 + i} ${120 - i * 9}, 50 ${160 - i * 9}`} />)}</g></svg>
        {c.logoSrc
          ? /* eslint-disable-next-line @next/next/no-img-element */ <div className="relative rounded-[0.8cqw] bg-white px-[1.4cqw] py-[0.8cqw] shadow"><img src={c.logoSrc} alt="" className="h-[4.2cqw] w-auto max-w-[17cqw] object-contain" /></div>
          : <div className="relative flex items-center gap-[0.8cqw]"><svg viewBox="0 0 64 64" className="h-[4.4cqw] w-[4.4cqw]" aria-hidden><circle cx="32" cy="32" r="29" fill="none" stroke="#fff" strokeWidth="3.5" /><path d="M32 12c8 7 11 17 0 33-11-16-8-26 0-33z" fill="#fff" /><path d="M32 46C22 44 14 36 12 26c9 0 17 5 20 20zM32 46c10-2 18-10 20-20-9 0-17 5-20 20z" fill="#fff" fillOpacity=".75" /></svg><span className="text-[2.6cqw] font-extrabold tracking-wide">LOTUS</span></div>}
        <p className="relative mt-[1cqw] text-[0.95cqw] font-bold uppercase tracking-[0.35em] text-white/85">Academy</p>
        <p className="relative text-[1.2cqw] font-semibold text-white/90" lang="ar">أكاديمية لوتس</p>

        {/* seal */}
        <div className="relative my-auto h-[17cqw] w-[17cqw]">
          <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8a6a22" /><stop offset=".3" stopColor="#e9cf82" /><stop offset=".55" stopColor="#c9a24a" /><stop offset=".8" stopColor="#f3df9b" /><stop offset="1" stopColor="#8a6a22" /></linearGradient>
              <path id="ring" d="M100 100 m-74 0 a74 74 0 1 1 148 0 a74 74 0 1 1 -148 0" />
            </defs>
            {Array.from({ length: 48 }, (_, i) => <path key={i} d="M100 2 L104 14 L96 14 Z" fill="url(#g)" transform={`rotate(${i * 7.5} 100 100)`} />)}
            <circle cx="100" cy="100" r="88" fill="url(#g)" />
            <circle cx="100" cy="100" r="84" fill="#0b4a44" />
            <circle cx="100" cy="100" r="62" fill="none" stroke="url(#g)" strokeWidth="1.5" />
            <text fill="#f3df9b" fontSize="11.5" fontWeight="700" letterSpacing="2.4"><textPath href="#ring" startOffset="0">LOTUS ACADEMY • CERTIFIED • LOTUS PHARMACIES •</textPath></text>
            <circle cx="100" cy="100" r="54" fill={th.accent} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Icon className="h-[4.4cqw] w-[4.4cqw] text-white" strokeWidth={1.6} aria-hidden />
            <span className="mt-[0.3cqw] text-[1.05cqw] font-extrabold tracking-wider text-white">{date.getFullYear()}</span>
          </div>
        </div>

        <p className="relative text-[0.9cqw] font-bold uppercase tracking-[0.25em]" style={gold}>{c.categoryName ?? th.label}</p>
        {c.categoryNameAr && <p className="relative text-[1cqw] text-white/80" lang="ar">{c.categoryNameAr}</p>}

        <div className="relative mt-[2cqw] flex items-center gap-[1cqw] rounded-[0.6cqw] bg-white p-[0.6cqw] text-start text-[#0b3f39]">
          <div className="h-[6.4cqw] w-[6.4cqw] shrink-0" dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="pe-[0.4cqw]">
            <p className="text-[0.7cqw] uppercase tracking-wider text-[#5b6b66]">Certificate ID · رقم الشهادة</p>
            <p className="font-mono text-[1.05cqw] font-bold">{c.publicId}</p>
            <p className="mt-[0.2cqw] text-[0.7cqw] text-[#5b6b66]">Scan to verify · امسح للتحقق</p>
          </div>
        </div>
      </div>

      {/* main content */}
      <div className="absolute inset-y-[2.4%] end-[2.4%] start-[28.4%] flex flex-col items-center px-[4%] pb-[3.2%] pt-[4%] text-center">
        <p className="flex items-center gap-[1cqw] text-[1.05cqw] font-bold"><span className="uppercase tracking-[0.5em]" style={gold}>Lotus Pharmacies</span><span style={gold}>·</span><span lang="ar" style={gold}>صيدليات لوتس</span></p>
        <h2 className="mt-[1.4cqw] font-serif text-[5.4cqw] leading-[0.95] tracking-tight text-[#0b3f39]">Certificate</h2>
        <p className="mt-[0.5cqw] text-[1.5cqw] font-semibold uppercase tracking-[0.45em]" style={gold}>of Completion</p>
        <p className="mt-[0.2cqw] text-[2cqw] font-bold text-[#0e5e57]" lang="ar" dir="rtl">شهادة إتمام</p>

        <svg aria-hidden viewBox="0 0 300 16" className="mt-[1cqw] h-[1.2cqw] w-[24cqw]"><defs><linearGradient id="d" x1="0" x2="1"><stop offset="0" stopColor="#c9a24a" stopOpacity="0" /><stop offset=".5" stopColor="#c9a24a" /><stop offset="1" stopColor="#c9a24a" stopOpacity="0" /></linearGradient></defs><path d="M0 8h125M175 8h125" stroke="url(#d)" strokeWidth="1.5" /><path d="M150 1l7 7-7 7-7-7z" fill="#c9a24a" /><circle cx="134" cy="8" r="2" fill="#c9a24a" /><circle cx="166" cy="8" r="2" fill="#c9a24a" /></svg>

        <div className="mt-[1.2cqw] flex w-full items-center justify-between gap-[2cqw] text-[1.15cqw] text-[#5b6b66]"><span>This is to certify that</span><span lang="ar" dir="rtl">تشهد أكاديمية لوتس بأن</span></div>
        <p className="mt-[0.4cqw] w-full font-serif text-[4cqw] italic leading-tight text-[#0b3f39]">{c.recipientName}</p>
        <div aria-hidden className="mx-auto mt-[0.3cqw] h-[0.18cqw] w-[70%]" style={{ backgroundImage: GOLD }} />
        <div className="mt-[1cqw] flex w-full items-center justify-between gap-[2cqw] text-[1.15cqw] text-[#5b6b66]"><span>has successfully completed the professional training programme</span><span lang="ar" dir="rtl">قد أتمّ بنجاح البرنامج التدريبي</span></div>
        <p className="mt-[0.6cqw] text-[2.3cqw] font-extrabold leading-tight text-[#0b3f39]">{c.courseTitle}</p>
        {c.courseTitleAr && <p className="mt-[0.2cqw] text-[1.8cqw] font-bold leading-snug" style={{ color: th.dark }} lang="ar" dir="rtl">{c.courseTitleAr}</p>}

        <dl className="mt-[1.4cqw] flex flex-wrap items-stretch justify-center overflow-hidden rounded-[0.8cqw] border text-[0.95cqw]" style={{ borderColor: `${th.accent}55`, background: th.soft }}>
          {details.map(([en, ar, v], i) => (
            <div key={en} className={`px-[1.3cqw] py-[0.55cqw] ${i ? "border-s" : ""}`} style={{ borderColor: `${th.accent}33` }}>
              <dt className="text-[0.75cqw] uppercase tracking-wider text-[#5b6b66]">{en} · <span lang="ar">{ar}</span></dt>
              <dd className="font-bold text-[#0b3f39]">{v}</dd>
            </div>
          ))}
        </dl>
        {c.topics.length > 0 && <p className="mt-[1cqw] max-w-[92%] text-[0.85cqw] leading-relaxed text-[#5b6b66]"><span className="font-bold" style={{ color: th.dark }}>Topics: </span>{c.topics.join(" · ")}</p>}

        <div className="mt-auto grid w-full grid-cols-2 gap-[6cqw] pt-[1cqw]">
          {sigs.map((s, i) => (
            <div key={i} className="text-center">
              <div className="flex h-[3cqw] items-end justify-center font-serif text-[2cqw] italic text-[#0b3f39]/80">{s.name}</div>
              <div className="mx-auto h-px w-[85%] bg-[#14211d]/40" />
              <p className="mt-[0.4cqw] text-[1cqw] font-bold text-[#0b3f39]">{s.title}</p>
              <p className="text-[0.95cqw] text-[#5b6b66]" lang="ar" dir="rtl">{s.titleAr}</p>
            </div>
          ))}
        </div>
        <p className="mt-[1cqw] text-[0.75cqw] text-[#7b8a85]">Verify this certificate at {c.verifyUrl.replace(/\/verify\/certificate\/.*/, "")}/verify/certificate · © Lotus Pharmacies</p>
      </div>
    </div>
  );
}
