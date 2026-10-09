import assert from "node:assert/strict";
import test from "node:test";
import { CSVAdapter, ImageAdapter, JSONAdapter, PDFAdapter, TextAdapter } from "./adapters.js";

test("text, JSON, CSV, and image adapters return normalized extraction", async () => {
  const text = await new TextAdapter().extract({ source: "demo", sourceType: "text", content: "hello" });
  const json = await new JSONAdapter().extract({ source: "demo", sourceType: "json", content: '{"ok":true}' });
  const csv = await new CSVAdapter().extract({ source: "demo", sourceType: "csv", content: "name,score\nAcme,4" });
  const image = await new ImageAdapter().extract({
    source: "image.jpg",
    sourceType: "image",
    metadata: { width: 100, height: 80, mimeType: "image/jpeg" },
  });
  assert.equal(text.status, "completed");
  assert.deepEqual(json.extraction.fields.json, { ok: true });
  assert.equal(csv.extraction.fields.rowCount, 1);
  assert.equal(
    (image.extraction.fields.imageMetadata as { mimeType: string }).mimeType,
    "image/jpeg",
  );
});

test("invalid inputs return structured errors without throwing", async () => {
  const json = await new JSONAdapter().extract({ source: "demo", sourceType: "json", content: "{" });
  const pdf = await new PDFAdapter().extract({ source: "demo", sourceType: "pdf", content: "not-pdf" });
  const image = await new ImageAdapter().extract({ source: "demo", sourceType: "image" });
  assert.equal(json.status, "failed");
  assert.equal(json.errors[0].code, "JSON_INVALID");
  assert.equal(pdf.status, "partial");
  assert.equal(pdf.errors[0].code, "PDF_PARSE_FAILED");
  assert.equal(image.errors[0].code, "IMAGE_METADATA_MISSING");
});
