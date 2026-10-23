import { compare, decimal } from "@thereforejs/decy";
import fc from "fast-check";
import { describe, expect, test } from "vite-plus/test";
import { formatPercent } from "../src/output/percent.ts";
import { resolveOptions } from "../src/core/options.ts";
import type { DeclarationOptions } from "../src/types/index.ts";

const pct = (value: string, options: Partial<DeclarationOptions> = {}) =>
  formatPercent(decimal(value), resolveOptions(options));

describe("default steps (Globus practice: two significant digits)", () => {
  test.each([
    ["85", "85 %"],
    ["21.37", "21 %"],
    ["10", "10 %"],
    ["9.99", "9,9 %"],
    ["6", "6,0 %"],
    ["1.09", "1,0 %"],
    ["0.6", "0,60 %"],
    ["0.456", "0,45 %"],
  ])("%s -> %s", (value, text) => {
    expect(pct(value)).toBe(text.replace(" ", " "));
  });

  test("100 % stays whole", () => {
    expect(pct("100")).toBe("100 %");
  });
});

describe("never 0 %", () => {
  test("adds digits up to the first non-zero one", () => {
    expect(pct("0.023")).toBe("0,02 %");
    expect(pct("0.0023")).toBe("0,002 %");
  });

  test("below 0.001 % the recipe is most likely wrong", () => {
    expect(() => pct("0.0009")).toThrow("0.001");
    expect(() => pct("0")).toThrow("0.001");
  });
});

describe("options", () => {
  test("percentSpace false", () => {
    expect(pct("21", { percentSpace: false })).toBe("21%");
  });

  test("rounding mode", () => {
    expect(pct("21.5", { rounding: "halfAwayFromZero" })).toBe("22 %");
    expect(pct("21.5")).toBe("21 %");
  });

  test("rounding up into a higher step uses that step", () => {
    expect(pct("9.96", { rounding: "halfAwayFromZero" })).toBe("10 %");
  });

  test("user steps replace the default, a missing 0 copies the step above", () => {
    const steps = resolveOptions({
      percentDecimals: [
        { from: 10, decimals: 2 },
        { from: 80, decimals: 1 },
      ],
    }).percentDecimals;
    expect(steps).toEqual([
      { from: 80, decimals: 1 },
      { from: 10, decimals: 2 },
      { from: 0, decimals: 2 },
    ]);
  });

  test("a missing 0 gets at least one decimal", () => {
    expect(
      resolveOptions({ percentDecimals: [{ from: 10, decimals: 0 }] }).percentDecimals,
    ).toEqual([
      { from: 10, decimals: 0 },
      { from: 0, decimals: 1 },
    ]);
  });

  test("a 0 set by the user is taken as is", () => {
    expect(
      resolveOptions({
        percentDecimals: [
          { from: 10, decimals: 2 },
          { from: 0, decimals: 0 },
        ],
      }).percentDecimals,
    ).toEqual([
      { from: 10, decimals: 2 },
      { from: 0, decimals: 0 },
    ]);
  });

  test.each([
    [
      [
        { from: 10, decimals: 0 },
        { from: 10, decimals: 1 },
      ],
      "twice",
    ],
    [[{ from: 101, decimals: 0 }], "0 to 100"],
    [[{ from: -1, decimals: 0 }], "0 to 100"],
    [[{ from: 10, decimals: 4 }], "0 to 3"],
    [[{ from: 10, decimals: 1.5 }], "0 to 3"],
  ])("refused: %j", (percentDecimals, message) => {
    expect(() => resolveOptions({ percentDecimals })).toThrow(message);
  });
});

describe("properties", () => {
  const share = fc
    .integer({ min: 1_000, max: 100_000_000 })
    .map((units) =>
      decimal(`${Math.floor(units / 1_000_000)}.${String(units % 1_000_000).padStart(6, "0")}`),
    );

  test("every share from 0.001 to 100 % prints, never as 0", () => {
    fc.assert(
      fc.property(share, (value) => {
        expect(formatPercent(value, resolveOptions())).not.toMatch(/^0(,0*)? %$/);
      }),
    );
  });

  test("floor never shows more than the real share", () => {
    fc.assert(
      fc.property(share, (value) => {
        const shown = formatPercent(value, resolveOptions()).replace(" %", "").replace(",", ".");
        expect(compare(decimal(shown), value)).toBeLessThanOrEqual(0);
      }),
    );
  });
});
