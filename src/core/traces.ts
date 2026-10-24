import allergensDe from "../allergens/de.json" with { type: "json" };
import { ALLERGEN_IDS } from "../allergens/ids.ts";
import { fail } from "../diagnostics/fail.ts";
import type {
  AllergenId,
  AllergenPiece,
  AllergenVocabulary,
  Ingredient,
  ResolvedIngredient,
  Trace,
} from "../types/index.ts";
import { createAllergenDetector, normalizeTerm } from "./allergens.ts";
import { createIngredientsList } from "./ingredients.ts";

const vocabulary: AllergenVocabulary = allergensDe;
const detect = createAllergenDetector(vocabulary);

// Cereals and nuts have no single word: there the kind (Walnüsse, Roggen) counts, not the group.
const kindCounts = (id: AllergenId) => vocabulary.allergens[id].short === undefined;

const kinds = (pieces: AllergenPiece[]) =>
  pieces.flatMap((piece) => (piece.kind ? [piece.kind] : []));

const leaves = (items: ResolvedIngredient[]): ResolvedIngredient[] =>
  items.flatMap((item) => (item.children ? leaves(item.children) : [item]));

const annexOrder = (trace: Trace) =>
  Math.min(...trace.allergens.map((id) => ALLERGEN_IDS.indexOf(id)));

/** Every "may contain" word in the recipe, from all levels, in input order. */
export function collectTraces(ingredients: Ingredient[], path = ""): Trace[] {
  return ingredients.flatMap((ingredient, index) => {
    const at = `${path}[${index}]`;
    const own = (ingredient.traces ?? []).map((name, i) => {
      const tracePath = `${at}.traces[${i}]`;
      const { allergens, unknown, pieces } = detect(name);
      if (unknown.length > 0) fail("trace.unknown", tracePath, { name, words: unknown.join(", ") });
      if (allergens.length === 0) fail("trace.noAllergen", tracePath, { name });
      return { name, path: tracePath, allergens, pieces };
    });
    return [...own, ...collectTraces(ingredient.children ?? [], `${at}.children`)];
  });
}

/**
 * The traces worth stating: each word once, in the order of Annex II, without what the
 * ingredient list already names.
 */
export function selectTraces(ingredients: Ingredient[]): Trace[] {
  const contained = leaves(createIngredientsList(ingredients));
  const allergens = new Set(contained.flatMap((item) => item.allergens));
  const containedKinds = new Set(contained.flatMap((item) => kinds(item.pieces)));
  const seen = new Set<string>();

  return collectTraces(ingredients)
    .filter((trace) => {
      const key = normalizeTerm(trace.name);
      if (seen.has(key)) return false;
      seen.add(key);
      const named = trace.allergens.every((id) =>
        kindCounts(id)
          ? kinds(trace.pieces).some((kind) => containedKinds.has(kind))
          : allergens.has(id),
      );
      return !named;
    })
    .sort((a, b) => annexOrder(a) - annexOrder(b));
}
