export type Step = 'idle' | 'processing' | 'complete';
export type LogStatus = 'info' | 'success' | 'error' | 'warning';

export type AuditFinding = {
  para: string;
  severity: 'CRITICAL' | 'MINOR';
  finding: string;
  rectification: string;
};

export type AuditLogItem = {
  message: string;
  status: LogStatus;
  time: string;
};

export type AuditBatchResponse = {
  jurisdiction: 'Kerala' | 'Mismatch';
  project: string;
  findings: AuditFinding[];
};

export type AuditReport = {
  jurisdiction: 'Kerala' | 'Mismatch';
  score: number;
  project: string;
  executiveSummary: string;
  findings: AuditFinding[];
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
};
