"use client";

import { createClient } from "@/utils/supabase/client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import {
  Search, Shield, Zap, AlertTriangle, CheckCircle, Plane,
  QrCode, FileText, X, MessageCircle, User, Plus, Package
} from "lucide-react";
import { analyzeContentRisk } from "./lib/compliance";
import { signOut } from "./auth/actions";
import { getCountryForCity } from "./lib/locations";

// --- TYPES ---
type Trip = {
  id: string;
  user_id: string;
  origin: string;
  destination: string;
  date: string;
  capacity_kg: number;
  sherpa_name: string;
};

type Shipment = {
  id: string;
  content_desc: string;
  weight_kg: number;
  value_eur: number;
  status: string;
};

export default function Home() {
  const supabase = createClient();
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- STATE ---
  
  // User & Auth
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [checkingUser, setCheckingUser] = useState(true);

  // Data
  const [trips, setTrips] = useState<Trip[]>([]);
  const [myShipments, setMyShipments] = useState<Shipment[]>([]);
  
  // Search
  const [searchFrom, setSearchFrom] = useState("");
  const [searchTo, setSearchTo] = useState("");
  const [loadingTrips, setLoadingTrips] = useState(false);

  // Manifest Form
  const [manifestInput, setManifestInput] = useState("");
  const [weight, setWeight] = useState("");
  const [value, setValue] = useState("");
  const [warning, setWarning] = useState<{ found: boolean; level: string | null; cat: string; msg: string; } | null>(null);
  const [showManifestModal, setShowManifestModal] = useState(false);
  
  // Trip Entry Form
  const [originInput, setOriginInput] = useState("");
  const [destInput, setDestInput] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [tripError, setTripError] = useState<string | null>(null);
  const [savingTrip, setSavingTrip] = useState(false);

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

  // Modals / UI
  const [showQR, setShowQR] = useState(false);
  const [showWaybill, setShowWaybill] = useState(false);
  const [shipmentId, setShipmentId] = useState<string | null>(null);
  const [qrSuccess, setQrSuccess] = useState(false);
  const [dateStr, setDateStr] = useState("");


  // --- EFFECTS ---

  useEffect(() => {
    setDateStr(new Date().toLocaleDateString("de-DE"));
    
    // User Check
    const initData = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUserEmail(data.user.email ?? null);
        setCurrentUserId(data.user.id);
        loadMyShipments(data.user.id);
      }
      fetchInitialTrips();
      setCheckingUser(false);
    };
    initData();

    // Auth Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      setCurrentUserId(session?.user?.id ?? null);
      setCheckingUser(false);
      if (session?.user) loadMyShipments(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Live Compliance Check
  useEffect(() => {
    if (manifestInput.length > 2) {
      // @ts-ignore
      const result = analyzeContentRisk(manifestInput);
      // @ts-ignore
      setWarning(result);
    } else setWarning(null);
  }, [manifestInput]);

  // QR Animation
  useEffect(() => {
    if (showQR) {
      const timer = setTimeout(() => setQrSuccess(true), 2500);
      return () => clearTimeout(timer);
    } else {
      setQrSuccess(false);
    }
  }, [showQR]);

  // CHAT LISTENER (Realtime)
  useEffect(() => {
    if (!activeConvId) return;

    const channel = supabase.channel(`chat:${activeConvId}`)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConvId}` }, 
        (payload) => {
          // Nachricht hinzufügen (Duplikate vermeiden)
          setChatMessages((prev) => {
            if (prev.find(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
          // Daten neu laden für Verknüpfungen (Paketdaten)
          loadMessages(activeConvId); 
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeConvId]);


  // --- FUNCTIONS ---

  const navigate = (viewId: string) => {
    ['view-home', 'view-search'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    document.getElementById(viewId)?.classList.remove('hidden');
    window.scrollTo(0, 0);
  };

  const fetchInitialTrips = async () => {
    setLoadingTrips(true);
    const { data } = await supabase.from("trips").select("*").gt('capacity_kg', 0).order("date", { ascending: true }).limit(10);
    if (data) setTrips(data as any);
    setLoadingTrips(false);
  };

  const loadMyShipments = async (userId: string) => {
    const { data } = await supabase.from("shipments").select("*").eq("user_id", userId).eq("status", "pending");
    if (data) setMyShipments(data as any);
  };

  const performSearch = async () => {
    setLoadingTrips(true);
    let query = supabase.from("trips").select("*").gt('capacity_kg', 0).order("date", { ascending: true });
    
    // UI Updates
    const elFrom = document.getElementById('res-from');
    const elTo = document.getElementById('res-to');
    if(elFrom) elFrom.innerText = searchFrom || "Alle";
    if(elTo) elTo.innerText = searchTo || "Alle";

    // 1. Exakt
    if (searchFrom) query = query.ilike('origin', `%${searchFrom}%`);
    if (searchTo) query = query.ilike('destination', `%${searchTo}%`);
    const { data: exactData } = await query;

    if (exactData && exactData.length > 0) {
      setTrips(exactData as any);
    } else {
      // 2. Land (Fallback)
      const fromC = getCountryForCity(searchFrom);
      const toC = getCountryForCity(searchTo);
      if (fromC || toC) {
        let q2 = supabase.from("trips").select("*").gt('capacity_kg', 0);
        if (fromC) q2 = q2.eq('origin_country', fromC);
        if (toC) q2 = q2.eq('destination_country', toC);
        const { data: countryData } = await q2;
        if (countryData && countryData.length > 0) {
          setTrips(countryData as any);
          alert("Keine exakten Treffer. Zeige Alternativen im selben Land.");
        } else {
          // 3. Alles
          fetchInitialTrips();
          alert("Keine Treffer. Zeige alle aktuellen Reisen.");
        }
      } else {
        fetchInitialTrips();
        alert("Keine Treffer. Zeige alle aktuellen Reisen.");
      }
    }
    setLoadingTrips(false);
    navigate('view-search');
  };

  // --- CHAT LOGIC ---
  const openChat = async (targetUserId: string, partnerName: string, tripId?: string) => {
    if (!currentUserId) return alert("Bitte erst einloggen!");
    if (currentUserId === targetUserId) return alert("Das ist deine eigene Reise!");

    setChatPartnerName(partnerName);
    setChatPartnerId(targetUserId);
    setContextTripId(tripId || null);
    setShowChat(true);
    setChatMessages([]);
    setIsChatLoading(true);

    // Suche Konversation
    const { data: convs } = await supabase.from('conversations')
      .select('*')
      .or(`and(participant1_id.eq.${currentUserId},participant2_id.eq.${targetUserId}),and(participant1_id.eq.${targetUserId},participant2_id.eq.${currentUserId})`);

    let cId;
    if (convs && convs.length > 0) {
      cId = convs[0].id;
    } else {
      const { data: newC, error } = await supabase.from('conversations')
        .insert({ participant1_id: currentUserId, participant2_id: targetUserId })
        .select()
        .single();
      if (!error && newC) cId = newC.id;
      else {
        setIsChatLoading(false);
        return alert("Fehler beim Chat-Start.");
      }
    }

    if (cId) {
      setActiveConvId(cId);
      loadMessages(cId);
    }
    setIsChatLoading(false);
  };

  const loadMessages = async (cId: string) => {
    const { data } = await supabase.from('messages')
      .select('*, shipments(*)')
      .eq('conversation_id', cId)
      .order('created_at', { ascending: true });
    
    if (data) {
      setChatMessages(data);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  const sendMessage = async (text: string, type: string = "text", linkedShipmentId: string | null = null) => {
    if (!activeConvId || !currentUserId) return;
    if (!text && type === 'text') return;

    await supabase.from('messages').insert({
      conversation_id: activeConvId,
      sender_id: currentUserId,
      content: text,
      type: type,
      shipment_id: linkedShipmentId
    });

    setChatInput("");
    setShowBookingOptions(false);
  };

  const handleBooking = async (msg: any, accept: boolean) => {
    if (!accept) return; // Ablehnen Logik optional
    
    // Status Update
    await supabase.from('shipments').update({ status: 'accepted', trip_id: contextTripId }).eq('id', msg.shipment_id);
    
    // Bestätigung
    await sendMessage("✅ Anfrage akzeptiert! Deal steht.", 'text');
    loadMessages(activeConvId!);
  };

  // --- SAVE LOGIC ---
  const saveManifest = async () => {
    if (!manifestInput || !weight || !value) return alert("Bitte alle Felder ausfüllen.");
    if (!currentUserId) return alert("Bitte einloggen.");

    const { data, error } = await supabase.from("shipments").insert([{
      user_id: currentUserId,
      content_desc: manifestInput,
      weight_kg: Number(weight),
      value_eur: Number(value),
      sender_name: "Verifiziert",
      status: "pending"
    }]).select();

    if (!error && data) {
      alert("Paket erstellt! Du kannst es jetzt im Chat versenden.");
      setShowManifestModal(false);
      setManifestInput(""); setWeight(""); setValue("");
      if (data[0]?.id) setShipmentId(data[0].id); // Für QR (falls direkt gewünscht)
      loadMyShipments(currentUserId);
    } else {
      alert("Fehler beim Speichern.");
    }
  };

  const submitTrip = async () => {
    if(!currentUserId) return alert("Bitte einloggen.");
    if (!originInput || !destInput) return alert("Bitte Route angeben.");
    
    setSavingTrip(true);
    // Namen holen
    const { data: profile } = await supabase.from("profiles").select("first_name").eq("id", currentUserId).single();
    const name = profile?.first_name || "Sherpa";
    
    // Länder holen
    const oC = getCountryForCity(originInput);
    const dC = getCountryForCity(destInput);

    const { error } = await supabase.from("trips").insert({
      user_id: currentUserId,
      origin: originInput,
      origin_country: oC,
      destination: destInput,
      destination_country: dC,
      date: dateInput,
      capacity_kg: Number(weightInput),
      sherpa_name: name,
    });

    setSavingTrip(false);
    if (!error) {
      alert("Reise gespeichert!");
      setOriginInput(""); setDestInput("");
      fetchInitialTrips();
      navigate('view-success');
    } else {
      alert("Fehler beim Speichern.");
    }
  };

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      
      {/* NAV */}
      <nav className="bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('view-home')}>
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-orange-500 shadow-lg"><Plane size={20} /></div>
            <span className="font-black text-xl tracking-tighter">SHERPASS</span>
          </div>
          <div className="flex gap-3 text-sm font-medium items-center">
            {!userEmail ? (
              <Link href="/login" className="px-4 py-2 rounded-full border border-slate-300 text-slate-700 font-bold">Anmelden</Link>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/dashboard" className="flex flex-col items-end"><span className="text-[10px] text-slate-400 font-bold uppercase">Mein Bereich</span><span className="text-xs font-bold">{userEmail.split('@')[0]}</span></Link>
                <form action={signOut}><button className="px-3 py-1.5 border rounded-full text-xs font-semibold">Logout</button></form>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* VIEW: HOME */}
      <div id="view-home" className="view-section">
        <header className="relative pt-20 pb-32 flex justify-center items-center bg-slate-900 overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=2074&auto=format&fit=crop')] bg-cover bg-center"></div>
          <div className="relative container mx-auto px-4 text-center z-10">
            <span className="text-orange-500 font-bold tracking-widest text-xs uppercase mb-4 block bg-white/10 w-fit mx-auto px-4 py-1 rounded-full backdrop-blur-sm border border-white/10">P2P Logistik</span>
            <h1 className="text-white font-black text-4xl sm:text-7xl mb-6 leading-tight">Sende dorthin,<br/>wo die Post nicht hinkommt.</h1>
            <div className="bg-white p-2 rounded-xl shadow-2xl max-w-3xl mx-auto flex flex-col md:flex-row gap-2">
              <input list="airport-cities" value={searchFrom} onChange={e=>setSearchFrom(e.target.value)} placeholder="Von (Stadt)" className="flex-1 p-3 rounded-lg bg-slate-50 font-bold" />
              <input list="airport-cities" value={searchTo} onChange={e=>setSearchTo(e.target.value)} placeholder="Nach (Stadt)" className="flex-1 p-3 rounded-lg bg-slate-50 font-bold" />
              <button onClick={performSearch} className="bg-orange-500 text-white font-bold px-8 py-3 rounded-lg flex items-center justify-center gap-2"><Search size={20}/> Suchen</button>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <div className="max-w-4xl mx-auto px-4 mt-8">
          
          {/* Quick Actions */}
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 mb-12 flex justify-around items-center">
            <button onClick={() => { document.getElementById('traveler')?.scrollIntoView({behavior:'smooth'}) }} className="flex flex-col items-center gap-2 text-slate-600 hover:text-orange-500 transition">
              <div className="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center text-orange-500"><Plane size={24} /></div>
              <span className="text-sm font-bold">Reise anbieten</span>
            </button>
            <div className="h-12 w-px bg-slate-200"></div>
            <button onClick={() => setShowManifestModal(true)} className="flex flex-col items-center gap-2 text-slate-600 hover:text-blue-500 transition">
              <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center text-blue-500"><Package size={24} /></div>
              <span className="text-sm font-bold">Paket erstellen</span>
            </button>
          </div>

          <h2 className="font-black text-xl mb-4">Aktuelle Reisen</h2>
          <div className="space-y-3 mb-16">
            {trips.map(trip => (
              <div key={trip.id} className="bg-white border border-slate-200 p-4 rounded-xl flex justify-between items-center shadow-sm">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase">{trip.origin} ➔ {trip.destination}</div>
                  <div className="font-bold">{new Date(trip.date).toLocaleDateString()}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-1"><User size={12}/> {trip.sherpa_name}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600 mb-1">{trip.capacity_kg} kg frei</div>
                  <button onClick={() => openChat(trip.user_id, trip.sherpa_name, trip.id)} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-orange-500 transition">Kontakt</button>
                </div>
              </div>
            ))}
          </div>

          <div id="traveler" className="bg-slate-900 text-white p-8 rounded-2xl mb-12">
            <h2 className="font-black text-xl mb-4">Werde Sherpa</h2>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input list="airport-cities" value={originInput} onChange={e=>setOriginInput(e.target.value)} placeholder="Von" className="w-1/2 bg-slate-800 rounded p-3 text-sm"/>
                <input list="airport-cities" value={destInput} onChange={e=>setDestInput(e.target.value)} placeholder="Nach" className="w-1/2 bg-slate-800 rounded p-3 text-sm"/>
              </div>
              <div className="flex gap-2">
                <input type="date" value={dateInput} onChange={e=>setDateInput(e.target.value)} className="w-1/2 bg-slate-800 rounded p-3 text-sm"/>
                <input type="number" value={weightInput} onChange={e=>setWeightInput(e.target.value)} placeholder="Kg" className="w-1/2 bg-slate-800 rounded p-3 text-sm"/>
              </div>
              <button onClick={submitTrip} disabled={savingTrip} className="w-full bg-orange-500 font-bold py-3 rounded-lg">{savingTrip ? "..." : "Reise eintragen"}</button>
            </div>
          </div>
        </div>
      </div>

      {/* VIEW: SEARCH RESULTS */}
      <div id="view-search" className="view-section hidden pt-24 px-4 max-w-4xl mx-auto">
        <button onClick={() => navigate('view-home')} className="mb-4 font-bold text-sm text-slate-500">← Zurück</button>
        <h2 className="text-2xl font-black mb-2">Suchergebnisse</h2>
        <p className="text-slate-500 mb-6"><span id="res-from">Start</span> ➔ <span id="res-to">Ziel</span></p>
        <div className="space-y-3">
          {trips.length === 0 && <p className="text-slate-500">Keine Reisen gefunden.</p>}
          {trips.map(trip => (
            <div key={trip.id} className="bg-white border p-4 rounded-xl flex justify-between items-center shadow-sm">
              <div>
                <div className="font-bold">{trip.origin} ➔ {trip.destination}</div>
                <div className="text-sm text-slate-500">{new Date(trip.date).toLocaleDateString()}</div>
                <div className="text-xs text-slate-400 mt-1">{trip.sherpa_name}</div>
              </div>
              <button onClick={() => openChat(trip.user_id, trip.sherpa_name, trip.id)} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold">Kontakt</button>
            </div>
          ))}
        </div>
      </div>

      {/* VIEW: SUCCESS */}
      <div id="view-success" className="view-section hidden fade-in min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600"><CheckCircle size={32}/></div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Erfolg!</h2>
          <button onClick={() => navigate('view-home')} className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg">Okay</button>
        </div>
      </div>

      {/* VIEW: LEGAL */}
      <div id="view-legal" className="view-section hidden pt-24 px-4"><button onClick={()=>navigate('view-home')}>← Zurück</button><h1>Impressum</h1></div>

      {/* MODAL: CHAT */}
      {showChat && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-in fade-in">
          <div className="bg-white w-full sm:max-w-md h-[90vh] sm:h-[600px] sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden">
            
            {/* Chat Header */}
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center font-bold text-white">{chatPartnerName.charAt(0)}</div>
                <div><h3 className="font-bold text-sm">{chatPartnerName}</h3><span className="text-xs text-green-400">● Online</span></div>
              </div>
              <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white p-2"><X /></button>
            </div>

            {/* Messages */}
            <div className="flex-1 bg-slate-100 p-4 overflow-y-auto space-y-3">
              {chatMessages.map(msg => (
                <div key={msg.id} className={`max-w-[85%] p-3 rounded-xl text-sm ${msg.sender_id === currentUserId ? 'bg-blue-600 text-white ml-auto rounded-tr-none' : 'bg-white border border-slate-200 mr-auto rounded-tl-none'}`}>
                  {msg.type === 'booking_request' ? (
                    <div className={msg.sender_id === currentUserId ? "text-white" : "text-slate-900"}>
                      <div className="flex items-center gap-2 font-bold mb-1 border-b border-white/20 pb-1"><Package size={14}/> BUCHUNGSANFRAGE</div>
                      <div className="font-bold text-base mb-1">{msg.shipments?.content_desc || "Paket"}</div>
                      <div className="text-xs opacity-80 mb-2">{msg.shipments?.weight_kg} kg · {msg.shipments?.value_eur} €</div>
                      
                      {msg.sender_id !== currentUserId && msg.shipments?.status === 'pending' && (
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => handleBooking(msg, true)} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-1.5 rounded font-bold text-xs">Annehmen</button>
                          <button className="flex-1 bg-red-500 hover:bg-red-600 text-white py-1.5 rounded font-bold text-xs">Ablehnen</button>
                        </div>
                      )}
                      {msg.shipments?.status === 'accepted' && <div className="mt-2 bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded flex items-center gap-1"><CheckCircle size={12}/> AKZEPTIERT</div>}
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                  <span className="text-[10px] opacity-60 block text-right mt-1">{new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                </div>
              ))}
              <div ref={chatEndRef}></div>
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white border-t border-slate-200 relative shrink-0">
              {showBookingOptions && (
                <div className="absolute bottom-full left-0 w-full bg-white border-t border-slate-200 shadow-xl p-4 rounded-t-2xl animate-in slide-in-from-bottom-2">
                  <div className="flex justify-between mb-3"><h3 className="font-bold text-sm">Paket auswählen</h3><button onClick={() => setShowBookingOptions(false)}><X size={16}/></button></div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {myShipments.length === 0 && (
                      <div className="text-center py-4">
                        <p className="text-xs text-slate-500 mb-2">Keine Pakete.</p>
                        <button onClick={() => { setShowManifestModal(true); setShowBookingOptions(false); }} className="text-orange-500 font-bold text-xs underline">Neues Paket erstellen</button>
                      </div>
                    )}
                    {myShipments.map(s => (
                      <div key={s.id} onClick={() => sendMessage("Anfrage senden...", "booking_request", s.id)} className="p-3 border rounded-lg hover:bg-slate-50 cursor-pointer flex justify-between items-center">
                        <span className="font-bold text-sm">{s.content_desc}</span><span className="text-xs bg-slate-100 px-2 py-1 rounded">{s.weight_kg} kg</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 items-center pb-safe">
                <button onClick={() => setShowBookingOptions(!showBookingOptions)} className="p-3 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-600"><Plus size={20}/></button>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage(chatInput)} placeholder="Nachricht..." className="flex-1 bg-slate-100 rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                <button onClick={() => sendMessage(chatInput)} className="p-3 bg-orange-500 text-white rounded-full shadow-lg hover:bg-orange-600"><Plane className="rotate-90" size={20} fill="currentColor"/></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MANIFEST CREATE */}
      {showManifestModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 p-6 rounded-2xl w-full max-w-sm shadow-2xl relative animate-in fade-in">
            <button onClick={() => setShowManifestModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X/></button>
            <h3 className="text-white font-bold text-lg mb-4">Neues Paket</h3>
            <div className="space-y-3 mb-4">
              <input value={manifestInput} onChange={e=>setManifestInput(e.target.value)} placeholder="Was ist drin?" className="w-full bg-slate-800 p-3 rounded-lg text-white" />
              <div className="flex gap-3">
                <input type="number" value={weight} onChange={e=>setWeight(e.target.value)} placeholder="kg" className="w-full bg-slate-800 p-3 rounded-lg text-white" />
                <input type="number" value={value} onChange={e=>setValue(e.target.value)} placeholder="Wert (€)" className="w-full bg-slate-800 p-3 rounded-lg text-white" />
              </div>
            </div>
            {warning?.found && <div className="text-red-300 text-xs mb-3">⚠️ {warning.msg}</div>}
            <button onClick={saveManifest} className="w-full bg-green-500 text-white font-bold py-3 rounded-lg">Erstellen & Schließen</button>
          </div>
        </div>
      )}

      {/* QR MODAL */}
      {showQR && <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-4"><button onClick={()=>setShowQR(false)} className="absolute top-6 right-6 text-white"><X size={32}/></button>{shipmentId ? <div className="bg-white p-4 rounded-2xl"><QRCode value={shipmentId} /></div> : <p className="text-white">Fehler</p>}</div>}
      
      {/* WAYBILL MODAL */}
      {showWaybill && <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 overflow-y-auto"><div className="bg-white w-full max-w-xl min-h-[600px] p-8 relative"><button onClick={()=>setShowWaybill(false)} className="absolute top-2 right-2 font-bold">✕</button><h1 className="text-4xl font-black italic">WAYBILL</h1><p>{manifestInput}</p></div></div>}

    </div>
  );
}