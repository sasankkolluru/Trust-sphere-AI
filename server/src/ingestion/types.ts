export type IngestionSourceType = "url" | "text" | "json" | "csv" | "pdf" | "image";

export type ExtractionError = {
  code: string;
  message: string;
  recoverable: boolean;
};

export type IngestionRequest = {
  source: string;
  sourceType: IngestionSourceType;
  content?: unknown;
  domain?: string;
  metadata?: Record<string, unknown>;
};

export type NormalizedExtraction = {
  text: string;
  fields: Record<string, unknown>;
  confidence: number;
};

export type AdapterResult = {
  extraction: NormalizedExtraction;
  errors: ExtractionError[];
  status: "completed" | "partial" | "failed";
};

export interface BaseIngestionAdapter {
  readonly type: IngestionSourceType;
  supports(request: IngestionRequest): boolean;
  extract(request: IngestionRequest): Promise<AdapterResult>;
}
