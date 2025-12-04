"use client";

import { createClient } from "@/utils/supabase/client";
import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search, Plane, User, Package, Calendar, Luggage, ArrowLeft
} from "lucide-react";
import { getCountryForCity } from "../lib/locations";

type Trip = {
  id: string; user_id: string; origin: string; destination: string; date: string;
  capacity_kg: number; sherpa_name: string; description?: string; price_eur?: number;
  origin_country?: string; destination_country?: string;
};

export default function SearchResults() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  // Search inputs from URL params
  const [searchFrom, setSearchFrom] = useState("");
  const [searchTo, setSearchTo] = useState("");

  useEffect(() => {
    // Lade Suchparameter aus URL
    const from = searchParams.get('from') || "";
    const to = searchParams.get('to') || "";
    
    setSearchFrom(from);
    setSearchTo(to);
    
    // Lade User-Info
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserEmail(data.user.email ?? null);
      }
    });
    
    // Führe Suche aus
    if (from || to) {
      performSearch(from, to);
    } else {
      loadAllTrips();
    }
  }, [searchParams]);

  const loadAllTrips = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .gte("date", new Date().toISOString().split('T')[0])
        .order("date", { ascending: true })
        .limit(50);

      if (error) {
        console.error("DB Error:", error.message);
        setTrips([]);
      } else {
        setTrips(data as any || []);
      }
    } catch (err) {
      console.error("Fehler:", err);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async (from: string, to: string) => {
    setLoading(true);
    
    try {
      let query = supabase
        .from("trips")
        .select("*")
        .gte("date", new Date().toISOString().split('T')[0])
        .order("date", { ascending: true });
      
      if (from) query = query.ilike('origin', `%${from}%`);
      if (to) query = query.ilike('destination', `%${to}%`);
      
      const { data: exactData, error: exactError } = await query;

      if (exactError) {
        console.error("Suche-Fehler:", exactError);
        loadAllTrips();
        return;
      }

      if (exactData && exactData.length > 0) {
        setTrips(exactData as any);
        setLoading(false);
        return;
      }

      // Fallback: Suche nach Ländern
      const fromC = getCountryForCity(from);
      const toC = getCountryForCity(to);
      
      if (fromC || toC) {
        let countryQuery = supabase
          .from("trips")
          .select("*")
          .gte("date", new Date().toISOString().split('T')[0])
          .order("date", { ascending: true });
        
        if (fromC) countryQuery = countryQuery.eq('origin_country', fromC);
        if (toC) countryQuery = countryQuery.eq('destination_country', toC);
        
        const { data: countryData, error: countryError } = await countryQuery;
        
        if (!countryError && countryData && countryData.length > 0) {
          setTrips(countryData as any);
          setLoading(false);
          return;
        }
      }

      // Keine Treffer: Zeige alle
      loadAllTrips();
      
    } catch (err) {
      console.error("Fehler:", err);
      loadAllTrips();
    }
  };

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchFrom) params.set('from', searchFrom);
    if (searchTo) params.set('to', searchTo);
    
    router.push(`/search-results?${params.toString()}`);
  };

  const handleTripClick = (trip: Trip, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Validiere, dass die ID existiert
    if (!trip || !trip.id) {
      console.error("Trip oder Trip-ID fehlt:", trip);
      return;
    }
    
    // Navigiere zur Detail-Seite
    const tripId = trip.id.toString();
    console.log("Navigiere zu Trip:", tripId); // Debug-Log
    router.push(`/trip/${tripId}`);
  };

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

      {/* STICKY SEARCH BAR */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex gap-2">
            <input 
              list="airport-cities" 
              value={searchFrom} 
              onChange={e=>setSearchFrom(e.target.value)} 
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.focus()}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Von" 
              className="flex-1 bg-slate-100 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-500" 
            />
            <input 
              list="airport-cities" 
              value={searchTo} 
              onChange={e=>setSearchTo(e.target.value)} 
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.focus()}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Nach" 
              className="flex-1 bg-slate-100 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-500" 
            />
            <button 
              onClick={handleSearch} 
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-2 rounded-lg text-sm transition flex items-center gap-2"
            >
              <Search size={18}/> Suchen
            </button>
          </div>
        </div>
      </div>

      {/* RESULTS */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-500">Lade Reisen...</p>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-slate-800 mb-6">{trips.length} Reisen gefunden</h2>
            {trips.length > 0 ? (
              <div className="space-y-4">
                {trips.map(trip => (
                  <div 
                    key={trip.id || `trip-${Math.random()}`} 
                    onClick={(e) => handleTripClick(trip, e)} 
                    className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition cursor-pointer flex flex-col sm:flex-row justify-between sm:items-center gap-4 group"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3 text-lg font-bold text-slate-900">
                        <span>{trip.origin}</span>
                        <div className="h-0.5 w-8 bg-slate-300 relative group-hover:bg-orange-500 transition-colors duration-300"></div>
                        <span>{trip.destination}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
                        <span className="flex items-center gap-1"><Calendar size={14}/> {new Date(trip.date).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1"><User size={14}/> {trip.sherpa_name}</span>
                      </div>
                    </div>
                    <div 
                      className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-col items-end"><span className="text-lg font-bold text-slate-900">Preis: VB</span><span className="text-xs text-slate-400">im Chat</span></div>
                      <div className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-1"><Luggage size={14}/> {trip.capacity_kg} kg</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <Plane size={48} className="mx-auto mb-4 text-slate-300"/>
                <p className="text-slate-500 font-medium">Keine Reisen gefunden.</p>
                <p className="text-sm text-slate-400 mt-2">Versuche andere Suchkriterien.</p>
              </div>
            )}
          </>
        )}
      </div>

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
    </div>
  );
}

