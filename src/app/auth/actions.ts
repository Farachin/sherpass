"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function signOut() {
  // 1. Verbindung herstellen
  const supabase = await createClient();

  // 2. Den Nutzer rauswerfen (Cookie löschen)
  await supabase.auth.signOut();

  // 3. Zurück zur Startseite schicken und Seite neu laden
  return redirect("/");
}
