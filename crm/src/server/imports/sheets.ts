import { z } from "zod";
import { CrmError } from "@/server/guard";
import { logger } from "@/server/observability";
import { startImport, StartImportInput } from "@/server/imports/csvImport";

/**
 * Google Sheets import provider. Isolated here per the spec: no
 * Google-specific logic leaks into the wizard or the import engine — the
 * sheet is resolved to ROWS (header + data) and everything downstream is
 * source-agnostic.
 *
 * v1 reads sheets via their published-CSV link (File → Share → Publish to
 * web → CSV): zero OAuth infrastructure, works for shared team sheets. A
 * full Drive-API adapter (OAuth connect, spreadsheet/worksheet pickers)
 * slots in behind fetchSheetRows without further changes.
 */

const SHEET_CSV_RE = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+/;

export const SheetsInput = z.object({
  url: z.string().trim().url().max(500),
});

export async function fetchSheetRows(url: string): Promise<{ columns: string[]; rows: Array<Record<string, string>> }> {
  if (!SHEET_CSV_RE.test(url)) {
    throw new CrmError(
      "Provide a Google Sheets link (docs.google.com/spreadsheets/d/…). Use File → Share → Publish to web → CSV.",
      400,
    );
  }
  // Normalize to the CSV export endpoint.
  const exportUrl = url.includes("/export?format=csv")
    ? url
    : `${url.split("/edit")[0].split("/pubhtml")[0]}/export?format=csv`;
  let text: string;
  try {
    const response = await fetch(exportUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "text/csv" },
    });
    if (!response.ok) {
      throw new CrmError(
        `The sheet is not publicly published (HTTP ${response.status}) — publish it as CSV and retry.`,
        400,
      );
    }
    text = await response.text();
  } catch (error) {
    if (error instanceof CrmError) throw error;
    logger.warn("sheets_fetch_failed", { error: String(error) });
    throw new CrmError("Could not reach the sheet — check the link and that it is published.", 400);
  }
  return parseCsv(text);
}

/** Minimal RFC-4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): { columns: string[]; rows: Array<Record<string, string>> } {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      record.push(field);
      field = "";
      if (record.some((entry) => entry.trim() !== "")) records.push(record);
      record = [];
    } else {
      field += char;
    }
  }
  record.push(field);
  if (record.some((entry) => entry.trim() !== "")) records.push(record);

  if (records.length === 0) return { columns: [], rows: [] };
  const columns = records[0]!.map((column, position) => column.trim() || `column_${position + 1}`);
  const rows = records.slice(1).map((record) => {
    const row: Record<string, string> = {};
    columns.forEach((column, position) => {
      row[column] = record[position] ?? "";
    });
    return row;
  });
  return { columns, rows };
}

/** Kick off an import sourced from a published Google Sheet. */
export async function startSheetsImport(
  ctx: Parameters<typeof startImport>[0],
  url: string,
  base: Omit<z.infer<typeof StartImportInput>, "rows">,
) {
  const { rows } = await fetchSheetRows(url);
  if (rows.length === 0) throw new CrmError("The sheet has no data rows.", 400);
  if (rows.length > 5000) throw new CrmError(`Sheet has ${rows.length} rows — the limit is 5000.`, 400);
  return startImport(ctx, { ...base, rows, fileName: `sheet:${url.split("/d/")[1]?.slice(0, 16) ?? "sheet"}` });
}
