export const metadata = { title: "Offline" };

export default function Offline() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
      <div className="mb-6 h-16 w-16 rounded-2xl bg-primary-light" aria-hidden />
      <h1 className="text-2xl font-extrabold text-primary-dark">You are offline · أنت غير متصل</h1>
      <p className="mt-3 text-muted">Check your internet connection and try again. Your progress is saved on the server.</p>
      <p className="mt-1 text-muted" dir="rtl" lang="ar">تحقق من اتصال الإنترنت وحاول مرة أخرى. تقدّمك محفوظ على الخادم.</p>
      <a href="/dashboard" className="btn-primary mt-8">Try again · حاول مجددًا</a>
    </div>
  );
}
