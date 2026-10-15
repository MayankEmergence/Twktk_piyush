import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { addExportSheet } from "../server/export";
test("Excel export retains money, dates, IDs and formula-like input safely", async () => {
  const wb = new ExcelJS.Workbook(),
    date = new Date("2026-10-31T12:30:00Z");
  addExportSheet(
    wb,
    "Bookings",
    ["id", "email", "amount_inr", "created_at"],
    [
      {
        id: "000001",
        email: '=HYPERLINK("https://evil.example")',
        amount_inr: "1999.00",
        created_at: date,
      },
    ],
  );
  addExportSheet(
    wb,
    "Audit history",
    ["id", "after_data"],
    [{ id: "12", after_data: { price: 199900 } }],
  );
  const data = await wb.xlsx.writeBuffer();
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(data);
  const sheet = restored.getWorksheet("Bookings")!;
  assert.equal(sheet.getCell("A2").value, "000001");
  assert.equal(sheet.getCell("B2").type, ExcelJS.ValueType.String);
  assert.equal(sheet.getCell("B2").value, '=HYPERLINK("https://evil.example")');
  assert.equal(sheet.getCell("C2").value, 1999);
  assert.equal(
    (sheet.getCell("D2").value as Date).toISOString(),
    date.toISOString(),
  );
  assert.equal(sheet.views[0].state, "frozen");
  assert.equal(
    restored.getWorksheet("Audit history")!.getCell("B2").value,
    '{"price":199900}',
  );
});
