import { ALLERGEN_IDS } from "../allergens/ids.ts";
import type { AllergenId, AllergenMatch, AllergenVocabulary } from "../types/index.ts";

export function normalizeTerm(term: string): string {
  return term.normalize("NFC").toLocaleLowerCase("de-DE").replaceAll("ß", "ss").trim();
}

export function createAllergenDetector(vocabulary: AllergenVocabulary) {
  const pieces = new Map<string, AllergenId[]>();
  for (const term of vocabulary.neutral) pieces.set(normalizeTerm(term), []);
  for (const id of ALLERGEN_IDS) {
    for (const term of vocabulary.allergens[id].terms) pieces.set(normalizeTerm(term), [id]);
  }

  // Fewest pieces wins; ties are unioned, so an ambiguous split declares rather than hides.
  function split(word: string): Set<AllergenId> | undefined {
    const best: ({ count: number; allergens: Set<AllergenId> } | undefined)[] = [];
    best[word.length] = { count: 0, allergens: new Set() };
    for (let start = word.length - 1; start >= 0; start--) {
      for (let end = start + 1; end <= word.length; end++) {
        const piece = pieces.get(word.slice(start, end));
        const rest = best[end];
        if (!piece || !rest) continue;
        const count = rest.count + 1;
        const current = best[start];
        if (!current || count < current.count) {
          best[start] = { count, allergens: new Set([...piece, ...rest.allergens]) };
        } else if (count === current.count) {
          for (const id of [...piece, ...rest.allergens]) current.allergens.add(id);
        }
      }
    }
    return best[0]?.allergens;
  }

  return function detect(name: string): AllergenMatch {
    const found = new Set<AllergenId>();
    const unknown: string[] = [];
    for (const word of normalizeTerm(name).split(/[\s-]+/)) {
      if (word === "" || /^\d+$/.test(word)) continue;
      const allergens = split(word);
      if (allergens) for (const id of allergens) found.add(id);
      else unknown.push(word);
    }
    return { allergens: ALLERGEN_IDS.filter((id) => found.has(id)), unknown };
  };
}
