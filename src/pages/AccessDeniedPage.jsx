export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen bg-canvas text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-4 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-slate-800 bg-panel p-8 shadow-soft sm:p-10">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Restricted Access
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-white sm:text-5xl">
            Access Denied
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
            Your sign-in was successful, but this account is not currently approved for ARGUS operator access.
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">
            ARGUS access requires both a configured identity provider account and explicit ARGUS
            operator approval.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/8 px-3.5 py-2 text-sm font-medium text-emerald-50">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              Authentication confirmed
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/8 px-3.5 py-2 text-sm font-medium text-amber-50">
              <span className="h-2 w-2 rounded-full bg-amber-300" />
              Approval required
            </span>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/"
              className="inline-flex min-w-[190px] items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 px-5 py-3.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
            >
              Return to home
            </a>
            <a
              href="/"
              className="inline-flex min-w-[190px] items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-5 py-3.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
            >
              Open identity provider
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
