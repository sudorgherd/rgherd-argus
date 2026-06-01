import { HeartPulse, Scale, ShieldAlert, Truck, Users, Wrench } from "lucide-react";

function getCategoryIcon(category) {
  switch (category) {
    case "Safety / Threat / Health":
      return ShieldAlert;
    case "Basic Needs (Shelter / Food / Supplies)":
      return HeartPulse;
    case "Escort / Transport":
      return Truck;
    case "Legal Support / Observer":
      return Scale;
    case "Logistics / Coordination":
      return Wrench;
    default:
      return Users;
  }
}

export default function CategoryBadge({ category }) {
  const Icon = getCategoryIcon(category);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-200">
      <Icon className="h-3.5 w-3.5" />
      <span>{category || "Uncategorized"}</span>
    </span>
  );
}
