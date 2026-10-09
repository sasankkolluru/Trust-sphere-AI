import type {
  AdapterResult,
  BaseIngestionAdapter,
  ExtractionError,
  IngestionRequest,
} from "./types.js";
import pdfParse from "pdf-parse";

const MAX_URL_BYTES = 2_000_000;
const timeout = (milliseconds: number): AbortSignal =>
  AbortSignal.timeout(milliseconds);

function error(code: string, message: string, recoverable = true): ExtractionError {
  return { code, message, recoverable };
}

function result(
  text: string,
  fields: Record<string, unknown>,
  confidence: number,
  errors: ExtractionError[] = [],
): AdapterResult {
  return {
    extraction: { text, fields, confidence },
    errors,
    status: errors.length && !text && !Object.keys(fields).length ? "failed" : errors.length ? "partial" : "completed",
  };
}

export class TextAdapter implements BaseIngestionAdapter {
  readonly type = "text" as const;
  supports(request: IngestionRequest): boolean {
    return request.sourceType === this.type;
  }
  async extract(request: IngestionRequest): Promise<AdapterResult> {
    if (typeof request.content !== "string") {
      return result("", {}, 0, [error("TEXT_INVALID", "Text content must be a string.", false)]);
    }
    return result(request.content.trim(), { characterCount: request.content.length }, 1);
  }
}

export class JSONAdapter implements BaseIngestionAdapter {
  readonly type = "json" as const;
  supports(request: IngestionRequest): boolean {
    return request.sourceType === this.type;
  }
  async extract(request: IngestionRequest): Promise<AdapterResult> {
    if (request.content === null || request.content === undefined) {
      return result("", {}, 0, [error("JSON_MISSING", "JSON content is required.", false)]);
    }
    try {
      const value =
        typeof request.content === "string" ? JSON.parse(request.content) : request.content;
      return result(JSON.stringify(value), { json: value }, 1);
    } catch {
      return result("", {}, 0, [error("JSON_INVALID", "Content is not valid JSON.", false)]);
    }
  }
}

export class CSVAdapter implements BaseIngestionAdapter {
  readonly type = "csv" as const;
  supports(request: IngestionRequest): boolean {
    return request.sourceType === this.type;
  }
  async extract(request: IngestionRequest): Promise<AdapterResult> {
    if (typeof request.content !== "string") {
      return result("", {}, 0, [error("CSV_INVALID", "CSV content must be a string.", false)]);
    }
    const lines = request.content.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return result("", {}, 0, [error("CSV_EMPTY", "CSV content is empty.", false)]);
    const headers = lines[0].split(",").map((header) => header.trim());
    if (headers.some((header) => !header)) {
      return result("", {}, 0, [error("CSV_HEADERS_INVALID", "CSV headers cannot be empty.", false)]);
    }
    const rows = lines.slice(1).map((line) => {
      const values = line.split(",");
      return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]));
    });
    return result(lines.join("\n"), { headers, rows, rowCount: rows.length }, 0.95);
  }
}

export class WebsiteAdapter implements BaseIngestionAdapter {
  readonly type = "url" as const;
  supports(request: IngestionRequest): boolean {
    return request.sourceType === this.type;
  }
  async extract(request: IngestionRequest): Promise<AdapterResult> {
    let url: URL;
    try {
      url = new URL(request.source);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("unsupported");
    } catch {
      return result("", {}, 0, [error("URL_INVALID", "Only valid HTTP(S) URLs are supported.", false)]);
    }
    try {
      const response = await fetch(url, {
        signal: timeout(5_000),
        headers: { "User-Agent": "TrustSphere-Demo-Ingestion/1.0" },
      });
      if (!response.ok) {
        return result("", {}, 0, [error("URL_HTTP_ERROR", `Website returned HTTP ${response.status}.`)]);
      }
      const length = Number(response.headers.get("content-length") ?? 0);
      if (length > MAX_URL_BYTES) {
        return result("", {}, 0, [error("URL_TOO_LARGE", "Website response exceeds the 2 MB limit.", false)]);
      }
      const body = await response.text();
      if (body.length > MAX_URL_BYTES) {
        return result("", {}, 0, [error("URL_TOO_LARGE", "Website response exceeds the 2 MB limit.", false)]);
      }
      const text = body.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return result(text, { url: url.toString(), contentType: response.headers.get("content-type") }, 0.8);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Website extraction failed.";
      return result("", {}, 0, [error("URL_FETCH_FAILED", message)]);
    }
  }
}

export class PDFAdapter implements BaseIngestionAdapter {
  readonly type = "pdf" as const;
  supports(request: IngestionRequest): boolean {
    return request.sourceType === this.type;
  }
  async extract(request: IngestionRequest): Promise<AdapterResult> {
    if (typeof request.content === "string" && request.content.trim()) {
      try {
        const buffer = Buffer.from(request.content, "base64");
        if (buffer.subarray(0, 4).toString() !== "%PDF") throw new Error("Invalid PDF signature.");
        const parsed = await pdfParse(buffer);
        return result(parsed.text.trim(), { format: "pdf", pages: parsed.numpages }, 0.9);
      } catch {
        return result(request.content.trim(), { format: "pdf-text-provided" }, 0.7, [
          error("PDF_PARSE_FAILED", "PDF bytes could not be parsed; treating content as supplied text."),
        ]);
      }
    }
    return result("", {}, 0, [
      error("PDF_EXTRACTION_UNAVAILABLE", "Provide extracted PDF text or configure a PDF parser before submitting binary data.", false),
    ]);
  }
}

export class ImageAdapter implements BaseIngestionAdapter {
  readonly type = "image" as const;
  supports(request: IngestionRequest): boolean {
    return request.sourceType === this.type;
  }
  async extract(request: IngestionRequest): Promise<AdapterResult> {
    if (!request.metadata || typeof request.metadata !== "object") {
      return result("", {}, 0, [error("IMAGE_METADATA_MISSING", "Image ingestion accepts metadata only; no image download or OCR is performed.", false)]);
    }
    return result("", { imageMetadata: request.metadata }, 0.9);
  }
}

export const ingestionAdapters: BaseIngestionAdapter[] = [
  new WebsiteAdapter(),
  new TextAdapter(),
  new JSONAdapter(),
  new CSVAdapter(),
  new PDFAdapter(),
  new ImageAdapter(),
];
