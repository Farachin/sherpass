"use client";

import { useState, useEffect } from "react";
import { Trash2, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { StatusBadge } from "./StatusBadge";
import type { ShipmentWithRelations } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

type MyRequestCardProps = {
  request: ShipmentWithRelations;
  userId: string;
  onOpenChat: (
    conversationId: string,
    partnerId: string,
    partnerName: string,
    tripId?: string,
  ) => void;
  onDelete: (shipmentId: string) => void;
  getDeliveryCode: (shipment: ShipmentWithRelations) => string;
  supabase: SupabaseClient;
};

export function MyRequestCard({
  request,
  userId,
  onOpenChat,
  onDelete,
  getDeliveryCode,
  supabase,
}: MyRequestCardProps) {
  const [localStatus, setLocalStatus] = useState<string>(
    request.status || "pending",
  );

  useEffect(() => {
    if (request.status) {
      setLocalStatus(request.status);
    }
  }, [request.status]);

  const statusLower = (localStatus || "pending").toLowerCase();
  const showQRCode = statusLower === "accepted" || statusLower === "in_transit";

  const handleClick = async () => {
    if (request.trip_id) {
      const { data: tripData } = await supabase
        .from("trips")
        .select("user_id, sherpa_name")
        .eq("id", request.trip_id)
        .single();

      if (tripData) {
        const { data: existingConv } = await supabase
          .from("conversations")
          .select("id")
          .or(
            `and(participant1_id.eq.${userId},participant2_id.eq.${tripData.user_id}),and(participant1_id.eq.${tripData.user_id},participant2_id.eq.${userId})`,
          )
          .single();

        let convId = existingConv?.id;
        if (!convId) {
          const { data: newConv } = await supabase
            .from("conversations")
            .insert({
              participant1_id: userId,
              participant2_id: tripData.user_id,
            })
            .select()
            .single();
          if (newConv) convId = newConv.id;
        }

        if (convId) {
          onOpenChat(
            convId,
            tripData.user_id,
            tripData.sherpa_name,
            request.trip_id,
          );
        }
      }
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition">
      <div className="flex justify-between items-start">
        <div className="flex-1 cursor-pointer" onClick={handleClick}>
          <div className="font-bold text-lg mb-2">{request.content_desc}</div>
          <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
            <span>{request.weight_kg} kg</span>
            <span>·</span>
            <span>{request.value_eur}€</span>
            {request.trips && (
              <>
                <span>·</span>
                <span>
                  {request.trips.origin} ➔ {request.trips.destination}
                </span>
              </>
            )}
          </div>
          <div className="mt-2">
            <StatusBadge status={localStatus} />
          </div>

          {showQRCode && (
            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                <QrCode size={16} className="text-orange-500" /> Abhol-Code für
                Empfänger
              </h3>
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <QRCodeSVG
                    value={getDeliveryCode(request)}
                    size={120}
                    level="M"
                    includeMargin={true}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-600 mb-2">
                    Sende diesen QR-Code an deine Kontaktperson am Zielort. Der
                    Sherpa muss ihn scannen, um das Paket zu übergeben.
                  </p>
                  <div className="bg-white p-2 rounded border border-slate-200 font-mono text-xs text-slate-700 break-all">
                    {getDeliveryCode(request)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!request?.id) return;
            onDelete(request.id);
          }}
          className="p-2 hover:bg-red-50 text-red-400 rounded transition ml-4"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
