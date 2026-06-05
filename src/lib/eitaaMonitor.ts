export type EitaaMonitorMessage = {
  key: string;
  text: string;
  author: string;
  time: string;
  visible: boolean;
  discoveredAt: string;
  casePreview?: {
    fieldCount: number;
    code: string;
    title: string;
    matchedFields: string[];
    values: Record<string, string>;
  } | null;
};

export type EitaaMonitorCaseCandidate = EitaaMonitorMessage & {
  casePreview: {
    fieldCount: number;
    code: string;
    title: string;
    matchedFields: string[];
    values: Record<string, string>;
  };
};

export type EitaaMonitorStatus = {
  running: boolean;
  phase: string;
  browserMode: string;
  targetUrl: string;
  lastError: string | null;
  messageCount: number;
  traversalDirection: 'up' | 'down' | null;
  lastDiscoveredAt: string | null;
  lastScan: {
    when: string | null;
    candidateCount: number;
    visibleCount: number;
    fallbackCount: number;
    scrollTop: number;
    maxScrollTop: number;
    pageTitle: string;
    pageUrl: string;
    note: string;
  };
  lastPageSnapshot: {
    when: string | null;
    pageTitle: string;
    pageUrl: string;
    bodyText: string;
    bodyHtml: string;
    totalElements: number;
    messageSelectorCount: number;
    scrollContainerCount: number;
    note: string;
  };
  recentMessages: EitaaMonitorMessage[];
  recentCaseCandidates: EitaaMonitorCaseCandidate[];
};

const apiBase = import.meta.env.VITE_EITAA_MONITOR_API_URL?.trim() || 'http://127.0.0.1:4179';

export const EITAA_MONITOR_API_BASE = apiBase;

export function buildEitaaMonitorUrl(pathname: string) {
  return new URL(pathname, apiBase).toString();
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!response.ok) {
    let message = `Monitor request failed with status ${response.status}.`;

    try {
      const data = JSON.parse(text) as { error?: string; message?: string };
      message = data.error || data.message || message;
    } catch {
      if (text.trim()) {
        message = text.trim();
      }
    }

    throw new Error(message);
  }

  return text ? (JSON.parse(text) as T) : ({} as T);
}

export async function fetchEitaaMonitorStatus() {
  const response = await fetch(buildEitaaMonitorUrl('/api/eitaa/status'));
  return parseJsonResponse<EitaaMonitorStatus>(response);
}

export async function startEitaaMonitor() {
  const response = await fetch(buildEitaaMonitorUrl('/api/eitaa/start'), {
    method: 'POST',
  });

  return parseJsonResponse<EitaaMonitorStatus>(response);
}

export async function resetEitaaMonitor() {
  const response = await fetch(buildEitaaMonitorUrl('/api/eitaa/reset'), {
    method: 'POST',
  });

  return parseJsonResponse<EitaaMonitorStatus>(response);
}

export async function stopEitaaMonitor() {
  const response = await fetch(buildEitaaMonitorUrl('/api/eitaa/stop'), {
    method: 'POST',
  });

  return parseJsonResponse<EitaaMonitorStatus>(response);
}
