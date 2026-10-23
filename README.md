<p align="center">
  <img src="./assets/logo.svg" alt="foodlabel" width="128" height="128">
</p>

<h1 align="center">foodlabel</h1>

<p align="center">
  Ingredient lists from recipes under the EU food information regulation<br>
  (Regulation (EU) No 1169/2011, known as FIC, LMIV in German, INCO in French).<br>
  It calculates, it never guesses.
</p>

> [!WARNING]
> Early development (0.x). The API may change. Rules are encoded with their legal source, but the
> library is no legal advice: the label stays the responsibility of the food business.

## What it does

You pass a recipe as nested raw materials with their shares. foodlabel returns the ingredient list for the
label:

- resolves nested recipes top down to exact weights (no floating point, via
  [`@thereforejs/decy`](https://github.com/thereforejs/decy)) and sorts by weight
- merges the same ingredient across levels, or keeps a compound ingredient in brackets
- finds the 14 allergens of Annex II by whole words, never by substring: "Milchsäure" is not milk,
  "Buchweizen" is not wheat
- highlights allergens and names the allergen where the name does not: "Grieß (WEIZEN)",
  "Dinkelmehl (WEIZEN)", "E 322 (SOJA)"
- groups additives by class ("Emulgatoren: ..."), one substance in two classes stays two entries
- prints QUID percentages, inside a bracket relative to the bracket
- refuses what it cannot know instead of guessing: an unknown word, "Malz" without its cereal, a share
  below 0.001 %, children that do not add up to their parent

## Install

```sh
npm install @thereforejs/foodlabel
```

## Usage

```ts
import { createDeclaration } from "@thereforejs/foodlabel";

createDeclaration([
  { name: "Roggenmehl", quantity: 5000, unit: "weight", quid: true },
  { name: "Weizenmehl", quantity: 3000, unit: "weight" },
  {
    name: "Sauerteig",
    quantity: 1000,
    unit: "weight",
    group: true,
    children: [
      { name: "Roggenmehl", quantity: 50, unit: "percent" },
      { name: "Wasser", quantity: 50, unit: "percent" },
    ],
  },
  { name: "Wasser", quantity: 4800, unit: "weight" },
  { name: "Salz", quantity: 190, unit: "weight" },
  { name: "Sojalecithin", quantity: 10, unit: "weight", eNumberCategory: "Emulgator" },
]);
// 35 % ROGGENMEHL, Wasser, WEIZENMEHL, Sauerteig (ROGGENMEHL, Wasser), Salz, Emulgator: SOJALECITHIN
```

The same recipe with `{ format: "markdown", highlight: "bold", highlightScope: "allergen", additives: "eNumber" }`:

```md
35 % **Roggen**mehl, Wasser, **Weizen**mehl, Sauerteig (**Roggen**mehl, Wasser), Salz, Emulgator: E 322 (**Soja**)
```

`createIngredientsList` returns the same result as data (weights, allergens, groups) instead of text.

### Input

| Field                        | Meaning                                                                    |
| ---------------------------- | -------------------------------------------------------------------------- |
| `name`                       | Ingredient name as it should appear on the label                           |
| `quantity`, `unit`           | `"weight"` in grams, or `"percent"` of the parent                          |
| `children`                   | The raw material's own ingredients; they must add up to the parent exactly |
| `group`                      | Keep it as one entry with its ingredients in brackets                      |
| `quid`                       | Show its percentage                                                        |
| `eNumberCategory`, `eNumber` | Marks an additive: its class ("Emulgator") and, if known, its E number     |

Weights are taken as they end up in the product: baking loss is the caller's business.

### Options

| Option            | Values                                                         | Default                          |
| ----------------- | -------------------------------------------------------------- | -------------------------------- |
| `format`          | `"text"`, `"markdown"`, `"html"`                               | `"text"`                         |
| `highlight`       | `"uppercase"`, `"bold"` (not with `text`)                      | `"uppercase"`                    |
| `highlightScope`  | `"name"` (ROGGENMEHL), `"allergen"` (ROGGENmehl)               | `"name"`                         |
| `additives`       | `"name"`, `"eNumber"`                                          | `"name"`                         |
| `group`           | default for `Ingredient.group`                                 | `false`                          |
| `quid`            | `"before"`, `"after"`, `"brackets-before"`, `"brackets-after"` | `"before"`                       |
| `percentDecimals` | decimals per range, e.g. `[{ from: 10, decimals: 0 }]`         | 0 from 10 %, 1 from 1 %, 2 below |
| `percentSpace`    | `"21 %"` with a no-break space, or `"21%"`                     | `true`                           |
| `rounding`        | any [decy](https://github.com/thereforejs/decy) rounding mode  | `"floor"`                        |

### Errors

Whatever foodlabel cannot decide refuses the whole result with a `DiagnosticError`. Its `diagnostics` carry
a stable `code` to translate in your app, the `path` into your input and, where a regulation is the
reason, its `source`:

```ts
import { createDeclaration, DiagnosticError } from "@thereforejs/foodlabel";

try {
  createDeclaration([{ name: "Malz", quantity: 1, unit: "weight" }]);
} catch (error) {
  if (error instanceof DiagnosticError) error.diagnostics;
  // [{ code: "allergen.sourceMissing", level: "error", path: "[0]",
  //    params: { name: "Malz", allergen: "gluten" }, source: "Regulation (EU) No 1169/2011, Annex II; ..." }]
}
```

## Principles

- **The lowest layer.** foodlabel is a deterministic algorithm: same input, same output. It does not
  estimate shares, interpret names or guess. Anything smart belongs in the application above, which
  passes its decisions in as input.
- **In doubt, declare.** A missing allergen can kill. Where a rule is unclear, foodlabel takes the side that
  hides nothing, or refuses.
- **Rules are data with a source.** Every rule cites its regulation, article or annex.

## License

[MIT](./LICENSE). Part of [ThereforeJS](https://github.com/thereforejs).
