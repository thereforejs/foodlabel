import {
  add,
  compare,
  type Decimal,
  decimal,
  equals,
  fromNumber,
  isZero,
  multiply,
  percentageOf,
  sum,
  toDecimalString,
} from "@thereforejs/decy";
import additivesDe from "../additives/de.json" with { type: "json" };
import allergensDe from "../allergens/de.json" with { type: "json" };
import { ALLERGEN_IDS } from "../allergens/ids.ts";
import { fail } from "../diagnostics/fail.ts";
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

const GRAMS_TO_KG = decimal("0.001");
// Annex II No 12: sulphites count as allergen above 10 mg/kg SO2 in the product.
const SULPHITE_LIMIT = decimal("10");

//#region Helper

function toGrams(ingredient: Ingredient, parent: Decimal | undefined, path: string): Decimal {
  const quantity = fromNumber(ingredient.quantity);
  if (ingredient.unit === "weight") return quantity;
  if (!parent) fail("share.withoutParent", path);
  return percentageOf(parent, quantity);
}

function toGroup(
  name: string,
  path: string,
  weight: Decimal,
  children: ResolvedIngredient[],
): ResolvedIngredient {
  const allergens = new Set(children.flatMap((child) => child.allergens));
  return {
    name,
    path,
    weight,
    allergens: ALLERGEN_IDS.filter((id) => allergens.has(id)),
    unknown: children.flatMap((child) => child.unknown),
    pieces: [],
    children,
    ...sulphiteOf(children),
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
    const merged = known && {
      ...known,
      weight: add(known.weight, item.weight),
      quid: known.quid || item.quid,
      ...sulphiteOf([known, item]),
    };
    byKey.set(key, merged ?? item);
  });
  return [...byKey.values()];
}

// Top down once, so every level below works in grams only.
function resolve(
  ingredients: Ingredient[],
  parent: Decimal | undefined,
  path: string,
  options: DeclarationOptions,
  inheritedSulphite?: number,
): ResolvedIngredient[] {
  const items = ingredients.flatMap((ingredient, index) => {
    const at = `${path}[${index}]`;
    const weight = toGrams(ingredient, parent, at);
    const own = ingredient.sulphite;
    if (own !== undefined && !(Number.isFinite(own) && own >= 0)) {
      fail("sulphite.invalid", at, { value: String(own) });
    }
    // A raw material's own amount covers its whole ingredient list; amounts below it are included.
    const sulphite = inheritedSulphite ?? own;
    if (!ingredient.children?.length) {
      const additive = catalog.identify(ingredient, at);
      const match = detect(ingredient.name);
      const unknown = additive && catalog.knows(ingredient.name) ? [] : match.unknown;
      return [
        {
          name: ingredient.name,
          path: at,
          weight,
          ...match,
          unknown,
          ...additive,
          quid: ingredient.quid,
          ...(sulphite !== undefined && {
            sulphiteMg: multiply(multiply(fromNumber(sulphite), weight), GRAMS_TO_KG),
          }),
        },
      ];
    }

    const children = resolve(ingredient.children, weight, `${at}.children`, options, sulphite);
    const total = sum(children.map((child) => child.weight));
    if (!equals(total, weight)) {
      fail("share.sumNot100", `${at}.children`, {
        sum: toDecimalString(total),
        expected: toDecimalString(weight),
      });
    }
    // A product made of one ingredient is that ingredient: "Sauerteig" declares "Roggenmehl, Wasser".
    const isProduct = parent === undefined && ingredients.length === 1;
    return (ingredient.group ?? options.group) && !isProduct
      ? [{ ...toGroup(ingredient.name, at, weight, present(children)), quid: ingredient.quid }]
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
    entries.push({
      ...toGroup(label, members[0]?.path ?? "", weight, byWeight(members)),
      additiveClass: id,
    });
  }
  return byWeight(entries);
}

function sulphiteOf(items: ResolvedIngredient[]): { sulphiteMg?: Decimal } {
  const amounts = items.flatMap((item) => (item.sulphiteMg ? [item.sulphiteMg] : []));
  return amounts.length > 0 ? { sulphiteMg: sum(amounts) } : {};
}

// The amount can only add the allergen: a named sulphite stays highlighted at any amount.
function addSulphites(items: ResolvedIngredient[]): ResolvedIngredient[] {
  return items.map((item) => {
    if (!item.sulphiteMg || isZero(item.sulphiteMg)) return item;
    const allergens = ALLERGEN_IDS.filter(
      (id) => id === "sulphites" || item.allergens.includes(id),
    );
    return item.children
      ? { ...item, allergens, children: addSulphites(item.children) }
      : { ...item, allergens };
  });
}

//#endregion

export function createIngredientsList(
  ingredients: Ingredient[],
  options: Partial<DeclarationOptions> = {},
): ResolvedIngredient[] {
  const items = present(resolve(ingredients, undefined, "", resolveOptions(options)));
  const grams = sum(items.map((item) => item.weight));
  const sulphiteMg = sulphiteOf(items).sulphiteMg;
  // mg / kg > limit, without dividing: mg / (g / 1000) > limit  <=>  mg * 1000 > limit * g
  const over =
    sulphiteMg &&
    compare(multiply(sulphiteMg, decimal("1000")), multiply(SULPHITE_LIMIT, grams)) > 0;
  return over ? addSulphites(items) : items;
}
