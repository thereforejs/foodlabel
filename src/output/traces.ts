import allergensDe from "../allergens/de.json" with { type: "json" };
import { resolveOptions } from "../core/options.ts";
import { selectTraces } from "../core/traces.ts";
import type { AllergenVocabulary, DeclarationOptions, Ingredient } from "../types/index.ts";
import { highlight } from "./highlight.ts";
import { createMarkup } from "./markup.ts";

const vocabulary: AllergenVocabulary = allergensDe;

/**
 * The "may contain" statement for below the ingredient list, e.g.
 * "Kann Spuren enthalten: SOJA, SESAM." Empty when there is nothing to state.
 */
export function createTraces(
  ingredients: Ingredient[],
  options: Partial<DeclarationOptions> = {},
): string {
  const resolved = resolveOptions(options);
  const markup = createMarkup(resolved);
  const traces = selectTraces(ingredients);
  if (traces.length === 0) return "";
  const words = traces.map((trace) => highlight(trace, markup, resolved)).join(", ");
  return `${markup.plain(vocabulary.mayContain)}: ${words}.`;
}
