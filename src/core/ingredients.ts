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
import additivesDe from "../additives/de.json" with { type: "json" };
import allergensDe from "../allergens/de.json" with { type: "json" };
import { ALLERGEN_IDS } from "../allergens/ids.ts";
import type {
  AdditiveClassId,
  DeclarationOptions,
  Ingredient,
  ResolvedIngredient,
} from "../types/index.ts";
import { createAdditiveCatalog } from "./additives.ts";
import { createAllergenDetector, normalizeTerm } from "./allergens.ts";
import { resolveOptions } from "./options.ts";

const detect = createAllergenDetector(allergensDe);
const catalog = createAdditiveCatalog(additivesDe);

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

// Groups are never merged: what is in their brackets stays there. An additive is its substance
// plus its class, so E 341 as raising agent and as acidity regulator stay two entries.
function merge(items: ResolvedIngredient[]): ResolvedIngredient[] {
  const byKey = new Map<string | number, ResolvedIngredient>();
  items.forEach((item, index) => {
    const key = item.children
      ? index
      : item.eNumber
        ? `${item.eNumber} ${item.additiveClass}`
        : normalizeTerm(item.name);
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
  options: DeclarationOptions,
): ResolvedIngredient[] {
  const items = ingredients.flatMap((ingredient, index) => {
    const at = `${path}[${index}]`;
    const weight = toGrams(ingredient, parent, at);
    if (!ingredient.children?.length) {
      const additive = catalog.identify(ingredient, at);
      return [{ name: ingredient.name, weight, ...detect(ingredient.name), ...additive }];
    }

    const children = resolve(ingredient.children, weight, `${at}.children`, options);
    const total = sum(children.map((child) => child.weight));
    if (!equals(total, weight)) {
      throw new Error(
        `${at}.children: add up to ${toDecimalString(total)} g, expected ${toDecimalString(weight)} g`,
      );
    }
    // A product made of one ingredient is that ingredient: "Sauerteig" declares "Roggenmehl, Wasser".
    const isProduct = parent === undefined && ingredients.length === 1;
    return (ingredient.group ?? options.group) && !isProduct
      ? [toGroup(ingredient.name, weight, present(children))]
      : children;
  });
  return merge(items);
}

function byWeight(items: ResolvedIngredient[]): ResolvedIngredient[] {
  return items.sort((a, b) => compare(b.weight, a.weight));
}

// Additives of one class become one entry, placed by the class total.
function present(items: ResolvedIngredient[]): ResolvedIngredient[] {
  const classes = new Map<AdditiveClassId, ResolvedIngredient[]>();
  const entries: ResolvedIngredient[] = [];
  for (const item of items) {
    if (item.eNumber && item.additiveClass) {
      classes.set(item.additiveClass, [...(classes.get(item.additiveClass) ?? []), item]);
    } else entries.push(item);
  }
  for (const [id, members] of classes) {
    const weight = sum(members.map((member) => member.weight));
    const label = catalog.classLabel(id, members.length);
    entries.push({ ...toGroup(label, weight, byWeight(members)), additiveClass: id });
  }
  return byWeight(entries);
}

//#endregion

export function createIngredientsList(
  ingredients: Ingredient[],
  options: Partial<DeclarationOptions> = {},
): ResolvedIngredient[] {
  return present(resolve(ingredients, undefined, "", resolveOptions(options)));
}
