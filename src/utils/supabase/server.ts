import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies(); // Hier lag der Fehler: Wir müssen warten!

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // KRITISCH: Prüfe ob Umgebungsvariablen vorhanden sind
  if (!supabaseUrl || !supabaseAnonKey) {
    const missing = [];
    if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!supabaseAnonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    console.error(
      "🚨 KRITISCHER FEHLER: Supabase Umgebungsvariablen fehlen (Server)!",
    );
    console.error("Fehlende Variablen:", missing);

    throw new Error(
      `Supabase Url or Key missing! Fehlende Variablen: ${missing.join(", ")}`,
    );
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch (error) {
          // Ignorieren, wenn wir in einer Server Component sind
        }
      },
      remove(name: string, options: any) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch (error) {
          // Ignorieren
        }
      },
    },
  });
}
