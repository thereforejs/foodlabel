import { fail } from "../diagnostics/fail.ts";
import type { DeclarationOptions, PercentStep } from "../types/index.ts";

export const MAX_PERCENT_DECIMALS = 3;

const LOCALES = { "EU-DE": "de-DE" } satisfies Record<DeclarationOptions["jurisdiction"], string>;

export const localeOf = (options: DeclarationOptions) => LOCALES[options.jurisdiction];

const defaults: DeclarationOptions = {
  jurisdiction: "EU-DE",
  format: "text",
  highlight: "uppercase",
  highlightScope: "name",
  additives: "name",
  group: false,
  quid: "before",
  percentDecimals: [
    { from: 10, decimals: 0 },
    { from: 1, decimals: 1 },
    { from: 0, decimals: 2 },
  ],
  percentSpace: true,
  rounding: "floor",
};

// Highest first. A missing 0 copies the step above, since smaller shares never need fewer digits.
function resolveSteps(steps: PercentStep[]): PercentStep[] {
  const sorted = [...steps].sort((a, b) => b.from - a.from);
  sorted.forEach((step, index) => {
    const path = "options.percentDecimals";
    if (step.from === sorted[index - 1]?.from) {
      fail("options.percentStepDuplicate", path, { from: step.from });
    }
    if (!(step.from >= 0 && step.from <= 100)) {
      fail("options.percentStepOutOfRange", path, { from: step.from });
    }
    if (
      !Number.isInteger(step.decimals) ||
      step.decimals < 0 ||
      step.decimals > MAX_PERCENT_DECIMALS
    ) {
      fail("options.percentDecimalsOutOfRange", path, { decimals: step.decimals });
    }
  });
  const lowest = sorted.at(-1);
  if (lowest?.from === 0) return sorted;
  return [...sorted, { from: 0, decimals: Math.max(1, lowest?.decimals ?? 0) }];
}

export function resolveOptions(options: Partial<DeclarationOptions> = {}): DeclarationOptions {
  const resolved = { ...defaults, ...options };
  // Allergens must stand out (1169/2011 Art. 21(1)(b)); plain text has no bold.
  if (resolved.format === "text" && resolved.highlight === "bold") {
    fail("options.boldNeedsMarkup", "options.highlight");
  }
  return { ...resolved, percentDecimals: resolveSteps(resolved.percentDecimals) };
}
