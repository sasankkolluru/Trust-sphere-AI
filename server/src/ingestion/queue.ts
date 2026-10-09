import { randomUUID } from "node:crypto";

export type AnalysisQueueJob = {
  id: string;
  ingestionId: string;
  status: "pending";
  enqueuedAt: string;
};

const pendingJobs: AnalysisQueueJob[] = [];

export function enqueueAnalysis(ingestionId: string): AnalysisQueueJob {
  const job: AnalysisQueueJob = {
    id: randomUUID(),
    ingestionId,
    status: "pending",
    enqueuedAt: new Date().toISOString(),
  };
  pendingJobs.push(job);
  return job;
}

export function pendingAnalysisJobs(): AnalysisQueueJob[] {
  return [...pendingJobs];
}
