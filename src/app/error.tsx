"use client";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center" role="alert">
      <h1 className="text-2xl font-semibold text-primary-dark">Something went wrong</h1>
      <p className="mt-3 text-muted">An unexpected error occurred. Please try again.</p>
      <button onClick={reset} className="btn-primary mt-8">Try again</button>
    </div>
  );
}
