"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import { 
  Plane, Package, Trash2, QrCode, X, CheckCircle, 
  AlertTriangle, ScanLine, Truck, AlertOctagon 
} from "lucide-react";
import { redirect } from "next/navigation";

export default function Dashboard() {
  const supabase = createClient();
  
  // Data
  const [trips, setTrips] = useState<any[]>([]);
  const [myShipments, setMyShipments] = useState<any[]>([]);
  const [incomingShipments, setIncomingShipments] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrData, setQrData] = useState<{id: string, type: string} | null>(null);
  
  // Shipping Modal
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [activeShipmentId, setActiveShipmentId] = useState<string | null>(null);
  const [trackingId, setTrackingId] = useState("");

  // Check Modal (Sherpa)
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [checkItem, setCheckItem] = useState<any>(null);

  // --- INIT ---
  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return redirect("/login");
      setUser(user);

      // Meine Reisen
      const { data: myTrips } = await supabase.from("trips").select("*").eq("user_id", user.id);
      if (myTrips) setTrips(myTrips);

      // Meine Pakete
      const { data: myPkgs } = await supabase.from("shipments").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (myPkgs) setMyShipments(myPkgs);
      
      // Eingehende Aufträge (Pakete für mich als Sherpa)
      if (myTrips && myTrips.length > 0) {
        const tripIds = myTrips.map(t => t.id);
        const { data: incoming } = await supabase.from("shipments").select("*, profiles:user_id(first_name)").in("trip_id", tripIds).neq("status", "pending");
        if (incoming) setIncomingShipments(incoming);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  // --- ACTIONS ---

  // 1. Postversand eintragen (Sender)
  const saveTracking = async () => {
    if (!trackingId) return alert("Bitte Nummer eingeben.");
    await supabase.from('shipments').update({ 
      tracking_provider: 'DHL/Post', tracking_id: trackingId, status: 'shipping_to_sherpa' 
    }).eq('id', activeShipmentId);
    window.location.reload();
  };

  // 2. Einfache Annahme (Sherpa)
  const confirmReceipt = async () => {
    // Einfacher Update auf "In Transit"
    await supabase.from('shipments').update({ status: 'in_transit' }).eq('id', checkItem.id);
    alert("Paket akzeptiert! Gute Reise.");
    window.location.reload();
  };

  const rejectPackage = async () => {
    if(confirm("Willst du den Auftrag wirklich ablehnen?")) {
        // Status zurücksetzen oder auf 'rejected'
        await supabase.from('shipments').update({ status: 'rejected', trip_id: null }).eq('id', checkItem.id);
        alert("Auftrag abgelehnt.");
        window.location.reload();
    }
  };

  // 3. QR Handshake (Finale Übergabe)
  const handleFinalHandover = async (id: string) => {
    const { data } = await supabase.rpc('perform_handshake', { p_shipment_id: id, p_sherpa_id: user.id });
    if(data === 'delivered') {
        alert("Perfekt! Paket zugestellt.");
        window.location.reload();
    }
  };

  const deleteItem = async (table: string, id: string) => {
    if(!confirm("Löschen?")) return;
    await supabase.from(table).delete().eq("id", id);
    window.location.reload();
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Lade...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <nav className="bg-slate-900 text-white p-4 sticky top-0 z-50 flex justify-between items-center">
        <Link href="/" className="font-black text-xl tracking-tighter flex items-center gap-2"><span className="text-orange-500">←</span> SHERPASS</Link>
        <div className="text-xs text-slate-400">{user.email?.split('@')[0]}</div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-12">
        
        {/* --- SHERPA BEREICH --- */}
        <section>
          <h2 className="text-xl font-black mb-6 flex items-center gap-2"><Plane className="text-orange-500" /> Meine Aufträge</h2>
          {incomingShipments.length === 0 ? <p className="text-sm text-slate-500">Keine Aufträge.</p> : (
            <div className="space-y-4">
              {incomingShipments.map((item) => (
                <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          item.status === 'in_transit' ? 'bg-blue-100 text-blue-700' : 
                          item.status === 'shipping_to_sherpa' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100'
                        }`}>
                          {item.status.replace(/_/g, ' ')}
                        </span>
                        {item.tracking_id && <span className="text-[10px] flex gap-1 items-center text-slate-500"><Truck size={10}/> {item.tracking_id}</span>}
                      </div>
                      <h3 className="font-bold text-lg">{item.content_desc}</h3>
                      <p className="text-xs text-slate-500">{item.weight_kg}kg · {item.value_eur}€ · Von {item.profiles?.first_name || "User"}</p>
                    </div>
                  </div>

                  {/* ACTIONS SHERPA */}
                  <div>
                    {(item.status === 'shipping_to_sherpa' || item.status === 'accepted') && (
                        <button 
                            onClick={() => { setCheckItem(item); setShowCheckModal(true); }}
                            className="w-full bg-slate-900 text-white py-3 rounded-lg text-sm font-bold hover:bg-orange-500 transition flex justify-center items-center gap-2"
                        >
                            Paket prüfen & annehmen
                        </button>
                    )}

                    {item.status === 'in_transit' && (
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-center">
                            <p className="text-xs text-blue-800 mb-2 font-bold">Du bist unterwegs.</p>
                            <button onClick={() => { const id = prompt("Scan Simulation (Empfänger Code):"); if(id) handleFinalHandover(id) }} className="w-full bg-blue-600 text-white py-2 rounded font-bold text-xs flex justify-center items-center gap-2">
                                <ScanLine size={14}/> Empfänger scannen
                            </button>
                        </div>
                    )}
                    
                    {item.status === 'delivered' && <div className="text-center text-green-600 font-bold text-sm">✅ Zugestellt</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* --- SENDER BEREICH --- */}
        <section>
          <h2 className="text-xl font-black mb-6 flex items-center gap-2"><Package className="text-blue-600" /> Meine Pakete</h2>
          {myShipments.map((item) => (
            <div key={item.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-4 relative">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="font-bold">{item.content_desc}</div>
                        <div className="text-xs text-slate-500">{item.weight_kg} kg · {item.status}</div>
                    </div>
                    {item.status === 'pending' && <button onClick={() => deleteItem("shipments", item.id)} className="text-red-300 hover:text-red-500"><Trash2 size={16}/></button>}
                </div>

                <div className="flex gap-2">
                    {/* QR Code immer verfügbar für Hand-to-Hand */}
                    {(item.status === 'accepted' || item.status === 'in_transit') && (
                        <button onClick={() => { setQrData({id: item.id, type: item.status === 'in_transit' ? "QR für Empfänger" : "QR für Abholung"}); setShowQRModal(true); }} className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                            <QrCode size={14}/> QR Code
                        </button>
                    )}

                    {/* Postversand Button */}
                    {(item.status === 'accepted') && (
                        <button onClick={() => { setActiveShipmentId(item.id); setShowShippingModal(true); }} className="flex-1 bg-blue-50 text-blue-600 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                            <Truck size={14}/> Per Post
                        </button>
                    )}
                </div>
            </div>
          ))}
        </section>

      </div>

      {/* --- MODAL: CHECK & CONFIRM (SHERPA) --- */}
      {showCheckModal && checkItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl p-6">
            <h3 className="font-bold text-lg mb-2">Paket-Check</h3>
            <p className="text-sm text-slate-500 mb-4">Bitte bestätige den Inhalt.</p>
            
            <div className="bg-slate-50 p-3 rounded border mb-6 text-sm">
                <strong>Erwarteter Inhalt:</strong><br/>
                {checkItem.content_desc} ({checkItem.weight_kg}kg)
            </div>

            <div className="space-y-3">
                <button onClick={confirmReceipt} className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-green-600 transition">
                    Inhalt stimmt, ich nehme es mit
                </button>
                <button onClick={rejectPackage} className="w-full text-red-500 text-sm font-bold py-2">
                    Ablehnen (Inhalt falsch/illegal)
                </button>
                <button onClick={() => setShowCheckModal(false)} className="w-full text-slate-400 text-xs py-2">Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {/* Shipping Modal */}
      {showShippingModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-xs space-y-4">
            <h3 className="font-bold">Postversand eintragen</h3>
            <p className="text-xs text-slate-500">Der Sherpa sieht diese Nummer im Dashboard.</p>
            <input value={trackingId} onChange={e=>setTrackingId(e.target.value)} placeholder="Sendungsnummer (DHL/Hermes...)" className="w-full border p-3 rounded-lg text-sm" />
            <button onClick={saveTracking} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg">Speichern</button>
            <button onClick={()=>setShowShippingModal(false)} className="w-full text-slate-400 text-xs">Abbrechen</button>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {showQRModal && qrData && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4">
            <button onClick={()=>setShowQRModal(false)} className="absolute top-4 right-4 text-white"><X/></button>
            <div className="bg-white p-4 rounded-xl mb-4"><QRCode value={qrData.id} /></div>
            <p className="text-white font-bold text-center">{qrData.type}</p>
            {qrData.type.includes("Empfänger") && <p className="text-white/60 text-xs mt-2 text-center max-w-xs">Screenshot an Empfänger senden.</p>}
        </div>
      )}

    </div>
  );
}