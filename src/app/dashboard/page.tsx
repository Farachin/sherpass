"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plane, Package, Trash2, ArrowRight, User, Save } from "lucide-react";
import { redirect } from "next/navigation";

export default function Dashboard() {
  const supabase = createClient();
  const [trips, setTrips] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  // Profil State
  const [firstName, setFirstName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return redirect("/login");
      setUser(user);

      // 0. Profil laden
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", user.id)
        .single();
      
      if (profile) setFirstName(profile.first_name || "");

      // 1. Meine Reisen
      const { data: myTrips } = await supabase
        .from("trips")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: true });

      if (myTrips) setTrips(myTrips);

      // 2. Meine Pakete
      const { data: myShipments } = await supabase
        .from("shipments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (myShipments) setShipments(myShipments);
      setLoading(false);
    }
    loadData();
  }, []);

  const updateProfile = async () => {
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ first_name: firstName })
      .eq("id", user.id);
      
    if (error) alert("Fehler beim Speichern");
    else alert("Profil aktualisiert!");
    setSavingProfile(false);
  };

  const deleteItem = async (table: string, id: string) => {
    if(!confirm("Wirklich löschen?")) return;
    await supabase.from(table).delete().eq("id", id);
    window.location.reload();
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Lade Dashboard...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Navbar */}
      <nav className="bg-slate-900 text-white p-4 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Link href="/" className="font-black text-xl tracking-tighter flex items-center gap-2">
            <span className="text-orange-500">←</span> SHERPASS
          </Link>
          <div className="text-xs text-slate-400">{user.email}</div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-black mb-8">Mein Bereich</h1>

        {/* PROFIL CARD */}
        <section className="mb-12 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <User className="text-slate-900" /> Mein Profil
          </h2>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-400 uppercase block mb-2">Anzeigename (Vorname)</label>
              <input 
                type="text" 
                value={firstName} 
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 font-bold text-slate-900 focus:ring-2 focus:ring-orange-500"
                placeholder="Dein Name"
              />
            </div>
            <button 
              onClick={updateProfile}
              disabled={savingProfile}
              className="bg-slate-900 text-white font-bold py-3 px-6 rounded-lg hover:bg-orange-500 transition flex items-center gap-2"
            >
              <Save size={18} /> {savingProfile ? "..." : "Speichern"}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-3">Dieser Name wird anderen Nutzern angezeigt, wenn du Reisen anbietest.</p>
        </section>

        {/* REISEN */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Plane className="text-orange-500" /> Meine angebotenen Reisen
          </h2>
          {trips.length === 0 ? (
            <div className="bg-slate-100 p-6 rounded-xl text-slate-500 text-sm border-2 border-dashed border-slate-200">
              Du hast noch keine Reisen eingetragen.
              <Link href="/#traveler" className="text-orange-500 font-bold ml-2 hover:underline">Jetzt eintragen</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {trips.map((trip) => (
                <div key={trip.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                  <div>
                    <div className="font-bold text-lg">{trip.origin} ➔ {trip.destination}</div>
                    <div className="text-sm text-slate-500">{new Date(trip.date).toLocaleDateString()} · {trip.capacity_kg}kg frei</div>
                  </div>
                  <button onClick={() => deleteItem("trips", trip.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={18}/></button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* PAKETE */}
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Package className="text-blue-500" /> Meine Sendungen (Manifeste)
          </h2>
          {shipments.length === 0 ? (
            <div className="bg-slate-100 p-6 rounded-xl text-slate-500 text-sm border-2 border-dashed border-slate-200">
              Keine Manifeste gefunden.
              <Link href="/#safety" className="text-blue-500 font-bold ml-2 hover:underline">Erstellen</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {shipments.map((item) => (
                <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-slate-900">{item.content_desc}</div>
                      <div className="text-xs text-slate-500 font-mono mt-1">ID: {item.id.slice(0,8)}...</div>
                    </div>
                    <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-1 rounded font-bold uppercase">{item.status}</span>
                  </div>
                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100">
                    <div className="text-sm text-slate-600">{item.weight_kg} kg · {item.value_eur} €</div>
                    <div className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">QR Code im Home</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}