"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plane, Package, Settings, LogOut, Star, ArrowLeft, Trash2, Lock, Mail, ShieldAlert, Bell, CheckCircle, XCircle, Clock, MessageCircle } from "lucide-react";
import { signOut } from "../auth/actions";

function DashboardContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  
  const [activeTab, setActiveTab] = useState('trips');
  const [trips, setTrips] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]); // Meine Anfragen (als Absender)
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]); // Eingehende Anfragen (als Sherpa)
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

  useEffect(() => {
    const tab = searchParams.get('tab');
    if(tab) setActiveTab(tab);

    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; 
      setUser(user);

      const { data: t } = await supabase.from("trips").select("*").eq("user_id", user.id);
      if (t) setTrips(t);

      const { data: s } = await supabase.from("shipments").select("*").eq("user_id", user.id);
      if (s) setShipments(s);

      // Meine Anfragen: Alle meine Shipments mit Status
      const { data: myReqs } = await supabase
        .from("shipments")
        .select("*, trips(origin, destination, date)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (myReqs) setMyRequests(myReqs);

      // Eingehende Anfragen: Booking-Requests für meine Trips
      if (t && t.length > 0) {
        const tripIds = t.map(tr => tr.id);
        
        // Lade alle booking_request messages mit shipments
        const { data: allRequests } = await supabase
          .from("messages")
          .select("*, shipments(*, profiles:user_id(first_name))")
          .eq("type", "booking_request")
          .order("created_at", { ascending: false });
        
        if (allRequests) {
          // Filtere nur die, die zu meinen Trips gehören
          const filtered = allRequests.filter(msg => {
            const shipment = msg.shipments;
            return shipment && shipment.trip_id && tripIds.includes(shipment.trip_id);
          });
          setIncomingRequests(filtered);
        }
      }

      const { data: r } = await supabase.from("reviews").select("*").eq("reviewer_id", user.id);
      if (r) setReviews(r);

      const { data: b } = await supabase.from("blocked_users").select("*, blocked:blocked_id(id, email)").eq("blocker_id", user.id);
      if (b) setBlockedUsers(b);

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
    if (trips.length > 0) {
      const tripIds = trips.map(t => t.id);
      const { data: allRequests } = await supabase
        .from("messages")
        .select("*, shipments(*, profiles:user_id(first_name))")
        .eq("type", "booking_request")
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (allRequests) {
        const newRequests = allRequests.filter(msg => {
          const shipment = msg.shipments;
          return shipment && shipment.trip_id && tripIds.includes(shipment.trip_id) && shipment.status === 'pending';
        });
        
        newRequests.forEach(msg => {
          notifications.push({
            id: msg.id,
            type: 'new_request',
            message: `Neue Anfrage für deine Reise`,
            shipment: msg.shipments,
            conversation_id: msg.conversation_id,
            created_at: msg.created_at
          });
        });
      }
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
          type: ship.status === 'accepted' ? 'accepted' : 'rejected',
          message: `Deine Anfrage wurde ${ship.status === 'accepted' ? 'akzeptiert' : 'abgelehnt'}`,
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

  const handleAcceptRequest = async (messageId: string, shipmentId: string, tripId: string, senderId: string) => {
    await supabase.from('shipments').update({ status: 'accepted', trip_id: tripId }).eq('id', shipmentId);
    
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
    
    // Reload
    window.location.reload();
  };

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

  const openChat = (conversationId: string, partnerId: string, partnerName: string, tripId?: string) => {
    window.location.href = `/?openChat=${conversationId}&partnerId=${partnerId}&partnerName=${encodeURIComponent(partnerName)}${tripId ? `&tripId=${tripId}` : ''}`;
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-900">Lade...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 p-6 flex-shrink-0 sticky top-0 md:h-screen flex flex-col">
        <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold mb-8 text-sm">
          <ArrowLeft size={16}/> Zurück
        </Link>
        
        <nav className="space-y-1 flex-1">
          <button onClick={()=>setActiveTab('trips')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 font-bold text-sm transition ${activeTab==='trips'?'bg-slate-100 text-slate-900':'text-slate-500 hover:bg-slate-50'}`}>
            <Plane size={16}/> Meine Reisen
          </button>
          <button onClick={()=>setActiveTab('my-requests')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 font-bold text-sm transition relative ${activeTab==='my-requests'?'bg-slate-100 text-slate-900':'text-slate-500 hover:bg-slate-50'}`}>
            <Package size={16}/> Meine Anfragen
            {myRequests.filter(r => r.status === 'pending').length > 0 && (
              <span className="ml-auto bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {myRequests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
          <button onClick={()=>setActiveTab('incoming-requests')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 font-bold text-sm transition relative ${activeTab==='incoming-requests'?'bg-slate-100 text-slate-900':'text-slate-500 hover:bg-slate-50'}`}>
            <MessageCircle size={16}/> Eingehende Anfragen
            {incomingRequests.filter(r => r.shipments?.status === 'pending').length > 0 && (
              <span className="ml-auto bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {incomingRequests.filter(r => r.shipments?.status === 'pending').length}
              </span>
            )}
          </button>
          <button onClick={()=>setActiveTab('shipments')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 font-bold text-sm transition ${activeTab==='shipments'?'bg-slate-100 text-slate-900':'text-slate-500 hover:bg-slate-50'}`}>
            <Package size={16}/> Meine Pakete
          </button>
          <button onClick={()=>setActiveTab('reviews')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 font-bold text-sm transition ${activeTab==='reviews'?'bg-slate-100 text-slate-900':'text-slate-500 hover:bg-slate-50'}`}>
            <Star size={16}/> Bewertungen
          </button>
          <button onClick={()=>setActiveTab('settings')} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 font-bold text-sm transition ${activeTab==='settings'?'bg-slate-100 text-slate-900':'text-slate-500 hover:bg-slate-50'}`}>
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
                            const partnerName = notif.shipment.profiles?.first_name || "User";
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
          <form action={signOut}>
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
              myRequests.map(req => (
                <div key={req.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition">
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
                        {getStatusBadge(req.status)}
                      </div>
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
              ))
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
                const shipment = req.shipments;
                const senderName = shipment?.profiles?.first_name || "User";
                return (
                  <div key={req.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="font-bold text-lg mb-1">{shipment?.content_desc || "Anfrage"}</div>
                        <div className="text-xs text-slate-500 mb-2">
                          Von: {senderName} · {shipment?.weight_kg} kg · {shipment?.value_eur}€
                        </div>
                        <div className="mb-2">
                          {getStatusBadge(shipment?.status || 'pending')}
                        </div>
                      </div>
                    </div>
                    {shipment?.status === 'pending' && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => {
                            const tripId = shipment.trip_id;
                            const senderId = shipment.user_id;
                            if (tripId && senderId) {
                              handleAcceptRequest(req.id, shipment.id, tripId, senderId);
                            }
                          }}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition flex items-center justify-center gap-2"
                        >
                          <CheckCircle size={16}/> Akzeptieren
                        </button>
                        <button
                          onClick={() => {
                            const senderId = shipment.user_id;
                            if (senderId) {
                              handleRejectRequest(req.id, shipment.id, senderId);
                            }
                          }}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition flex items-center justify-center gap-2"
                        >
                          <XCircle size={16}/> Ablehnen
                        </button>
                        <button
                          onClick={() => {
                            const partnerId = shipment.user_id;
                            const partnerName = senderName;
                            const convId = req.conversation_id;
                            if (convId) {
                              openChat(convId, partnerId, partnerName, shipment.trip_id);
                            } else {
                              // Erstelle Conversation falls nicht vorhanden
                              supabase.from('conversations').insert({ participant1_id: user.id, participant2_id: partnerId }).select().single().then(({ data: newConv }) => {
                                if (newConv) {
                                  openChat(newConv.id, partnerId, partnerName, shipment.trip_id);
                                }
                              });
                            }
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition flex items-center justify-center gap-2"
                        >
                          <MessageCircle size={16}/> Chat
                        </button>
                      </div>
                    )}
                    {shipment?.status !== 'pending' && (
                      <button
                        onClick={() => {
                          const partnerId = shipment.user_id;
                          const partnerName = senderName;
                          const convId = req.conversation_id;
                          if (convId) {
                            openChat(convId, partnerId, partnerName, shipment.trip_id);
                          }
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition flex items-center justify-center gap-2 mt-3"
                      >
                        <MessageCircle size={16}/> Chat öffnen
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400">
                <MessageCircle size={48} className="mx-auto mb-4 opacity-50"/>
                <p>Noch keine eingehenden Anfragen.</p>
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

