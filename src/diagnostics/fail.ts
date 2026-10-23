import type { Diagnostic, DiagnosticCode, DiagnosticParams } from "../types/index.ts";
import { DIAGNOSTICS, type Rule } from "./codes.ts";

/** Refuses the whole result. `diagnostics` carries the stable codes for the caller. */
export class DiagnosticError extends Error {
  readonly diagnostics: Diagnostic[];

  constructor(diagnostics: Diagnostic[]) {
    super(
      diagnostics
        .map(
          (diagnostic) =>
            `${diagnostic.path}: ${DIAGNOSTICS[diagnostic.code].message(diagnostic.params)}`,
        )
        .join("\n"),
    );
    this.name = "DiagnosticError";
    this.diagnostics = diagnostics;
  }
}

export function fail(code: DiagnosticCode, path: string, params: DiagnosticParams = {}): never {
  const rule: Rule = DIAGNOSTICS[code];
  const diagnostic: Diagnostic = { code, level: "error", path, params };
  throw new DiagnosticError([rule.source ? { ...diagnostic, source: rule.source } : diagnostic]);
}
