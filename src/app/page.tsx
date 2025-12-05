"use client";

import { createClient } from "@/utils/supabase/client";
import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search, Plane, X, MessageCircle, User, Package, Calendar, 
  Luggage, Info, CheckCircle, Plus, Flag, ArrowRight, Zap, QrCode
} from "lucide-react";
import { analyzeContentRisk } from "./lib/compliance";
import { getCountryForCity } from "./lib/locations";

// --- TYPES ---
type Trip = {
  id: string; user_id: string; origin: string; destination: string; date: string;
  capacity_kg: number; sherpa_name: string; description?: string; price_eur?: number;
  origin_country?: string; destination_country?: string;
};

type Shipment = {
  id: string; 
  content_desc: string; 
  weight_kg: number; 
  value_eur: number; 
  status: string;
  trip_id?: string | null;  // UUID ist ein String, kann null sein
  sender_name?: string | null;  // Name des Absenders
  user_id?: string | null;  // ID des Absenders
  delivery_code?: string | null;  // QR-Code für die Lieferung
  created_at?: string;  // Zeitstempel
  updated_at?: string;  // Zeitstempel
};

function HomeContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- STATE ---
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  // Navigation & Data
  const [teaserTrips, setTeaserTrips] = useState<Trip[]>([]);
  const [myShipments, setMyShipments] = useState<Shipment[]>([]);
  
  // Search Inputs
  const [searchFrom, setSearchFrom] = useState("");
  const [searchTo, setSearchTo] = useState("");

  // Chat
  const [showChat, setShowChat] = useState(false);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [chatPartnerName, setChatPartnerName] = useState("");
  const [chatPartnerId, setChatPartnerId] = useState<string | null>(null);
  const [contextTripId, setContextTripId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [showBookingOptions, setShowBookingOptions] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Modals
  const [showManifestModal, setShowManifestModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  
  // Forms
  const [manifestInput, setManifestInput] = useState("");
  const [weight, setWeight] = useState("");
  const [value, setValue] = useState("");
  const [warning, setWarning] = useState<any>(null);
  const [reportReason, setReportReason] = useState("");

  const [offerOrigin, setOfferOrigin] = useState("");
  const [offerDest, setOfferDest] = useState("");
  const [offerDate, setOfferDate] = useState("");
  const [offerWeight, setOfferWeight] = useState("");
  const [offerDesc, setOfferDesc] = useState("");

  // --- INIT ---
  useEffect(() => {
    const initData = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUserEmail(data.user.email ?? null);
        setCurrentUserId(data.user.id);
        loadMyShipments(data.user.id);
      }
      // Nur Teaser-Trips für die Startseite laden
      fetchInitialTrips();
    };
    initData();

    const handleScroll = () => setScrolled(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserEmail(session?.user?.email ?? null);
      setCurrentUserId(session?.user?.id ?? null);
      if (session?.user) loadMyShipments(session.user.id);
    });
    
    return () => {
        subscription.unsubscribe();
        window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Chat aus URL-Parametern öffnen
  useEffect(() => {
    const openChatId = searchParams.get('openChat');
    const partnerId = searchParams.get('partnerId');
    const partnerName = searchParams.get('partnerName');
    const tripIdParam = searchParams.get('tripId');
    
    if (openChatId && partnerId && partnerName && currentUserId) {
      // Decodiere den Namen
      const decodedName = decodeURIComponent(partnerName);
      
      // Setze Chat-Parameter
      setChatPartnerName(decodedName);
      setChatPartnerId(partnerId);
      setContextTripId(tripIdParam || null);
      setShowChat(true);
      setActiveConvId(openChatId);
      
      // Lade Nachrichten
      const loadChatMessages = async (cId: string) => {
        // WICHTIG: Lade Nachrichten und ihre Shipments
        // Verwende shipments(*) um alle Shipments zu laden, dann filtern wir manuell nach shipment_id
        const { data, error } = await supabase
          .from('messages')
          .select('*, shipments(*)')
          .eq('conversation_id', cId)
          .order('created_at', {ascending: true});
        
        if (error) {
          console.error("Fehler beim Laden der Chat-Nachrichten:", error);
          return;
        }
        
        if (data) {
          // WICHTIG: Für jede Nachricht nur das Shipment mit der passenden shipment_id verwenden
          let processedData = data.map(msg => {
            if (msg.type === 'booking_request' && msg.shipment_id) {
              // Finde das Shipment mit der passenden ID
              let shipment = null;
              if (Array.isArray(msg.shipments)) {
                shipment = msg.shipments.find((s: any) => s.id === msg.shipment_id) || null;
              } else if (msg.shipments && msg.shipments.id === msg.shipment_id) {
                shipment = msg.shipments;
              }
              
              // Zusätzliche Validierung: Prüfe trip_id wenn tripIdParam vorhanden
              if (tripIdParam && shipment && shipment.trip_id !== tripIdParam) {
                console.warn("DEBUG: Shipment trip_id stimmt nicht überein:", {
                  msgId: msg.id,
                  shipmentId: shipment.id,
                  shipmentTripId: shipment.trip_id,
                  expectedTripId: tripIdParam
                });
                return { ...msg, shipments: null };
              }
              
              return { ...msg, shipments: shipment };
            }
            return msg;
          });
          
          // Zusätzliche Filterung: Wenn tripIdParam vorhanden ist, filtere nach trip_id
          if (tripIdParam) {
            console.log("DEBUG: Filtere Chat-Nachrichten nach trip_id:", tripIdParam);
            processedData = processedData.map(msg => {
              // Für booking_request Nachrichten: Prüfe ob shipment.trip_id übereinstimmt
              if (msg.type === 'booking_request' && msg.shipments) {
                const shipment = Array.isArray(msg.shipments) ? msg.shipments[0] : msg.shipments;
                if (shipment && shipment.trip_id !== tripIdParam) {
                  console.warn("DEBUG: Shipment trip_id stimmt nicht überein (zweite Prüfung):", {
                    msgId: msg.id,
                    shipmentId: shipment.id,
                    shipmentTripId: shipment.trip_id,
                    expectedTripId: tripIdParam
                  });
                  // Entferne das falsche Shipment
                  return { ...msg, shipments: null };
                }
              }
              return msg;
            });
          }
          
          setChatMessages(processedData);
          setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      };
      
      loadChatMessages(openChatId);
      
      // Entferne Parameter aus URL (ohne Reload)
      const url = new URL(window.location.href);
      url.searchParams.delete('openChat');
      url.searchParams.delete('partnerId');
      url.searchParams.delete('partnerName');
      url.searchParams.delete('tripId');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, currentUserId, supabase]);

  useEffect(() => {
    if (manifestInput.length > 2) {
      // @ts-ignore
      setWarning(analyzeContentRisk(manifestInput));
    } else setWarning(null);
  }, [manifestInput]);

  // Chat Listener
  useEffect(() => {
    if (!activeConvId) return;
    const channel = supabase.channel(`chat:${activeConvId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConvId}` }, 
      (payload) => {
        if (payload.new.type === 'booking_request') {
          loadMessages(activeConvId);
        } else {
             setChatMessages(prev => {
            // Prüfen ob Nachricht schon vorhanden (optimistic update oder bereits geladen)
            const exists = prev.find(m => m.id === payload.new.id || (m.id?.toString().startsWith('temp-') && m.sender_id === payload.new.sender_id && m.content === payload.new.content));
            if (exists) {
              // Ersetze optimistic update mit echter Nachricht
              return prev.map(m => 
                (m.id?.toString().startsWith('temp-') && m.sender_id === payload.new.sender_id && m.content === payload.new.content)
                  ? payload.new
                  : m
              ).filter((m, idx, arr) => arr.findIndex(msg => msg.id === m.id) === idx); // Entferne Duplikate
            }
                return [...prev, payload.new];
             });
             setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConvId]);

  // --- DATA LOADING ---
  const fetchInitialTrips = async () => {
    try {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .gte("date", new Date().toISOString().split('T')[0])
      .order("date", { ascending: true })
      .limit(50);

    if (error) {
        console.error("DB Error:", error.message);
        setTeaserTrips([]);
    } else {
        if (data && data.length > 0) {
          setTeaserTrips(data.slice(0, 3) as any);
    } else {
          setTeaserTrips([]);
        }
      }
    } catch (err) {
      console.error("Fehler beim Laden:", err);
      setTeaserTrips([]);
    }
  };

  const loadMyShipments = async (userId: string) => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from("shipments")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "pending");
      
      if (error) {
        console.error("Fehler:", error);
        setMyShipments([]);
      } else {
        setMyShipments(data as any || []);
      }
    } catch (err) {
      console.error("Fehler:", err);
      setMyShipments([]);
    }
  };

  const loadMessages = async (cId: string) => {
    // WICHTIG: Lade nur das spezifische Shipment für jede Nachricht (über shipment_id Foreign Key)
    // Der Query verwendet shipments!inner(*) um nur Shipments zu laden, die mit der Nachricht verknüpft sind
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        shipments!messages_shipment_id_fkey(*)
      `)
      .eq('conversation_id', cId)
      .order('created_at', {ascending: true});
    
    if (error) {
      console.error("Fehler beim Laden der Nachrichten:", error);
      // Fallback: Versuche ohne explizite Foreign Key Relation
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('messages')
        .select('*, shipments(*)')
        .eq('conversation_id', cId)
        .order('created_at', {ascending: true});
      
      if (fallbackError) {
        console.error("Fallback Query Fehler:", fallbackError);
        return;
      }
      
      if (fallbackData) {
        // Manuelle Filterung: Nur das Shipment mit der passenden shipment_id
        const processedData = fallbackData.map(msg => {
          if (msg.type === 'booking_request' && msg.shipment_id) {
            // Finde das Shipment mit der passenden ID
            const shipment = Array.isArray(msg.shipments) 
              ? msg.shipments.find((s: any) => s.id === msg.shipment_id)
              : (msg.shipments?.id === msg.shipment_id ? msg.shipments : null);
            
            // Zusätzliche Validierung: Prüfe trip_id wenn contextTripId vorhanden
            if (contextTripId && shipment && shipment.trip_id !== contextTripId) {
              console.warn("DEBUG: Shipment trip_id stimmt nicht überein:", {
                msgId: msg.id,
                shipmentId: shipment.id,
                shipmentTripId: shipment.trip_id,
                contextTripId: contextTripId
              });
              return { ...msg, shipments: null };
            }
            
            return { ...msg, shipments: shipment || null };
          }
          return msg;
        });
        
        setChatMessages(processedData);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
      return;
    }
    
    if (data) {
      // Zusätzliche Filterung: Wenn contextTripId vorhanden ist, filtere nach trip_id
      let filteredData = data;
      
      if (contextTripId) {
        console.log("DEBUG: Filtere Nachrichten nach trip_id:", contextTripId);
        filteredData = data.map(msg => {
          // Für booking_request Nachrichten: Prüfe ob shipment.trip_id übereinstimmt
          if (msg.type === 'booking_request' && msg.shipments) {
            const shipment = Array.isArray(msg.shipments) ? msg.shipments[0] : msg.shipments;
            if (shipment && shipment.trip_id !== contextTripId) {
              console.warn("DEBUG: Shipment trip_id stimmt nicht überein:", {
                msgId: msg.id,
                shipmentId: shipment.id,
                shipmentTripId: shipment.trip_id,
                contextTripId: contextTripId
              });
              // Entferne das falsche Shipment
              return { ...msg, shipments: null };
            }
          }
          return msg;
        });
      }
      
      setChatMessages(filteredData);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }

  // --- SEARCH ACTIONS ---
  const performSearch = () => {
    // Weiterleitung zur Ergebnisseite mit Query-Parametern
    const params = new URLSearchParams();
    if (searchFrom) params.set('from', searchFrom);
    if (searchTo) params.set('to', searchTo);
    
    router.push(`/search-results?${params.toString()}`);
  };

  const initiateBooking = (tripId: string, userId: string, sherpaName: string) => {
    if (!currentUserId) {
      router.push("/login");
      return;
    }
    if (currentUserId === userId) {
      alert("Das ist deine eigene Reise!");
      return;
    }
    openChat(userId, sherpaName, tripId);
  };

  const handleReportUser = async () => {
    if(!reportReason) return;
    await supabase.from("reports").insert({ reporter_id: currentUserId, reported_user_id: chatPartnerId, context: 'chat', reason: reportReason });
    alert("Nutzer gemeldet."); setShowReportModal(false); setReportReason("");
  };

  // --- CHAT ---
  const openChat = async (targetId: string, name: string, tripId?: string) => {
    setChatPartnerName(name);
    setChatPartnerId(targetId);
    setContextTripId(tripId || null);
    setShowChat(true);
    setChatMessages([]);
    setIsChatLoading(true);
    
    const { data: convs } = await supabase.from('conversations').select('*').or(`and(participant1_id.eq.${currentUserId},participant2_id.eq.${targetId}),and(participant1_id.eq.${targetId},participant2_id.eq.${currentUserId})`);
    let cId = convs?.[0]?.id;
    if (!cId) {
      const { data: newC } = await supabase.from('conversations').insert({ participant1_id: currentUserId, participant2_id: targetId }).select().single();
      if(newC) cId = newC.id;
    }
    if (cId) { setActiveConvId(cId); loadMessages(cId); }
    setIsChatLoading(false);
  };

  const sendMessage = async (txt: string, type='text', shipId: string|null=null) => {
    if(!activeConvId || !txt.trim() || !currentUserId) return;
    
    const messageText = txt.trim();
    
    // Optimistic update: Nachricht sofort zum State hinzufügen
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      conversation_id: activeConvId,
      sender_id: currentUserId,
      content: messageText,
      type,
      shipment_id: shipId,
      created_at: new Date().toISOString(),
      shipments: null
    };
    
    // Sofort zum State hinzufügen und UI aktualisieren
    setChatMessages(prev => [...prev, optimisticMessage]);
    setChatInput("");
    setShowBookingOptions(false);
    
    // Scroll zum Ende
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    
    // Nachricht in DB speichern
    const { data: savedMessage, error } = await supabase
      .from('messages')
      .insert({ conversation_id: activeConvId, sender_id: currentUserId, content: messageText, type, shipment_id: shipId })
      .select()
      .single();
    
    if (error) {
      console.error("Fehler beim Senden:", error);
      // Optimistic update rückgängig machen
      setChatMessages(prev => prev.filter(m => m.id !== tempId));
      alert("Fehler beim Senden der Nachricht: " + error.message);
      return;
    }
    
    // Der Real-time Listener sollte die Nachricht automatisch ersetzen
    // Falls nicht, ersetzen wir manuell nach kurzer Verzögerung
    if (savedMessage) {
      setTimeout(() => {
        setChatMessages(prev => {
          // Entferne optimistic update
          const withoutTemp = prev.filter(m => m.id !== tempId);
          // Prüfen ob echte Nachricht schon vorhanden (vom Real-time Listener)
          const exists = withoutTemp.find(m => m.id === savedMessage.id);
          if (!exists) {
            return [...withoutTemp, savedMessage];
          }
          return withoutTemp;
        });
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }, 500);
    }
  };

  const handleBookingAccept = async (msg: any) => {
    await supabase.from('shipments').update({ status: 'accepted', trip_id: contextTripId }).eq('id', msg.shipment_id);
    await sendMessage("✅ Anfrage akzeptiert!", 'text');
  };

  // --- SAVE ---
  const saveManifest = async () => {
    if(!manifestInput || !weight || !currentUserId) {
      alert("Bitte alle Felder ausfüllen!");
      return;
    }

    const weightNum = Number(weight);
    const valueNum = Number(value || 0);
    
    if (isNaN(weightNum) || weightNum <= 0) {
      alert("Bitte gültiges Gewicht eingeben!");
      return;
    }

    try {
      // Lade Profil für sender_name
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", currentUserId)
        .single();
      
      const senderName = profile?.first_name || "User";
      
      // Erstelle Shipment mit trip_id, falls verfügbar
      const shipmentData: any = {
        user_id: currentUserId,
        content_desc: manifestInput.trim(),
        weight_kg: weightNum,
        value_eur: valueNum,
        sender_name: senderName,
        status: "pending"
      };
      
      // WICHTIG: trip_id hinzufügen, wenn verfügbar (aus contextTripId)
      if (contextTripId) {
        shipmentData.trip_id = contextTripId;
        console.log("DEBUG: Shipment wird mit trip_id erstellt:", contextTripId);
      } else {
        console.warn("DEBUG: Keine trip_id verfügbar - Shipment wird ohne trip_id erstellt");
      }
      
      const { data: newShipment, error } = await supabase
        .from("shipments")
        .insert([shipmentData])
        .select()
        .single();
      
      if (error) {
        console.error("Fehler beim Erstellen des Shipments:", error);
        alert("Fehler beim Erstellen: " + error.message);
        return;
      }
      
      if (!newShipment) {
        alert("Fehler: Shipment wurde nicht erstellt");
        return;
      }
      
      console.log("DEBUG: Shipment erstellt:", { 
        id: newShipment.id, 
        trip_id: newShipment.trip_id,
        content_desc: newShipment.content_desc 
      });
      
      // Automatisch als Buchungsanfrage in den Chat posten, wenn Chat aktiv
      if (activeConvId && newShipment) {
        const { error: msgError } = await supabase.from('messages').insert({ 
          conversation_id: activeConvId, 
          sender_id: currentUserId, 
          content: "Anfrage senden...", 
          type: 'booking_request', 
          shipment_id: newShipment.id 
        });
        
        if (msgError) {
          console.error("Fehler beim Erstellen der Nachricht:", msgError);
        } else {
          // Nachrichten neu laden
          loadMessages(activeConvId);
        }
      }
      
      alert("Paket erstellt" + (activeConvId ? " und Anfrage gesendet!" : "!"));
      setShowManifestModal(false);
      setManifestInput("");
      setWeight("");
      setValue("");
      
      if(currentUserId) {
        loadMyShipments(currentUserId);
      }
    } catch (err: any) {
      console.error("Unerwarteter Fehler beim Erstellen des Pakets:", err);
      alert("Ein Fehler ist aufgetreten: " + (err.message || "Unbekannter Fehler"));
    }
  };

  const submitOffer = async () => {
    if (!currentUserId) {
      alert("Bitte einloggen!");
      return;
    }

    // Validierung
    if (!offerOrigin || !offerDest || !offerDate || !offerWeight) {
      alert("Bitte alle Felder ausfüllen!");
      return;
    }

    const weightNum = Number(offerWeight);
    if (isNaN(weightNum) || weightNum <= 0) {
      alert("Bitte gültiges Gewicht eingeben!");
      return;
    }

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", currentUserId)
        .single();
      
    const name = profile?.first_name || "Sherpa";
      
      const { data, error } = await supabase
        .from("trips")
        .insert({
          user_id: currentUserId,
          origin: offerOrigin.trim(),
          destination: offerDest.trim(),
          date: offerDate,
          capacity_kg: weightNum,
          sherpa_name: name,
          description: offerDesc?.trim() || null,
          origin_country: getCountryForCity(offerOrigin),
          destination_country: getCountryForCity(offerDest),
          price_eur: null // Optional, kann später hinzugefügt werden
        })
        .select()
        .single();

      if (error) {
        console.error("Fehler beim Erstellen der Reise:", error);
        alert("Fehler beim Erstellen der Reise: " + error.message);
        return;
      }

      if (data) {
        alert("Reise erfolgreich erstellt!");
        setShowOfferModal(false);
        // Formular zurücksetzen
        setOfferOrigin("");
        setOfferDest("");
        setOfferDate("");
        setOfferWeight("");
        setOfferDesc("");
        // Trips neu laden
        fetchInitialTrips();
      }
    } catch (err: any) {
      console.error("Unerwarteter Fehler:", err);
      alert("Ein Fehler ist aufgetreten: " + (err.message || "Unbekannter Fehler"));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20 relative">
      
      <style jsx global>{`
        @keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .ticker-wrap { overflow: hidden; white-space: nowrap; width: 100%; }
        .ticker { display: flex; width: max-content; animation: scroll 60s linear infinite; }
      `}</style>

      {/* NAVBAR */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 h-16 flex items-center justify-between px-2 sm:px-4 lg:px-8 overflow-x-hidden max-w-full">
        <Link href="/" className="flex items-center gap-1 sm:gap-2 cursor-pointer flex-shrink-0 min-w-0">
          <Plane className="text-orange-500 flex-shrink-0" /> <span className="font-black text-lg sm:text-xl tracking-tighter truncate">SHERPASS</span>
        </Link>
        <div className="flex gap-2 sm:gap-4 items-center flex-shrink-0">
          {/* Desktop: Vollständiger Button mit Text */}
          <button onClick={() => setShowOfferModal(true)} className="hidden sm:flex text-orange-500 font-bold text-sm items-center gap-1 hover:bg-orange-50 px-3 py-2 rounded-full transition">
            <Plus size={16}/> Reise anbieten
          </button>
          {/* Mobile: Nur Icon-Button */}
          <button onClick={() => setShowOfferModal(true)} className="sm:hidden bg-orange-500 text-white p-2.5 rounded-full shadow-lg hover:bg-orange-600 transition flex items-center justify-center">
            <Plus size={20}/>
          </button>
          {!userEmail ? (
            <Link href="/login" className="bg-slate-100 hover:bg-slate-200 p-2 rounded-full"><User size={20}/></Link>
          ) : (
            <Link href="/dashboard" className="bg-slate-900 text-white w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs hover:bg-orange-500 transition">
                 {userEmail.charAt(0).toUpperCase()}
            </Link>
          )}
        </div>
      </nav>

      {/* STICKY SEARCH */}
      {scrolled && (
        <div className="bg-white border-b border-slate-200 p-2 sm:p-3 fixed top-16 left-0 w-full z-30 shadow-md animate-in slide-in-from-top-5 overflow-x-hidden max-w-full">
          <div className="max-w-4xl mx-auto flex gap-1 sm:gap-2 px-2 sm:px-0">
            <input 
              list="airport-cities" 
              value={searchFrom} 
              onChange={e=>setSearchFrom(e.target.value)} 
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.focus()}
              placeholder="Von" 
              className="flex-1 min-w-0 bg-slate-100 rounded-lg px-2 sm:px-3 py-2 text-xs sm:text-sm font-bold" 
            />
            <input 
              list="airport-cities" 
              value={searchTo} 
              onChange={e=>setSearchTo(e.target.value)} 
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.focus()}
              placeholder="Nach" 
              className="flex-1 min-w-0 bg-slate-100 rounded-lg px-2 sm:px-3 py-2 text-xs sm:text-sm font-bold" 
            />
            <button 
              onClick={performSearch} 
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg text-sm flex items-center justify-center flex-shrink-0 transition"
              style={{ minWidth: '44px' }}
            >
              <span className="hidden sm:inline px-3 py-2">Suchen</span>
              <span className="sm:hidden p-2">
                <Search size={18} />
              </span>
            </button>
          </div>
        </div>
      )}

      {(
        <>
        {/* HERO SECTION */}
        <div className="relative min-h-[85vh] flex flex-col justify-center items-center text-center px-2 sm:px-4 overflow-x-hidden bg-slate-900">
           <div className="absolute inset-0 opacity-50 bg-[url('https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=2074&auto=format&fit=crop')] bg-cover bg-center"></div>
          <div className="relative z-10 max-w-4xl w-full overflow-x-hidden">
              <h1 className="text-white font-black text-4xl md:text-7xl mb-6 leading-tight drop-shadow-2xl">
                Sende dorthin,<br/>wo die Post nicht hinkommt.
              </h1>
              <p className="text-slate-200 text-lg md:text-xl mb-12 drop-shadow-md font-medium max-w-2xl mx-auto">
                Community Logistik ohne Grenzen. Sicher, direkt und persönlich.
              </p>
              
            <div className="bg-white p-2 sm:p-3 rounded-2xl shadow-2xl flex flex-col md:flex-row gap-2 max-w-3xl mx-auto w-full overflow-x-hidden">
              <div className="flex-1 flex items-center bg-slate-50 rounded-xl px-3 sm:px-4 py-2 sm:py-3 min-w-0">
                <div className="w-3 h-3 rounded-full border-2 border-slate-400 mr-2 sm:mr-3 flex-shrink-0"></div>
                <input 
                  list="airport-cities" 
                  value={searchFrom} 
                  onChange={e=>setSearchFrom(e.target.value)} 
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.target.focus()}
                  placeholder="Von (Stadt)" 
                  className="bg-transparent w-full font-bold outline-none text-slate-900 placeholder-slate-400 text-sm sm:text-lg min-w-0"
                />
                </div>
              <div className="flex-1 flex items-center bg-slate-50 rounded-xl px-3 sm:px-4 py-2 sm:py-3 min-w-0">
                <div className="w-3 h-3 rounded-full border-2 border-orange-500 mr-2 sm:mr-3 flex-shrink-0"></div>
                <input 
                  list="airport-cities" 
                  value={searchTo} 
                  onChange={e=>setSearchTo(e.target.value)} 
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.target.focus()}
                  placeholder="Nach (Stadt)" 
                  className="bg-transparent w-full font-bold outline-none text-slate-900 placeholder-slate-400 text-sm sm:text-lg min-w-0"
                />
                </div>
              <button 
                onClick={performSearch} 
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm sm:text-lg px-4 sm:px-8 py-3 sm:py-4 rounded-xl transition shadow-lg flex items-center justify-center gap-2 flex-shrink-0 w-full md:w-auto"
              >
                <Search size={18} className="sm:w-5 sm:h-5"/> 
                <span className="hidden sm:inline">Suchen</span>
                <span className="sm:hidden">Suchen</span>
              </button>
              </div>
           </div>
        </div>

        {/* TICKER */}
        <div className="bg-slate-900 text-white py-3 border-y border-slate-800 overflow-hidden">
            <div className="ticker text-sm font-mono flex whitespace-nowrap">
                <span className="mx-4 text-orange-500">●</span> Ahmad: Hamburg ➔ Kabul <span className="mx-4 text-orange-500">●</span> Maria: Berlin ➔ Teheran <span className="mx-4 text-orange-500">●</span> Jean: Paris ➔ Bamako <span className="mx-4 text-orange-500">●</span> Ali: Frankfurt ➔ Mazar-i-Sharif
                <span className="mx-4 text-orange-500">●</span> Lisa: München ➔ Dubai <span className="mx-4 text-orange-500">●</span> Karim: London ➔ Islamabad <span className="mx-4 text-orange-500">●</span> Sarah: Köln ➔ Istanbul
                <span className="mx-4 text-orange-500">●</span> Ahmad: Hamburg ➔ Kabul <span className="mx-4 text-orange-500">●</span> Maria: Berlin ➔ Teheran <span className="mx-4 text-orange-500">●</span> Jean: Paris ➔ Bamako <span className="mx-4 text-orange-500">●</span> Ali: Frankfurt ➔ Mazar-i-Sharif
                <span className="mx-4 text-orange-500">●</span> Lisa: München ➔ Dubai <span className="mx-4 text-orange-500">●</span> Karim: London ➔ Islamabad <span className="mx-4 text-orange-500">●</span> Sarah: Köln ➔ Istanbul
            </div>
        </div>

        {/* BENEFITS SECTION */}
        <div className="max-w-7xl mx-auto px-4 py-20 text-center bg-white">
          <h2 className="text-3xl font-black text-slate-900 mb-4">Warum Sherpass besser ist.</h2>
          <p className="text-slate-500 mb-12">Klassischer Versand vs. Community Power.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-lg">
                <h3 className="text-2xl font-bold text-slate-900 mb-4">Schneller</h3>
                <p className="text-slate-600 mb-4 text-sm leading-relaxed">DHL braucht Wochen nach Afghanistan oder Mali. Ein Sherpa nimmt den Direktflug.</p>
                <div className="flex justify-center items-center gap-2 font-bold text-sm text-green-600">✓ Ankunft in 24-48h</div>
            </div>
            <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-lg">
                <h3 className="text-2xl font-bold text-slate-900 mb-4">Sicherer</h3>
                <p className="text-slate-600 mb-4 text-sm leading-relaxed">Kein anonymes Verteilerzentrum. Persönliche Übergabe (Hand-to-Hand).</p>
                <div className="flex flex-col gap-2 items-center font-bold text-sm text-orange-500">
                    <span>✓ Verifizierte Reisende</span>
                    <span>✓ Live-Manifest Check</span>
                </div>
            </div>
            <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-lg">
                <h3 className="text-2xl font-bold text-slate-900 mb-4">Kostenlos</h3>
                <p className="text-slate-600 mb-4 text-sm leading-relaxed">Sherpass nimmt 0% Provision. Ihr einigt euch selbst auf den Preis.</p>
                <div className="flex justify-center items-center gap-2 font-bold text-sm text-slate-900">✓ 100% Dein Geld</div>
            </div>
          </div>
        </div>

        <div id="results-anchor"></div>

        {/* TEASER TRIPS */}
        <div className="bg-slate-50 py-20 border-y border-slate-200">
            <div className="max-w-4xl mx-auto px-4">
                <h2 className="text-xl font-black mb-8 flex items-center gap-2"><Zap className="text-orange-500"/> Beliebte Verbindungen</h2>
                <div className="grid md:grid-cols-3 gap-4">
                    {teaserTrips.length > 0 ? teaserTrips.map(trip => (
                <div key={trip.id} onClick={() => router.push(`/trip/${trip.id}`)} className="bg-white p-5 rounded-xl border border-slate-200 hover:border-orange-300 cursor-pointer flex flex-col justify-between group transition shadow-sm h-32">
                            <div className="font-bold text-slate-700 text-lg">
                                {trip.origin} <span className="text-orange-500">➔</span> {trip.destination}
                            </div>
                            <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                                <span>{new Date(trip.date).toLocaleDateString()}</span>
                                <span className="bg-slate-100 px-2 py-1 rounded font-bold text-slate-700">{trip.capacity_kg} kg frei</span>
                            </div>
                        </div>
                    )) : <p className="text-sm text-slate-400 col-span-3">Lade Reisen...</p>}
                </div>
            </div>
        </div>

        {/* HOW IT WORKS */}
        <div className="max-w-5xl mx-auto px-4 py-20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
                <div className="flex flex-col items-center md:items-start">
                    <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 mx-auto md:mx-0">
                        <Search size={28} />
                    </div>
                    <h3 className="font-bold text-xl mb-2">Finde einen Sherpa</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">Nutze die Suche, um Reisende auf deiner Route zu finden. Schau dir ihre Profile und Bewertungen an.</p>
                </div>
                <div className="flex flex-col items-center md:items-start">
                    <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-4 mx-auto md:mx-0">
                        <Package size={28} />
                    </div>
                    <h3 className="font-bold text-xl mb-2">Erstelle ein Paket</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">Beschreibe den Inhalt deiner Sendung. Mit 100% Community Trust.</p>
                </div>
                <div className="flex flex-col items-center md:items-start">
                    <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 mx-auto md:mx-0">
                        <QrCode size={28} />
                    </div>
                    <h3 className="font-bold text-xl mb-2">Sichere Übergabe</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">Digitaler Handshake und Tracking für maximale Sicherheit bei der Übergabe.</p>
                </div>
            </div>
        </div>
        </>
      )}

      {/* CONTENT AREA - Entfernt, da Suchergebnisse jetzt auf /search-results angezeigt werden */}

      {/* MODALS */}
      
      {showOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 relative animate-in zoom-in-95">
            <button onClick={() => setShowOfferModal(false)} className="absolute top-4 right-4"><X/></button>
            <h2 className="text-xl font-black mb-4">Reise anbieten</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input list="airport-cities" value={offerOrigin} onChange={e=>setOfferOrigin(e.target.value)} placeholder="Von" className="border p-3 rounded-lg w-full"/>
                <input list="airport-cities" value={offerDest} onChange={e=>setOfferDest(e.target.value)} placeholder="Nach" className="border p-3 rounded-lg w-full"/>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={offerDate} onChange={e=>setOfferDate(e.target.value)} className="border p-3 rounded-lg w-full"/>
                <input type="number" value={offerWeight} onChange={e=>setOfferWeight(e.target.value)} placeholder="Freie kg" className="border p-3 rounded-lg w-full"/>
              </div>
              <textarea value={offerDesc} onChange={e=>setOfferDesc(e.target.value)} placeholder="Beschreibung..." className="border p-3 rounded-lg w-full h-24 text-sm"/>
              <button onClick={submitOffer} className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg mt-2">Veröffentlichen</button>
            </div>
          </div>
        </div>
      )}

      {showManifestModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 relative animate-in fade-in zoom-in">
            <button onClick={() => setShowManifestModal(false)} className="absolute top-4 right-4"><X/></button>
            <h2 className="text-xl font-black mb-2">Paket erstellen</h2>
            <div className="space-y-3">
              <input value={manifestInput} onChange={e=>setManifestInput(e.target.value)} placeholder="Inhalt" className="border p-3 rounded-lg w-full"/>
              <div className="flex gap-2"><input type="number" value={weight} onChange={e=>setWeight(e.target.value)} placeholder="kg" className="border p-3 rounded-lg w-full"/><input type="number" value={value} onChange={e=>setValue(e.target.value)} placeholder="Wert €" className="border p-3 rounded-lg w-full"/></div>
              {warning?.found && <div className="text-red-500 text-xs font-bold bg-red-50 p-2 rounded">⚠️ {warning.msg}</div>}
              <button onClick={saveManifest} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg mt-2 hover:bg-blue-700">Erstellen & Anfrage senden</button>
            </div>
          </div>
        </div>
      )}

      {showChat && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4">
          <div className="bg-white w-full sm:max-w-md h-[90vh] sm:h-[600px] sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center font-bold text-white">{chatPartnerName.charAt(0)}</div>
                <div><h3 className="font-bold text-sm">{chatPartnerName}</h3><span className="text-xs text-green-400">● Online</span></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowReportModal(true)} className="p-2 text-slate-400 hover:text-red-400"><Flag size={18}/></button>
                <button onClick={() => setShowChat(false)} className="p-2 hover:bg-slate-800 rounded"><X size={20}/></button>
              </div>
            </div>

            <div className="flex-1 bg-slate-50 p-4 overflow-y-auto space-y-3">
              {chatMessages.map(msg => (
                <div key={msg.id} className={`max-w-[85%] p-3 rounded-xl text-sm shadow-sm ${msg.sender_id === currentUserId ? 'bg-blue-600 text-white ml-auto rounded-tr-none' : 'bg-white border border-slate-200 mr-auto rounded-tl-none'}`}>
                  {msg.type === 'booking_request' ? (
                    <div className={msg.sender_id === currentUserId ? "text-white" : "text-slate-900"}>
                      <div className="flex items-center gap-2 font-bold mb-2 border-b border-white/20 pb-1 uppercase text-xs tracking-wider"><Package size={14}/> Buchungsanfrage</div>
                      {(() => {
                        // WICHTIG: Extrahiere das Shipment korrekt (kann Array oder Objekt sein)
                        const shipment = Array.isArray(msg.shipments) ? msg.shipments[0] : msg.shipments;
                        
                        // Zusätzliche Validierung: Prüfe ob trip_id übereinstimmt
                        if (contextTripId && shipment && shipment.trip_id !== contextTripId) {
                          console.warn("DEBUG: Falsches Shipment im Chat angezeigt:", {
                            msgId: msg.id,
                            shipmentTripId: shipment.trip_id,
                            contextTripId: contextTripId
                          });
                          return (
                            <div className="text-red-500 text-xs">
                              ⚠️ Paket-Daten nicht verfügbar (falsche trip_id)
                            </div>
                          );
                        }
                        
                        if (!shipment) {
                          return (
                            <div className="text-slate-400 text-xs">
                              Paket-Daten nicht verfügbar
                            </div>
                          );
                        }
                        
                        return (
                          <>
                      <div className="flex gap-3 items-center">
                         <div className="bg-white/20 w-10 h-10 rounded flex items-center justify-center font-bold text-lg">📦</div>
                              <div>
                                <div className="font-bold text-base">{shipment.content_desc}</div>
                                <div className="text-xs opacity-80">{shipment.weight_kg} kg</div>
                      </div>
                      </div>
                            {(() => {
                              // Prüfe Status
                              const statusLower = (shipment.status || 'pending').toLowerCase();
                              const isDelivered = statusLower === 'delivered' || statusLower === 'completed';
                              const isAccepted = statusLower === 'accepted';
                              const isPending = statusLower === 'pending';
                              
                              // Wenn delivered: Zeige Status-Badge statt Button
                              if (isDelivered) {
                                return (
                                  <div className="mt-3 p-3 bg-green-100 border-2 border-green-500 rounded-lg text-center">
                                    <div className="flex items-center justify-center gap-2 mb-1">
                                      <CheckCircle size={16} className="text-green-600" />
                                      <span className="font-bold text-green-700 text-sm">Erfolgreich übergeben</span>
                                    </div>
                                    <p className="text-xs text-green-600">Das Paket wurde erfolgreich an den Empfänger übergeben.</p>
                                  </div>
                                );
                              }
                              
                              // Wenn accepted: Zeige Status-Badge
                              if (isAccepted) {
                                return (
                                  <div className="mt-2 bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded flex items-center gap-1 border border-green-200">
                                    <CheckCircle size={12}/> Akzeptiert
                                  </div>
                                );
                              }
                              
                              // WICHTIG: Zeige "Annehmen"-Button nur, wenn:
                              // 1. Ich bin der Besitzer der Reise (currentUserId === shipment.trip.user_id)
                              // 2. Der Status ist pending
                              // 3. Die Nachricht wurde nicht von mir gesendet
                              const trip = shipment.trips || shipment.trip;
                              const isTripOwner = trip && trip.user_id === currentUserId;
                              const isNotMyMessage = msg.sender_id !== currentUserId;
                              
                              if (isTripOwner && isPending && isNotMyMessage) {
                                return (
                                  <button 
                                    onClick={() => handleBookingAccept(msg)} 
                                    className="w-full bg-green-500 text-white py-2 rounded-lg font-bold text-xs mt-3 hover:bg-green-600 shadow-lg"
                                  >
                                    ✅ Annehmen
                                  </button>
                                );
                              }
                              return null;
                            })()}
                          </>
                        );
                      })()}
                    </div>
                  ) : (<p>{msg.content}</p>)}
                  <span className="text-[10px] opacity-60 block text-right mt-1">{new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                </div>
              ))}
              <div ref={chatEndRef}></div>
            </div>

            <div className="p-3 bg-white border-t border-slate-200 shrink-0 relative">
              {showBookingOptions && (
                <div className="absolute bottom-full left-0 w-full bg-white border-t border-slate-200 shadow-xl p-4 rounded-t-2xl animate-in slide-in-from-bottom-2 z-20">
                  <div className="flex justify-between mb-3"><h3 className="font-bold text-sm text-slate-800">Wähle ein Paket</h3><button onClick={() => setShowBookingOptions(false)}><X size={16}/></button></div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    <button onClick={() => { setShowManifestModal(true); setShowBookingOptions(false); }} className="w-full p-3 border-2 border-dashed border-blue-300 bg-blue-50 rounded-lg text-blue-600 font-bold text-sm hover:bg-blue-100 flex items-center justify-center gap-2 transition"><Plus size={16}/> Neues Paket erstellen</button>
                    {myShipments.map(s => (
                      <div key={s.id} onClick={async () => {
                        // Wenn trip_id fehlt, aber contextTripId verfügbar ist, aktualisiere das Shipment
                        if (contextTripId && !s.trip_id) {
                          await supabase
                            .from('shipments')
                            .update({ trip_id: contextTripId })
                            .eq('id', s.id);
                          console.log("DEBUG: Shipment trip_id aktualisiert:", { shipmentId: s.id, trip_id: contextTripId });
                        }
                        sendMessage("Anfrage senden...", "booking_request", s.id);
                      }} className="p-3 border rounded-lg hover:bg-slate-50 cursor-pointer flex justify-between items-center transition group">
                        <span className="font-bold text-sm text-slate-700 group-hover:text-blue-600">{s.content_desc}</span>
                        <div className="flex items-center gap-2"><span className="text-xs bg-slate-100 px-2 py-1 rounded font-bold">{s.weight_kg} kg</span><ArrowRight size={14} className="text-slate-300 group-hover:text-blue-500"/></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 items-center pb-safe">
                <button onClick={() => setShowBookingOptions(!showBookingOptions)} className={`p-3 rounded-full transition ${showBookingOptions ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}><Plus size={20}/></button>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage(chatInput)} placeholder="Nachricht..." className="flex-1 bg-slate-100 rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={() => sendMessage(chatInput)} className="p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition"><MessageCircle size={20}/></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReportModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm animate-in zoom-in-95">
            <h3 className="font-bold mb-4 text-red-600 flex items-center gap-2"><Flag size={18}/> Nutzer melden</h3>
            <textarea value={reportReason} onChange={e=>setReportReason(e.target.value)} className="w-full border p-3 rounded-lg h-24 text-sm mb-4 resize-none focus:ring-2 focus:ring-red-500 outline-none" placeholder="Grund..." />
            <button onClick={handleReportUser} className="w-full bg-red-600 text-white font-bold py-3 rounded-lg">Melden</button>
            <button onClick={()=>setShowReportModal(false)} className="w-full text-slate-400 text-xs mt-3">Abbrechen</button>
          </div>
        </div>
      )}

      <datalist id="airport-cities">
        <option value="Frankfurt (FRA)" />
        <option value="Berlin (BER)" />
        <option value="Hamburg (HAM)" />
        <option value="München (MUC)" />
        <option value="Kabul (KBL)" />
        <option value="Mazar-i-Sharif (MZR)" />
        <option value="Teheran (IKA)" />
        <option value="Istanbul (IST)" />
        <option value="Dubai (DXB)" />
        <option value="Paris (CDG)" />
        <option value="London (LHR)" />
      </datalist>

      <footer className="bg-slate-50 py-12 border-t border-slate-200 mt-20 text-center text-sm text-slate-400">
        SHERPASS © 2025
      </footer>

      {/* Mobile: Sticky "Reise anbieten" Button am unteren Rand */}
      <button 
        onClick={() => setShowOfferModal(true)} 
        className="sm:hidden fixed bottom-6 right-6 bg-orange-500 text-white w-14 h-14 rounded-full shadow-2xl hover:bg-orange-600 transition flex items-center justify-center z-50 animate-in fade-in slide-in-from-bottom-4"
        aria-label="Reise anbieten"
      >
        <Plus size={24} strokeWidth={3}/>
      </button>

    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-900">
        <p>Lade...</p>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
