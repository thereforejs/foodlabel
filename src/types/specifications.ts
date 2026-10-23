import type { Decimal, RoundingMode } from "@thereforejs/decy";
import type { AdditiveClassId } from "./additives.ts";
import type { AllergenId, AllergenPiece } from "./allergens.ts";

export interface DeclarationOptions {
  jurisdiction: "EU-DE";
  format: "text" | "markdown" | "html";
  highlight: "bold" | "uppercase"; // both are legal; the baker chooses
  /** "ROGGENMEHL" or "ROGGENmehl"; marking the part is enough (2017/C 428/01 No 16). */
  highlightScope: "name" | "allergen";
  additives: "name" | "eNumber"; // "Emulgator: Sojalecithin" or "Emulgator: E 322 (SOJA)"
  /** Default for `Ingredient.group`; the ingredient's own setting wins. */
  group: boolean;
  /** "5 % Roggen", "Roggen 5 %", "(5 %) Roggen", "Roggen (5 %)" */
  quid: "before" | "after" | "brackets-before" | "brackets-after";
  /** Decimals per range: a share from `from` up to the next step gets `decimals` (0 to 3). */
  percentDecimals: PercentStep[];
  /** "21 %" with a no-break space, or "21%". */
  percentSpace: boolean;
  rounding: RoundingMode;
}

export interface PercentStep {
  from: number;
  decimals: number;
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
  /** Show the percentage. Overrides what is detected from the product name. */
  quid?: boolean;
  children?: Ingredient[];
}

// An ingredient after resolving: weight in grams, same names merged per level.
export interface ResolvedIngredient {
  name: string;
  weight: Decimal;
  /** For a group: the allergens of all its parts. */
  allergens: AllergenId[];
  unknown: string[];
  /** Where the allergens sit in `name`. Empty for a group, whose name is no ingredient. */
  pieces: AllergenPiece[];
  quid?: boolean;
  /** Only set for a group. A class entry like "Emulgatoren" is a group with `additiveClass`. */
  children?: ResolvedIngredient[];
  /** Set on an additive and on its class entry. */
  additiveClass?: AdditiveClassId;
  /** Only set on an additive, e.g. "E 471". */
  eNumber?: string;
}
