import { localeOf } from "../core/options.ts";
import type { DeclarationOptions } from "../types/index.ts";

const escapeHtml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const escapeMarkdown = (text: string) => text.replaceAll(/[\\*_`[\]]/g, "\\$&");

/** Plain and highlighted text in the chosen format. Names come from outside, so all text is escaped. */
export function createMarkup(options: DeclarationOptions) {
  const plain =
    options.format === "html"
      ? escapeHtml
      : options.format === "markdown"
        ? escapeMarkdown
        : (text: string) => text;

  function strong(text: string): string {
    if (options.highlight === "uppercase") return plain(text.toLocaleUpperCase(localeOf(options)));
    return options.format === "html" ? `<strong>${plain(text)}</strong>` : `**${plain(text)}**`;
  }

  return { plain, strong };
}

export type Markup = ReturnType<typeof createMarkup>;
