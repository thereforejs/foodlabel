import type { AllergenPiece, DeclarationOptions } from "../types/index.ts";
import type { Markup } from "./markup.ts";

/** A name with its allergens highlighted: all of it, or only the allergen parts. */
export function highlight(
  named: { name: string; pieces: AllergenPiece[] },
  markup: Markup,
  options: DeclarationOptions,
): string {
  const { name, pieces } = named;
  if (pieces.length === 0) return markup.plain(name);
  if (options.highlightScope === "name") return markup.strong(name);

  const marked = Array.from({ length: name.length }, () => false);
  for (const piece of pieces) marked.fill(true, piece.start, piece.end);
  let text = "";
  let start = 0;
  for (let index = 1; index <= name.length; index++) {
    if (index < name.length && marked[index] === marked[start]) continue;
    const part = name.slice(start, index);
    text += marked[start] ? markup.strong(part) : markup.plain(part);
    start = index;
  }
  return text;
}
