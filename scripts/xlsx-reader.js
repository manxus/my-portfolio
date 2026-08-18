/**
 * Minimal read-only xlsx support: enough of the ZIP container and SpreadsheetML to pull a sheet's
 * cell values out. Exists so the assignment sync stays dependency-free like the rest of scripts/.
 *
 * Handles what Excel actually writes for a simple sheet -- stored and deflated entries, shared
 * strings, inline strings, and cached formula results. It is not a general xlsx library: no
 * styles, dates, or number formatting.
 */

import { inflateRawSync } from 'zlib';

const SIGNATURE = { END_OF_CENTRAL_DIR: 0x06054b50, CENTRAL_FILE: 0x02014b50 };

/** Read the ZIP central directory and return every member as { name, buffer }. */
function readZipEntries(buffer) {
  // The end-of-central-directory record sits at the tail, after a comment of unknown length, so it
  // has to be found by scanning backwards for its signature.
  let end = -1;
  for (let i = buffer.length - 22; i >= 0; i -= 1) {
    if (buffer.readUInt32LE(i) === SIGNATURE.END_OF_CENTRAL_DIR) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error('not a zip file: no end-of-central-directory record');

  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const entries = new Map();

  for (let i = 0; i < count; i += 1) {
    if (buffer.readUInt32LE(offset) !== SIGNATURE.CENTRAL_FILE) {
      throw new Error(`corrupt central directory at entry ${i}`);
    }

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);

    // The local header repeats the name and extra fields, and its lengths are the authoritative
    // ones for locating the data -- the central directory's extra length often differs.
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);

    entries.set(name, method === 0 ? raw : inflateRawSync(raw));
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

const unescapeXml = (value) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    // Ampersand last, so an escaped &amp;lt; does not become a tag.
    .replace(/&amp;/g, '&');

const stripTags = (value) => unescapeXml(value.replace(/<[^>]+>/g, ''));

function readSharedStrings(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => stripTags(match[1]));
}

/**
 * Returns a Map of row number -> { COLUMN: value }. Empty cells are omitted entirely so callers can
 * test presence rather than distinguishing "" from missing.
 */
function readSheet(xml, strings) {
  const rows = new Map();

  for (const rowMatch of xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};

    // The attribute group must be LAZY: a self-closing <c r="F4" s="14"/> would otherwise consume
    // the slash and fall into the `>` branch, swallowing the NEXT cell's <v> up to its </c> and
    // silently attributing one cell's value to another column.
    for (const cellMatch of rowMatch[2].matchAll(
      /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,
    )) {
      const [, column, attributes = '', inner = ''] = cellMatch;

      const inline = inner.match(/<is>([\s\S]*?)<\/is>/);
      const value = inner.match(/<v>([\s\S]*?)<\/v>/);

      let text = '';
      if (inline) text = stripTags(inline[1]);
      else if (value) {
        // t="s" indexes the shared string table; everything else (numbers, and t="str" formula
        // results such as the ✔️/❌ column) is already the literal cached value.
        text = /t="s"/.test(attributes) ? (strings[Number(value[1])] ?? '') : unescapeXml(value[1]);
      }

      if (text !== '') cells[column] = text;
    }

    rows.set(Number(rowMatch[1]), cells);
  }

  return rows;
}

/** Read the first worksheet of an xlsx buffer into a Map of row number -> { COLUMN: value }. */
export function readWorkbookRows(buffer, sheetPath = 'xl/worksheets/sheet1.xml') {
  const entries = readZipEntries(buffer);

  const sheet = entries.get(sheetPath);
  if (!sheet) throw new Error(`${sheetPath} is not in the workbook`);

  const strings = readSharedStrings(entries.get('xl/sharedStrings.xml')?.toString('utf8'));
  return readSheet(sheet.toString('utf8'), strings);
}
