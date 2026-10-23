import type { DeclarationOptions, PercentStep } from "../types/index.ts";

export const MAX_PERCENT_DECIMALS = 3;

const defaults: DeclarationOptions = {
  jurisdiction: "EU-DE",
  format: "text",
  highlight: "uppercase",
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
    if (step.from === sorted[index - 1]?.from)
      throw new Error(`percentDecimals: ${step.from} is set twice`);
    if (!(step.from >= 0 && step.from <= 100)) {
      throw new Error(`percentDecimals: from ${step.from} is not within 0 to 100`);
    }
    if (
      !Number.isInteger(step.decimals) ||
      step.decimals < 0 ||
      step.decimals > MAX_PERCENT_DECIMALS
    ) {
      throw new Error(
        `percentDecimals: decimals ${step.decimals} is not a whole number from 0 to 3`,
      );
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
    throw new Error('highlight "bold" needs format "markdown" or "html"');
  }
  return { ...resolved, percentDecimals: resolveSteps(resolved.percentDecimals) };
}
