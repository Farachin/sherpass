import { login, signup } from "./actions";
import { Plane, Lock, Mail, AlertCircle } from "lucide-react";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Fehlermeldung auslesen (Next.js 15 Style)
  const params = await searchParams;
  const error = params.error;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100 relative">
        
        {/* Zurück Button */}
        <Link href="/" className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-sm font-bold">✕ Schließen</Link>

        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-orange-500 shadow-lg">
            <Plane size={28} />
          </div>
        </div>
        
        <h1 className="text-2xl font-black text-slate-900 mb-2 text-center">Willkommen bei Sherpass</h1>
        <p className="text-slate-500 text-center mb-8 text-sm">Logg dich ein oder erstelle einen Account.</p>

        {/* Fehlermeldung anzeigen */}
        {error === "login_failed" && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold mb-4 flex items-center gap-2">
            <AlertCircle size={16}/> E-Mail oder Passwort falsch.
          </div>
        )}
        {error === "signup_failed" && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold mb-4 flex items-center gap-2">
            <AlertCircle size={16}/> Registrierung fehlgeschlagen.
          </div>
        )}

        <form className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">E-Mail</label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-3 text-slate-400" size={18}/>
              <input name="email" type="email" required placeholder="name@beispiel.com" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 focus:ring-2 focus:ring-orange-500 outline-none transition text-slate-900" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Passwort</label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-3 text-slate-400" size={18}/>
              <input name="password" type="password" required placeholder="••••••••" minLength={6} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 focus:ring-2 focus:ring-orange-500 outline-none transition text-slate-900" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4">
            <button formAction={login} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition shadow-lg">Einloggen</button>
            <button formAction={signup} className="w-full bg-white border-2 border-slate-200 text-slate-900 font-bold py-3 rounded-xl hover:border-orange-500 hover:text-orange-500 transition">Registrieren</button>
          </div>
        </form>
        
        <p className="text-center text-xs text-slate-400 mt-6">Min. 6 Zeichen für das Passwort.</p>
      </div>
    </div>
  );
}