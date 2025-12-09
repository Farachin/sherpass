"use client";

import { Clock, CheckCircle, XCircle, Package, Plane } from "lucide-react";
import { LucideIcon } from "lucide-react";

type StatusInfo = {
  label: string;
  color: string;
  icon: LucideIcon;
};

const statusMap: Record<string, StatusInfo> = {
  pending: {
    label: "Ausstehend",
    color: "bg-yellow-100 text-yellow-700",
    icon: Clock,
  },
  accepted: {
    label: "Akzeptiert",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle,
  },
  rejected: {
    label: "Abgelehnt",
    color: "bg-red-100 text-red-700",
    icon: XCircle,
  },
  shipping_to_sherpa: {
    label: "Unterwegs zum Sherpa",
    color: "bg-blue-100 text-blue-700",
    icon: Package,
  },
  in_transit: {
    label: "In Transit",
    color: "bg-blue-100 text-blue-700",
    icon: Plane,
  },
  delivered: {
    label: "Zugestellt",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle,
  },
};

type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusInfo = statusMap[status.toLowerCase()] || {
    label: status,
    color: "bg-slate-100 text-slate-700",
    icon: Clock,
  };
  const Icon = statusInfo.icon;

  return (
    <span
      className={`${statusInfo.color} px-2 py-1 rounded text-xs font-bold flex items-center gap-1`}
    >
      <Icon size={12} /> {statusInfo.label}
    </span>
  );
}
