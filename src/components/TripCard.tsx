"use client";

import { Trash2 } from "lucide-react";
import type { Trip } from "@/types/database";

type TripCardProps = {
  trip: Trip;
  onDelete: (tripId: string) => void;
};

export function TripCard({ trip, onDelete }: TripCardProps) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm">
      <div>
        <div className="font-bold text-lg">
          {trip.origin} ➔ {trip.destination}
        </div>
        <div className="text-xs text-slate-500 mt-1">
          {new Date(trip.date).toLocaleDateString("de-DE")} · {trip.capacity_kg}{" "}
          kg frei
        </div>
      </div>
      <button
        onClick={() => onDelete(trip.id)}
        className="p-2 hover:bg-red-50 text-red-400 rounded transition"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
