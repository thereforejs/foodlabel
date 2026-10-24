import type { DiagnosticParams } from "../types/index.ts";

export interface Rule {
  source?: string;
  message: (params: DiagnosticParams) => string;
}

/** Every diagnostic foodlabel can raise. Codes are stable; apps translate them, not the messages. */
export const DIAGNOSTICS = {
  "share.withoutParent": {
    message: () => "a percentage needs a parent",
  },
  "share.sumNot100": {
    message: (p) => `children add up to ${p.sum} g, expected ${p.expected} g`,
  },
  "share.belowMinimum": {
    message: (p) => `"${p.name}": share ${p.share} % is below 0.001 %, check the recipe`,
  },
  "ingredient.unknown": {
    message: (p) => `"${p.name}" has unknown words: ${p.words}, never treated as safe`,
  },
  "allergen.sourceMissing": {
    source: "Regulation (EU) No 1169/2011, Annex II; Commission Notice 2017/C 428/01, No 8, 9, 13",
    message: (p) =>
      `"${p.name}" contains ${p.allergen} but does not say which kind, use a more specific name`,
  },
  "sulphite.invalid": {
    message: (p) => `sulphite ${p.value} is no amount in mg/kg`,
  },
  "additive.functionNotAllowed": {
    source: "Regulation (EU) No 1169/2011, Annex VII, Part C",
    message: (p) => `"${p.class}" is no additive class`,
  },
  "additive.unknown": {
    message: (p) => `"${p.name}" is no known additive`,
  },
  "options.boldNeedsMarkup": {
    source: "Regulation (EU) No 1169/2011, Art. 21(1)(b)",
    message: () => 'highlight "bold" needs format "markdown" or "html", plain text cannot be bold',
  },
  "options.percentStepDuplicate": {
    message: (p) => `step from ${p.from} is set twice`,
  },
  "options.percentStepOutOfRange": {
    message: (p) => `step from ${p.from} is not within 0 to 100`,
  },
  "options.percentDecimalsOutOfRange": {
    message: (p) => `decimals ${p.decimals} is not a whole number from 0 to 3`,
  },
} satisfies Record<string, Rule>;
