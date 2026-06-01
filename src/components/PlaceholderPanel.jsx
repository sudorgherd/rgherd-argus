import { Panel } from "./ui";

export default function PlaceholderPanel({ title, subtitle, icon: Icon, children }) {
  return (
    <Panel
      title={title}
      subtitle={subtitle}
      icon={Icon}
      className="flex h-[420px] min-h-[420px] flex-col"
    >
      <div className="flex-1 overflow-y-auto">
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 px-3 py-4 text-sm text-slate-400">
          {children}
        </div>
      </div>
    </Panel>
  );
}
