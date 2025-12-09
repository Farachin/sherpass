"use client";

import { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon: LucideIcon;
  message: string;
  description?: string;
};

export function EmptyState({
  icon: Icon,
  message,
  description,
}: EmptyStateProps) {
  return (
    <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400">
      <Icon size={48} className="mx-auto mb-4 opacity-50" />
      <p>{message}</p>
      {description && <p className="text-xs mt-2">{description}</p>}
    </div>
  );
}
