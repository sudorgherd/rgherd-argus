import IntakeForm from "./IntakeForm";

export default function IntakeView({ onCreated, zones = [] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-panel p-6 shadow-soft">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Report Intake</p>
      <h2 className="mt-2 text-xl font-semibold text-slate-100">Create Record</h2>
      <p className="mt-3 text-sm text-slate-400">
        Universal intake form for creating a new ARGUS operational record.
      </p>

      <div className="mt-6">
        <IntakeForm onCreated={onCreated} zones={zones} />
      </div>
    </div>
  );
}
