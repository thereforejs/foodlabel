import type { Decimal } from "@jasy/decy";
import type { AdditiveClassId } from "./additives.ts";
import type { AllergenId } from "./allergens.ts";

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
  /** Keep this ingredient as one entry with its parts in brackets. Only has an effect with children. */
  group?: boolean;
  children?: Ingredient[];
}

// An ingredient after resolving: weight in grams, same names merged per level.
export interface ResolvedIngredient {
  name: string;
  weight: Decimal;
  /** For a group: the allergens of all its parts. */
  allergens: AllergenId[];
  unknown: string[];
  /** Only set for a group. A class entry like "Emulgatoren" is a group with `additiveClass`. */
  children?: ResolvedIngredient[];
  /** Set on an additive and on its class entry. */
  additiveClass?: AdditiveClassId;
  /** Only set on an additive, e.g. "E 471". */
  eNumber?: string;
}
