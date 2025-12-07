"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState, Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plane, Package, Settings, LogOut, Star, ArrowLeft, Trash2, Lock, Mail, ShieldAlert, Bell, CheckCircle, XCircle, Clock, MessageCircle, Menu, X, Luggage, QrCode, Camera, Home } from "lucide-react";
import { signOut } from "../auth/actions";
import { QRCodeSVG } from "qrcode.react";
import { BrowserQRCodeReader } from "@zxing/library";

// Hilfsfunktion: Berechnet die verfügbare Kapazität
function calculateRemainingCapacity(
  tripCapacity: number,
  shipments: Array<{ weight_kg: number; status: string }>,
  excludeShipmentId?: string // Optional: Paket-ID ausschließen (z.B. wenn Status noch PENDING)
): number {
  const maxCapacity = tripCapacity || 0;
  
  // Summiere Gewicht aller Pakete mit Status ACCEPTED, IN_TRANSIT oder DELIVERED
  // WICHTIG: Schließe das aktuelle Paket aus, wenn excludeShipmentId gesetzt ist
  const usedCapacity = shipments
    .filter(s => {
      const status = (s.status || '').toLowerCase();
      const isActive = status === 'accepted' || status === 'in_transit' || status === 'delivered' || status === 'completed';
      // Wenn excludeShipmentId gesetzt ist, schließe dieses Paket aus
      if (excludeShipmentId && (s as any).id === excludeShipmentId) {
        return false;
      }
      return isActive;
    })
    .reduce((sum, s) => sum + (s.weight_kg || 0), 0);
  
  // Berechne Restkapazität (min 0)
  return Math.max(0, maxCapacity - usedCapacity);
}

function DashboardContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  
  const [activeTab, setActiveTab] = useState('trips');
  const [trips, setTrips] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]); // Meine Anfragen (als Absender)
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]); // Eingehende Anfragen (als Sherpa)
  const [conversations, setConversations] = useState<any[]>([]); // Alle Konversationen für Inbox
  const [reviews, setReviews] = useState<any[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Benachrichtigungen
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  
  // Mobile Navigation
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // QR Code Scanner
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scanningShipmentId, setScanningShipmentId] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if(tab) setActiveTab(tab);

    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("DEBUG: Kein User gefunden, breche ab");
        return;
      }
      setUser(user);
      console.log("DEBUG: User geladen:", { userId: user.id, email: user.email });

      // TRIPS FETCH - Aggressives Debugging
      console.log("DEBUG: Starte Trip-Fetch...", { userId: user.id });
      const { data: t, error: tripError } = await supabase
        .from("trips")
        .select("*")
        .eq("user_id", user.id);
      
      console.log("DEBUG: Trip Fetch Ergebnis:", { 
        tripData: t, 
        tripError: tripError,
        tripDataLength: t?.length,
        tripDataType: typeof t,
        isArray: Array.isArray(t),
        isNull: t === null,
        isUndefined: t === undefined
      });
      
      if (tripError) {
        console.error("DEBUG: Trip Fetch FEHLER:", tripError);
        console.error("DEBUG: Fehler-Details:", {
          message: tripError.message,
          details: tripError.details,
          hint: tripError.hint,
          code: tripError.code
        });
      }
      
      if (t) {
        console.log("DEBUG: Setze Trips in State:", { count: t.length, trips: t });
        setTrips(t);
        console.log("DEBUG: Trips State gesetzt");
      } else {
        console.warn("DEBUG: Trip Data ist null/undefined - KEINE TRIPS GELADEN!");
        console.warn("DEBUG: Mögliche Ursachen:");
        console.warn("  1. RLS Policies blockieren den Zugriff - Prüfe Supabase RLS Policies für 'trips' Tabelle");
        console.warn("  2. Keine Trips vorhanden für diesen User");
        console.warn("  3. Query-Fehler (siehe tripError oben)");
        setTrips([]); // Explizit leeres Array setzen
      }
      
      // WICHTIG: Falls trips leer ist ([]), aber kein Fehler kommt, 
      // prüfe bitte die RLS (Row Level Security) Policies in Supabase:
      // - Gehe zu Supabase Dashboard > Authentication > Policies
      // - Prüfe die 'trips' Tabelle
      // - Stelle sicher, dass SELECT für authenticated users erlaubt ist
      // - Beispiel: CREATE POLICY "Users können eigene Trips lesen" ON trips FOR SELECT USING (auth.uid() = user_id);

      const { data: s } = await supabase.from("shipments").select("*").eq("user_id", user.id);
      if (s) setShipments(s);

      // Meine Anfragen: Alle meine Shipments mit Status
      const { data: myReqs } = await supabase
        .from("shipments")
        .select("*, trips(origin, destination, date)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (myReqs) setMyRequests(myReqs);

      // Eingehende Anfragen: Two-Step-Fetch (robuster als !inner Join)
      // Schritt 1: Hol dir erst die IDs meiner Reisen
      if (!user || !user.id) {
        console.warn("DEBUG: User nicht verfügbar für eingehende Anfragen");
        setIncomingRequests([]);
      } else {
        const { data: myTrips, error: tripsError } = await supabase
          .from('trips')
          .select('id')
          .eq('user_id', user.id);
        
        if (tripsError) {
          console.error("Fehler beim Laden meiner Reisen:", tripsError);
          setIncomingRequests([]);
        } else if (!myTrips || myTrips.length === 0) {
          console.log("DEBUG: Keine Reisen gefunden -> Keine eingehenden Anfragen");
          setIncomingRequests([]);
        } else {
          // Schritt 2: Hol dir alle Shipments, die zu diesen Trip-IDs gehören
          const myTripIds = myTrips.map(t => t.id);
          
          const { data: shipments, error: shipmentsError } = await supabase
            .from('shipments')
            .select('*, trips(*)')  // Simpler Join, nur Trips
            .in('trip_id', myTripIds)  // Der sichere Filter
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false });
          
          if (shipmentsError) {
            console.error("Fehler beim Laden der Shipments:", shipmentsError);
            setIncomingRequests([]);
          } else if (shipments && shipments.length > 0) {
            // Schritt 3: Lade die zugehörigen booking_request Nachrichten
            const shipmentIds = shipments.map((s: any) => s.id);
            
            const { data: bookingMessages, error: messagesError } = await supabase
              .from("messages")
              .select("*")
              .eq("type", "booking_request")
              .in("shipment_id", shipmentIds)
              .order("created_at", { ascending: false });
            
            if (messagesError) {
              console.error("Fehler beim Laden der booking_request Nachrichten:", messagesError);
            }
            
            // Transformiere die Daten in das erwartete Format (messages mit shipments)
            const transformed = shipments.map((shipment: any) => {
              // Finde die zugehörige booking_request Nachricht
              const message = bookingMessages?.find((m: any) => m.shipment_id === shipment.id);
              
              // Stelle sicher, dass trips als Objekt (nicht Array) vorliegt
              const trip = Array.isArray(shipment.trips) ? shipment.trips[0] : shipment.trips;
              
              return {
                id: message?.id || shipment.id,
                conversation_id: message?.conversation_id,
                sender_id: message?.sender_id || shipment.user_id,
                content: message?.content || "Buchungsanfrage",
                type: "booking_request",
                created_at: message?.created_at || shipment.created_at,
                shipments: {
                  ...shipment,
                  trips: trip
                }
              };
            });
            
            console.log("DEBUG: Eingehende Anfragen geladen:", transformed.length, transformed);
            setIncomingRequests(transformed);
          } else {
            console.log("DEBUG: Keine eingehenden Anfragen gefunden");
            setIncomingRequests([]);
          }
        }
      }

      const { data: r } = await supabase.from("reviews").select("*").eq("reviewer_id", user.id);
      if (r) setReviews(r);

      const { data: b } = await supabase.from("blocked_users").select("*, blocked:blocked_id(id, email)").eq("blocker_id", user.id);
      if (b) setBlockedUsers(b);

      // Lade alle Konversationen des Users
      await loadConversations(user.id);

      setLoading(false);
      
      // Lade Benachrichtigungen nach dem Laden der Daten
      if (user) {
        loadNotifications(user.id);
      }
    }
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
  
  const loadNotifications = async (userId: string) => {
    // Finde neue Nachrichten und Status-Änderungen
    const notifications: any[] = [];
    
    // Neue eingehende Anfragen (nur pending)
    // WICHTIG: Verwende den gleichen Two-Step-Fetch wie beim Laden der eingehenden Anfragen
    if (!userId) {
      return; // Kein User, keine Benachrichtigungen
    }
    
    // Schritt 1: Hol dir erst die IDs meiner Reisen
    const { data: myTrips } = await supabase
      .from('trips')
      .select('id')
      .eq('user_id', userId);
    
    if (!myTrips || myTrips.length === 0) {
      return; // Keine Reisen -> Keine Anfragen
    }
    
    // Schritt 2: Hol dir alle pending Shipments, die zu diesen Trip-IDs gehören
    const myTripIds = myTrips.map(t => t.id);
    
    const { data: shipments } = await supabase
      .from('shipments')
      .select('*, trips(*)')  // Simpler Join, nur Trips
      .in('trip_id', myTripIds)  // Der sichere Filter
      .eq('status', 'pending')  // Nur pending Anfragen
      .neq('status', 'cancelled')  // Stornierte ausblenden
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (shipments && shipments.length > 0) {
      // Lade die zugehörigen booking_request Nachrichten
      const shipmentIds = shipments.map((s: any) => s.id);
      const { data: bookingMessages } = await supabase
        .from("messages")
        .select("*")
        .eq("type", "booking_request")
        .in("shipment_id", shipmentIds);
      
      shipments.forEach((shipment: any) => {
        const trip = Array.isArray(shipment.trips) ? shipment.trips[0] : shipment.trips;
        const message = bookingMessages?.find((m: any) => m.shipment_id === shipment.id);
        
        notifications.push({
          id: message?.id || shipment.id,
          type: 'new_request',
          message: `Neue Anfrage für ${trip?.origin || 'deine Reise'} → ${trip?.destination || ''}`,
          shipment: shipment,
          conversation_id: message?.conversation_id,
          created_at: message?.created_at || shipment.created_at
        });
      });
    }
    
    // Status-Änderungen meiner Anfragen (nur recent)
    const { data: myShipments } = await supabase
      .from("shipments")
      .select("*, trips(origin, destination)")
      .eq("user_id", userId)
      .in("status", ["accepted", "rejected"])
      .order("updated_at", { ascending: false })
      .limit(5);
    
    if (myShipments) {
      myShipments.forEach(ship => {
        notifications.push({
          id: `status-${ship.id}`,
          type: (ship.status?.toLowerCase() || 'pending') === 'accepted' ? 'accepted' : 'rejected',
          message: `Deine Anfrage wurde ${(ship.status?.toLowerCase() || 'pending') === 'accepted' ? 'akzeptiert' : 'abgelehnt'}`,
          shipment: ship,
          created_at: ship.updated_at
        });
      });
    }
    
    // Sortiere nach Datum (neueste zuerst)
    notifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    setNotifications(notifications.slice(0, 10)); // Max 10
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
    if(!confirm("Wirklich löschen?")) return;
    await supabase.from(table).delete().eq("id", id);
    window.location.reload();
  };

  const unblockUser = async (blockedId: string) => {
    await supabase.from("blocked_users").delete().eq("blocker_id", user.id).eq("blocked_id", blockedId);
    window.location.reload();
  };

  // Diese Funktion wird nicht mehr verwendet - Toggle-Logik ist jetzt in RequestCard
  // Behalten für Kompatibilität, falls noch irgendwo verwendet

  const handleRejectRequest = async (messageId: string, shipmentId: string, senderId: string) => {
    await supabase.from('shipments').update({ status: 'rejected', trip_id: null }).eq('id', shipmentId);
    
    // Finde oder erstelle Conversation
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${senderId}),and(participant1_id.eq.${senderId},participant2_id.eq.${user.id})`)
      .single();
    
    let convId = existingConv?.id;
    
    if (!convId) {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({ participant1_id: user.id, participant2_id: senderId })
        .select()
        .single();
      if (newConv) convId = newConv.id;
    }
    
    if (convId) {
      await supabase.from('messages').insert({
        conversation_id: convId,
        sender_id: user.id,
        content: "❌ Anfrage abgelehnt.",
        type: 'text'
      });
    }
    
    // Reload
    window.location.reload();
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; icon: any }> = {
      pending: { label: "Ausstehend", color: "bg-yellow-100 text-yellow-700", icon: Clock },
      accepted: { label: "Akzeptiert", color: "bg-green-100 text-green-700", icon: CheckCircle },
      rejected: { label: "Abgelehnt", color: "bg-red-100 text-red-700", icon: XCircle },
      shipping_to_sherpa: { label: "Unterwegs zum Sherpa", color: "bg-blue-100 text-blue-700", icon: Package },
      in_transit: { label: "In Transit", color: "bg-blue-100 text-blue-700", icon: Plane },
      delivered: { label: "Zugestellt", color: "bg-green-100 text-green-700", icon: CheckCircle }
    };
    
    const statusInfo = statusMap[status] || { label: status, color: "bg-slate-100 text-slate-700", icon: Clock };
    const Icon = statusInfo.icon;
    
    return (
      <span className={`${statusInfo.color} px-2 py-1 rounded text-xs font-bold flex items-center gap-1`}>
        <Icon size={12}/> {statusInfo.label}
      </span>
    );
  };

  const loadConversations = async (userId: string) => {
    try {
      // Lade alle Konversationen, an denen der User beteiligt ist
      const { data: convs } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (!convs || convs.length === 0) {
        setConversations([]);
        return;
      }

      // Für jede Konversation: Lade Partner-Info, letzte Nachricht und Reise-Kontext
      const conversationsWithDetails = await Promise.all(
        convs.map(async (conv) => {
          // Bestimme Partner-ID
          const partnerId = conv.participant1_id === userId ? conv.participant2_id : conv.participant1_id;
          
          // Lade Partner-Profil
          const { data: partnerProfile } = await supabase
            .from('profiles')
            .select('first_name')
            .eq('id', partnerId)
            .single();
          
          // Lade letzte Nachricht
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('*, shipments(trip_id, trips(origin, destination))')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
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
                destination: trips.destination
              };
            }
          } else if (lastMessage?.shipment_id) {
            // Versuche Trip über Shipment zu finden
            const { data: shipment } = await supabase
              .from('shipments')
              .select('trip_id, trips(origin, destination)')
              .eq('id', lastMessage.shipment_id)
              .single();
            
            if (shipment?.trips) {
              const trips = Array.isArray(shipment.trips) ? shipment.trips[0] : shipment.trips;
              if (trips) {
                tripContext = {
                  origin: trips.origin,
                  destination: trips.destination
                };
              }
            }
          }

          return {
            ...conv,
            partnerId,
            partnerName: partnerProfile?.first_name || 'User',
            lastMessage: lastMessage || null,
            tripContext,
            lastMessageTime: lastMessage?.created_at || conv.created_at
          };
        })
      );

      // Sortiere nach neuester Nachricht
      conversationsWithDetails.sort((a, b) => {
        const timeA = new Date(a.lastMessageTime).getTime();
        const timeB = new Date(b.lastMessageTime).getTime();
        return timeB - timeA;
      });

      setConversations(conversationsWithDetails);
    } catch (error) {
      console.error('Fehler beim Laden der Konversationen:', error);
      setConversations([]);
    }
  };

  const openChat = (conversationId: string, partnerId: string, partnerName: string, tripId?: string) => {
    window.location.href = `/?openChat=${conversationId}&partnerId=${partnerId}&partnerName=${encodeURIComponent(partnerName)}${tripId ? `&tripId=${tripId}` : ''}`;
  };

  // QR Code Funktionen
  const getDeliveryCode = (shipment: any): string => {
    // Nutze delivery_code Feld falls vorhanden, sonst shipment.id
    return shipment?.delivery_code || shipment?.id || '';
  };

  const handleScanQRCode = async (shipmentId: string, scannedCode: string) => {
    // Finde das Shipment, um den delivery_code zu bekommen
    const shipment = incomingRequests.find(req => req.shipments?.id === shipmentId)?.shipments;
    const expectedCode = getDeliveryCode(shipment || { id: shipmentId });
    
    console.log('DEBUG SCAN:', { scannedCode, expectedCode, shipmentId });
    
    if (scannedCode === expectedCode || scannedCode === shipmentId) {
      // Status auf DELIVERED setzen
      const { error } = await supabase
        .from('shipments')
        .update({ status: 'delivered' })
        .eq('id', shipmentId);
      
      if (!error) {
        setScanResult('success');
        // Update State optimistisch
        setIncomingRequests(prev => prev.map(req => {
          if (req.shipments?.id === shipmentId) {
            return {
              ...req,
              shipments: {
                ...req.shipments,
                status: 'delivered'
              }
            };
          }
          return req;
        }));
        
        // Schließe Scanner nach 2 Sekunden
        setTimeout(() => {
          setShowQRScanner(false);
          setScanningShipmentId(null);
          setScanResult(null);
        }, 2000);
      } else {
        setScanResult('error');
        console.error('Fehler beim Aktualisieren:', error);
      }
    } else {
      setScanResult('invalid');
      console.error('QR-Code stimmt nicht überein:', { scannedCode, expectedCode });
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
          alert('Keine Kamera gefunden. Bitte erlaube den Kamerazugriff.');
          setShowQRScanner(false);
          setScanningShipmentId(null);
          return;
        }
        
        // Nutze die erste verfügbare Kamera (oder die Rückkamera auf Mobile)
        const selectedDeviceId = videoInputDevices.length > 1 
          ? videoInputDevices.find(device => device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear'))?.deviceId || videoInputDevices[1].deviceId
          : videoInputDevices[0].deviceId;
        
        const videoElement = document.getElementById('qr-scanner-video') as HTMLVideoElement;
        if (videoElement) {
          codeReader.decodeFromVideoDevice(selectedDeviceId, videoElement, (result, error) => {
            if (result) {
              const scannedCode = result.getText();
              handleScanQRCode(shipmentId, scannedCode);
              codeReader.reset();
            }
            if (error && error.name !== 'NotFoundException') {
              console.error('Scan-Fehler:', error);
            }
          });
        }
      } catch (error) {
        console.error('Fehler beim Starten des Scanners:', error);
        alert('Fehler beim Starten der Kamera. Bitte erlaube den Kamerazugriff.');
        setShowQRScanner(false);
        setScanningShipmentId(null);
      }
    }, 100);
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-900">Lade...</div>;

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
      <aside className={`
        w-full md:w-64 bg-white border-r border-slate-200 p-6 flex-shrink-0 
        fixed md:sticky top-0 md:top-0 h-screen z-40 md:z-auto
        flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm" onClick={() => setMobileMenuOpen(false)}>
            <ArrowLeft size={16}/> Zurück
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
            <Home size={16}/> Zurück zur Startseite
          </Link>
          
          <button onClick={()=>{setActiveTab('trips'); setMobileMenuOpen(false);}} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 font-bold text-sm transition ${activeTab==='trips'?'bg-slate-100 text-slate-900':'text-slate-500 hover:bg-slate-50'}`}>
            <Plane size={16}/> Meine Reisen
          </button>
          <button onClick={()=>{setActiveTab('my-requests'); setMobileMenuOpen(false);}} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 font-bold text-sm transition relative ${activeTab==='my-requests'?'bg-slate-100 text-slate-900':'text-slate-500 hover:bg-slate-50'}`}>
            <Package size={16}/> Meine Anfragen
            {myRequests.filter(r => (r.status?.toLowerCase() || 'pending') === 'pending').length > 0 && (
              <span className="ml-auto bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {myRequests.filter(r => (r.status?.toLowerCase() || 'pending') === 'pending').length}
              </span>
            )}
          </button>
          <button onClick={()=>{setActiveTab('incoming-requests'); setMobileMenuOpen(false);}} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 font-bold text-sm transition relative ${activeTab==='incoming-requests'?'bg-slate-100 text-slate-900':'text-slate-500 hover:bg-slate-50'}`}>
            <MessageCircle size={16}/> Eingehende Anfragen
            {incomingRequests.filter(r => (r.shipments?.status?.toLowerCase() || 'pending') === 'pending').length > 0 && (
              <span className="ml-auto bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {incomingRequests.filter(r => (r.shipments?.status?.toLowerCase() || 'pending') === 'pending').length}
              </span>
            )}
          </button>
          <button onClick={()=>{setActiveTab('messages'); setMobileMenuOpen(false);}} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 font-bold text-sm transition relative ${activeTab==='messages'?'bg-slate-100 text-slate-900':'text-slate-500 hover:bg-slate-50'}`}>
            <Mail size={16}/> Nachrichten
            {conversations.length > 0 && (
              <span className="ml-auto bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {conversations.length}
              </span>
            )}
          </button>
          <button onClick={()=>{setActiveTab('shipments'); setMobileMenuOpen(false);}} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 font-bold text-sm transition ${activeTab==='shipments'?'bg-slate-100 text-slate-900':'text-slate-500 hover:bg-slate-50'}`}>
            <Package size={16}/> Meine Pakete
          </button>
          <button onClick={()=>{setActiveTab('reviews'); setMobileMenuOpen(false);}} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 font-bold text-sm transition ${activeTab==='reviews'?'bg-slate-100 text-slate-900':'text-slate-500 hover:bg-slate-50'}`}>
            <Star size={16}/> Bewertungen
          </button>
          <button onClick={()=>{setActiveTab('settings'); setMobileMenuOpen(false);}} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 font-bold text-sm transition ${activeTab==='settings'?'bg-slate-100 text-slate-900':'text-slate-500 hover:bg-slate-50'}`}>
            <Settings size={16}/> Einstellungen
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t">
             <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="text-xs font-bold truncate w-32">{user?.email || 'User'}</div>
            {/* Benachrichtigungs-Icon */}
            <div className="ml-auto relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 hover:bg-slate-100 rounded transition"
              >
                <Bell size={18} className="text-slate-600"/>
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
                    <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600">
                      <XCircle size={16}/>
                    </button>
                  </div>
                  {notifications.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {notifications.map(notif => (
                        <div key={notif.id} className="p-3 hover:bg-slate-50 cursor-pointer" onClick={() => {
                          setShowNotifications(false);
                          if (notif.type === 'new_request' && notif.shipment) {
                            // Öffne Chat
                            const partnerId = notif.shipment.user_id;
                            const partnerName = notif.shipment.sender_name || "User";
                            const convId = notif.conversation_id;
                            if (convId) {
                              openChat(convId, partnerId, partnerName, notif.shipment.trip_id);
                            }
                          }
                        }}>
                          <p className="text-sm font-medium text-slate-900">{notif.message}</p>
                          <p className="text-xs text-slate-400 mt-1">{new Date(notif.created_at).toLocaleString('de-DE')}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-slate-400">Keine Benachrichtigungen</div>
                  )}
                </div>
              )}
            </div>
             </div>
          <form action={signOut} className="mt-auto pb-24 md:pb-6">
            <button type="submit" className="w-full text-left p-2 text-red-500 font-bold text-xs flex items-center gap-2 hover:bg-red-50 rounded transition">
              <LogOut size={14}/> Ausloggen
            </button>
          </form>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'trips' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-black mb-4">Meine Reisen</h1>
            {/* DEBUG: State-Info */}
            {(() => {
              console.log("DEBUG RENDER: Trips Tab - State:", { 
                tripsLength: trips.length, 
                trips: trips,
                tripsType: typeof trips,
                isArray: Array.isArray(trips),
                activeTab: activeTab
              });
              return null;
            })()}
            {trips.length > 0 ? (
              trips.map(t => (
                <div key={t.id} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm">
                  <div>
                    <div className="font-bold text-lg">{t.origin} ➔ {t.destination}</div>
                    <div className="text-xs text-slate-500 mt-1">{new Date(t.date).toLocaleDateString('de-DE')} · {t.capacity_kg} kg frei</div>
                  </div>
                  <button onClick={()=>deleteItem("trips", t.id)} className="p-2 hover:bg-red-50 text-red-400 rounded transition">
                    <Trash2 size={16}/>
                  </button>
                </div>
              ))
            ) : (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400">
                <Plane size={48} className="mx-auto mb-4 opacity-50"/>
                <p>Noch keine Reisen erstellt.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'my-requests' && (
                    <div className="space-y-4">
            <h1 className="text-2xl font-black mb-4">Meine Anfragen</h1>
            {myRequests.length > 0 ? (
              myRequests.map(req => {
                // RequestCard für "Meine Anfragen" mit lokalem State
                const MyRequestCard = () => {
                  const [localStatus, setLocalStatus] = useState<string>(req.status || 'pending');
                  
                  // Update localStatus wenn req.status sich ändert
                  useEffect(() => {
                    if (req.status) {
                      setLocalStatus(req.status);
                    }
                  }, [req.status]);
                  
                  const statusLower = (localStatus || 'pending').toLowerCase();
                  const showQRCode = statusLower === 'accepted' || statusLower === 'in_transit';
                  
                  return (
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition">
                      <div className="flex justify-between items-start">
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={async () => {
                            if (req.trip_id) {
                              // Finde die Reise, um den Sherpa zu finden
                              const { data: tripData } = await supabase.from("trips").select("user_id, sherpa_name").eq("id", req.trip_id).single();
                              if (tripData) {
                                // Finde oder erstelle Conversation
                                const { data: existingConv } = await supabase
                                  .from('conversations')
                                  .select('id')
                                  .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${tripData.user_id}),and(participant1_id.eq.${tripData.user_id},participant2_id.eq.${user.id})`)
                                  .single();
                                
                                let convId = existingConv?.id;
                                if (!convId) {
                                  const { data: newConv } = await supabase
                                    .from('conversations')
                                    .insert({ participant1_id: user.id, participant2_id: tripData.user_id })
                                    .select()
                                    .single();
                                  if (newConv) convId = newConv.id;
                                }
                                
                                if (convId) {
                                  openChat(convId, tripData.user_id, tripData.sherpa_name, req.trip_id);
                                }
                              }
                            }
                          }}
                        >
                          <div className="font-bold text-lg mb-2">{req.content_desc}</div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                            <span>{req.weight_kg} kg</span>
                            <span>·</span>
                            <span>{req.value_eur}€</span>
                            {req.trips && (
                              <>
                                <span>·</span>
                                <span>{req.trips.origin} ➔ {req.trips.destination}</span>
                              </>
                            )}
                          </div>
                          <div className="mt-2">
                            {getStatusBadge(localStatus)}
                          </div>
                          {/* Debug Info */}
                          <div className="text-xs text-slate-400 mt-1">
                            Status Debug: {localStatus} (DB: {req.status || 'N/A'})
                          </div>
                          
                          {/* QR-Code für Absender: Zeige wenn accepted oder in_transit */}
                          {showQRCode && (
                            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                              <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                                <QrCode size={16} className="text-orange-500"/> Abhol-Code für Empfänger
                              </h3>
                              <div className="flex flex-col sm:flex-row gap-4 items-start">
                                <div className="bg-white p-3 rounded-lg border border-slate-200">
                                  <QRCodeSVG 
                                    value={getDeliveryCode(req)} 
                                    size={120}
                                    level="M"
                                    includeMargin={true}
                                  />
                                </div>
                                <div className="flex-1">
                                  <p className="text-xs text-slate-600 mb-2">
                                    Sende diesen QR-Code an deine Kontaktperson am Zielort. Der Sherpa muss ihn scannen, um das Paket zu übergeben.
                                  </p>
                                  <div className="bg-white p-2 rounded border border-slate-200 font-mono text-xs text-slate-700 break-all">
                                    {getDeliveryCode(req)}
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
                            deleteItem("shipments", req.id); 
                          }} 
                          className="p-2 hover:bg-red-50 text-red-400 rounded transition ml-4"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    </div>
                  );
                };
                
                return <MyRequestCard key={req.id} />;
              })
            ) : (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400">
                <Package size={48} className="mx-auto mb-4 opacity-50"/>
                <p>Noch keine Anfragen gestellt.</p>
              </div>
            )}
                            </div>
        )}

        {activeTab === 'incoming-requests' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-black mb-4">Eingehende Anfragen</h1>
            {incomingRequests.length > 0 ? (
              incomingRequests.map(req => {
                // RequestCard Component mit lokalem State
                const RequestCard = () => {
                  const shipment = req.shipments;
                  const senderName = shipment?.sender_name || "User";
                  const trip = shipment?.trips || shipment?.trip;
                  
                  // Lokaler State für sofortige UI-Updates
                  const [localStatus, setLocalStatus] = useState<string>(shipment?.status || 'pending');
                  const [tripShipments, setTripShipments] = useState<Array<{ weight_kg: number; status: string; id?: string }>>([]);
                  const [remainingCapacity, setRemainingCapacity] = useState<number | null>(null);
                  
                  // Lade alle shipments für diesen Trip, um die verfügbare Kapazität zu berechnen
                  useEffect(() => {
                    if (shipment?.trip_id && trip) {
                      supabase
                        .from("shipments")
                        .select("id, weight_kg, status")
                        .eq("trip_id", shipment.trip_id)
                        .then(({ data }) => {
                          if (data) {
                            setTripShipments(data);
                            // Berechne verfügbare Kapazität
                            // WICHTIG: Wenn Status PENDING ist, schließe das aktuelle Paket aus
                            const excludeId = isPending ? shipment.id : undefined;
                            const remaining = calculateRemainingCapacity(
                              trip.capacity_kg || 0,
                              data,
                              excludeId
                            );
                            setRemainingCapacity(remaining);
                          }
                        });
                    }
                  }, [shipment?.trip_id, shipment?.id, shipment?.status]);
                  
                  // Update localStatus wenn shipment.status sich ändert (von außen)
                  useEffect(() => {
                    if (shipment?.status) {
                      setLocalStatus(shipment.status);
                    }
                  }, [shipment?.status]);
                  
                  const statusLower = (localStatus || 'pending').toLowerCase();
                  const isAccepted = statusLower === 'accepted';
                  const isPending = statusLower === 'pending';
                  const isInTransit = statusLower === 'in_transit';
                  const isDelivered = statusLower === 'delivered' || statusLower === 'completed';
                  
                  // Prüfe, ob das Paket zu schwer ist (nur wenn pending)
                  const packageWeight = shipment?.weight_kg || 0;
                  const exceedsCapacity = isPending && remainingCapacity !== null && packageWeight > remainingCapacity;
                  
                  const handleToggle = async () => {
                    const tripId = shipment?.trip_id;
                    const senderId = shipment?.user_id;
                    
                    if (!tripId || !senderId || !shipment?.id) {
                      console.error('Missing required data:', { tripId, senderId, shipmentId: shipment?.id });
                      return;
                    }
                    
                    // 1. Optimistic Update ZUERST
                    const nextStatus = isAccepted ? 'pending' : 'accepted';
                    setLocalStatus(nextStatus);
                    
                    console.log('DEBUG TOGGLE:', { 
                      currentStatus: localStatus, 
                      nextStatus,
                      isAccepted 
                    });
                    
                    try {
                      // 2. Dann DB Update
                      // WICHTIG: trip_id NICHT auf null setzen beim Zurücksetzen zu pending
                      // Der trip_id bleibt erhalten, nur der Status ändert sich
                      const updateData: any = { status: nextStatus };
                      // Nur trip_id setzen wenn accepted, sonst nicht ändern (behalten)
                      if (nextStatus === 'accepted') {
                        updateData.trip_id = tripId;
                      }
                      // delivery_code bleibt erhalten, auch wenn Status zurückgesetzt wird
                      
                      const { error } = await supabase.from('shipments').update(updateData).eq('id', shipment.id);
                      
                      if (error) {
                        console.error('DB Update Error:', error);
                        // Rollback bei Fehler
                        setLocalStatus(localStatus);
                        alert('Fehler beim Aktualisieren. Bitte versuche es erneut.');
                        return;
                      }
                      
                      // 3. Update State optimistisch
                      setIncomingRequests(prev => prev.map(r => {
                        if (r.shipments?.id === shipment.id) {
                          return {
                            ...r,
                            shipments: {
                              ...r.shipments,
                              status: nextStatus
                            }
                          };
                        }
                        return r;
                      }));
                      
                      // 4. Chat Nachricht nur bei Success und accepted
                      if (nextStatus === 'accepted') {
                        // Finde oder erstelle Conversation
                        const { data: existingConv } = await supabase
                          .from('conversations')
                          .select('id')
                          .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${senderId}),and(participant1_id.eq.${senderId},participant2_id.eq.${user.id})`)
                          .single();
                        
                        let convId = existingConv?.id;
                        if (!convId) {
                          const { data: newConv } = await supabase
                            .from('conversations')
                            .insert({ participant1_id: user.id, participant2_id: senderId })
                            .select()
                            .single();
                          if (newConv) convId = newConv.id;
                        }
                        
                        if (convId) {
                          await supabase.from('messages').insert({
                            conversation_id: convId,
                            sender_id: user.id,
                            content: "✅ Anfrage akzeptiert!",
                            type: 'text'
                          });
                        }
                      }
                    } catch (e) {
                      console.error('Toggle Error:', e);
                      // Rollback bei Fehler
                      setLocalStatus(localStatus);
                      alert('Fehler beim Aktualisieren. Bitte versuche es erneut.');
                    }
                  };
                  
                  return (
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="font-bold text-lg mb-1">{shipment?.content_desc || "Anfrage"}</div>
                          <div className="text-xs text-slate-500 mb-2">
                            Von: {senderName} · {shipment?.weight_kg} kg · {shipment?.value_eur}€
                          </div>
                          <div className="mb-2">
                            {getStatusBadge(localStatus)}
                          </div>
                          {/* Debug Info */}
                          <div className="text-xs text-slate-400 mt-1">
                            Status Debug: {localStatus} (DB: {shipment?.status || 'N/A'})
                            </div>
                        </div>
                      </div>
                      
                      {/* Warnung bei Überkapazität */}
                      {exceedsCapacity && (
                        <div className="mb-3 p-3 bg-red-100 border-2 border-red-500 rounded-lg">
                          <div className="flex items-start gap-2">
                            <ShieldAlert size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-bold text-red-700 text-sm mb-1">
                                ⚠️ Achtung: Kapazität überschritten
                              </p>
                              <p className="text-xs text-red-600">
                                Dieses Paket ({packageWeight} kg) überschreitet deine freie Kapazität ({remainingCapacity} kg).
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Button Logik */}
                      {isDelivered ? (
                        // Status-Badge für erfolgreich übergebene Pakete
                        <div className="mt-3 p-4 bg-green-100 border-2 border-green-500 rounded-lg text-center">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <CheckCircle size={24} className="text-green-600" />
                            <span className="font-bold text-green-700 text-lg">Erfolgreich übergeben</span>
                          </div>
                          <p className="text-sm text-green-600">Das Paket wurde erfolgreich an den Empfänger übergeben.</p>
                        </div>
                      ) : (
                        <div className="flex gap-2 mt-3 flex-wrap">
                          {/* Toggle Button: Nur sichtbar wenn nicht delivered */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleToggle();
                            }}
                            className={`flex-1 py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition-colors ${
                              isAccepted 
                                ? 'bg-orange-500 hover:bg-orange-600' 
                                : 'bg-green-500 hover:bg-green-600'
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
                          
                          {/* Ablehnen Button: Nur sichtbar wenn pending */}
                          {isPending && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const senderId = shipment?.user_id;
                                if (senderId) {
                                  handleRejectRequest(req.id, shipment.id, senderId);
                                }
                              }}
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg text-sm transition flex items-center justify-center gap-2"
                            >
                              <XCircle size={20}/> Ablehnen
                            </button>
                          )}
                          
                          {/* QR Scanner Button für Sherpa: Nur wenn accepted oder in_transit */}
                          {(isAccepted || isInTransit) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                if (shipment?.id) {
                                  startQRScanner(shipment.id);
                                }
                              }}
                              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg text-sm transition flex items-center justify-center gap-2"
                            >
                              <Camera size={20}/> Lieferung abschließen (Scan)
                            </button>
                          )}
                          
                          {/* Chat Button: Immer sichtbar */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              const partnerId = shipment?.user_id;
                              const partnerName = senderName;
                              const convId = req.conversation_id;
                              if (convId) {
                                openChat(convId, partnerId, partnerName, shipment?.trip_id);
                              } else {
                                // Erstelle Conversation falls nicht vorhanden
                                supabase.from('conversations').insert({ participant1_id: user.id, participant2_id: partnerId }).select().single().then(({ data: newConv }) => {
                                  if (newConv) {
                                    openChat(newConv.id, partnerId, partnerName, shipment?.trip_id);
                                  }
                                });
                              }
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg text-sm transition flex items-center justify-center gap-2"
                          >
                            <MessageCircle size={20}/> Chat
                          </button>
                        </div>
                      )}
                    </div>
                  );
                };
                
                return <RequestCard key={req.id} />;
              })
            ) : (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400">
                <MessageCircle size={48} className="mx-auto mb-4 opacity-50"/>
                <p>Noch keine eingehenden Anfragen.</p>
                </div>
            )}
            </div>
         )}

        {activeTab === 'messages' && (
            <div className="space-y-4">
            <h1 className="text-2xl font-black mb-4">Nachrichten</h1>
            {conversations.length > 0 ? (
              conversations.map(conv => {
                const lastMsg = conv.lastMessage;
                const preview = lastMsg?.content || 'Keine Nachrichten';
                const truncatedPreview = preview.length > 60 ? preview.substring(0, 60) + '...' : preview;
                const timeAgo = lastMsg?.created_at 
                  ? new Date(lastMsg.created_at).toLocaleString('de-DE', { 
                      day: '2-digit', 
                      month: '2-digit', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })
                  : new Date(conv.created_at).toLocaleString('de-DE', { 
                      day: '2-digit', 
                      month: '2-digit' 
                    });

                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      const tripId = lastMsg?.shipments?.trip_id || null;
                      openChat(conv.id, conv.partnerId, conv.partnerName, tripId);
                    }}
                    className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer"
                  >
                    <div className="flex gap-4 items-start">
                      <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {conv.partnerName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                        <div>
                            <h3 className="font-bold text-lg text-slate-900">{conv.partnerName}</h3>
                            {conv.tripContext && (
                              <p className="text-xs text-slate-500 mt-0.5">
                                {conv.tripContext.origin} ➔ {conv.tripContext.destination}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                            {timeAgo}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                          {lastMsg?.type === 'booking_request' ? (
                            <span className="flex items-center gap-1 text-orange-600 font-medium">
                              <Package size={14}/> Buchungsanfrage
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
                <Mail size={48} className="mx-auto mb-4 opacity-50"/>
                <p>Noch keine Nachrichten.</p>
                <p className="text-xs mt-2">Starte eine Unterhaltung über eine Reise.</p>
              </div>
            )}
            </div>
         )}

         {activeTab === 'shipments' && (
            <div className="space-y-4">
                <h1 className="text-2xl font-black mb-4">Meine Pakete</h1>
            {shipments.length > 0 ? (
              shipments.map(s => (
                <div key={s.id} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm">
                  <div>
                    <div className="font-bold text-lg">{s.content_desc}</div>
                    <div className="text-xs text-slate-500 mt-1">{s.weight_kg} kg · {s.value_eur}€ · {s.status}</div>
                  </div>
                  <button onClick={()=>deleteItem("shipments", s.id)} className="p-2 hover:bg-red-50 text-red-400 rounded transition">
                    <Trash2 size={16}/>
                  </button>
                </div>
              ))
            ) : (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400">
                <Package size={48} className="mx-auto mb-4 opacity-50"/>
                <p>Noch keine Pakete erstellt.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-black mb-4">Bewertungen</h1>
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400">
              <Star size={48} className="mx-auto mb-4 opacity-50"/>
              <p>Bewertungsfunktion kommt bald.</p>
              <p className="text-xs mt-2">Hier siehst du später alle Bewertungen, die du erhalten hast.</p>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-lg space-y-8">
            <h1 className="text-2xl font-black">Einstellungen</h1>
            
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Lock size={16} className="text-slate-400"/> Sicherheit
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-slate-400 mb-1 block">Neues Passwort</label>
                  <div className="flex gap-2">
                    <input 
                      type="password" 
                      value={newPassword} 
                      onChange={e=>setNewPassword(e.target.value)} 
                      className="flex-1 border border-slate-200 p-3 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" 
                      placeholder="••••••••"
                      minLength={6}
                    />
                    <button onClick={updatePassword} className="bg-slate-900 text-white px-6 rounded-lg text-sm font-bold hover:bg-slate-800 transition">
                      Ändern
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Mindestens 6 Zeichen</p>
                </div>
                        <div>
                  <label className="text-xs font-bold uppercase text-slate-400 mb-1 block">E-Mail ändern</label>
                  <div className="flex gap-2">
                    <input 
                      type="email" 
                      value={newEmail} 
                      onChange={e=>setNewEmail(e.target.value)} 
                      className="flex-1 border border-slate-200 p-3 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" 
                      placeholder="neue@email.com"
                    />
                    <button onClick={updateEmail} className="bg-slate-900 text-white px-6 rounded-lg text-sm font-bold hover:bg-slate-800 transition">
                      Ändern
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Du erhältst eine Bestätigungsmail</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <ShieldAlert size={16} className="text-slate-400"/> Privatsphäre & Blockierungen
              </h3>
              <p className="text-sm text-slate-500 mb-4">Hier kannst du sehen, wen du blockiert hast.</p>
              {blockedUsers.length > 0 ? (
                <div className="space-y-2">
                  {blockedUsers.map(block => (
                    <div key={block.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center text-xs font-bold">
                          {block.blocked?.email?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <span className="text-sm font-medium">{block.blocked?.email || 'Unbekannt'}</span>
                      </div>
                      <button 
                        onClick={() => unblockUser(block.blocked_id)} 
                        className="text-xs text-blue-600 font-bold hover:text-blue-800 transition"
                      >
                        Entblockieren
                      </button>
                    </div>
                ))}
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
            
            {scanResult === 'success' ? (
              <div className="text-center py-8">
                <CheckCircle size={64} className="mx-auto mb-4 text-green-500" />
                <h3 className="text-2xl font-bold text-green-600 mb-2">Erfolgreich zugestellt!</h3>
                <p className="text-slate-600">Das Paket wurde erfolgreich übergeben.</p>
              </div>
            ) : scanResult === 'invalid' ? (
              <div className="text-center py-8">
                <XCircle size={64} className="mx-auto mb-4 text-red-500" />
                <h3 className="text-xl font-bold text-red-600 mb-2">Ungültiger QR-Code</h3>
                <p className="text-slate-600 mb-4">Der gescannte Code stimmt nicht überein.</p>
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
                    style={{ maxHeight: '400px' }}
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
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-900">
        <p>Lade Dashboard...</p>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}