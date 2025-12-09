"use client";

import { BrowserQRCodeReader } from "@zxing/library";
import { createClient } from "@/utils/supabase/client";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Plane,
  Package,
  Settings,
  LogOut,
  Star,
  ArrowLeft,
  Trash2,
  Lock,
  Mail,
  ShieldAlert,
  Bell,
  CheckCircle,
  XCircle,
  Clock,
  MessageCircle,
  Menu,
  X,
  Luggage,
  QrCode,
  Camera,
  Home,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { signOut } from "../auth/actions";
import { TripCard } from "@/components/TripCard";
import { ShipmentCard } from "@/components/ShipmentCard";
import { MyRequestCard } from "@/components/MyRequestCard";
import { IncomingRequestCard } from "@/components/IncomingRequestCard";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import type {
  Trip,
  Shipment,
  ShipmentWithRelations,
  BookingMessage,
  ConversationWithDetails,
  ShipmentStatus,
  Review,
  BlockedUserWithRelations,
  Message,
} from "@/types/database";

// Hilfsfunktion: Berechnet die verfügbare Kapazität
function calculateRemainingCapacity(
  tripCapacity: number,
  shipments: Array<{ weight_kg: number; status: ShipmentStatus; id: string }>,
  excludeShipmentId?: string, // Optional: Paket-ID ausschließen (z.B. wenn Status noch PENDING)
): number {
  const maxCapacity = tripCapacity || 0;

  // Summiere Gewicht aller Pakete mit Status ACCEPTED, IN_TRANSIT oder DELIVERED
  // WICHTIG: Schließe das aktuelle Paket aus, wenn excludeShipmentId gesetzt ist
  const usedCapacity = shipments
    .filter((shipment) => {
      const status = shipment.status.toLowerCase();
      const isActive =
        status === "accepted" ||
        status === "in_transit" ||
        status === "delivered" ||
        status === "completed";
      if (excludeShipmentId && shipment.id === excludeShipmentId) {
        return false;
      }
      return isActive;
    })
    .reduce((sum, shipment) => sum + shipment.weight_kg, 0);

  // Berechne Restkapazität (min 0)
  return Math.max(0, maxCapacity - usedCapacity);
}

function DashboardContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState("trips");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [myRequests, setMyRequests] = useState<ShipmentWithRelations[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<BookingMessage[]>(
    [],
  );
  const [conversations, setConversations] = useState<ConversationWithDetails[]>(
    [],
  );
  const [reviews, setReviews] = useState<Review[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserWithRelations[]>(
    [],
  );
  const [user, setUser] = useState<{
    id: string;
    email?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      type: string;
      message: string;
      shipment?: ShipmentWithRelations;
      conversation_id?: string;
      created_at: string;
    }>
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scanningShipmentId, setScanningShipmentId] = useState<string | null>(
    null,
  );
  const [scanResult, setScanResult] = useState<string | null>(null);

  /**
   * Lädt alle Reisen des aktuellen Users
   */
  const fetchUserTrips = async (userId: string): Promise<Trip[]> => {
    const { data: trips, error } = await supabase
      .from("trips")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      console.error("Fehler beim Laden der Reisen:", error);
      return [];
    }

    return trips || [];
  };

  /**
   * Lädt alle eigenen Shipments des Users
   */
  const fetchUserShipments = async (userId: string): Promise<Shipment[]> => {
    const { data: shipments } = await supabase
      .from("shipments")
      .select("*")
      .eq("user_id", userId);

    return shipments || [];
  };

  /**
   * Lädt alle eigenen Anfragen (Shipments mit zugehörigen Trip-Infos)
   */
  const fetchMyRequests = async (userId: string): Promise<Shipment[]> => {
    const { data: requests } = await supabase
      .from("shipments")
      .select("*, trips(origin, destination, date)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    return requests || [];
  };

  /**
   * Lädt alle eingehenden Paketanfragen für aktive Reisen des Users
   * Verwendet einen Two-Step-Fetch für bessere Performance
   */
  const fetchIncomingRequests = async (
    userId: string,
  ): Promise<BookingMessage[]> => {
    const { data: myTrips, error: tripsError } = await supabase
      .from("trips")
      .select("id")
      .eq("user_id", userId);

    if (tripsError || !myTrips || myTrips.length === 0) {
      return [];
    }

    const tripIds = myTrips.map((trip) => trip.id);

    const { data: shipments, error: shipmentsError } = await supabase
      .from("shipments")
      .select("*, trips(*)")
      .in("trip_id", tripIds)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });

    if (shipmentsError || !shipments || shipments.length === 0) {
      return [];
    }

    const typedShipments = shipments as ShipmentWithRelations[];
    const shipmentIds = typedShipments.map((shipment) => shipment.id);

    const { data: bookingMessages } = await supabase
      .from("messages")
      .select("*")
      .eq("type", "booking_request")
      .in("shipment_id", shipmentIds)
      .order("created_at", { ascending: false });

    return typedShipments.map((shipment) => {
      const message = (bookingMessages as Message[] | null)?.find(
        (m: Message) => m.shipment_id === shipment.id,
      );
      const trip = Array.isArray(shipment.trips)
        ? shipment.trips[0]
        : shipment.trips;

      return {
        id: message?.id || shipment.id,
        conversation_id: message?.conversation_id,
        sender_id: message?.sender_id || shipment.user_id,
        content: message?.content || "Buchungsanfrage",
        type: "booking_request",
        created_at: message?.created_at || shipment.created_at,
        shipments: {
          ...shipment,
          trips: trip,
        },
      };
    });
  };

  /**
   * Lädt alle Reviews des Users
   */
  const fetchUserReviews = async (userId: string): Promise<Review[]> => {
    const { data: reviews } = await supabase
      .from("reviews")
      .select("*")
      .eq("reviewer_id", userId);

    return (reviews as Review[] | null) || [];
  };

  /**
   * Lädt alle blockierten User des aktuellen Users
   */
  const fetchBlockedUsers = async (
    userId: string,
  ): Promise<BlockedUserWithRelations[]> => {
    const { data: blockedUsers } = await supabase
      .from("blocked_users")
      .select("*, blocked:blocked_id(id, email)")
      .eq("blocker_id", userId);

    return (blockedUsers as BlockedUserWithRelations[] | null) || [];
  };

  /**
   * Lädt alle Dashboard-Daten für den aktuellen User
   */
  const loadData = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return;
    }

    setUser(user);

    const [
      userTrips,
      userShipments,
      myRequestsData,
      incomingRequestsData,
      userReviews,
      blockedUsersData,
    ] = await Promise.all([
      fetchUserTrips(user.id),
      fetchUserShipments(user.id),
      fetchMyRequests(user.id),
      fetchIncomingRequests(user.id),
      fetchUserReviews(user.id),
      fetchBlockedUsers(user.id),
    ]);

    setTrips(userTrips);
    setShipments(userShipments);
    setMyRequests(myRequestsData);
    setIncomingRequests(incomingRequestsData);
    setReviews(userReviews);
    setBlockedUsers(blockedUsersData);

    await loadConversations(user.id);
    setLoading(false);

    if (user) {
      loadNotifications(user.id);
    }
  };

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);

    loadData();

    // Polling für Updates alle 15 Sekunden
    const interval = setInterval(() => {
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user) {
          loadNotifications(data.user.id);
        }
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [searchParams]);

  /**
   * Lädt Benachrichtigungen für neue Anfragen und Status-Änderungen
   */
  const loadNotifications = async (userId: string) => {
    if (!userId) {
      return;
    }

    const notifications: Array<{
      id: string;
      type: string;
      message: string;
      shipment?: ShipmentWithRelations;
      conversation_id?: string;
      created_at: string;
    }> = [];

    // Neue eingehende Anfragen (nur pending)
    const { data: userTrips } = await supabase
      .from("trips")
      .select("id")
      .eq("user_id", userId);

    if (userTrips && userTrips.length > 0) {
      const tripIds = userTrips.map((trip) => trip.id);

      const { data: pendingShipments } = await supabase
        .from("shipments")
        .select("*, trips(*)")
        .in("trip_id", tripIds)
        .eq("status", "pending")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(10);

      if (pendingShipments && pendingShipments.length > 0) {
        const typedPendingShipments =
          pendingShipments as ShipmentWithRelations[];
        const shipmentIds = typedPendingShipments.map(
          (shipment) => shipment.id,
        );
        const { data: bookingMessages } = await supabase
          .from("messages")
          .select("*")
          .eq("type", "booking_request")
          .in("shipment_id", shipmentIds);

        typedPendingShipments.forEach((shipment) => {
          const trip = Array.isArray(shipment.trips)
            ? shipment.trips[0]
            : shipment.trips;
          const message = (bookingMessages as Message[] | null)?.find(
            (m: Message) => m.shipment_id === shipment.id,
          );

          notifications.push({
            id: message?.id || shipment.id,
            type: "new_request",
            message: `Neue Anfrage für ${trip?.origin || "deine Reise"} → ${trip?.destination || ""}`,
            shipment: shipment,
            conversation_id: message?.conversation_id,
            created_at: message?.created_at || shipment.created_at,
          });
        });
      }
    }

    // Status-Änderungen meiner Anfragen
    const { data: statusChangedShipments } = await supabase
      .from("shipments")
      .select("*, trips(origin, destination)")
      .eq("user_id", userId)
      .in("status", ["accepted", "rejected"])
      .order("updated_at", { ascending: false })
      .limit(5);

    if (statusChangedShipments) {
      statusChangedShipments.forEach((shipment) => {
        const isAccepted =
          (shipment.status?.toLowerCase() || "pending") === "accepted";
        notifications.push({
          id: `status-${shipment.id}`,
          type: isAccepted ? "accepted" : "rejected",
          message: `Deine Anfrage wurde ${isAccepted ? "akzeptiert" : "abgelehnt"}`,
          shipment: shipment,
          created_at: shipment.updated_at,
        });
      });
    }

    notifications.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    setNotifications(notifications.slice(0, 10));
    setUnreadCount(notifications.length);
  };

  const updatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert("Passwort muss mindestens 6 Zeichen lang sein!");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) alert(error.message);
    else {
      alert("Passwort geändert!");
      setNewPassword("");
    }
  };

  const updateEmail = async () => {
    if (!newEmail) {
      alert("Bitte E-Mail eingeben!");
      return;
    }
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) alert(error.message);
    else {
      alert("Bestätigungsmail an die neue Adresse gesendet!");
      setNewEmail("");
    }
  };

  const deleteItem = async (table: string, id: string) => {
    if (!confirm("Wirklich löschen?")) return;
    await supabase.from(table).delete().eq("id", id);
    window.location.reload();
  };

  const unblockUser = async (blockedId: string) => {
    if (!user?.id) return;
    await supabase
      .from("blocked_users")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", blockedId);
    window.location.reload();
  };

  // Diese Funktion wird nicht mehr verwendet - Toggle-Logik ist jetzt in RequestCard
  // Behalten für Kompatibilität, falls noch irgendwo verwendet

  const handleRejectRequest = async (
    messageId: string,
    shipmentId: string,
    senderId: string,
  ) => {
    if (!user?.id) return;

    await supabase
      .from("shipments")
      .update({ status: "rejected", trip_id: null })
      .eq("id", shipmentId);

    const { data: existingConv } = await supabase
      .from("conversations")
      .select("id")
      .or(
        `and(participant1_id.eq.${user.id},participant2_id.eq.${senderId}),and(participant1_id.eq.${senderId},participant2_id.eq.${user.id})`,
      )
      .single();

    let convId = existingConv?.id;

    if (!convId) {
      const { data: newConv } = await supabase
        .from("conversations")
        .insert({ participant1_id: user.id, participant2_id: senderId })
        .select()
        .single();
      if (newConv) convId = newConv.id;
    }

    if (convId) {
      await supabase.from("messages").insert({
        conversation_id: convId,
        sender_id: user.id,
        content: "❌ Anfrage abgelehnt.",
        type: "text",
      });
    }

    window.location.reload();
  };

  /**
   * Handles the toggle of incoming request status (accepted <-> pending)
   */
  const handleToggleIncomingRequest = async (
    shipmentId: string,
    nextStatus: ShipmentStatus,
  ) => {
    if (!user?.id) return;

    const shipment = incomingRequests.find(
      (req) => req.shipments?.id === shipmentId,
    )?.shipments;
    if (!shipment) return;

    const tripId = shipment.trip_id;
    const senderId = shipment.user_id;

    if (!tripId || !senderId) return;

    try {
      const updateData: {
        status: ShipmentStatus;
        trip_id?: string;
      } = { status: nextStatus };
      if (nextStatus === "accepted") {
        updateData.trip_id = tripId;
      }

      const { error } = await supabase
        .from("shipments")
        .update(updateData)
        .eq("id", shipmentId);

      if (error) {
        alert("Fehler beim Aktualisieren. Bitte versuche es erneut.");
        return;
      }

      setIncomingRequests((prev) =>
        prev.map((req) => {
          if (req.shipments?.id === shipmentId) {
            return {
              ...req,
              shipments: {
                ...req.shipments,
                status: nextStatus,
              },
            };
          }
          return req;
        }),
      );

      if (nextStatus === "accepted") {
        const { data: existingConv } = await supabase
          .from("conversations")
          .select("id")
          .or(
            `and(participant1_id.eq.${user.id},participant2_id.eq.${senderId}),and(participant1_id.eq.${senderId},participant2_id.eq.${user.id})`,
          )
          .single();

        let convId = existingConv?.id;
        if (!convId) {
          const { data: newConv } = await supabase
            .from("conversations")
            .insert({ participant1_id: user.id, participant2_id: senderId })
            .select()
            .single();
          if (newConv) convId = newConv.id;
        }

        if (convId) {
          await supabase.from("messages").insert({
            conversation_id: convId,
            sender_id: user.id,
            content: "✅ Anfrage akzeptiert!",
            type: "text",
          });
        }
      }
    } catch (e) {
      alert("Fehler beim Aktualisieren. Bitte versuche es erneut.");
    }
  };

  const loadConversations = async (userId: string) => {
    try {
      // Lade alle Konversationen, an denen der User beteiligt ist
      const { data: convs } = await supabase
        .from("conversations")
        .select("*")
        .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
        .order("created_at", { ascending: false });

      if (!convs || convs.length === 0) {
        setConversations([]);
        return;
      }

      // Für jede Konversation: Lade Partner-Info, letzte Nachricht und Reise-Kontext
      const conversationsWithDetails = await Promise.all(
        convs.map(async (conv) => {
          // Bestimme Partner-ID
          const partnerId =
            conv.participant1_id === userId
              ? conv.participant2_id
              : conv.participant1_id;

          // Lade Partner-Profil
          const { data: partnerProfile } = await supabase
            .from("profiles")
            .select("first_name")
            .eq("id", partnerId)
            .single();

          // Lade letzte Nachricht
          const { data: lastMessage } = await supabase
            .from("messages")
            .select("*, shipments(trip_id, trips(origin, destination))")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          // Finde Reise-Kontext aus Shipments oder Trips
          let tripContext = null;
          if (lastMessage?.shipments?.trips) {
            const trips = Array.isArray(lastMessage.shipments.trips)
              ? lastMessage.shipments.trips[0]
              : lastMessage.shipments.trips;
            if (trips) {
              tripContext = {
                origin: trips.origin,
                destination: trips.destination,
              };
            }
          } else if (lastMessage?.shipment_id) {
            // Versuche Trip über Shipment zu finden
            const { data: shipment } = await supabase
              .from("shipments")
              .select("trip_id, trips(origin, destination)")
              .eq("id", lastMessage.shipment_id)
              .single();

            if (shipment?.trips) {
              const trips = Array.isArray(shipment.trips)
                ? shipment.trips[0]
                : shipment.trips;
              if (trips) {
                tripContext = {
                  origin: trips.origin,
                  destination: trips.destination,
                };
              }
            }
          }

          return {
            ...conv,
            partnerId,
            partnerName: partnerProfile?.first_name || "User",
            lastMessage: lastMessage || null,
            tripContext,
            lastMessageTime: lastMessage?.created_at || conv.created_at,
          };
        }),
      );

      // Sortiere nach neuester Nachricht
      conversationsWithDetails.sort((a, b) => {
        const timeA = new Date(a.lastMessageTime).getTime();
        const timeB = new Date(b.lastMessageTime).getTime();
        return timeB - timeA;
      });

      setConversations(conversationsWithDetails);
    } catch (error) {
      console.error("Fehler beim Laden der Konversationen:", error);
      setConversations([]);
    }
  };

  const openChat = (
    conversationId: string,
    partnerId: string,
    partnerName: string,
    tripId?: string,
  ) => {
    window.location.href = `/?openChat=${conversationId}&partnerId=${partnerId}&partnerName=${encodeURIComponent(partnerName)}${tripId ? `&tripId=${tripId}` : ""}`;
  };

  // QR Code Funktionen
  const getDeliveryCode = (
    shipment: Shipment | ShipmentWithRelations,
  ): string => {
    // Nutze delivery_code Feld falls vorhanden, sonst shipment.id
    return shipment.delivery_code || shipment.id;
  };

  const handleScanQRCode = async (shipmentId: string, scannedCode: string) => {
    // Finde das Shipment, um den delivery_code zu bekommen
    const shipment = incomingRequests.find(
      (req) => req.shipments?.id === shipmentId,
    )?.shipments;
    const expectedCode = shipment ? getDeliveryCode(shipment) : shipmentId;

    if (scannedCode === expectedCode || scannedCode === shipmentId) {
      // Status auf DELIVERED setzen
      const { error } = await supabase
        .from("shipments")
        .update({ status: "delivered" })
        .eq("id", shipmentId);

      if (!error) {
        setScanResult("success");
        // Update Status
        setIncomingRequests((prev) =>
          prev.map((req) => {
            if (req.shipments?.id === shipmentId) {
              return {
                ...req,
                shipments: {
                  ...req.shipments,
                  status: "delivered",
                },
              };
            }
            return req;
          }),
        );

        // Schließe Scanner nach 2 Sekunden
        setTimeout(() => {
          setShowQRScanner(false);
          setScanningShipmentId(null);
          setScanResult(null);
        }, 2000);
      } else {
        setScanResult("error");
      }
    } else {
      setScanResult("invalid");
    }
  };

  const startQRScanner = async (shipmentId: string) => {
    setScanningShipmentId(shipmentId);
    setShowQRScanner(true);
    setScanResult(null);

    // Warte kurz, damit das Video-Element gerendert wird
    setTimeout(async () => {
      try {
        const codeReader = new BrowserQRCodeReader();
        const videoInputDevices = await codeReader.listVideoInputDevices();

        if (videoInputDevices.length === 0) {
          alert("Keine Kamera gefunden. Bitte erlaube den Kamerazugriff.");
          setShowQRScanner(false);
          setScanningShipmentId(null);
          return;
        }

        // Nutze die erste verfügbare Kamera (oder die Rückkamera auf Mobile)
        const selectedDeviceId =
          videoInputDevices.length > 1
            ? videoInputDevices.find(
                (device) =>
                  device.label.toLowerCase().includes("back") ||
                  device.label.toLowerCase().includes("rear"),
              )?.deviceId || videoInputDevices[1].deviceId
            : videoInputDevices[0].deviceId;

        const videoElement = document.getElementById(
          "qr-scanner-video",
        ) as HTMLVideoElement;
        if (videoElement) {
          codeReader.decodeFromVideoDevice(
            selectedDeviceId,
            videoElement,
            (result, error) => {
              if (result) {
                const scannedCode = result.getText();
                handleScanQRCode(shipmentId, scannedCode);
                codeReader.reset();
              }
            },
          );
        }
      } catch (error) {
        console.error("Fehler beim Starten des Scanners:", error);
        alert(
          "Fehler beim Starten der Kamera. Bitte erlaube den Kamerazugriff.",
        );
        setShowQRScanner(false);
        setScanningShipmentId(null);
      }
    }, 100);
  };

  if (loading)
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-900">
        Lade...
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      {/* MOBILE HEADER mit Hamburger */}
      <div className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 hover:bg-slate-100 rounded-lg transition"
          aria-label="Menü öffnen"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <h1 className="font-black text-lg">Dashboard</h1>
        <div className="w-10"></div> {/* Spacer für Zentrierung */}
      </div>

      {/* MOBILE OVERLAY */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`
        w-full md:w-64 bg-white border-r border-slate-200 p-6 flex-shrink-0 
        fixed md:sticky top-0 md:top-0 h-screen z-40 md:z-auto
        flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}
      >
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm"
            onClick={() => setMobileMenuOpen(false)}
          >
            <ArrowLeft size={16} /> Zurück
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-2 hover:bg-slate-100 rounded-lg transition"
            aria-label="Menü schließen"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="space-y-1 flex-1">
          {/* Mobile: "Zurück zur Startseite" Link - Ganz oben, optisch abgehoben */}
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden w-full text-left p-3 rounded-lg flex items-center gap-3 font-bold text-sm transition bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 mb-4"
          >
            <Home size={16} /> Zurück zur Startseite
          </Link>

          <button
            onClick={() => {
              setActiveTab("trips");
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left p-3 rounded-lg flex items-center gap-3 font-bold text-sm transition ${activeTab === "trips" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50"}`}
          >
            <Plane size={16} /> Meine Reisen
          </button>
          <button
            onClick={() => {
              setActiveTab("my-requests");
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left p-3 rounded-lg flex items-center gap-3 font-bold text-sm transition relative ${activeTab === "my-requests" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50"}`}
          >
            <Package size={16} /> Meine Anfragen
            {myRequests.filter(
              (request) =>
                (request.status?.toLowerCase() || "pending") === "pending",
            ).length > 0 && (
              <span className="ml-auto bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {
                  myRequests.filter(
                    (request) =>
                      (request.status?.toLowerCase() || "pending") ===
                      "pending",
                  ).length
                }
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab("incoming-requests");
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left p-3 rounded-lg flex items-center gap-3 font-bold text-sm transition relative ${activeTab === "incoming-requests" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50"}`}
          >
            <MessageCircle size={16} /> Eingehende Anfragen
            {incomingRequests.filter(
              (r) =>
                (r.shipments?.status?.toLowerCase() || "pending") === "pending",
            ).length > 0 && (
              <span className="ml-auto bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {
                  incomingRequests.filter(
                    (r) =>
                      (r.shipments?.status?.toLowerCase() || "pending") ===
                      "pending",
                  ).length
                }
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab("messages");
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left p-3 rounded-lg flex items-center gap-3 font-bold text-sm transition relative ${activeTab === "messages" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50"}`}
          >
            <Mail size={16} /> Nachrichten
            {conversations.length > 0 && (
              <span className="ml-auto bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {conversations.length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab("shipments");
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left p-3 rounded-lg flex items-center gap-3 font-bold text-sm transition ${activeTab === "shipments" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50"}`}
          >
            <Package size={16} /> Meine Pakete
          </button>
          <button
            onClick={() => {
              setActiveTab("reviews");
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left p-3 rounded-lg flex items-center gap-3 font-bold text-sm transition ${activeTab === "reviews" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50"}`}
          >
            <Star size={16} /> Bewertungen
          </button>
          <button
            onClick={() => {
              setActiveTab("settings");
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left p-3 rounded-lg flex items-center gap-3 font-bold text-sm transition ${activeTab === "settings" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50"}`}
          >
            <Settings size={16} /> Einstellungen
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="text-xs font-bold truncate w-32">
              {user?.email || "User"}
            </div>
            {/* Benachrichtigungs-Icon */}
            <div className="ml-auto relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 hover:bg-slate-100 rounded transition"
              >
                <Bell size={18} className="text-slate-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute bottom-full right-0 mb-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto">
                  <div className="p-3 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-sm">Benachrichtigungen</h3>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                  {notifications.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className="p-3 hover:bg-slate-50 cursor-pointer"
                          onClick={() => {
                            setShowNotifications(false);
                            if (
                              notif.type === "new_request" &&
                              notif.shipment
                            ) {
                              // Öffne Chat
                              const partnerId = notif.shipment.user_id;
                              const partnerName =
                                notif.shipment.sender_name || "User";
                              const convId = notif.conversation_id;
                              if (convId) {
                                openChat(
                                  convId,
                                  partnerId,
                                  partnerName,
                                  notif.shipment.trip_id || undefined,
                                );
                              }
                            }
                          }}
                        >
                          <p className="text-sm font-medium text-slate-900">
                            {notif.message}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {new Date(notif.created_at).toLocaleString("de-DE")}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-slate-400">
                      Keine Benachrichtigungen
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <form action={signOut} className="mt-auto pb-24 md:pb-6">
            <button
              type="submit"
              className="w-full text-left p-2 text-red-500 font-bold text-xs flex items-center gap-2 hover:bg-red-50 rounded transition"
            >
              <LogOut size={14} /> Ausloggen
            </button>
          </form>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 p-8 overflow-y-auto">
        {activeTab === "trips" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-black mb-4">Meine Reisen</h1>
            {trips.length > 0 ? (
              trips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onDelete={(tripId) => deleteItem("trips", tripId)}
                />
              ))
            ) : (
              <EmptyState icon={Plane} message="Noch keine Reisen erstellt." />
            )}
          </div>
        )}

        {activeTab === "my-requests" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-black mb-4">Meine Anfragen</h1>
            {myRequests.length > 0 ? (
              myRequests.map((req) => (
                <MyRequestCard
                  key={req.id}
                  request={req}
                  userId={user?.id || ""}
                  onOpenChat={openChat}
                  onDelete={(shipmentId) => deleteItem("shipments", shipmentId)}
                  getDeliveryCode={getDeliveryCode}
                  supabase={supabase}
                />
              ))
            ) : (
              <EmptyState
                icon={Package}
                message="Noch keine Anfragen gestellt."
              />
            )}
          </div>
        )}

        {activeTab === "incoming-requests" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-black mb-4">Eingehende Anfragen</h1>
            {incomingRequests.length > 0 ? (
              incomingRequests.map((req) => (
                <IncomingRequestCard
                  key={req.id}
                  request={req}
                  userId={user?.id || ""}
                  calculateRemainingCapacity={calculateRemainingCapacity}
                  onToggle={handleToggleIncomingRequest}
                  onReject={handleRejectRequest}
                  onOpenChat={openChat}
                  onStartQRScanner={startQRScanner}
                  supabase={supabase}
                />
              ))
            ) : (
              <EmptyState
                icon={MessageCircle}
                message="Noch keine eingehenden Anfragen."
              />
            )}
          </div>
        )}

        {activeTab === "messages" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-black mb-4">Nachrichten</h1>
            {conversations.length > 0 ? (
              conversations.map((conv) => {
                const lastMsg = conv.lastMessage;
                const preview = lastMsg?.content || "Keine Nachrichten";
                const truncatedPreview =
                  preview.length > 60
                    ? preview.substring(0, 60) + "..."
                    : preview;
                const timeAgo = lastMsg?.created_at
                  ? new Date(lastMsg.created_at).toLocaleString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : conv.created_at
                    ? new Date(conv.created_at).toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                      })
                    : "";
                const partnerName = conv.partnerName || "Kontakt";

                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      const shipments = lastMsg?.shipments;
                      const tripId =
                        shipments && !Array.isArray(shipments)
                          ? shipments.trip_id || undefined
                          : undefined;
                      openChat(
                        conv.id,
                        conv.partnerId || "",
                        partnerName,
                        tripId,
                      );
                    }}
                    className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer"
                  >
                    <div className="flex gap-4 items-start">
                      <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {partnerName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <div>
                            <h3 className="font-bold text-lg text-slate-900">
                              {partnerName}
                            </h3>
                            {conv.tripContext && (
                              <p className="text-xs text-slate-500 mt-0.5">
                                {conv.tripContext.origin} ➔{" "}
                                {conv.tripContext.destination}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                            {timeAgo}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                          {lastMsg?.type === "booking_request" ? (
                            <span className="flex items-center gap-1 text-orange-600 font-medium">
                              <Package size={14} /> Buchungsanfrage
                            </span>
                          ) : (
                            truncatedPreview
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400">
                <Mail size={48} className="mx-auto mb-4 opacity-50" />
                <p>Noch keine Nachrichten.</p>
                <p className="text-xs mt-2">
                  Starte eine Unterhaltung über eine Reise.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "shipments" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-black mb-4">Meine Pakete</h1>
            {shipments.length > 0 ? (
              shipments.map((shipment, index) => (
                <ShipmentCard
                  key={shipment.id || `shipment-${index}`}
                  shipment={shipment}
                  index={index}
                  onDelete={(shipmentId) => deleteItem("shipments", shipmentId)}
                />
              ))
            ) : (
              <EmptyState
                icon={Package}
                message="Noch keine Pakete erstellt."
              />
            )}
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-black mb-4">Bewertungen</h1>
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400">
              <Star size={48} className="mx-auto mb-4 opacity-50" />
              <p>Bewertungsfunktion kommt bald.</p>
              <p className="text-xs mt-2">
                Hier siehst du später alle Bewertungen, die du erhalten hast.
              </p>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="max-w-lg space-y-8">
            <h1 className="text-2xl font-black">Einstellungen</h1>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Lock size={16} className="text-slate-400" /> Sicherheit
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-slate-400 mb-1 block">
                    Neues Passwort
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="flex-1 border border-slate-200 p-3 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                      placeholder="••••••••"
                      minLength={6}
                    />
                    <button
                      onClick={updatePassword}
                      className="bg-slate-900 text-white px-6 rounded-lg text-sm font-bold hover:bg-slate-800 transition"
                    >
                      Ändern
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Mindestens 6 Zeichen
                  </p>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-slate-400 mb-1 block">
                    E-Mail ändern
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="flex-1 border border-slate-200 p-3 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                      placeholder="neue@email.com"
                    />
                    <button
                      onClick={updateEmail}
                      className="bg-slate-900 text-white px-6 rounded-lg text-sm font-bold hover:bg-slate-800 transition"
                    >
                      Ändern
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Du erhältst eine Bestätigungsmail
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <ShieldAlert size={16} className="text-slate-400" />{" "}
                Privatsphäre & Blockierungen
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Hier kannst du sehen, wen du blockiert hast.
              </p>
              {blockedUsers.length > 0 ? (
                <div className="space-y-2">
                  {blockedUsers.map((block) => {
                    const blockedEmail = (
                      block.blocked as { email?: string } | undefined
                    )?.email;
                    return (
                      <div
                        key={block.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center text-xs font-bold">
                            {blockedEmail?.charAt(0).toUpperCase() || "?"}
                          </div>
                          <span className="text-sm font-medium">
                            {blockedEmail || "Unbekannt"}
                          </span>
                        </div>
                        <button
                          onClick={() => unblockUser(block.blocked_id)}
                          className="text-xs text-blue-600 font-bold hover:text-blue-800 transition"
                        >
                          Entblockieren
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded border border-slate-200 text-xs text-center text-slate-400">
                  Keine blockierten Nutzer.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      {/* QR Code Scanner Modal */}
      {showQRScanner && scanningShipmentId && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-black">QR-Code scannen</h2>
              <button
                onClick={() => {
                  setShowQRScanner(false);
                  setScanningShipmentId(null);
                  setScanResult(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <X size={24} />
              </button>
            </div>

            {scanResult === "success" ? (
              <div className="text-center py-8">
                <CheckCircle
                  size={64}
                  className="mx-auto mb-4 text-green-500"
                />
                <h3 className="text-2xl font-bold text-green-600 mb-2">
                  Erfolgreich zugestellt!
                </h3>
                <p className="text-slate-600">
                  Das Paket wurde erfolgreich übergeben.
                </p>
              </div>
            ) : scanResult === "invalid" ? (
              <div className="text-center py-8">
                <XCircle size={64} className="mx-auto mb-4 text-red-500" />
                <h3 className="text-xl font-bold text-red-600 mb-2">
                  Ungültiger QR-Code
                </h3>
                <p className="text-slate-600 mb-4">
                  Der gescannte Code stimmt nicht überein.
                </p>
                <button
                  onClick={() => {
                    setScanResult(null);
                    if (scanningShipmentId) {
                      startQRScanner(scanningShipmentId);
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
                >
                  Erneut scannen
                </button>
              </div>
            ) : (
              <>
                <div className="bg-slate-900 rounded-xl p-4 mb-4 relative overflow-hidden">
                  <video
                    id="qr-scanner-video"
                    className="w-full h-auto rounded-lg"
                    style={{ maxHeight: "400px" }}
                  />
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="border-4 border-orange-500 rounded-lg w-64 h-64"></div>
                  </div>
                </div>
                <p className="text-sm text-slate-600 text-center">
                  Richte die Kamera auf den QR-Code des Empfängers
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-900">
          <p>Lade Dashboard...</p>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
