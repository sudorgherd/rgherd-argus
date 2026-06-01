export function Panel({ title, icon: Icon, subtitle, children, className = "" }) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-panel p-4 shadow-soft ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        {Icon && <Icon size={17} className="shrink-0 text-slate-300" />}
      </div>
      {children}
    </div>
  );
}

export function Tag({ children, className = "" }) {
  return (
    <span className={`rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300 ${className}`}>
      {children}
    </span>
  );
}

export function DetailStat({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-3 text-sm">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-slate-100">{value}</p>
    </div>
  );
}
