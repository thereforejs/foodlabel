# lmiv: specification

Food declaration and nutrition from recipes, by the rules of the EU food information regulation
(LMIV, Regulation (EU) No 1169/2011) and its German companions. Pure TypeScript, open source.

Written 2026-10-22 from a long design conversation with a master baker who declared bakery products for
ten years. **Where this document and a secondary source disagree, this document wins; where it is
unsure, it says so.** Open points are listed at the end, never guessed.

---

## 1. What it is, and what it is not

**It is** a library that takes a recipe tree with exact amounts (materials given as structured
specifications, as supplier ingredient texts, or both, section 3.5) and returns:

1. the **ingredient list** (Zutatenverzeichnis) in the legally correct order and wording, compound
   ingredients in brackets or resolved, allergens highlighted;
2. the **allergens** (the 14 groups of Annex II) with where each one comes from;
3. **QUID** percentages where requested (Art. 22);
4. the **nutrition declaration** per 100 g of the finished product, exact and rounded;
5. **diagnostics**: every refusal and every warning with a stable code and the path to the cause.

**It is the source of truth and never estimates.** Every component needs a value. A missing share is
refused with an error that names it. Estimating missing shares (a supplier who gives no percentage for
salt) is the job of the application using the library, which marks the estimate and lets a person
confirm it before it reaches the library.

**It is not:**

- an estimator, a guesser, or anything with machine learning. Ingredient text is split by fixed
  syntax rules and every term is matched whole against the curated vocabulary; an unknown term is
  refused, never assumed harmless (3.5);
- a label layout, a printer or a PDF writer;
- a database, a store or a network client (data ships inside the package as versioned JSON);
- a judge. It applies the rules it knows, names their source, and when a case is unclear it declares
  rather than omits (section 4.9).

---

## 2. Principles

- **Exact decimals everywhere** with `@jasy/decy` (npm). Never JavaScript `number` arithmetic for
  amounts, percentages or nutrients. Round only at the end, with named rounding (section 6.4).
- **Rules as data with their source.** Every allergen, exception, class name, energy factor and
  rounding rule carries a citation (regulation, article or annex, number). A rule without a source
  does not exist.
- **In doubt, declare** (section 4.9). A missing allergen can kill; a superfluous one cannot.
- **The library protects itself.** In Germany no authority answers labelling questions in advance;
  most open points stay open. Where the law leaves room, the library takes the side that cannot hide
  information (declare, list separately, refuse) and says so with `rule.unclear`. It never waits for
  an answer and never picks the convenient reading.
- **Jurisdiction is a parameter.** Only `EU-DE` (EU law plus German national rules) is built now, but
  nothing is hard wired so that Austria or Switzerland can follow (the Swiss 2 % rule for compound
  ingredients is broader than the EU one and must not leak in).
- **Never a substring search.** "Milchsäure" (lactic acid) contains "Milch" and is not milk;
  "Buchweizen" contains "weizen" and is not wheat. Recognition of allergens works only on curated
  identifiers and synonyms (section 7), never on `contains()`.
- **Pure functions, no I/O, deterministic.** Same input, same output, in Node and in every browser.

---

## 3. Input model

The input is a tree. Names below are proposals; the implementer may refine them, keeping the meaning.

### 3.1 Recipe

```ts
interface Recipe {
  /** Percent of the dough weight lost in the oven, 0 to below 100; null: none. */
  bakingLoss: Decimal | null;
  lines: RecipeLine[];
}

type RecipeLine =
  | { kind: "heading"; afterBaking: boolean } // its lines join after the oven
  | { kind: "item"; kg: Decimal; item: Component; use: LineUse; display?: Display };

interface LineUse {
  weighed: boolean; // weighed into the dough
  declared: boolean; // appears in the ingredient list
  nutrition: boolean; // counts in the nutrition declaration
}

type Display = "compound" | "resolved" | "nameOnly"; // see 4.3
```

- Lines before the first heading go into the oven.
- A line's `use` applies to everything under it: a switch off at any level is off for the raw
  materials below (logical AND along the path).
- Amounts are in kg with six decimals (a milligram).

### 3.2 Component

A component is either a **raw material** or a **recipe** (a sub-recipe).

```ts
type Component =
  | { kind: "recipe"; id: string; name: string; recipe: Recipe; usedAs: "dough" | "baked" }
  | { kind: "material"; id: string; name: string; spec: MaterialSpec };
```

