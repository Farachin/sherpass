export type Location = {
  city: string;
  code: string;
  country: string;
};

export const SUPPORTED_LOCATIONS: Location[] = [
  { city: "Frankfurt (FRA)", code: "FRA", country: "DE" },
  { city: "Berlin (BER)", code: "BER", country: "DE" },
  { city: "Hamburg (HAM)", code: "HAM", country: "DE" },
  { city: "München (MUC)", code: "MUC", country: "DE" },
  { city: "Leipzig (LEJ)", code: "LEJ", country: "DE" },
  { city: "Dresden (DRS)", code: "DRS", country: "DE" },
  { city: "Köln (CGN)", code: "CGN", country: "DE" },

  { city: "Kabul (KBL)", code: "KBL", country: "AF" },
  { city: "Mazar-i-Sharif (MZR)", code: "MZR", country: "AF" },
  { city: "Herat (HEA)", code: "HEA", country: "AF" },

  { city: "Teheran (IKA)", code: "IKA", country: "IR" },
  { city: "Istanbul (IST)", code: "IST", country: "TR" },
  { city: "Dubai (DXB)", code: "DXB", country: "UAE" },
  { city: "Paris (CDG)", code: "CDG", country: "FR" },
  { city: "London (LHR)", code: "LHR", country: "UK" },
  { city: "Dublin (DUB)", code: "DUB", country: "IE" },
  { city: "Brüssel (BRU)", code: "BRU", country: "BE" },
];

export function getCountryForCity(cityString: string): string | null {
  if (!cityString) return null;
  // Wir suchen nach einem Teilstring (z.B. "Frankfurt")
  const loc = SUPPORTED_LOCATIONS.find(
    (l) => cityString.includes(l.city) || l.city.includes(cityString),
  );
  return loc ? loc.country : null;
}
