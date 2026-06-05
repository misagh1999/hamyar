import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  EITAA_MONITOR_API_BASE,
  buildEitaaMonitorUrl,
  fetchEitaaMonitorStatus,
  resetEitaaMonitor,
  startEitaaMonitor,
  stopEitaaMonitor,
  type EitaaMonitorMessage,
  type EitaaMonitorStatus,
} from '../lib/eitaaMonitor';
import { formatMarriageCaseValue, getMarriageCaseFieldLabel } from '../lib/cases';

function toMessageList(messages: EitaaMonitorMessage[]) {
  return [...messages].sort((left, right) => left.discoveredAt.localeCompare(right.discoveredAt));
}

function buildNewCasePreviewUrl(text: string) {
  const base = `${window.location.origin}${import.meta.env.BASE_URL || '/'}`;
  return `${base}#/admin/new-case?preview=1&text=${encodeURIComponent(text)}`;
}

function getPreviewFields(message: EitaaMonitorMessage) {
  const preview = message.casePreview;
  if (!preview?.values) {
    return [];
  }

  return Object.entries(preview.values)
    .filter(([, value]) => Boolean(String(value || '').trim()))
    .slice(0, 6)
    .map(([key, value]) => ({
      label: getMarriageCaseFieldLabel(key as Parameters<typeof getMarriageCaseFieldLabel>[0]),
      value: formatMarriageCaseValue(key as Parameters<typeof getMarriageCaseFieldLabel>[0], value),
    }));
}

