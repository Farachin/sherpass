import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  // Debugging: Sehen, ob wir überhaupt aufgerufen werden
  console.log("CALLBACK ROUTE AUFGERUFEN!");

  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  console.log("Code vorhanden?", code ? "JA" : "NEIN");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      console.log("LOGIN ERFOLGREICH! Weiterleitung...");
      return NextResponse.redirect(`${origin}${next}`);
    } else {
      console.error("LOGIN FEHLER:", error.message);
    }
  }

  // Falls kein Code da oder Fehler
  console.log("Weiterleitung ohne Login...");
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}