- `usedAs: "baked"`: the amount on the parent line is the sub-recipe's **baked** weight (500 g of a
  baked sponge base); the dough needed is computed back by the sub-recipe's own baking loss. A
  sub-recipe line under an "after baking" heading is used as baked; under the oven, as dough.

### 3.3 Material specification

What a supplier declares about a purchased raw material, or a basic ingredient:

```ts
type MaterialSpec = (
  | { kind: "basic"; ingredient: IngredientId } // Weizenmehl, Wasser, Salz, Hefe
  | { kind: "composite"; parts: SpecPart[]; customName?: string; exemption?: Exemption }
) & { sulphite?: { mgPerKg: Decimal } | "unknown" }; // as SO2, from the supplier

type Exemption = "unionStandard" | "spiceMix" | "noIngredientList"; // 4.3

interface SpecPart {
  share: { percent: Decimal } | { kg: Decimal }; // one of them, always; never missing
  item: MaterialSpec | { additive: AdditiveRef } | { processingAid: true; reason: string };
  display?: Display; // for a composite part, e.g. chocolate in a filling
}

interface AdditiveRef {
  id: AdditiveId; // E number, into the shipped additive data (5.1)
  function: AdditiveClass; // the class it serves in this food, from the supplier
}
```

- Every part has a share. Percent shares of one composite must add up to 100 % (within the rounding of
  the supplier's figures: a configurable tolerance, default 0.1 percentage points); amounts are scaled
  to the material's amount. A missing share is error `share.missing` with the path.
- `IngredientId` points into the shipped vocabulary (section 7), which knows the legal name, the
  allergen group, the dough role and the nutrition values.
- `exemption` says which kind of compound ingredient the material is (4.3). It is a fact about the
  material from the supplier; whether the exemption applies in a recipe is decided by the library.
- `sulphite` absent: the supplier declares none. `"unknown"`: sulphite is in it, the amount is not
  known (4.6).
- `function` must be one of the class names of Annex VII Part C LMIV, otherwise error
  `additive.functionNotAllowed`. No law lists the allowed classes per substance (the EU additives
  database has no such field either), so the class comes from the supplier: citric acid is an acid in
  one food and an antioxidant in another. Only colours and sweeteners are fixed by law (their own
  tables in Annex II Part B of Regulation (EC) No 1333/2008); a colour declared as anything but
  "Farbstoff", or a sweetener as anything but "Süßungsmittel", is the same error.

### 3.4 Options

```ts
interface DeclarationOptions {
  jurisdiction: "EU-DE";
  highlight: "bold" | "uppercase"; // both are legal; the baker chooses
  sale: "prepacked" | "loose" | "selfService" | "catering"; // 5.5
  smallIngredientsAnyOrder: boolean; // Annex VII Part A No 6, default false
  quid: { ingredient: IngredientId | "class:..." }[]; // what QUID is asked for
  guideline?: GuidelineId; // 4.10, the category the name claims ("roggenmischbrot")
  pieceKg?: Decimal; // 6.5, weight of one piece as sold
  additives: "name" | "eNumber"; // "Emulgator: Sojalecithin" or "Emulgator: E 322 (SOJA)"
}
```

- `guideline` is a curated identifier, never read from a product name (no substring search, section 2).
- `additives: "eNumber"`: an additive from an allergen source keeps the allergen visible after the
  number, "E 322 (SOJA)" (Art. 21). Classes without a specific name (modified starch) are unaffected.

### 3.5 Text input

A material may be given as the supplier's ingredient text instead of a structured specification:

```ts
| { kind: "text"; text: string } // "Weizenmehl, Backmittel 2 % (WEIZENMEHL, Malz 5 %, ...), Salz"
```

The library turns it into a `MaterialSpec` in two steps; everything after that is the same path as
structured input (one model, one set of rules):

1. **split**: syntax only, no vocabulary. Brackets of any depth (round and square), a leading
   "Zutaten:", a closing full stop; percentages in every position ("10 % Mehl", "Mehl 10 %",
   "Haselnüsse (13 %)": a bracket holding only a percentage is a share, not a sub-list); the decimal
   comma is not a list comma ("Malz 10,5 %"); **never split on "und"** ("Mono- und Diglyceride");
   classes as "Emulgator: E 471" and "Emulgatoren (E 471, E 472e)"; highlighting ("MILCH",
   "**Milch**") is emphasis, not meaning; precautionary statements ("Kann Spuren von ... enthalten")
   are cut off and returned apart (out of scope, open question 8). Text it cannot parse is error
   `text.syntax` with the position.
2. **resolve**: every term is matched **whole** against the vocabulary (section 7) after normalising
   case, ß/ss, hyphens, spaces and Typ/Type. Never a substring, never fuzzy matching. Where the reach
   of a class list is ambiguous ("Emulgatoren: E 471, E 472e, Wasser") the vocabulary decides, and if
   it cannot, the text is refused. An unknown term is error `ingredient.unknown` with its path; the
   application maps it (or adds a synonym) and asks again.

Shares: what the text gives is used; what it does not give is missing, and a missing share is refused
like in structured input (`share.missing`, `share.sumNot100`). The library never fills a gap. Mixed
input is normal: a recipe line can be a structured material whose parts are texts, and the reverse.

---

## 4. Declaration rules

Citations: LMIV = Regulation (EU) No 1169/2011 (consolidated 2018-01-01); "Notice allergens" =
Commission Notice 2017/C 428/01; "Notice QUID" = Commission Notice 2017/C 393/05.

### 4.1 Order by weight at the time of manufacture (LMIV Art. 18(1))

- The list is in descending order of weight **as used**, not of the dough or the baked product.
- **Water** is the exception (Annex VII Part A No 1): added water is declared by its weight **in the
  finished product**: the finished product's weight minus all other ingredients. Added water under
  5 % of the finished product is not listed.
- **Volatile products** (alcohol in a filling) likewise by their share in the finished product
  (Annex VII Part A No 1, second paragraph). Open question 12.

### 4.2 Baking loss and water (the baker's rule, physics)

The baking loss is a percentage of the dough weight. It comes **only off added water**:

1. off the added water of the recipe itself (lines with `weighed` and in the oven);
2. if that is not enough (rare), proportionally off the added water inside sub-recipes used in the
   oven (the water in a sourdough), level by level;
3. never below zero: whatever remains unexplained is ignored for the ingredient list and reported as
   warning `bakingLoss.exceedsWater`;
4. **a baking loss in a recipe without any added water is ignored** for the ingredient list (warning
   `bakingLoss.withoutWater`). Flour, fat, sugar, eggs and milk lose nothing in the declaration.

Water gets **no percentage** in the list.

Example (no compound brackets): 10 kg wheat flour, 10 kg water, baking loss 20 %. Dough 20 kg, loss
4 kg, all from water: 10 kg flour, 6 kg water, finished product 16 kg. Flour is 62.5 % of the finished
product. List: "Weizenmehl, Wasser" (water still listed: 6 kg is far above 5 %).

### 4.3 Compound ingredients (Annex VII Part E)

Three presentations, chosen per line (or per composite part) by `display`:

- **compound**: listed under its name at its total weight, its ingredients **directly after it in
  brackets**, in their own order: "Sauerteig (Roggenmehl, Wasser)". **Nothing in brackets is merged
  with the same ingredient outside the brackets.**
- **resolved**: its ingredients go into the main list and are merged with equal ingredients there
  (five times water in five materials becomes one "Wasser", added up and placed by its total).
- **nameOnly**: listed under its name without its ingredient list. Only under the narrow exemption
  below; allergens (and for kinds a and b additives) stay visible.

Worked example from the baker (no baking loss, to keep it plain):
10 kg Roggenmehl, 5 kg Sauerteig (50 % Roggenmehl, 50 % Wasser), 5 kg Wasser. Total 20 kg.

- compound: Roggenmehl 50 %, Sauerteig 25 % (Roggenmehl 50 %, Wasser 50 %), Wasser 25 %
  → "Roggenmehl, Sauerteig (Roggenmehl, Wasser), Wasser"
- resolved: Roggenmehl 12.5 kg = 62.5 %, Wasser 7.5 kg = 37.5 % → "Roggenmehl, Wasser"

With a baking loss, step 2 of 4.2 reaches into the sourdough's water only when the recipe's own added
water is not enough; the flour is always listed.

**The exemption is narrow** (Annex VII Part E No 2). A compound ingredient may stay without its
ingredients only as one of three kinds, given by the material's `exemption`:

| `exemption`            | Kind                                                                                                                                       | Limit                             | Additives inside                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | -------------------------------------- |
| `unionStandard` (a)    | composition laid down in Union law (chocolate, jam)                                                                                        | under 2 % of the finished product | still listed (Art. 20(a) to (d) aside) |
| `spiceMix` (b)         | mixture of spices and/or herbs                                                                                                             | under 2 % of the finished product | still listed (Art. 20(a) to (d) aside) |
| `noIngredientList` (c) | a food that needs no ingredient list itself (Art. 19: cheese, butter, cream, fermented milk; Art. 16(4): drinks above 1.2 % alcohol, wine) | none                              | -                                      |

- The baker chooses `nameOnly`; the library checks both conditions: the kind is set on the material,
  and for (a) and (b) the share of the finished product is below 2 % (exactly 2 % is not below).
  Otherwise error `exemption.notApplicable`, naming the failed condition. The library never applies
  the exemption by itself.
- **Allergens inside are declared in every case**, e.g. "Schokolade (MILCH, SOJA)". The exact text when
  allergens and additives meet in one bracket is open question 14.
- The old general 2 % / 25 % rule of Directive 2000/13 is gone.

### 4.4 Ingredients under 2 % (Annex VII Part A No 6)

Ingredients under 2 % of the finished product may follow the others in any order. Default: keep the
order by weight; `smallIngredientsAnyOrder` only allows a stable alternative (e.g. alphabetical).

### 4.5 Names

- **Flour**: "Weizenmehl", "Roggenmehl", never with the type number ("Type 550" never appears).
- **Mixed flours** (Annex VII Part B No 3): "Mehl (Roggen, Weizen)", the cereals in descending order.
- **Spelt, khorasan, durum, emmer, einkorn are wheat** and must say so: "Dinkelvollkornmehl (WEIZEN)"
  or "Weizen (Dinkel)". "Dinkelmehl" alone is wrong (Notice allergens No 9).
- **Starch** (Annex VII Part B No 4): class name "Stärke", but the allergenic origin stays: "Weizenstärke".
- **Class names** for additives (Annex VII Part C): the class name followed by the specific name or the
  E number: "Emulgator: Sojalecithin" / "Säuerungsmittel: Citronensäure". The class is the function in
  the food, not a property of the substance.
- **One additive, several classes: listed once per class, never added across classes.** An additive is
  identified by **substance and class** together. Calcium phosphates as raising agent (from the baking
  powder) and as acidity regulator (from a filling) are two entries, each with its own weight and its
  own place in the order: "Backtriebmittel: Calciumphosphate, ..., Säureregulator: Calciumphosphate".
  Only equal substance **and** equal class merge (resolved mode, 4.3). Each entry carries exactly one
  class, the principal function of that use (Annex VII Part C: "Gehört eine Zutat zu mehreren Klassen,
  so ist die Klasse anzugeben, der die Zutat aufgrund ihrer hauptsächlichen Wirkung für das betreffende
  Lebensmittel zuzuordnen ist"). Practice: 175 of 1,538 real bakery declarations do exactly this.
  Open question 15.
- **Refined oils and fats**: "pflanzliche Öle (Raps, Sonnenblume)", "ganz gehärtet" or "teilweise
  gehärtet" where applicable (Annex VII Part A Nos 8 and 9).

### 4.6 Allergens (Art. 9(1)(c), Art. 21, Annex II)

- The 14 groups of Annex II, **with every exception**: wheat-based glucose syrups including dextrose,
  wheat-based maltodextrins, barley-based glucose syrups, cereals used for distillates; fully refined
  soybean oil and fat, natural mixed tocopherols (E 306) and derivatives, phytosterols from soy, plant
  stanol ester from soy sterols; whey used for distillates, lactitol; nuts used for distillates; fish
  gelatine or isinglass as carrier or fining agent; sulphites only above 10 mg/kg or 10 mg/l as SO2 in
  the product as ready for consumption.
- **Annex II is exhaustive.** Buckwheat, coconut, poppy, nutmeg, pine nuts, tiger nut, maize, rice,
  millet, sorghum, teff, amaranth and quinoa are not allergens. Peanut is its own group, not a tree nut. "Ei"
  means eggs of all poultry, "Milch" milk of all farmed animals.
- **No exception for**: refined peanut oil, soy lecithin, malt extract (barley), wheat starch, sesame
  oil.
- **Allergens beat every exception.** Class names, processing aids, carry-over, carriers and the 2 %
  rule all apply "without prejudice to Article 21": an enzyme on a wheat carrier is not listed as an
  ingredient, but wheat is declared.
- **Highlighting** (Art. 21(1)(b)): set apart by font, style or background; both bold and uppercase
  are accepted. Option `highlight`.
- **No extra "Allergene: ..." line on prepacked food** that has an ingredient list (Notice allergens
  No 27). For loose food an allergen list is the normal form (5.5).
- A line with `declared: false` that holds an allergen is **error** `allergen.undeclared` (the
  allergen still has to be declared somewhere; the library refuses rather than hides it).
- **Sulphites** (dried fruit, candied peel, wine): the SO2 of every material (`sulphite.mgPerKg` times
  its kg) is summed and divided by the weight after baking (6.1), giving mg/kg in the product as sold.
  Above 10 mg/kg: declared. No loss of SO2 in the oven is counted (open question 7). An additive
  E 220 to E 228 is sulphite as well. A material with `sulphite: "unknown"` (or a sulphite additive
  without a known amount) is declared, with warning `sulphite.amountUnknown` (4.9).

### 4.7 Processing aids and carry-over (Art. 20)

The baker's test: **does it have a purpose in the finished product?** Yes: declare. No: not.

- A release agent in a baking improver that only keeps the powder from clumping has no purpose in the
  bread: not declared. Palm fat that is not marked as a processing aid in the specification is declared.
- Release oil or wax on the tray: no purpose in the product, not declared (`use` all off).
- Fat taken up in frying (a doughnut takes up 1 to 2 %): a line "after baking", not weighed, declared,
  in the nutrition. Never a negative baking loss.
- Allergens from processing aids are declared anyway (4.6).

### 4.8 QUID (Art. 22, Annex VIII, Notice QUID)

- Required when an ingredient or class is in the name ("Nussbrot", "100 % Dinkelvollkornbrot"),
  emphasised, or essential to characterise the food; the application says which (`quid`).
- **Percentage of the finished product** for baked goods (Annex VIII No 4(a)): butter biscuits,
  50 g butter in 200 g dough, 170 g after baking: 50 / 170 = **29.4 %** (Commission example).
- Over 100 %: "Für 100 g wurden x g ... verwendet".
- **Round down for promises.** Percentages that make a claim (QUID, the cereal shares behind a name)
  are rounded **down**: better a touch less than more. Example: "Roggenmischbrot" needs more than 50 %
  rye (51 % in the baker's practice); a computed 50.96 % must not be shown as 51 %.
- Not required for loose food (Art. 44), but required for self-prepacked food in self-service
  (§ 4(1) LMIDV).

### 4.9 In doubt

If an exception is not unambiguous (example: glucose-fructose syrup from wheat, not named literally in
Annex II No 1(a)), the allergen is declared and the diagnostic `rule.unclear` names the rule and the
open question.

### 4.10 Guideline names (Leitsätze für Brot und Kleingebäck, optional checks)

The German food book guidelines tie names to cereal shares (Vollkorn at least 90 % wholemeal, Dinkelbrot
at least 90 % spelt, Roggenmischbrot / Weizenmischbrot more than 50 %, ...). These shares are relative to
the **cereal products** used, not to the finished product, so they differ from QUID. Optional checks
with warnings `guideline.*`, rounded down, run when the application names the category with option
`guideline`. Old bread used again ("Altbrot") is a raw material with its
own composition and counts by that composition (never listed as "Altbrot"). Sources: Leitsätze für Brot
und Kleingebäck (last amended 2026-01-22), Leitsätze für Feine Backwaren (2025-01-09).

---

## 5. Additives, sale forms

### 5.1 Additives

Regulation (EC) No 1333/2008. Every additive the library knows has: E number (with group members and
sub-numbers such as E 472a to f), German name and synonyms, its table in Annex II Part B (colour,
sweetener, other), and whether it is or may be an allergen source (E 322 lecithin from soy, from
egg, ...). Sources: Annex II Part B in the German consolidated version (EUR-Lex) for numbers and
names, the EU food additives database (CC BY 4.0) for groups and the authorisations of category 7. The function is given by the specification
(`AdditiveRef.function`), not guessed from the E number.

The data also carries the **mandatory notes** an additive triggers, with their source:

- sweeteners: "mit Süßungsmittel(n)", "mit Zucker(n) und Süßungsmittel(n)" (LMIV Annex III No 2.1, 2.2);
- aspartame and its salt: "enthält eine Phenylalaninquelle" (Annex III No 2.3);
- polyols above 10 % of the product: "kann bei übermäßigem Verzehr abführend wirken" (Annex III No 2.4;
  the library computes the share);
- the six azo dyes (E 102, E 104, E 110, E 122, E 124, E 129): "Bezeichnung oder E-Nummer des Farbstoffs:
  Kann Aktivität und Aufmerksamkeit bei Kindern beeinträchtigen" (Regulation (EC) No 1333/2008 Art. 24,
  Annex V).

### 5.2 to 5.4 reserved for the implementer's notes

### 5.5 Sale forms (Germany)

- **prepacked**: full ingredient list, QUID, nutrition (unless exempt, open question 11).
- **loose** (unpackaged, over the counter, delivered to catering): allergens in writing or orally with a
  written record (LMIDV); additive notes per § 5 LMZDV ("mit Konservierungsstoff", "mit Farbstoff",
  "geschwärzt", "gewachst", ...); "geschwefelt" is gone since 2021, sulphites go through the allergen
  rule. Sweeteners, phenylalanine and the laxative note always.
- **selfService** (self-prepacked in a self-service shelf): full labelling like prepacked except
  nutrition (§ 4(1) LMIDV); exception for "Dauerbackwaren" (long-keeping bakery wares: shortcrust
  biscuits, stollen; official definition to be linked by the implementer) and confectionery.
- **catering** (hotels, schools, kindergartens as community catering): mandatory particulars may be
  given in the commercial documents, e.g. on the delivery note (Art. 8(6) and (7) LMIV).

---

## 6. Nutrition

### 6.1 Calculation (Art. 31(4)(b), (c))

- For every raw material reached through the tree (with `nutrition` on along its path): its amount in
  kg times its values per 100 g. Water has 0 of everything.
- Sum all of them, then **divide by the weight after baking**, not by the dough weight. Only water
  evaporates, so the sums stay and the weight shrinks: per 100 g the values rise (dough 100 kJ per
  100 g, 20 % water lost: bread 125 kJ per 100 g).
- The weight after baking is the real one: oven lines after their loss, plus everything after baking,
  plus lines not weighed (fat taken up). For nutrition the loss comes from the real weight even in a
  recipe without added water (a shortcrust loses water from butter and eggs); for the ingredient list
  4.2 still applies.
- EuroFIR check: the ingredient amounts of 100 g of product, water included, add up to 97 to 103 g
  (EuroFIR recipe calculation guideline, 10 steps). Outside: warning `nutrition.massBalance`.
- Retention: the mandatory nutrients are kept fully when baking (factor 1.0); vitamins are out of scope.

### 6.2 Energy (Annex XIV)

kJ and kcal each with their own factors, never converted into each other:
fat 37 kJ / 9 kcal, carbohydrate (except polyols) 17 / 4, polyols 10 / 2.4, protein 17 / 4,
fibre 8 / 2, salatrims 25 / 6, alcohol 29 / 7, organic acid 13 / 3, erythritol 0 / 0.
Whether organic acids from sourdough and fibre must enter the energy is open question 3.

### 6.3 Salt

Salt = sodium × 2.5 (Annex I No 11).

### 6.4 Rounding (Commission guidance on tolerances, December 2012, Table 4)

Computed unrounded, rounded only for display, **half up** (commercial rounding, "kaufmännisch");
**energy is computed from the unrounded nutrients**.

| Nutrient                                                   | per 100 g            | Rounding             |
| ---------------------------------------------------------- | -------------------- | -------------------- |
| Energy                                                     |                      | whole kJ and kcal    |
| Fat, carbohydrate, sugars, protein, fibre, polyols, starch | ≥ 10 g               | 1 g                  |
|                                                            | < 10 g and > 0.5 g   | 0.1 g                |
|                                                            | ≤ 0.5 g              | "0 g" or "< 0,5 g"   |
| Saturates, mono-, polyunsaturates                          | ≥ 10 g               | 1 g                  |
|                                                            | < 10 g and > 0.1 g   | 0.1 g                |
|                                                            | ≤ 0.1 g              | "0 g" or "< 0,1 g"   |
| Sodium                                                     | ≥ 1 g                | 0.1 g                |
|                                                            | < 1 g and > 0.005 g  | 0.01 g               |
|                                                            | ≤ 0.005 g            | "0 g" or "< 0,005 g" |
| Salt                                                       | ≥ 1 g                | 0.1 g                |
|                                                            | < 1 g and > 0.0125 g | 0.01 g               |
|                                                            | ≤ 0.0125 g           | "0 g" or "< 0,01 g"  |

Boundary cases are tests: exactly 10.0 g, 0.5 g, 9.96 g (rounds to 10.0: shown as "10 g" by the ≥ 10 g
rule applied to the rounded value? Decide and fix as a test; open question 4), 0.0125 g salt.

### 6.5 Output

Per nutrient: the exact value, the rounded value, and the display text. Per 100 g; also per piece
when the application gives `pieceKg`.

---

## 7. Shipped data

Versioned JSON inside the package (a separate data package later if it grows), each file with its
sources and attribution:

- **Allergen vocabulary**: the 14 groups with their legal names, exceptions, and a curated list of
  ingredient identifiers with synonyms and spelling variants (Typ/Type, ß/ss, hyphens, plural) that map
  to a group or explicitly to "no allergen" (the traps). No official machine readable list exists; this
  vocabulary is the library's own work and its main value.
- **Additives**: E numbers, German names, functional classes (EU food additives database, CC BY 4.0;
  German names and classes from EUR-Lex).
- **Basic ingredients with nutrition values**: Bundeslebensmittelschlüssel BLS 4.0 (Max Rubner-Institut,
  CC BY 4.0, "MRI als Herausgeber nennen", DOI 10.25826/Data20251217-134202-0). Supplemental: USDA
  FoodData Central (CC0), Ciqual (Etalab 2.0), Frida (CC BY 4.0). Open Food Facts is **not** used as a
  source (ODbL share-alike, unclear taxonomy license); at most as an independent check while building.
- **Law texts** are official works (§ 5 UrhG) and EUR-Lex content is reusable under Decision
  2011/833/EU.

A single `ATTRIBUTION.md` lists every source with its license.

---

## 8. Output and diagnostics

- **Ingredient list** as a structure (entries with name, weight, share, allergen, children for
  compound entries, origin path) and as text with the chosen highlighting.
- **Allergens**: the set of groups, each with the paths that bring it in.
- **QUID**: per requested item, the percentage (rounded down) and the text form.
- **Nutrition**: 6.5.
- **Diagnostics**: `{ code, level: "error" | "warning", path, params, source }`. Errors refuse the
  result (no half output); warnings come with it. Stable codes, e.g. `share.missing`,
  `share.sumNot100`, `allergen.undeclared`, `bakingLoss.exceedsWater`, `bakingLoss.withoutWater`,
  `nutrition.valuesMissing`, `nutrition.massBalance`, `rule.unclear`, `guideline.*`, `cycle`,
  `exemption.notApplicable`, `additive.functionNotAllowed`, `sulphite.amountUnknown`, `text.syntax`,
  `ingredient.unknown`.
- **Mandatory notes** (5.1) as a list, each with its source.
- Cycles in the input (a recipe containing itself through any path) are error `cycle`, never a hang.

---

## 9. Tests (the oracle)

Build the oracle first; every rule gets a red test before the code and a sabotage probe after.

1. **The baker's examples** (sections 4.2, 4.3, 6.1): 62.5 % flour with 20 % loss; the sourdough
   compound / resolved pair; water not enough at the top level, taken from the sourdough; loss without
   any added water ignored; brackets never merged; 100 kJ dough becomes 125 kJ bread.
2. **Doughnut, filled** in one recipe: dough in the oven (3 % loss), filling and fat taken up after
   baking, fat not weighed; ingredient list, allergens and nutrition.
3. **Cake** with a baked base used after baking by its baked weight (500 g base at 10 % loss needs
   0.5556 kg dough).
4. **Commission QUID example**: butter biscuits, 29.4 %.
5. **Traps**: every row of the traps table (about 110 words: Buchweizen, Dinkel, Milchsäure, E 481, E 575,
   Lactit, Kakaobutter, Kokos, Erdnussöl raffiniert, Sojalecithin, Malzextrakt, Weizenstärke, Bier vs
   Korn, Hefe, ...) becomes a test: recognised as the right group, or explicitly as none.
6. **Recalls as tests** (24 cases): an allergen three levels deep in a purchased improver must reach the
   list; an added ingredient must change the list; old bread inherits the allergens of what it was made
   from; a mixed-up label is out of scope but the input that would have caught it is tested.
7. **Rounding**: every boundary of Table 4.
8. **Properties** (fast-check, with seeds kept when they once failed):
   - the leaves of a tree add up to its weight (within the six decimal rounding);
   - the oven only takes: nothing after baking loses, the loss never exceeds the added water;
   - order: the list is non increasing by weight (except water and the < 2 % option);
   - adding an allergen anywhere in the tree adds it to the output; removing it removes it;
   - an independent check: the min/max shares implied by the list order (the way Open Food Facts
     estimates) always contain the true shares.
9. **EuroFIR mass balance** on every recipe fixture.

Background for the implementer, outside this repository (German, private notes):
`~/projects/bfb/documents/deklaration/recherche-recht.md` (law with citations, traps table in section 13,
questions for a food chemist in section 14), `recherche-loesungen-und-fehler.md` (calculation methods,
the 24 recall cases), `recherche-daten.md` (data sources and licenses), `praxis-flo.md` (the baker's
practice, already folded into this document).

---

## 10. Decisions (made, not to be reopened without the baker)

- The library never estimates; missing values are refused (section 1).
- Rounding half up for nutrition, computed unrounded, energy from unrounded values; percentages that
  make a claim are rounded down.
- In doubt, declare.
- Baking loss comes only off added water; none without added water (ingredient list).
- Brackets stay apart; resolved merges.
- Flour without type numbers.
- Highlighting bold or uppercase, the baker's choice.
- CC BY sources are fine with attribution; no lawyer needed for that.
- License MIT.
- An additive with different functions is listed once per class, never summed across classes (4.5).

## 11. Repository

- Vite+ toolchain (`vp check`, `vp test`, `vp pack`), see `CLAUDE.md`. Code, comments, docs and commits
  in English; German only in the shipped vocabulary and output texts.
- Dependency: `@jasy/decy` for all decimal arithmetic.
- License: MIT.

## 12. Open questions

1. BLS 4.0: the old imprint on blsdb.de says "private use only", the download page says CC BY 4.0; a
   written confirmation from the MRI (bls.karlsruhe@mri.bund.de) settles it before the data ships.
2. Annex II: changed after 2018? Verify the current consolidated version.
3. Energy: must organic acids (sourdough) and fibre enter the energy when not declared?
4. Rounding at the boundary (9.96 g fat: "10 g" or "10,0 g"); meaning of the footnote "not applicable to
   sub-categories" in Table 4.
5. Glucose-fructose syrup, starch syrup, caramel from wheat: covered by the exception of Annex II No 1(a)?
   Until settled: declared (4.9).
6. Enzymes and ascorbic acid in unbaked dough pieces, part-baked and frozen goods: processing aid or
   ingredient?
7. Sulphite calculation: may the loss of SO2 in baking be counted?
8. Precautionary allergen labelling ("Kann Spuren enthalten"): voluntary under Art. 36; EU rules expected
   2028 or later. Out of scope until then.
9. "Dauerbackwaren" (§ 4(1) LMIDV): find and link the recognised definition.
10. Community catering: are allergens on the delivery note enough in practice, or are data sheets
    expected? (Practice says: the legal minimum is enough.)
11. Nutrition exemption for small craft businesses (Annex V No 19): current interpretation, and whether it
    covers a bakery delivering to hotels and kindergartens.
12. Volatile ingredients (rum in a filling) and the water inside milk and eggs: listed by the weight as
    used, or by their share in the finished product?
13. ~~License~~: decided 2026-10-22, MIT.
14. `nameOnly` with allergens and additives inside (chocolate under 2 % with soy lecithin and milk):
    the exact text, e.g. "Schokolade (Emulgator: SOJALECITHIN, MILCH)"? Until settled: additives first,
    then the allergen groups not already named by them.
15. One additive under two classes in one food (4.5): the practice lists it per use. Annex VII Part C
    speaks of "the" principal function "for the food in question", which could be read as one class
    per food. No official guidance found (searched 2026-10-22). A food chemist should confirm the
    practice; until then the decision in section 10 holds.
