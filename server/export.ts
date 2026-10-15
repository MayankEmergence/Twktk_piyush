import ExcelJS from "exceljs";
export function addExportSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  fields: string[],
  rows: Record<string, any>[],
) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = fields.map((key) => ({
    header:
      key === "price"
        ? "Price (paise)"
        : key === "amount_inr"
          ? "Amount (INR)"
          : key.endsWith("_at")
            ? `${key} (UTC)`
            : key,
    key,
    width:
      key === "id" || key.endsWith("_id")
        ? 39
        : key.includes("_data")
          ? 70
          : 26,
    style:
      key === "amount_inr"
        ? { numFmt: '"INR" #,##0.00' }
        : key.endsWith("_at")
          ? { numFmt: "dd mmm yyyy hh:mm" }
          : {},
  }));
  for (const input of rows) {
    const row = { ...input };
    for (const key in row) {
      if (key === "amount_inr") row[key] = Number(row[key]);
      if (
        row[key] &&
        typeof row[key] === "object" &&
        !(row[key] instanceof Date)
      )
        row[key] = JSON.stringify(row[key]);
    }
    sheet.addRow(row);
  }
  sheet.getRow(1).font = { bold: true, color: { argb: "FFF1F2DD" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF20271B" },
  };
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, sheet.rowCount), column: sheet.columnCount },
  };
  return sheet;
}
