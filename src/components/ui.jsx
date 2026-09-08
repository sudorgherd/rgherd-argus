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

export function DetailStat({ label, value, className = "" }) {
  return (
    <div className={`rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-3 text-sm ${className}`}>
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-slate-100">{value}</p>
    </div>
  );
}

export function EmptyState({ children }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}

export function ActionButton({ tone = "primary", className = "", ...props }) {
  const tones = {
    primary: "border-cyan-400/40 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25",
    neutral: "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800",
    danger: "border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20",
  };
  return (
    <button
      type="button"
      className={`rounded-lg border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
