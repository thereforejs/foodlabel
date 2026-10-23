import {
  add,
  compare,
  type Decimal,
  equals,
  fromNumber,
  percentageOf,
  sum,
  toDecimalString,
} from "@jasy/decy";
import de from "../allergens/de.json" with { type: "json" };
import type { Ingredient, ResolvedIngredient } from "../types/index.ts";
import { createAllergenDetector, normalizeTerm } from "./allergens.ts";

const detect = createAllergenDetector(de);

//#region Helper

interface Leaf {
  name: string;
  weight: Decimal;
}

function toGrams(ingredient: Ingredient, parent: Decimal | undefined, path: string): Decimal {
  const quantity = fromNumber(ingredient.quantity);
  if (ingredient.unit === "weight") return quantity;
  if (!parent) throw new Error(`${path}: a percentage needs a parent`);
  return percentageOf(parent, quantity);
}

// Top down once, so every level below works in grams only.
function toLeaves(ingredients: Ingredient[], parent: Decimal | undefined, path: string): Leaf[] {
  return ingredients.flatMap((ingredient, index) => {
    const at = `${path}[${index}]`;
    const weight = toGrams(ingredient, parent, at);
    if (!ingredient.children?.length) return [{ name: ingredient.name, weight }];

    const children = ingredient.children.map((child, i) =>
      toGrams(child, weight, `${at}.children[${i}]`),
    );
    if (!equals(sum(children), weight)) {
      throw new Error(
        `${at}.children: add up to ${toDecimalString(sum(children))} g, expected ${toDecimalString(weight)} g`,
      );
    }
    return toLeaves(ingredient.children, weight, `${at}.children`);
  });
}

function merge(leaves: Leaf[]): Leaf[] {
  const byName = new Map<string, Leaf>();
  for (const leaf of leaves) {
    const key = normalizeTerm(leaf.name);
    const known = byName.get(key);
    byName.set(key, known ? { name: known.name, weight: add(known.weight, leaf.weight) } : leaf);
  }
  return [...byName.values()];
}

//#endregion

export function createIngredientsList(ingredients: Ingredient[]): ResolvedIngredient[] {
  return merge(toLeaves(ingredients, undefined, ""))
    .sort((a, b) => compare(b.weight, a.weight))
    .map((leaf) => ({ ...leaf, ...detect(leaf.name) }));
}
