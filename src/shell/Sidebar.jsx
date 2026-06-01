import { useState } from "react";
import { X } from "lucide-react";
import argusLogo from "../assets/argus_logo_canvas_filled.tight.png";

export default function Sidebar({ activeNav, onSelect, navItems = [] }) {
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <>
      <aside className="border-r border-slate-800 bg-slate-950/90 px-4 py-5">
        <div className="mb-6 px-1 py-1">
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            className="block w-full rounded-xl border border-transparent p-1 transition hover:border-emerald-400/30 hover:bg-emerald-500/5 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            aria-label="About ARGUS"
            title="About ARGUS"
          >
            <img
              src={argusLogo}
              alt="ARGUS Operator Interface"
              className="block h-auto w-full object-contain"
            />
          </button>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item}
              onClick={() => onSelect(item)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                activeNav === item
                  ? "bg-emerald-500/15 text-emerald-200"
                  : "text-slate-300 hover:bg-slate-800/70"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>

      {aboutOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">About</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-50">ARGUS Operator Interface</h2>
              </div>

              <button
                type="button"
                onClick={() => setAboutOpen(false)}
                className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 transition hover:bg-slate-800"
                aria-label="Close About ARGUS"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm leading-6 text-slate-300">
              <p>
                ARGUS is a dispatcher-mediated coordination console for structured records,
                responder workflow, Matrix alerts, and operational audit history.
              </p>

              <p>
                <span className="font-semibold text-slate-100">Version:</span>{" "}
                <span className="font-mono text-emerald-200">v0.9.1</span>
              </p>

              <p>
                ARGUS stores operational state in the application. Matrix is used for
                communication and alert delivery.
              </p>

              <div className="border-l-2 border-amber-400/70 bg-amber-500/5 py-2 pl-4 text-amber-100">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                  Operational Notice
                </p>
                <p className="mt-1">
                  ARGUS is not emergency services software and does not replace professional
                  emergency response. Operators remain responsible for escalation decisions and
                  local operational compliance.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
