// src/app/lib/locations.ts

export type Location = {
    city: string;    // Was im Dropdown steht
    code: string;    // Flughafen-Code
    country: string; // Länder-Code (für die Suche)
  };
  
  export const SUPPORTED_LOCATIONS: Location[] = [
    { city: "Frankfurt (FRA)", code: "FRA", country: "DE" },
    { city: "Berlin (BER)", code: "BER", country: "DE" },
    { city: "Hamburg (HAM)", code: "HAM", country: "DE" },
    { city: "München (MUC)", code: "MUC", country: "DE" },
    
    { city: "Kabul (KBL)", code: "KBL", country: "AF" },
    { city: "Mazar-i-Sharif (MZR)", code: "MZR", country: "AF" },
    { city: "Herat (HEA)", code: "HEA", country: "AF" },
    
    { city: "Teheran (IKA)", code: "IKA", country: "IR" },
    { city: "Mashhad (MHD)", code: "MHD", country: "IR" },
    
    { city: "Dubai (DXB)", code: "DXB", country: "UAE" },
    { city: "Istanbul (IST)", code: "IST", country: "TR" },
    { city: "Paris (CDG)", code: "CDG", country: "FR" },
    { city: "London (LHR)", code: "LHR", country: "UK" }
  ];
  
  // Helfer-Funktion: Findet das Land zu einer Stadt
  export function getCountryForCity(cityString: string): string | null {
    const loc = SUPPORTED_LOCATIONS.find(l => l.city === cityString);
    return loc ? loc.country : null;
  }