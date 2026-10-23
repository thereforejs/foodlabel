import allergensDe from "../allergens/de.json" with { type: "json" };
import { normalizeTerm } from "../core/allergens.ts";
import type { AllergenVocabulary, ResolvedIngredient } from "../types/index.ts";

const vocabulary: AllergenVocabulary = allergensDe;

/**
 * The allergen words to put in brackets after an ingredient. With `all`, every allergen is named
 * (an E number names none itself); otherwise only those the name does not already say.
 */
export function allergenWords(item: ResolvedIngredient, all: boolean): string[] {
  const words = new Set<string>();
  for (const id of item.allergens) {
    const pieces = item.pieces.filter((piece) => piece.allergen === id);
    const own = pieces
      .filter((piece) => piece.adds === undefined)
      .map((piece) => item.name.slice(piece.start, piece.end));

    for (const { adds } of pieces) {
      if (adds === undefined) continue;
      // Annex II requires the kind: "Malz" alone can be barley or wheat (2017/C 428/01 No 8, 13).
      if (adds === null) {
        if (own.length === 0) {
          throw new Error(
            `"${item.name}" contains ${vocabulary.allergens[id].label} but does not say which kind, use a more specific name`,
          );
        }
        continue;
      }
      // "Dinkelweizenmehl" names wheat itself, "Dinkelmehl" does not (2017/C 428/01 No 9).
      if (!own.some((word) => normalizeTerm(word).endsWith(normalizeTerm(adds)))) words.add(adds);
    }
    const first = own[0];
    if (all && first !== undefined) words.add(vocabulary.allergens[id].short ?? first);
  }
  return [...words];
}
