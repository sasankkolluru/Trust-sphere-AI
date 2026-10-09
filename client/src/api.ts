export type Entity = {
  _id: string;
  name: string;
  type: string;
  identifier: string;
  metadata?: Record<string, unknown>;
};

export type Analysis = {
  _id: string;
  entity: string | Entity;
  domain: string;
  status: "queued" | "processing" | "completed" | "failed";
  riskLevel: "low" | "medium" | "high" | "critical" | "unknown";
  riskLevelLabel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  trustScore?: number;
  riskScore?: number;
  modelVersion?: string;
  createdAt: string;
  explanations?: string[];
  recommendations?: string[];
  explainability?: {
    overallScore: number;
    positiveSignals: string[];
    negativeSignals: string[];
    triggeredRules: Array<{
      ruleId: string;
      triggered: boolean;
      severity: "low" | "medium" | "high" | "critical";
      contribution: number;
      explanation: string;
    }>;
    mlContribution: number;
    nlpIndicators: string[];
    anomalyIndicators: string[];
    dataQuality: number;
    sourceReliability: number;
    recommendations: string[];
    language: string;
  };
};

export type Notification = {
  _id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "risk" | "system";
  read: boolean;
  createdAt: string;
};

export type Page<T> = {
  data: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  return response.json() as Promise<T>;
}

export const api = {
  analyses: (query = "") => request<Page<Analysis>>(`/api/v1/analyses${query}`),
  entities: (query = "") => request<Page<Entity>>(`/api/v1/entities${query}`),
  notifications: (query = "") => request<Page<Notification>>(`/api/v1/notifications${query}`),
  createAnalysis: (body: Record<string, unknown>) =>
    request<{ data: Analysis }>("/api/v1/analyses", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
