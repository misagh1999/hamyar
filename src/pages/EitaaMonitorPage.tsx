import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  buildEitaaMonitorUrl,
  fetchEitaaMonitorStatus,
  resetEitaaMonitor,
  startEitaaMonitor,
  stopEitaaMonitor,
  type EitaaMonitorStatus,
  type EitaaMonitorCaseCandidate,
} from '../lib/eitaaMonitor';

function buildNewCasePreviewUrl(text: string) {
  const base = `${window.location.origin}${import.meta.env.BASE_URL || '/'}`;
  return `${base}admin/new-case?preview=1&text=${encodeURIComponent(text)}`;
}

function toCandidateList(candidates: EitaaMonitorCaseCandidate[]) {
  return [...candidates].sort((left, right) => left.discoveredAt.localeCompare(right.discoveredAt));
}

export function EitaaMonitorPage() {
  const { loading: authLoading, user } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState<EitaaMonitorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  const autoStart = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('autostart') === '1';
  }, [location.search]);

  useEffect(() => {
    let active = true;
    let eventSource: EventSource | null = null;

    async function syncStatus() {
      try {
        const current = await fetchEitaaMonitorStatus();
        if (!active) return;

        setStatus(current);
        setLoading(false);
      } catch (error) {
        if (!active) return;

        setStreamError(error instanceof Error ? error.message : 'ارتباط با مانیتور برقرار نشد.');
        setLoading(false);
      }
    }

    function attachStream() {
      try {
        eventSource = new EventSource(buildEitaaMonitorUrl('/api/eitaa/events'));

        eventSource.addEventListener('state', (event) => {
          if (!active) return;
          const payload = JSON.parse((event as MessageEvent).data) as EitaaMonitorStatus;
          setStatus(payload);
          setLoading(false);
        });

        eventSource.addEventListener('message', (event) => {
          if (!active) return;
          const payload = JSON.parse((event as MessageEvent).data) as {
            status?: EitaaMonitorStatus;
          };

          if (payload.status) {
            setStatus(payload.status);
          }
        });

        eventSource.onerror = () => {
          if (!active) return;
          setStreamError('ارتباط زنده با سرور مانیتور قطع شد.');
        };
      } catch (error) {
        if (!active) return;
        setStreamError(error instanceof Error ? error.message : 'خطا در ساخت جریان زنده.');
      }
    }

    if (autoStart) {
      void (async () => {
        try {
          setBusy(true);
          setLoading(true);
          setStreamError(null);
          setStatus(null);
          setMessage('در حال شروع مانیتور...');
          await resetEitaaMonitor();
          if (!active) return;
          attachStream();
          const current = await startEitaaMonitor();
          if (!active) return;
          setStatus(current);
          setMessage('مانیتور با موفقیت شروع شد.');
          setLoading(false);
        } catch (error) {
          if (!active) return;
          setMessage(error instanceof Error ? error.message : 'شروع مانیتور ناموفق بود.');
          setLoading(false);
        } finally {
          if (active) {
            setBusy(false);
          }
        }
      })();
    } else {
      void syncStatus().then(() => {
        if (!active) return;
        attachStream();
      });
    }

    return () => {
      active = false;
      eventSource?.close();
    };
  }, [autoStart]);

  async function handleStart() {
    setBusy(true);
    setStreamError(null);
    setMessage(null);

    try {
      const current = await startEitaaMonitor();
      setStatus(current);
      setMessage('مانیتور شروع شد.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'شروع مانیتور ناموفق بود.');
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    setBusy(true);
    setStreamError(null);
    setMessage(null);

    try {
      const current = await stopEitaaMonitor();
      setStatus(current);
      setMessage('مانیتور متوقف شد.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'توقف مانیتور ناموفق بود.');
    } finally {
      setBusy(false);
    }
  }

  const running = status?.running ?? false;
  const caseCandidates = toCandidateList(status?.recentCaseCandidates ?? []);

  return (
    <section className="stack detail-page monitor-page">
      <div className="page-header">
        <p className="eyebrow">فراخوانی خودکار</p>
        <h1 className="page-title">پرونده‌های احتمالی Eitaa</h1>
      </div>

      {authLoading ? <div className="notice">در حال بررسی وضعیت ورود...</div> : null}
      {!authLoading && !user ? (
        <div className="notice notice-warning">
          برای استفاده از مانیتور ابتدا وارد شوید.
          <div>
            <Link className="ghost-link" to="/admin">
              رفتن به صفحه ورود
            </Link>
          </div>
        </div>
      ) : null}

      {user ? (
        <>
          <div className="card stack monitor-summary">
            <div className="profile-block">
              <div>
                <p className="label">وضعیت</p>
                <h2 className="card-title">{running ? 'در حال اجرا' : 'آماده شروع'}</h2>
              </div>
              <span className={`status-pill ${running ? '' : 'status-pill-muted'}`}>
                {status?.phase ?? 'idle'}
              </span>
            </div>

            <div className="admin-actions">
              <button className="button" type="button" onClick={handleStart} disabled={busy || running}>
                {busy && !running ? 'در حال شروع...' : 'شروع'}
              </button>
              <button className="button button-secondary" type="button" onClick={handleStop} disabled={busy || !running}>
                {busy && running ? 'در حال توقف...' : 'توقف'}
              </button>
              <Link className="button button-secondary admin-link-button" to="/admin">
                بازگشت به داشبورد
              </Link>
            </div>
          </div>

          <div className="card stack monitor-candidate-card">
            <div className="profile-block">
              <div>
                <h2 className="card-title">پرونده‌های احتمالی</h2>
              </div>
              <span className="case-pill case-pill-muted">{caseCandidates.length} مورد</span>
            </div>

            {caseCandidates.length ? (
              <div className="monitor-candidate-grid">
                {caseCandidates.map((item) => (
                  <article key={item.key} className="monitor-candidate">
                    <div className="monitor-candidate-meta">
                      <span>{item.casePreview?.code || 'بدون کد'}</span>
                      <span>{item.casePreview?.fieldCount ?? 0} فیلد</span>
                    </div>
                    <h3>{item.casePreview?.title || item.author || 'پرونده احتمالی'}</h3>
                    <p>
                      {item.text.slice(0, 180)}
                      {item.text.length > 180 ? '…' : ''}
                    </p>
                    <div className="admin-actions">
                      <a
                        className="button button-secondary admin-link-button"
                        href={buildNewCasePreviewUrl(item.text)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        باز کردن جزئیات در تب جدید
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="notice">
                {loading ? 'در حال دریافت پرونده‌های احتمالی...' : 'هنوز پرونده احتمالی پیدا نشده است.'}
              </div>
            )}
          </div>
        </>
      ) : null}

      {loading ? <div className="notice">در حال بارگذاری وضعیت مانیتور...</div> : null}
      {streamError ? <div className="notice notice-warning">{streamError}</div> : null}
      {message ? <div className="notice">{message}</div> : null}
    </section>
  );
}
