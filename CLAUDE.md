# lmiv

Food declaration and nutrition from recipes under EU Regulation 1169/2011 (LMIV) and its German
companions: ingredient list, allergens, QUID, nutrition per 100 g, diagnostics. Pure TypeScript
library, open source, no I/O.

**`SPEC.md` is the source of truth.** Read the relevant section before touching a rule. Where the
spec is unsure it says so (section 12, open questions): never guess an answer, raise it with Flo.
Decisions in section 10 are not reopened without him.

## Non-negotiables (from the spec)

- **Exact decimals only**, via `@jasy/decy`. No JavaScript `number` arithmetic for amounts, shares,
  percentages or nutrients. Round only at the output, with the named rounding of SPEC 6.4.
- **Never estimate.** A missing value is an error with a stable code and the path to the cause.
- **Rules are data with a citation** (regulation, article or annex, number). A rule without a source
  does not exist. Check citations against the consolidated EUR-Lex text when encoding them.
- **In doubt, declare** and emit `rule.unclear`. A missing allergen can kill.
- **Never substring matching** for ingredients or allergens ("Milchsäure" is not milk, "Buchweizen" is
  not wheat). Only curated identifiers and synonyms.
- **Pure and deterministic:** same input, same output, in Node and every browser. No network, no fs.
- **Jurisdiction is a parameter.** Only `EU-DE` is built, but nothing EU-DE specific is hard wired.
- **Errors refuse the whole result**, warnings travel with it. One diagnostics channel:
  `{ code, level, path, params, source }`.

## Language

- Code, identifiers, comments, docs, commits, GitHub: English.
- German only in the shipped vocabulary and in output texts (ingredient names, label wording).
- Chat with Flo: German.

## Code rules

- Comments: few and short, senior style. The why (a legal reason, a trap), never the what or how.
  Where a rule is enforced, its citation is the comment.
- No em dashes or en dashes anywhere. Use a plain hyphen.
- Small focused files, flat structure, every rule in exactly one place. Abstraction grows with use.
- No `any`, no `as never`, no dead guards.
- Imports from `vite-plus` / `vite-plus/test`, never from `vite` or `vitest`.

## Verification (library tier)

- **Oracle first:** a red test before each rule, from the spec's examples (SPEC 9), then the code.
- **Sabotage probe** after each rule: break it on a copy, confirm a test fails, restore the copy.
  Never undo work with `git checkout`, `git stash` or `git reset`.
- **Property tests** with `fast-check`; a seed that once failed stays in the suite.
- Before reporting: `vp check` and `vp test` green. Report failures with their output.

## Git

- Collaboration mode by default: never commit, push, open or merge PRs, or release. Flo owns git.
  Leave changes in the working tree and suggest a one-line commit message.
- Goal run only when a `/goal` is active or Flo says so: commit locally, small and meaningful; never
  push, never release.
- Commit messages: one line, Conventional Commits, Nuxt style, e.g.
  `feat(allergen): add cereal exceptions`. No body, no Co-Authored-By, no trailers.
- Check the branch before the first change; on `main`, branch first.

## Toolchain: Vite+

Vite+ (`vp`) wraps the package manager (pnpm), Vitest, Oxlint, Oxfmt and tsdown. `vp help` and
`vp <command> --help` list everything.

- `vp install` after pulling, `vp add` / `vp remove` for dependencies. Never call pnpm or npm directly.
- `vp check` (format, lint, type check), `vp test`, `vp pack` (build the library).
- `vp dlx` for one-off binaries, `vp run <script>` for package scripts that share a built-in's name.
- Never install Vitest, Oxlint, Oxfmt or tsdown directly; type-aware linting is built in.
- The pre-commit hook runs `vp staged` (`vp check --fix` on staged files).
