import { redirect } from "next/navigation";
import { Mail, Plane } from "lucide-react";
import { createClient } from "../../utils/supabase/server";

async function login(formData: FormData) {
  "use server";

  const email = String(formData.get("email") || "").trim();
  if (!email) {
    return;
  }

  const supabase = await createClient();
  
  // WICHTIG: Hier hart auf localhost gestellt für den Test, damit der Redirect sicher klappt.
  // Später für Vercel: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/callback` nutzen.
  const redirectTo = "http://localhost:3000/auth/callback";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    console.error("Supabase Auth Error:", error.message);
  }

  redirect("/login?sent=1");
}

// HIER IST DIE ÄNDERUNG:
// 1. "async" vor function
// 2. searchParams ist jetzt ein "Promise"
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  // 3. Wir warten auf die Parameter
  const params = await searchParams;
  const sent = params.sent === "1";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 bg-slate-950 rounded-lg flex items-center justify-center text-orange-500 shadow-lg">
            <Plane size={20} />
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold">
              Sherpass
            </div>
            <h1 className="text-xl font-black text-slate-50 tracking-tight">
              Anmelden
            </h1>
          </div>
        </div>

        <p className="text-sm text-slate-400 mb-6">
          Gib deine E-Mail-Adresse ein. Wir senden dir einen{" "}
          <span className="text-slate-100 font-semibold">Magic Link</span>, mit
          dem du dich sicher anmelden kannst – ohne Passwort.
        </p>

        {sent && (
          <div className="mb-4 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/40 rounded-lg px-3 py-2">
            Magic Link gesendet! Bitte prüfe dein E-Mail-Postfach.
          </div>
        )}

        <form action={login} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
              E-Mail-Adresse
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                <Mail size={16} />
              </span>
              <input
                type="email"
                name="email"
                required
                placeholder="du@example.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-9 pr-3 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition mt-2"
          >
            <Mail size={16} />
            Magic Link senden
          </button>
        </form>

        <p className="mt-6 text-[11px] text-slate-500 text-center leading-relaxed">
          Mit der Anmeldung akzeptierst du unsere Nutzungsbedingungen. Wir
          nutzen Supabase Auth für sichere Sitzungscookies.
        </p>
      </div>
    </div>
  );
}