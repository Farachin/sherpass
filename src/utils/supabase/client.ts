// src/utils/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // 1. Variablen explizit lesen
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 2. Debugging-Log (WICHTIG!)
  console.log("🔍 Supabase Client Init - URL:", url);
  console.log("🔍 Supabase Client Init - Key vorhanden:", !!key); // Loggt nur true/false aus Sicherheit
  console.log("🔍 Supabase Client Init - URL Typ:", typeof url);
  console.log("🔍 Supabase Client Init - Key Typ:", typeof key);
  console.log("🔍 Supabase Client Init - URL Länge:", url?.length || 0);
  console.log("🔍 Supabase Client Init - Key Länge:", key?.length || 0);

  if (!url || !key) {
    console.error("🚨 CRITICAL: Supabase Env Vars fehlen im Browser!");
    console.error("🚨 URL vorhanden:", !!url);
    console.error("🚨 Key vorhanden:", !!key);
    console.error("🚨 Bitte prüfe deine .env.local Datei im Projekt-Root!");
    console.error("🚨 Stelle sicher, dass die Variablen mit NEXT_PUBLIC_ beginnen!");
    
    const missing = [];
    if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!key) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    
    throw new Error(
      `Supabase Url or Key missing! Fehlende Variablen: ${missing.join(', ')}`
    );
  }

  // 3. Explizit an die Funktion übergeben!
  console.log("✅ Supabase Client wird initialisiert mit expliziten Credentials");
  const client = createBrowserClient(url, key);
  console.log("✅ Supabase Client erfolgreich erstellt");
  
  return client;
}