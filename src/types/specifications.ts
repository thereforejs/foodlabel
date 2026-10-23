export interface DeclarationOptions {
  jurisdiction: "EU-DE";
  highlight: "bold" | "uppercase"; // both are legal; the baker chooses
  additives: "name" | "eNumber"; // "Emulgator: Sojalecithin" or "Emulgator: E 322 (SOJA)"
}

// Incoming Ingredient like rye flour, sugar, etc.
export interface Ingredient {
  name: string;
  eNumber?: string;
  eNumberName?: string;
  eNumberCategory?: string;
  quantity: number;
  unit: "weight" | "percent";
  children?: Ingredient[];
}
