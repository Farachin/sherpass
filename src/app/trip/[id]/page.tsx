"use client";

import { createClient } from "@/utils/supabase/client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  Plane, Calendar, User, Info, CheckCircle, MessageCircle, ArrowLeft
} from "lucide-react";

type Trip = {
  id: string; user_id: string; origin: string; destination: string; date: string;
  capacity_kg: number; sherpa_name: string; description?: string; price_eur?: number;
  origin_country?: string; destination_country?: string;
};

export default function TripDetail() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;
  
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!tripId) {
        console.error("Keine Trip-ID in URL gefunden");
        router.push("/search-results");
        return;
      }
      
      console.log("Lade Trip mit ID:", tripId); // Debug-Log
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        setUserEmail(user.email ?? null);
      }
      
      const { data: tripData, error } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .single();
      
      if (error) {
        console.error("Fehler beim Laden der Reise:", error);
        setLoading(false);
        // Nicht sofort weiterleiten, sondern Fehler anzeigen
        return;
      }
      
      if (!tripData) {
        console.error("Reise nicht gefunden für ID:", tripId);
        setLoading(false);
        return;
      }
      
      console.log("Reise geladen:", tripData.id); // Debug-Log
      setTrip(tripData as any);
      setLoading(false);
    };
    
    loadData();
  }, [tripId, router]);

  const initiateBooking = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!currentUserId) {
      router.push("/login");
      return;
    }
    if (currentUserId === trip?.user_id) {
      alert("Das ist deine eigene Reise!");
      return;
    }
    
    if (!trip) {
      console.error("Keine Reise-Daten verfügbar");
      return;
    }
    
    // Öffne Chat direkt auf dieser Seite
    // Lade Profil für den Namen
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name")
      .eq("id", trip.user_id)
      .single();
    
    const sherpaName = profile?.first_name || trip.sherpa_name || "Sherpa";
    
    // Erstelle oder finde Conversation
    const { data: convs } = await supabase
      .from('conversations')
      .select('*')
      .or(`and(participant1_id.eq.${currentUserId},participant2_id.eq.${trip.user_id}),and(participant1_id.eq.${trip.user_id},participant2_id.eq.${currentUserId})`);
    
    let convId = convs?.[0]?.id;
    
    if (!convId) {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({ participant1_id: currentUserId, participant2_id: trip.user_id })
        .select()
        .single();
      
      if (newConv) {
        convId = newConv.id;
      }
    }
    
    if (convId) {
      // Weiterleitung zur Hauptseite mit Chat-Parameter
      router.push(`/?openChat=${convId}&partnerId=${trip.user_id}&partnerName=${encodeURIComponent(sherpaName)}&tripId=${tripId}`);
    } else {
      console.error("Konnte Conversation nicht erstellen");
      alert("Fehler beim Öffnen des Chats");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Lade Reise...</p>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Reise nicht gefunden.</p>
          <Link href="/search-results" className="text-blue-500 hover:underline">
            Zurück zur Suche
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* NAVBAR */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 h-16 flex items-center justify-between px-4 lg:px-8">
        <Link href="/" className="flex items-center gap-2 cursor-pointer">
          <Plane className="text-orange-500" /> <span className="font-black text-xl tracking-tighter">SHERPASS</span>
        </Link>
        <div className="flex gap-4 items-center">
          {!userEmail ? (
            <Link href="/login" className="bg-slate-100 hover:bg-slate-200 p-2 rounded-full"><User size={20}/></Link>
          ) : (
            <Link href="/dashboard" className="bg-slate-900 text-white w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs hover:bg-orange-500 transition">
              {userEmail.charAt(0).toUpperCase()}
            </Link>
          )}
        </div>
      </nav>

      {/* CONTENT */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button 
          onClick={() => {
            if (window.history.length > 1) {
              router.back();
            } else {
              router.push("/search-results");
            }
          }} 
          className="text-blue-500 font-bold mb-4 text-sm hover:underline flex items-center gap-1"
        >
          <ArrowLeft size={16}/> Zurück zur Suche
        </button>
        
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
          <div className="bg-slate-900 p-8 text-white relative">
            <div className="flex items-center gap-4 text-2xl font-black mb-2">
              {trip.origin} <Plane className="text-orange-500" /> {trip.destination}
            </div>
            <div className="text-slate-300 font-medium flex items-center gap-2">
              <Calendar size={16}/> {new Date(trip.date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
          <div className="p-6 grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center font-bold text-lg">
                  {trip.sherpa_name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{trip.sherpa_name}</h3>
                  <div className="flex items-center gap-1 text-xs text-green-600 font-bold">
                    <CheckCircle size={12}/> Identität verifiziert
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t">
                <h4 className="font-bold mb-2 flex gap-2 text-sm">
                  <Info size={16}/> Infos zur Reise
                </h4>
                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                  {trip.description || "Der Sherpa hat keine zusätzliche Beschreibung angegeben."}
                </p>
              </div>
            </div>
            <div className="bg-slate-50 p-5 rounded-xl h-fit border border-slate-100">
              <div className="flex justify-between mb-4">
                <span className="text-sm text-slate-500 font-bold">Verfügbar</span>
                <span className="font-black text-2xl">{trip.capacity_kg} kg</span>
              </div>
              {currentUserId === trip.user_id ? (
                <div className="bg-orange-100 text-orange-700 p-3 rounded-xl text-center font-bold text-sm">
                  Deine Reise
                </div>
              ) : (
                <button 
                  type="button"
                  onClick={(e) => initiateBooking(e)} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg transition flex justify-center gap-2"
                >
                  <MessageCircle size={18}/> Reise anfragen
                </button>
              )}
              <p className="text-[10px] text-center text-slate-400 mt-3">Kostenlos & unverbindlich.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

