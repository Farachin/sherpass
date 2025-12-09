"use client";

import { Trash2 } from "lucide-react";
import type { Shipment } from "@/types/database";

type ShipmentCardProps = {
  shipment: Shipment;
  index: number;
  onDelete: (shipmentId: string) => void;
};

export function ShipmentCard({ shipment, index, onDelete }: ShipmentCardProps) {
  return (
    <div
      key={shipment.id || `shipment-${index}`}
      className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm"
    >
      <div>
        <div className="font-bold text-lg">{shipment.content_desc}</div>
        <div className="text-xs text-slate-500 mt-1">
          {shipment.weight_kg} kg · {shipment.value_eur}€ · {shipment.status}
        </div>
      </div>
      <button
        onClick={() => onDelete(shipment.id)}
        className="p-2 hover:bg-red-50 text-red-400 rounded transition"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
