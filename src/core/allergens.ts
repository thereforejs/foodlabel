import { ALLERGEN_IDS } from "../allergens/ids.ts";
import type {
  AllergenId,
  AllergenMatch,
  AllergenPiece,
  AllergenVocabulary,
} from "../types/index.ts";

const normalizeChar = (char: string) => char.toLocaleLowerCase("de-DE").replaceAll("ß", "ss");

export function normalizeTerm(term: string): string {
  return normalizeChar(term.normalize("NFC")).trim();
}

// Normalizing changes lengths ("ß" -> "ss"), so every normalized position remembers its origin.
function normalizeWithOrigin(name: string) {
  let text = "";
  const origin: number[] = [];
  let index = 0;
  for (const char of name) {
    const normalized = normalizeChar(char);
    text += normalized;
    for (let i = 0; i < normalized.length; i++) origin.push(index);
    index += char.length;
  }
  origin.push(index);
  return { text, origin };
}

interface Entry {
  allergens: AllergenId[];
  adds?: string | null;
}

export function createAllergenDetector(vocabulary: AllergenVocabulary) {
  const entries = new Map<string, Entry>();
  for (const term of vocabulary.neutral) entries.set(normalizeTerm(term), { allergens: [] });
  for (const id of ALLERGEN_IDS) {
    const words = vocabulary.allergens[id];
    for (const term of words.terms) entries.set(normalizeTerm(term), { allergens: [id] });
    for (const [term, adds] of Object.entries(words.indirect ?? {})) {
      entries.set(normalizeTerm(term), { allergens: [id], adds });
    }
  }

  // Fewest pieces wins; ties are unioned, so an ambiguous split declares rather than hides.
  function split(word: string) {
    type Found = { start: number; end: number; entry: Entry };
    const best: ({ count: number; pieces: Found[] } | undefined)[] = [];
    best[word.length] = { count: 0, pieces: [] };
    for (let start = word.length - 1; start >= 0; start--) {
      for (let end = start + 1; end <= word.length; end++) {
        const entry = entries.get(word.slice(start, end));
        const rest = best[end];
        if (!entry || !rest) continue;
        const count = rest.count + 1;
        const pieces = [{ start, end, entry }, ...rest.pieces];
        const current = best[start];
        if (!current || count < current.count) best[start] = { count, pieces };
        else if (count === current.count) current.pieces.push(...pieces);
      }
    }
    return best[0]?.pieces;
  }

  return function detect(name: string): AllergenMatch {
    const { text, origin } = normalizeWithOrigin(name.normalize("NFC"));
    const pieces: AllergenPiece[] = [];
    const unknown: string[] = [];
    for (const match of text.matchAll(/[^\s-]+/g)) {
      const word = match[0];
      if (/^\d+$/.test(word)) continue;
      const found = split(word);
      if (!found) {
        unknown.push(word);
        continue;
      }
      for (const { start, end, entry } of found) {
        for (const allergen of entry.allergens) {
          const at = {
            allergen,
            start: origin[match.index + start],
            end: origin[match.index + end],
          };
          pieces.push(entry.adds === undefined ? at : { ...at, adds: entry.adds });
        }
      }
    }
    const named = new Set(pieces.map((piece) => piece.allergen));
    return { allergens: ALLERGEN_IDS.filter((id) => named.has(id)), unknown, pieces };
  };
}
