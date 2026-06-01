import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";

export default function TopBar({
  operatorLabel,
  operatorProfileLabel,
  operatorUsername,
  onSignOut,
}) {
  const [currentTime, setCurrentTime] = useState(() => new Date().toLocaleTimeString());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 px-6 py-4 backdrop-blur">
      <div className="flex min-h-9 items-center justify-end gap-4 text-xs text-slate-300">
        <div className="text-right leading-tight">
          <div className="font-semibold text-slate-100">{operatorLabel || "—"}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {operatorProfileLabel || "No operational profile"}
            {operatorUsername ? <span> · {operatorUsername}</span> : null}
          </div>
        </div>

        <span className="inline-flex w-[112px] shrink-0 items-center justify-end gap-1 font-mono tabular-nums text-slate-300">
          <Clock3 size={14} /> {currentTime}
        </span>

        <button
          type="button"
          onClick={() => {
            if (onSignOut) {
              onSignOut();
              return;
            }
            window.location.href = "/logout";
          }}
          className="inline-flex items-center rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
