import {
  compare,
  type Decimal,
  decimal,
  format,
  fromNumber,
  isZero,
  round,
  toDecimalString,
} from "@jasy/decy";
import { MAX_PERCENT_DECIMALS } from "../core/options.ts";
import type { DeclarationOptions, PercentStep } from "../types/index.ts";

const LOCALES = { "EU-DE": "de-DE" } satisfies Record<DeclarationOptions["jurisdiction"], string>;

// A share this small is almost always a recipe error; printing it would spread it to every label.
const MIN_SHARE = decimal("0.001");

function decimalsFor(value: Decimal, steps: PercentStep[]): number {
  for (const step of steps) if (compare(value, fromNumber(step.from)) >= 0) return step.decimals;
  return MAX_PERCENT_DECIMALS;
}

/** A share in percent as label text, e.g. "21 %". Never "0 %". */
export function formatPercent(value: Decimal, options: DeclarationOptions): string {
  if (compare(value, MIN_SHARE) < 0) {
    throw new Error(`share ${toDecimalString(value)} % is below 0.001 %, check the recipe`);
  }
  const at = (decimals: number) => round(value, { scale: decimals, mode: options.rounding });
  let decimals = decimalsFor(value, options.percentDecimals);
  // Rounding up can cross into a higher step: 9.96 shows as "10 %", not "10,0 %".
  decimals = decimalsFor(at(decimals), options.percentDecimals);
  while (isZero(at(decimals))) decimals++;

  const text = format(at(decimals), LOCALES[options.jurisdiction], { useGrouping: false });
  return options.percentSpace ? `${text} %` : `${text}%`;
}
