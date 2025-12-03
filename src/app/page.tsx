"use client";

import React, { useState, useEffect } from "react";
import QRCode from "react-qr-code";
import {
  Search,
  Shield,
  Zap,
  AlertTriangle,
  CheckCircle,
  Plane,
  QrCode,
  FileText,
  X,
} from "lucide-react";
import { analyzeContentRisk } from "./lib/compliance";
import { supabase } from "./lib/supabase";

type Trip = {
  id: number;
  origin: string;
  destination: string;
  date: string;
  weight: number;
  sherpa_name: string;
};

export default function Home() {
  const [manifestInput, setManifestInput] = useState("");
  const [weight, setWeight] = useState("");
  const [value, setValue] = useState("");
  const [warning, setWarning] = useState<{
    found: boolean;
    level: string | null;
    cat: string;
    msg: string;
  } | null>(null);

  // Modals
  const [showQR, setShowQR] = useState(false);
  const [showWaybill, setShowWaybill] = useState(false);
  const [qrSuccess, setQrSuccess] = useState(false);

  // Trips
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [tripWeight, setTripWeight] = useState("");
  const [savingTrip, setSavingTrip] = useState(false);
  const [tripError, setTripError] = useState<string | null>(null);
  const [dateStr, setDateStr] = useState("");
  const [shipmentId, setShipmentId] = useState<string | null>(null);

  // Live-Check
  useEffect(() => {
    if (manifestInput.length > 2) {
      // @ts-ignore
      const result = analyzeContentRisk(manifestInput);
      // @ts-ignore
      setWarning(result);
    } else {
      setWarning(null);
    }
  }, [manifestInput]);

  // QR Simulation
  useEffect(() => {
    if (showQR) {
      const timer = setTimeout(() => setQrSuccess(true), 2500);
      return () => clearTimeout(timer);
    } else {
      setQrSuccess(false);
    }
  }, [showQR]);

  // Statisches Datum für Manifest-Header (verhindert Hydration-Fehler)
  useEffect(() => {
    setDateStr(new Date().toLocaleDateString("de-DE"));
  }, []);

  const saveManifest = async () => {
    if (!manifestInput || !weight || !value) {
      alert("Bitte Manifest, Gewicht und Wert ausfüllen.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("shipments")
        .insert([
          {
            content_desc: manifestInput,
            weight_kg: Number(weight),
            value_eur: Number(value),
            sender_name: "Gast User",
          },
        ])
        .select("id");

      if (error) {
        console.log("Supabase Error:", (error as any).message);
        console.log("Error:", error);
        alert("Manifest konnte nicht gespeichert werden. Bitte später erneut versuchen.");
        return;
      }

      if (data && data[0]?.id) {
        setShipmentId(data[0].id as string);
        setShowQR(true);
      }
    } catch (error) {
      console.log("Supabase Error:", (error as any).message ?? error);
      console.log("Error:", error);
      alert("Unerwarteter Fehler beim Speichern des Manifests.");
    }
  };

  // Trips laden
  useEffect(() => {
    const fetchTrips = async () => {
      setLoadingTrips(true);
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .order("date", { ascending: true });

      if (!error && data) {
        setTrips(data as Trip[]);
      }
      setLoadingTrips(false);
    };

    fetchTrips();
  }, []);

  const submitTrip = async () => {
    setTripError(null);

    if (!origin || !destination || !date || !tripWeight) {
      setTripError("Bitte alle Felder ausfüllen.");
      return;
    }

    setSavingTrip(true);

    try {
      const { error: insertError } = await supabase.from("trips").insert({
        origin,
        destination,
        date,
        capacity_kg: Number(tripWeight),
        sherpa_name: "Gast Sherpa",
      });

      if (insertError) {
        console.error(insertError);
        setTripError(
          "Speichern fehlgeschlagen. Bitte später erneut versuchen."
        );
        setSavingTrip(false);
        return;
      }

      alert("Reise erfolgreich gespeichert!");

      // Eingabefelder zurücksetzen
      setOrigin("");
      setDestination("");
      setDate("");
      setTripWeight("");

      // Liste neu laden
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .order("date", { ascending: true });

      if (!error && data) {
        setTrips(data as Trip[]);
      }
    } catch (error) {
      console.error(error);
      setTripError("Unerwarteter Fehler. Bitte später erneut versuchen.");
    } finally {
      setSavingTrip(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {/* NAV */}
      <nav className="bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-orange-500 shadow-lg">
              <Plane size={20} />
            </div>
            <span className="font-black text-xl tracking-tighter">SHERPASS</span>
          </div>
          <div className="hidden md:flex gap-6 text-sm font-medium text-slate-600 items-center">
            <a href="#" className="hover:text-orange-500">
              Start
            </a>
            <a href="#" className="hover:text-orange-500">
              Für Reisende
            </a>
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
              100% KOSTENLOS
            </span>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="relative pt-20 pb-32 flex justify-center items-center bg-slate-900 overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=2074&auto=format&fit=crop')] bg-cover bg-center"></div>
        <div className="relative container mx-auto px-4 text-center z-10">
          <span className="text-orange-500 font-bold tracking-widest text-xs uppercase mb-4 block bg-white/10 w-fit mx-auto px-4 py-1 rounded-full backdrop-blur-sm border border-white/10">
            Peer-to-Peer Logistik
          </span>
          <h1 className="text-white font-black text-5xl md:text-7xl mb-6 leading-tight drop-shadow-2xl">
            Sende dorthin,
            <br />
            wo die Post nicht hinkommt.
          </h1>
          <p className="text-slate-400 text-lg md:text-xl mb-10 max-w-2xl mx-auto">
            Verbinde dich mit Reisenden. Sende Dokumente, Medikamente und
            Geschenke direkt, sicher und ohne Gebühren.
          </p>

          <div className="bg-white p-2 rounded-xl shadow-2xl max-w-3xl mx-auto flex flex-col md:flex-row gap-2 transform hover:scale-[1.01] transition-all">
            <input
              type="text"
              placeholder="Von (z.B. Frankfurt)"
              className="flex-1 p-3 rounded-lg bg-slate-50 font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <input
              type="text"
              placeholder="Nach (z.B. Kabul)"
              className="flex-1 p-3 rounded-lg bg-slate-50 font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-3 rounded-lg transition flex items-center justify-center gap-2 shadow-lg">
              <Search size={20} /> Sherpa finden
            </button>
          </div>
        </div>
      </header>

      {/* MANIFEST SECTION */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-2 gap-16 items-start">
          {/* Input Area */}
          <div>
            <h2 className="text-3xl font-black mb-4 text-slate-900">
              Sicherheit durch Transparenz.
            </h2>
            <p className="text-slate-500 mb-8 text-lg">
              Erstelle in Sekunden ein digitales Manifest. Das schützt Reisende
              vor dem Zoll und garantiert dir die Ankunft.
            </p>

            <div className="bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-800">
              <label className="text-xs font-bold text-orange-500 uppercase mb-2 block tracking-wider">
                Manifest erstellen
              </label>

              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="col-span-2">
                  <input
                    type="text"
                    value={manifestInput}
                    onChange={(e) => setManifestInput(e.target.value)}
                    placeholder="Inhalt (z.B. Dokumente)"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-orange-500 placeholder-slate-500 text-sm"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="kg"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-orange-500 placeholder-slate-500 text-sm text-center"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="€"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-orange-500 placeholder-slate-500 text-sm text-center"
                  />
                </div>
              </div>

              {/* WARNING LOGIC */}
              {warning && warning.found && (
                <div
                  className={`p-4 rounded-lg flex gap-3 mb-4 animate-in fade-in slide-in-from-top-2 ${
                    warning.level === "critical"
                      ? "bg-red-500/20 text-red-200 border border-red-500/30"
                      : "bg-yellow-500/20 text-yellow-200 border border-yellow-500/30"
                  }`}
                >
                  <AlertTriangle size={24} className="shrink-0" />
                  <div>
                    <strong className="block text-xs uppercase opacity-75 tracking-wider">
                      {warning.cat}
                    </strong>
                    <span className="font-bold text-sm leading-tight">
                      {warning.msg}
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowWaybill(true)}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold py-3 rounded-lg text-sm flex items-center justify-center gap-2 transition hover:text-white"
              >
                <FileText size={16} /> Dokument drucken (Waybill)
              </button>

              <button
                onClick={saveManifest}
                className="mt-3 w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg text-sm flex items-center justify-center gap-2 transition"
              >
                <QrCode size={16} /> Manifest speichern &amp; QR generieren
              </button>
            </div>
          </div>

          {/* Visual Manifest Card */}
          <div className="relative">
            <div className="bg-white text-slate-900 rounded-xl shadow-2xl max-w-sm mx-auto border border-slate-200 transform lg:rotate-2 hover:rotate-0 transition duration-500 overflow-hidden">
              {/* Header */}
              <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-white/10 rounded flex items-center justify-center text-orange-500 font-bold text-xs">
                    S
                  </div>
                  <span className="font-bold text-sm tracking-tight">
                    SHERPASS MANIFEST
                  </span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[10px] text-slate-400 uppercase">
                    DATE
                  </span>
                  <span className="text-xs font-mono font-bold">
                    {dateStr}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                <div className="flex justify-between border-b border-slate-100 pb-3">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold">
                      ABSENDER
                    </div>
                    <div className="font-bold text-sm">Du (Verifiziert)</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">
                      ROUTE
                    </div>
                    <div className="font-bold text-sm">
                      FRA <span className="text-orange-500">✈</span> KBL
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 p-2 rounded border border-slate-100">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">
                      GEWICHT
                    </div>
                    <div className="font-mono font-bold text-sm">
                      {weight || "0"} kg
                    </div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border border-slate-100">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">
                      WERT
                    </div>
                    <div className="font-mono font-bold text-sm">
                      {value || "0"} €
                    </div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border border-slate-100">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">
                      STATUS
                    </div>
                    <div
                      className={`font-bold text-xs truncate ${
                        warning?.found ? "text-red-600" : "text-slate-900"
                      }`}
                    >
                      {warning?.found ? "RESTRICTED" : "OK"}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border-2 border-slate-200 border-dashed min-h-[3rem]">
                  <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                    INHALT
                  </div>
                  <div className="font-mono text-orange-500 font-bold text-lg leading-tight break-words">
                    {manifestInput || "..."}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <span className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded font-bold uppercase border border-green-200">
                    {qrSuccess ? "HANDOVER COMPLETE" : "VERIFIED USER"}
                  </span>
                  {parseInt(value) > 430 && (
                    <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-1 rounded font-bold uppercase border border-orange-200">
                      DECLARE CUSTOMS
                    </span>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-between items-center">
                <div className="text-[10px] text-slate-400 font-mono">
                  ID: #992-AX-22
                </div>
                <button
                  onClick={() => setShowQR(true)}
                  className={`text-white text-[10px] font-bold px-3 py-1.5 rounded cursor-pointer transition flex items-center gap-1 ${
                    qrSuccess ? "bg-green-600" : "bg-slate-900 hover:bg-orange-500"
                  }`}
                >
                  <QrCode size={12} /> {qrSuccess ? "ERFOLG" : "QR SCAN"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRIPS SECTION */}
      <section className="py-16 bg-slate-900 text-slate-50 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-2 gap-16 items-start">
          {/* Trip Formular */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="text-green-400" size={20} />
              <h2 className="text-2xl font-black">
                Eigene Reise anbieten (Sherpa).
              </h2>
            </div>
            <p className="text-slate-400 mb-6">
              Trage deine nächste Flugreise ein. Andere können dir dann sichere
              Sendungen anvertrauen. Du bleibst anonym – wir zeigen nur den
              Vornamen.
            </p>

            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase text-slate-400 font-bold">
                    Von
                  </label>
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="z.B. Frankfurt (FRA)"
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase text-slate-400 font-bold">
                    Nach
                  </label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="z.B. Kabul (KBL)"
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase text-slate-400 font-bold">
                    Datum
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase text-slate-400 font-bold">
                    Freies Gewicht (kg)
                  </label>
                  <input
                    type="number"
                    value={tripWeight}
                    onChange={(e) => setTripWeight(e.target.value)}
                    placeholder="z.B. 5"
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
              </div>

              {tripError && (
                <div className="text-sm text-red-300 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  <span>{tripError}</span>
                </div>
              )}

              <button
                onClick={submitTrip}
                disabled={savingTrip}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/60 text-white font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition"
              >
                <Zap size={18} />
                {savingTrip ? "Wird gespeichert..." : "Reise eintragen"}
              </button>

              <p className="text-[11px] text-slate-500">
                Mit dem Eintrag bestätigst du, keine verbotenen Inhalte zu
                transportieren. Sherpass führt zusätzliche Checks durch.
              </p>
            </div>
          </div>

          {/* Trip Liste */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Plane className="text-orange-400" size={20} />
              <h2 className="text-2xl font-black">Aktuelle Sherpa-Reisen.</h2>
            </div>
            <p className="text-slate-400 mb-6">
              Finde eine passende Verbindung für deine Sendung. Die Daten
              stammen direkt aus der Sherpass-Datenbank.
            </p>

            <div className="space-y-3">
              {loadingTrips && (
                <div className="text-sm text-slate-400">
                  Lädt verfügbare Reisen...
                </div>
              )}

              {!loadingTrips && trips.length === 0 && (
                <div className="text-sm text-slate-500 bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                  Noch keine Reisen eingetragen. Sei der erste Sherpa!
                </div>
              )}

              {!loadingTrips &&
                trips.map((trip) => (
                  <div
                    key={trip.id}
                    className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-xs uppercase text-slate-400 font-bold mb-1">
                        {trip.origin} → {trip.destination}
                      </div>
                      <div className="text-sm font-semibold">
                        {new Date(trip.date).toLocaleDateString()} ·{" "}
                        <span className="text-slate-300">
                          {trip.weight} kg frei
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Sherpa: {trip.sherpa_name || "Gast Sherpa"}
                      </div>
                    </div>
                    <span className="text-[11px] px-3 py-1 rounded-full bg-green-500/10 text-green-300 border border-green-500/40 font-semibold">
                      Verfügbar
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </section>

      {/* MODAL: WAYBILL */}
      {showWaybill && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-2xl min-h-[600px] shadow-2xl relative p-8 font-mono text-sm overflow-y-auto max-h-[90vh]">
            <button
              onClick={() => setShowWaybill(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-red-500"
            >
              <X />
            </button>

            <div className="flex justify-between items-start border-b-4 border-black pb-6 mb-6">
              <div>
                <h1 className="text-4xl font-black italic tracking-tighter">
                  SHERPASS
                </h1>
                <p className="text-xs uppercase mt-1">
                  International Courier Waybill
                </p>
              </div>
              <div className="text-right">
                <div className="text-4xl mb-1">*992AX22*</div>
                <p className="text-xs">AWB: 992-AX-22</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
              <div className="border border-black p-4">
                <span className="block text-[10px] font-bold uppercase mb-2 bg-black text-white px-1 inline-block">
                  ABSENDER
                </span>
                <p className="font-bold">Verified User #8821</p>
                <p>Frankfurt Airport (FRA)</p>
                <p>Germany</p>
              </div>
              <div className="border border-black p-4">
                <span className="block text-[10px] font-bold uppercase mb-2 bg-black text-white px-1 inline-block">
                  EMPFÄNGER
                </span>
                <p className="font-bold">Recipient Pending</p>
                <p>Kabul Intl. Airport (KBL)</p>
                <p>Afghanistan</p>
              </div>
            </div>

            <table className="w-full border-collapse border border-black mb-8">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black p-2 text-left w-1/2">
                    BESCHREIBUNG
                  </th>
                  <th className="border border-black p-2 text-center">
                    GEWICHT
                  </th>
                  <th className="border border-black p-2 text-center">WERT</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black p-4 font-bold text-lg">
                    {manifestInput || "---"}
                  </td>
                  <td className="border border-black p-4 text-center">
                    {weight || "0"} kg
                  </td>
                  <td className="border border-black p-4 text-center">
                    {value || "0"} €
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="text-[10px] text-slate-500 leading-tight text-justify border-t border-black pt-4">
              <strong>KONFORMITÄTSERKLÄRUNG:</strong> Der Absender erklärt, dass
              dieses Paket keine Waffen, illegalen Drogen oder Gefahrgüter
              enthält. Sherpass übernimmt keine Haftung.
            </div>
          </div>
        </div>
      )}

      {/* MODAL: QR SCANNER */}
      {showQR && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4">
          <button
            onClick={() => setShowQR(false)}
            className="absolute top-6 right-6 text-white"
          >
            <X size={32} />
          </button>

          {shipmentId ? (
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-4 rounded-2xl">
                <QRCode value={shipmentId} size={220} />
              </div>
              <div className="text-center text-slate-100">
                <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                  Shipment ID
                </div>
                <div className="font-mono text-sm break-all max-w-xs">
                  {shipmentId}
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Zeige diesen Code beim Handover dem Sherpa oder am Check-in.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-white text-center font-bold">
              Kein Manifest gefunden. Bitte zuerst ein Manifest speichern.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

