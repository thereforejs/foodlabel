// Rebuilds the additives in src/additives/de.json from the German consolidated text of
// Regulation (EC) No 1333/2008, Annex II Part B. Classes and synonyms already in the file stay.
//
//   Source: https://eur-lex.europa.eu/legal-content/DE/ALL/?uri=CELEX%3A32008R1333
//   pdftotext -layout CELEX_02008R1333-<date>_DE_TXT.pdf 1333.txt
//   node scripts/additives-de.ts 1333.txt 2026-08-18

import { readFileSync, writeFileSync } from "node:fs";

interface Additive {
  name: string;
  synonyms: string[];
  notAuthorized?: true;
}

const [textPath, version] = process.argv.slice(2);
if (!textPath || !version)
  throw new Error("usage: node scripts/additives-de.ts <text> <yyyy-mm-dd>");

const target = new URL("../src/additives/de.json", import.meta.url);
const vocabulary = JSON.parse(readFileSync(target, "utf8"));
const current: Record<string, Additive> = vocabulary.additives;

const lines = readFileSync(textPath, "utf8").split("\n");
const start = lines.findIndex((line) => line.trim() === "TEIL B");
const end = lines.findIndex((line, index) => index > start && line.trim() === "TEIL C");
if (start < 0 || end < 0) throw new Error("Annex II Part B not found");

const SOFT_HYPHEN = String.fromCharCode(0xad);
const row = /^\s{4,}(E \d{3,4}[a-z]?(?:\([ivx]+\))?)\s{2,}(\S.*?)\s*$/;
const continuation = /^\s{12,}(\S.*?)\s*$/;
const additives: Record<string, Additive> = {};

for (let index = start; index < end; index++) {
  const match = row.exec(lines[index] ?? "");
  if (!match?.[1] || !match[2]) continue;
  let name = match[2];
  // Names wrapped by the PDF layout: "von Speise-" + "fettsäuren".
  const next = continuation.exec(lines[index + 1] ?? "");
  const wrapped = name.endsWith(SOFT_HYPHEN) || name.endsWith("von");
  if (next?.[1] && !row.test(lines[index + 1] ?? "") && wrapped) {
    name = name.endsWith(SOFT_HYPHEN) ? name.slice(0, -1) + next[1] : `${name} ${next[1]}`;
  }
  // "(**)" marks Titandioxid: listed, but authorised in no food category (footnote M98).
  const notAuthorized = name.includes("(**)");
  name = name.replace(/\s*\((?:\d+|\*+)\)$/, "").replaceAll(SOFT_HYPHEN, "");

  const eNumber = match[1];
  // Listed twice (as colour and as additive): the first spelling is the name, others are synonyms.
  const listed = additives[eNumber];
  if (listed) {
    if (listed.name !== name && !listed.synonyms.includes(name)) listed.synonyms.push(name);
    continue;
  }
  const known = current[eNumber];
  const synonyms = [...(known?.synonyms ?? [])];
  if (known && known.name !== name && !synonyms.includes(known.name)) synonyms.push(known.name);
  additives[eNumber] = { name, synonyms, ...(notAuthorized && { notAuthorized: true }) };
}

vocabulary.source = `Regulation (EC) No 1333/2008, Annex II Part B, consolidated ${version}; Regulation (EU) No 1169/2011, Annex VII, Part C`;
vocabulary.additives = additives;
writeFileSync(target, `${JSON.stringify(vocabulary, null, 2)}\n`);
console.log(`${Object.keys(additives).length} additives written`);
