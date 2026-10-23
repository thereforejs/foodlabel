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
import { ALLERGEN_IDS } from "../allergens/ids.ts";
import type { Ingredient, ResolvedIngredient } from "../types/index.ts";
import { createAllergenDetector, normalizeTerm } from "./allergens.ts";

const detect = createAllergenDetector(de);

//#region Helper

function toGrams(ingredient: Ingredient, parent: Decimal | undefined, path: string): Decimal {
  const quantity = fromNumber(ingredient.quantity);
  if (ingredient.unit === "weight") return quantity;
  if (!parent) throw new Error(`${path}: a percentage needs a parent`);
  return percentageOf(parent, quantity);
}

function toGroup(
  name: string,
  weight: Decimal,
  children: ResolvedIngredient[],
): ResolvedIngredient {
  const allergens = new Set(children.flatMap((child) => child.allergens));
  return {
    name,
    weight,
    allergens: ALLERGEN_IDS.filter((id) => allergens.has(id)),
    unknown: children.flatMap((child) => child.unknown),
    children,
  };
}

// Groups are never merged: what is in their brackets stays there.
function merge(items: ResolvedIngredient[]): ResolvedIngredient[] {
  const byKey = new Map<string | number, ResolvedIngredient>();
  items.forEach((item, index) => {
    const key = item.children ? index : normalizeTerm(item.name);
    const known = byKey.get(key);
    byKey.set(key, known ? { ...known, weight: add(known.weight, item.weight) } : item);
  });
  return [...byKey.values()];
}

// Top down once, so every level below works in grams only.
function resolve(
  ingredients: Ingredient[],
  parent: Decimal | undefined,
  path: string,
): ResolvedIngredient[] {
  const items = ingredients.flatMap((ingredient, index) => {
    const at = `${path}[${index}]`;
    const weight = toGrams(ingredient, parent, at);
    if (!ingredient.children?.length)
      return [{ name: ingredient.name, weight, ...detect(ingredient.name) }];

    const children = resolve(ingredient.children, weight, `${at}.children`);
    const total = sum(children.map((child) => child.weight));
    if (!equals(total, weight)) {
      throw new Error(
        `${at}.children: add up to ${toDecimalString(total)} g, expected ${toDecimalString(weight)} g`,
      );
    }
    // A product made of one ingredient is that ingredient: "Sauerteig" declares "Roggenmehl, Wasser".
    const isProduct = parent === undefined && ingredients.length === 1;
    return ingredient.group && !isProduct ? [toGroup(ingredient.name, weight, children)] : children;
  });
  return merge(items).sort((a, b) => compare(b.weight, a.weight));
}

//#endregion

export function createIngredientsList(ingredients: Ingredient[]): ResolvedIngredient[] {
  return resolve(ingredients, undefined, "");
}
