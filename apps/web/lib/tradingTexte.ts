import type { BrokerArt } from "@highstack/trading";
export const BROKER_NAMEN: Record<BrokerArt, string> = { simulation: "Simulation", "alpaca-paper": "Alpaca Paper", "alpaca-live": "Alpaca (echtes Geld)", manuell: "Eigene App (manuell)", ibkr: "Interactive Brokers" };
export const BROKER_WAHL: { art: BrokerArt; titel: string; text: string; status: "bereit" | "geplant" | "gesperrt" }[] = [
  { art: "simulation", titel: "Simulation", text: "Künstliche Kurse, ein Handelstag im Zeitraffer. Zum Kennenlernen und Einstellen, ohne Konto.", status: "bereit" },
  { art: "alpaca-paper", titel: "Alpaca Paper", text: "Echte US-Kurse, Spielgeld. Kostenloses Konto bei alpaca.markets, Schlüssel unten eintragen.", status: "bereit" },
  { art: "manuell", titel: "Eigene App", text: "Trade Republic, Scalable und andere ohne Schnittstelle: der Agent legt Order-Zettel vor, Sie führen in der App aus und bestätigen.", status: "bereit" },
  { art: "ibkr", titel: "Interactive Brokers", text: "Deutsche und internationale Börsen, echtes Geld. Anbindung folgt.", status: "geplant" },
  { art: "alpaca-live", titel: "Alpaca live", text: "Echtes Geld über Alpaca. Erst nach Wochen stabiler Paper-Ergebnisse; serverseitig gesperrt.", status: "gesperrt" },
];
