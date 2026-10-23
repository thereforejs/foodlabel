import { describe, expect, test } from "vite-plus/test";
import { createDeclaration } from "../src/output/declaration.ts";
import type { DeclarationOptions, Ingredient } from "../src/types/index.ts";

const g = (name: string, quantity: number, extra: Partial<Ingredient> = {}): Ingredient => ({
  name,
  quantity,
  unit: "weight",
  ...extra,
});
const p = (name: string, quantity: number, extra: Partial<Ingredient> = {}): Ingredient => ({
  name,
  quantity,
  unit: "percent",
  ...extra,
});
const nbsp = (text: string) => text.replaceAll(" %", " %");
const declare = (ingredients: Ingredient[], options: Partial<DeclarationOptions> = {}) =>
  createDeclaration(ingredients, options);

const recipe = (malt: string): Ingredient[] => [
  g("Roggenmehl", 5000),
  g("Weizenmehl", 3000),
  g("Sauerteig", 1000, { children: [p("Roggenmehl", 50), p("Wasser", 50)] }),
  g("Salz", 190),
  g("Backmittel", 250, {
    children: [p("Weizenerzeugnisse", 85), p(malt, 12), p("Glukose-Fructose-Sirup", 3)],
  }),
  g("Wasser", 5300),
];

describe("first recipe", () => {
  test("Malze does not say which cereal: refused", () => {
    expect(() => declare(recipe("Malze"))).toThrow("Malze");
  });

  test("with the cereal named", () => {
    expect(declare(recipe("Gerstenmalz"))).toBe(
      "Wasser, ROGGENMEHL, WEIZENMEHL, WEIZENERZEUGNISSE, Salz, GERSTENMALZ, Glukose-Fructose-Sirup",
    );
  });

  test("only the allergen part highlighted", () => {
    expect(declare(recipe("Gerstenmalz"), { highlightScope: "allergen" })).toBe(
      "Wasser, ROGGENmehl, WEIZENmehl, WEIZENerzeugnisse, Salz, GERSTENMALZ, Glukose-Fructose-Sirup",
    );
  });
});

describe("allergen named in brackets when the name does not say it (2017/C 428/01)", () => {
  test.each([
    ["Grieß", "GRIESS (WEIZEN)"],
    ["Dinkelmehl", "DINKELMEHL (WEIZEN)"],
    ["Dinkelweizenmehl", "DINKELWEIZENMEHL"],
    ["Molke", "MOLKE (MILCH)"],
    ["Marzipan", "MARZIPAN (MANDEL)"],
    ["Butter", "BUTTER"],
    ["Haselnussnougat", "HASELNUSSNOUGAT"],
  ])("%s -> %s", (name, text) => {
    expect(declare([g(name, 10), g("Wasser", 90)])).toBe(`Wasser, ${text}`);
  });

  test.each(["Nusskerne", "Gluten", "Malz"])("%s names no source: refused", (name) => {
    expect(() => declare([g(name, 10), g("Wasser", 90)])).toThrow(name);
  });

  test("an unknown name is refused, never treated as safe", () => {
    expect(() => declare([g("Buchweizen", 10), g("Wasser", 90)])).toThrow("buchweizen");
  });
});

describe("format", () => {
  test("markdown bold", () => {
    expect(
      declare([g("Dinkelmehl", 60), g("Wasser", 40)], {
        format: "markdown",
        highlight: "bold",
        highlightScope: "allergen",
      }),
    ).toBe("**Dinkel**mehl (**Weizen**), Wasser");
  });

  test("html bold escapes names", () => {
    expect(
      declare([g("Weizenmehl", 60), g("Salz & <Pfeffer>", 40, { children: [p("Salz", 100)] })], {
        format: "html",
        highlight: "bold",
        group: true,
      }),
    ).toBe("<strong>Weizenmehl</strong>, Salz &amp; &lt;Pfeffer&gt; (Salz)");
  });
});

describe("groups and additives", () => {
  test("a group keeps its bracket", () => {
    expect(
      declare([
        g("Weizenmehl", 600),
        g("Sauerteig", 400, { group: true, children: [p("Roggenmehl", 50), p("Wasser", 50)] }),
      ]),
    ).toBe("WEIZENMEHL, Sauerteig (ROGGENMEHL, Wasser)");
  });

  const emulsifiers = [
    g("Weizenmehl", 1000),
    g("Mono- und Diglyceride von Speisefettsäuren", 15, {
      eNumberCategory: "Emulgator",
      eNumber: "E 471",
    }),
    g("Sojalecithin", 10, { eNumberCategory: "Emulgator" }),
  ];

  test("additives by name", () => {
    expect(declare(emulsifiers)).toBe(
      "WEIZENMEHL, Emulgatoren: Mono- und Diglyceride von Speisefettsäuren, SOJALECITHIN",
    );
  });

  test("additives by E number keep their allergen", () => {
    expect(declare(emulsifiers, { additives: "eNumber" })).toBe(
      "WEIZENMEHL, Emulgatoren: E 471, E 322 (SOJA)",
    );
  });
});

describe("QUID", () => {
  const bread = [g("Roggenmehl", 600, { quid: true }), g("Wasser", 400)];

  test.each([
    ["before", "60 % ROGGENMEHL, Wasser"],
    ["after", "ROGGENMEHL 60 %, Wasser"],
    ["brackets-before", "(60 %) ROGGENMEHL, Wasser"],
    ["brackets-after", "ROGGENMEHL (60 %), Wasser"],
  ] as const)("%s", (quid, text) => {
    expect(declare(bread, { quid })).toBe(nbsp(text));
  });

  test("inside a group relative to the group, and the group gets its own share", () => {
    expect(
      declare([
        g("Weizenmehl", 7000),
        g("Sauerteig", 3000, {
          group: true,
          children: [p("Roggenmehl", 50, { quid: true }), p("Wasser", 50)],
        }),
      ]),
    ).toBe(nbsp("WEIZENMEHL, 30 % Sauerteig (50 % ROGGENMEHL, Wasser)"));
  });

  test("a bracket after the name takes the share before it", () => {
    expect(
      declare([g("Grieß", 400, { quid: true }), g("Wasser", 600)], { quid: "brackets-after" }),
    ).toBe(nbsp("Wasser, GRIESS 40 % (WEIZEN)"));
  });

  test("a class is a name, not a compound: its members relate to the level above", () => {
    expect(
      declare([
        g("Weizenmehl", 98),
        g("Sojalecithin", 2, { eNumberCategory: "Emulgator", quid: true }),
      ]),
    ).toBe(nbsp("WEIZENMEHL, Emulgator: 2,0 % SOJALECITHIN"));
  });
});
