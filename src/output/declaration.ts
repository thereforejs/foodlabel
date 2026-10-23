import { type Decimal, decimal, divide, multiply, sum } from "@thereforejs/decy";
import { createIngredientsList } from "../core/ingredients.ts";
import { resolveOptions } from "../core/options.ts";
import { fail } from "../diagnostics/fail.ts";
import type { DeclarationOptions, Ingredient, ResolvedIngredient } from "../types/index.ts";
import { allergenWords } from "./allergen-words.ts";
import { createMarkup, type Markup } from "./markup.ts";
import { formatPercent } from "./percent.ts";

const HUNDRED = decimal("100");

// A class like "Emulgatoren" is only a name in front of its members, not a compound ingredient.
const isClass = (item: ResolvedIngredient) => item.additiveClass !== undefined && !item.eNumber;

// A group shows its own share as soon as anything inside does, so every bracket can be recalculated.
function showsShare(item: ResolvedIngredient): boolean {
  return item.quid === true || (item.children ?? []).some(showsShare);
}

/** The ingredient list as label text, e.g. "Wasser, ROGGENMEHL, Salz". */
export function createDeclaration(
  ingredients: Ingredient[],
  options: Partial<DeclarationOptions> = {},
): string {
  const resolved = resolveOptions(options);
  const markup = createMarkup(resolved);
  const items = createIngredientsList(ingredients, resolved);

  function share(item: ResolvedIngredient, total: Decimal): string {
    const percent = divide(multiply(item.weight, HUNDRED), total, {
      scale: 20,
      mode: resolved.rounding,
    });
    return markup.plain(formatPercent(percent, resolved, item));
  }

  function name(item: ResolvedIngredient): { text: string; tail: string } {
    if (item.children) {
      return { text: markup.plain(item.name), tail: ` (${list(item.children, item.weight)})` };
    }
    if (item.unknown.length > 0) {
      fail("ingredient.unknown", item.path, { name: item.name, words: item.unknown.join(", ") });
    }
    const eNumber = resolved.additives === "eNumber" ? item.eNumber : undefined;
    const words = allergenWords(item, eNumber !== undefined);
    const tail = words.length > 0 ? ` (${words.map(markup.strong).join(", ")})` : "";
    if (eNumber) return { text: markup.plain(eNumber), tail };
    return { text: highlight(item, markup, resolved), tail };
  }

  function entry(item: ResolvedIngredient, total: Decimal): string {
    const { text, tail } = name(item);
    if (!showsShare(item)) return `${text}${tail}`;
    const percent = share(item, total);
    switch (resolved.quid) {
      case "before":
        return `${percent} ${text}${tail}`;
      case "brackets-before":
        return `(${percent}) ${text}${tail}`;
      case "after":
        return `${text} ${percent}${tail}`;
      case "brackets-after":
        // A second bracket right after the first would be unreadable.
        return tail ? `${text} ${percent}${tail}` : `${text} (${percent})`;
    }
  }

  function list(level: ResolvedIngredient[], total: Decimal): string {
    return level
      .map((item) =>
        isClass(item)
          ? `${markup.plain(item.name)}: ${(item.children ?? []).map((member) => entry(member, total)).join(", ")}`
          : entry(item, total),
      )
      .join(", ");
  }

  return list(items, sum(items.map((item) => item.weight)));
}

function highlight(item: ResolvedIngredient, markup: Markup, options: DeclarationOptions): string {
  if (item.pieces.length === 0) return markup.plain(item.name);
  if (options.highlightScope === "name") return markup.strong(item.name);

  const marked = Array.from({ length: item.name.length }, () => false);
  for (const piece of item.pieces) marked.fill(true, piece.start, piece.end);
  let text = "";
  let start = 0;
  for (let index = 1; index <= item.name.length; index++) {
    if (index < item.name.length && marked[index] === marked[start]) continue;
    const part = item.name.slice(start, index);
    text += marked[start] ? markup.strong(part) : markup.plain(part);
    start = index;
  }
  return text;
}
