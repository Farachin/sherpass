"use client";

import { useState, useEffect } from "react";
import {
  ShieldAlert,
  CheckCircle,
  XCircle,
  Luggage,
  Camera,
  MessageCircle,
} from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import type {
  BookingMessage,
  Shipment,
  ShipmentStatus,
} from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

type IncomingRequestCardProps = {
  request: BookingMessage;
  userId: string;
  calculateRemainingCapacity: (
    tripCapacity: number,
    shipments: Array<{ weight_kg: number; status: ShipmentStatus; id: string }>,
    excludeShipmentId?: string,
  ) => number;
  onToggle: (shipmentId: string, nextStatus: ShipmentStatus) => Promise<void>;
  onReject: (messageId: string, shipmentId: string, senderId: string) => void;
  onOpenChat: (
    conversationId: string,
    partnerId: string,
    partnerName: string,
    tripId?: string,
  ) => void;
  onStartQRScanner: (shipmentId: string) => void;
  supabase: SupabaseClient;
};

export function IncomingRequestCard({
  request,
  userId,
  calculateRemainingCapacity,
  onToggle,
  onReject,
  onOpenChat,
  onStartQRScanner,
  supabase,
}: IncomingRequestCardProps) {
  const shipment = request.shipments;
  const senderName = shipment?.sender_name || "User";
  const trip = shipment?.trips || shipment?.trip;

  const [localStatus, setLocalStatus] = useState<ShipmentStatus>(
    shipment?.status || "pending",
  );
  const [tripShipments, setTripShipments] = useState<
    Array<{ weight_kg: number; status: ShipmentStatus; id: string }>
  >([]);
  const [remainingCapacity, setRemainingCapacity] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (shipment?.trip_id && trip) {
      supabase
        .from("shipments")
        .select("id, weight_kg, status")
        .eq("trip_id", shipment.trip_id)
        .then(({ data }) => {
          if (data) {
            const typedData: Array<{
              weight_kg: number;
              status: ShipmentStatus;
              id: string;
            }> = data.map((s: Shipment) => ({
              weight_kg: s.weight_kg,
              status: s.status,
              id: s.id,
            }));
            setTripShipments(typedData);
            const statusLower = (localStatus || "pending").toLowerCase();
            const isPending = statusLower === "pending";
            const excludeId = isPending ? shipment.id : undefined;
            const remaining = calculateRemainingCapacity(
              trip.capacity_kg || 0,
              typedData,
              excludeId,
            );
            setRemainingCapacity(remaining);
          }
        });
    }
  }, [
    shipment?.trip_id,
    shipment?.id,
    shipment?.status,
    localStatus,
    trip,
    calculateRemainingCapacity,
    supabase,
  ]);

  useEffect(() => {
    if (shipment?.status) {
      setLocalStatus(shipment.status);
    }
  }, [shipment?.status]);

  const statusLower = (localStatus || "pending").toLowerCase();
  const isAccepted = statusLower === "accepted";
  const isPending = statusLower === "pending";
  const isInTransit = statusLower === "in_transit";
  const isDelivered =
    statusLower === "delivered" || statusLower === "completed";

  const packageWeight = shipment?.weight_kg || 0;
  const exceedsCapacity =
    isPending &&
    remainingCapacity !== null &&
    packageWeight > remainingCapacity;

  const handleToggle = async () => {
    if (!shipment?.id) return;
    const nextStatus = isAccepted ? "pending" : "accepted";
    setLocalStatus(nextStatus);
    await onToggle(shipment.id, nextStatus);
  };

  const handleChat = async () => {
    const partnerId = shipment?.user_id;
    const partnerName = senderName;
    const convId = request.conversation_id;

    if (convId) {
      onOpenChat(convId, partnerId, partnerName, shipment?.trip_id);
    } else {
      const { data: newConv } = await supabase
        .from("conversations")
        .insert({ participant1_id: userId, participant2_id: partnerId })
        .select()
        .single();
      if (newConv) {
        onOpenChat(newConv.id, partnerId, partnerName, shipment?.trip_id);
      }
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="font-bold text-lg mb-1">
            {shipment?.content_desc || "Anfrage"}
          </div>
          <div className="text-xs text-slate-500 mb-2">
            Von: {senderName} · {shipment?.weight_kg} kg · {shipment?.value_eur}
            €
          </div>
          <div className="mb-2">
            <StatusBadge status={localStatus} />
          </div>
        </div>
      </div>

      {exceedsCapacity && (
        <div className="mb-3 p-3 bg-red-100 border-2 border-red-500 rounded-lg">
          <div className="flex items-start gap-2">
            <ShieldAlert
              size={20}
              className="text-red-600 flex-shrink-0 mt-0.5"
            />
            <div className="flex-1">
              <p className="font-bold text-red-700 text-sm mb-1">
                ⚠️ Achtung: Kapazität überschritten
              </p>
              <p className="text-xs text-red-600">
                Dieses Paket ({packageWeight} kg) überschreitet deine freie
                Kapazität ({remainingCapacity} kg).
              </p>
            </div>
          </div>
        </div>
      )}

      {isDelivered ? (
        <div className="mt-3 p-4 bg-green-100 border-2 border-green-500 rounded-lg text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <CheckCircle size={24} className="text-green-600" />
            <span className="font-bold text-green-700 text-lg">
              Erfolgreich übergeben
            </span>
          </div>
          <p className="text-sm text-green-600">
            Das Paket wurde erfolgreich an den Empfänger übergeben.
          </p>
        </div>
      ) : (
        <div className="flex gap-2 mt-3 flex-wrap">
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleToggle();
            }}
            className={`flex-1 py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition-colors ${
              isAccepted
                ? "bg-orange-500 hover:bg-orange-600"
                : "bg-green-500 hover:bg-green-600"
            }`}
          >
            {isAccepted ? (
              <>
                <Luggage size={20} />
                <span>Im Koffer verstaut</span>
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                <span>Annehmen</span>
              </>
            )}
          </button>

          {isPending && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                const senderId = shipment?.user_id;
                if (senderId && shipment?.id) {
                  onReject(request.id, shipment.id, senderId);
                }
              }}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg text-sm transition flex items-center justify-center gap-2"
            >
              <XCircle size={20} /> Ablehnen
            </button>
          )}

          {(isAccepted || isInTransit) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (shipment?.id) {
                  onStartQRScanner(shipment.id);
                }
              }}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg text-sm transition flex items-center justify-center gap-2"
            >
              <Camera size={20} /> Lieferung abschließen (Scan)
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleChat();
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg text-sm transition flex items-center justify-center gap-2"
          >
            <MessageCircle size={20} /> Chat
          </button>
        </div>
      )}
    </div>
  );
}