export function EitaaMonitorPage() {
  const { loading: authLoading, user } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState<EitaaMonitorStatus | null>(null);
  const [messages, setMessages] = useState<EitaaMonitorMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

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
        setMessages(toMessageList(current.recentMessages));
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
          setMessages(toMessageList(payload.recentMessages));
          setLoading(false);
        });

        eventSource.addEventListener('message', (event) => {
          if (!active) return;
          const payload = JSON.parse((event as MessageEvent).data) as {
            message: EitaaMonitorMessage;
            status?: EitaaMonitorStatus;
          };

          if (payload.status) {
            setStatus(payload.status);
          }

          setMessages((current) => {
            const next = [...current.filter((item) => item.key !== payload.message.key), payload.message];
            return next;
          });
        });

        eventSource.addEventListener('log', (event) => {
          if (!active) return;
          const payload = JSON.parse((event as MessageEvent).data) as { message: string };
          setMessage(payload.message);
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
          setMessages([]);
          setMessage('در حال شروع مانیتور...');
          await resetEitaaMonitor();
          if (!active) return;
          attachStream();
          const current = await startEitaaMonitor();
          if (!active) return;
          setStatus(current);
          setMessages(toMessageList(current.recentMessages));
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

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  async function handleStart() {
    setBusy(true);
    setStreamError(null);
    setMessage(null);

    try {
      const current = await startEitaaMonitor();
      setStatus(current);
      setMessages(toMessageList(current.recentMessages));
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
      setMessages(toMessageList(current.recentMessages));
      setMessage('مانیتور متوقف شد.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'توقف مانیتور ناموفق بود.');
    } finally {
      setBusy(false);
    }
  }

  const running = status?.running ?? false;
  const caseCandidates = messages.filter((item) => (item.casePreview?.fieldCount ?? 0) >= 5);

  return (
    <section className="stack detail-page monitor-page">
      <div className="page-header">
        <p className="eyebrow">فراخوانی خودکار</p>
        <h1 className="page-title">دریافت زنده پیام‌های Eitaa</h1>
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

            <div className="monitor-info-grid">
              <div className="info-item">
                <span className="label">آدرس مقصد</span>
                <p>{status?.targetUrl ?? 'https://web.eitaa.com/#@Moarefe_Moshavere'}</p>
              </div>
              <div className="info-item">
                <span className="label">حالت مرورگر</span>
                <p>{status?.browserMode ?? 'نامشخص'}</p>
              </div>
              <div className="info-item">
                <span className="label">تعداد پیام</span>
                <p>{status?.messageCount ?? 0}</p>
              </div>
              <div className="info-item">
                <span className="label">جهت پیمایش</span>
                <p>{status?.traversalDirection ?? '-'}</p>
              </div>
            </div>

            <div className="monitor-info-grid">
              <div className="info-item">
                <span className="label">کاندیدها</span>
                <p>{status?.lastScan?.candidateCount ?? 0}</p>
              </div>
              <div className="info-item">
                <span className="label">پیام‌های قابل‌دیدن</span>
                <p>{status?.lastScan?.visibleCount ?? 0}</p>
              </div>
              <div className="info-item">
                <span className="label">جابه‌جایی اسکرول</span>
                <p>
                  {status?.lastScan
                    ? `${Math.round(status.lastScan.scrollTop)} / ${Math.round(status.lastScan.maxScrollTop)}`
                    : '-'}
                </p>
              </div>
              <div className="info-item">
                <span className="label">آخرین اسکن</span>
                <p>{status?.lastScan?.when ?? '-'}</p>
              </div>
            </div>

            <div className="monitor-hint">
              <strong>اسکن فعلی:</strong> {status?.lastScan?.note ?? 'هنوز اسکنی ثبت نشده است.'}
              {status?.lastScan?.pageTitle ? (
                <>
                  <br />
                  <strong>عنوان صفحه:</strong> {status.lastScan.pageTitle}
                </>
              ) : null}
              {status?.lastScan?.pageUrl ? (
                <>
                  <br />
                  <strong>URL:</strong> {status.lastScan.pageUrl}
                </>
              ) : null}
            </div>

            <div className="monitor-hint monitor-debug-panel">
              <strong>آخرین محتوای صفحه:</strong>
              <div className="monitor-debug-meta">
                <span>عناصر: {status?.lastPageSnapshot?.totalElements ?? 0}</span>
                <span>match selector: {status?.lastPageSnapshot?.messageSelectorCount ?? 0}</span>
                <span>scroll containers: {status?.lastPageSnapshot?.scrollContainerCount ?? 0}</span>
              </div>
              <div className="monitor-debug-meta">
                <span>pageTitle: {status?.lastPageSnapshot?.pageTitle || '-'}</span>
                <span>when: {status?.lastPageSnapshot?.when || '-'}</span>
              </div>
              <pre className="monitor-debug-pre">{status?.lastPageSnapshot?.bodyText || 'No text captured yet.'}</pre>
              {status?.lastPageSnapshot?.bodyHtml ? (
                <>
                  <p className="monitor-debug-label">HTML excerpt</p>
                  <pre className="monitor-debug-pre monitor-debug-pre-html">
                    {status.lastPageSnapshot.bodyHtml}
                  </pre>
                </>
              ) : null}
            </div>

            <div className="monitor-hint">
              <strong>نکته:</strong> این مانیتور از پروفایل Chrome/Chromium شما استفاده می‌کند. اگر می‌خواهید
              دقیقاً سشن بازِ مرورگر فعلی را بخواند، `EITAA_REMOTE_DEBUGGING_URL` را تنظیم کنید. اگر پروفایل
              هم‌زمان باز باشد، برنامه یک snapshot موقت از آن می‌سازد تا لاگین ذخیره‌شده را بخواند. در غیر این
              صورت `EITAA_USER_DATA_DIR` باید به پوشه پروفایل لاگین‌شده شما اشاره کند.
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

          <div className="card stack monitor-log-card">
            <div className="profile-block">
              <div>
                <p className="label">جریان زنده</p>
                <h2 className="card-title">پیام‌های کشف‌شده</h2>
              </div>
              <span className="case-pill case-pill-muted">{messages.length} مورد</span>
            </div>

            <div ref={listRef} className="monitor-log">
              {messages.length === 0 ? (
                <div className="notice">هنوز پیامی دریافت نشده است.</div>
              ) : (
                messages.map((item) => (
                  <article key={item.key} className="monitor-message">
                    <div className="monitor-message-meta">
                      <span>{item.casePreview?.title || item.author || 'بدون فرستنده'}</span>
                      <span>{item.casePreview?.code ? `کد ${item.casePreview.code}` : item.time || item.discoveredAt}</span>
                    </div>
                    {item.casePreview ? (
                      <>
                        <div className="monitor-message-tags">
                          <span className="case-pill case-pill-muted">{item.casePreview.fieldCount} فیلد</span>
                          {item.casePreview.matchedFields.slice(0, 3).map((field) => (
                            <span key={field} className="case-pill case-pill-muted">
                              {field}
                            </span>
                          ))}
                        </div>
                        <div className="monitor-message-fields">
                          {getPreviewFields(item).map((field) => (
                            <div key={field.label} className="monitor-message-field">
                              <span>{field.label}</span>
                              <p>{field.value}</p>
                            </div>
                          ))}
                        </div>
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
                      </>
                    ) : (
                      <p>{item.text.length > 240 ? `${item.text.slice(0, 240)}…` : item.text}</p>
                    )}
                  </article>
                ))
              )}
            </div>
          </div>

          {caseCandidates.length ? (
            <div className="card stack monitor-candidate-card">
              <div className="profile-block">
                <div>
                  <p className="label">پرونده‌های احتمالی</p>
                  <h2 className="card-title">پیام‌هایی با حداقل ۵ فیلد</h2>
                </div>
                <span className="case-pill case-pill-muted">{caseCandidates.length} مورد</span>
              </div>

              <div className="monitor-candidate-grid">
                {caseCandidates.map((item) => (
                  <article key={item.key} className="monitor-candidate">
                    <div className="monitor-candidate-meta">
                      <span>{item.casePreview?.code || 'بدون کد'}</span>
                      <span>{item.casePreview?.fieldCount ?? 0} فیلد</span>
                    </div>
                    <h3>{item.casePreview?.title || item.author || 'پرونده احتمالی'}</h3>
                    <p>{item.text.slice(0, 180)}{item.text.length > 180 ? '…' : ''}</p>
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
            </div>
          ) : null}

          <div className="notice">
            API محلی: <code>{EITAA_MONITOR_API_BASE}</code>
          </div>
        </>
      ) : null}

      {loading ? <div className="notice">در حال بارگذاری وضعیت مانیتور...</div> : null}
      {streamError ? <div className="notice notice-warning">{streamError}</div> : null}
      {message ? <div className="notice">{message}</div> : null}
    </section>
  );
}
