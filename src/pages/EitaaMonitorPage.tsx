import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  buildEitaaMonitorUrl,
  fetchEitaaMonitorStatus,
  resetEitaaMonitor,
  startEitaaMonitor,
  stopEitaaMonitor,
  type EitaaMonitorStatus,
  type EitaaMonitorCaseCandidate,
} from '../lib/eitaaMonitor';

const CASE_TABLE_NAME = 'marriage_cases';
const BATCH_INSERT_SIZE = 10;

type BatchAvailability = {
  total: number;
  sendable: EitaaMonitorCaseCandidate[];
  existingCodes: number[];
  duplicateCodes: number[];
  missingCodeCount: number;
};

type BatchState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'ready'; availability: BatchAvailability }
  | { phase: 'sending'; availability: BatchAvailability; sentCount: number; totalCount: number }
  | { phase: 'sent'; insertedCount: number; skippedCount: number };

function buildNewCasePreviewUrl(text: string) {
  const base = `${window.location.origin}${import.meta.env.BASE_URL || '/'}`;
  return `${base}admin/new-case?preview=1&text=${encodeURIComponent(text)}`;
}

function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

function toNullableInteger(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = normalizeDigits(String(value));
  const match = normalized.match(/-?\d+/);
  return match ? Number(match[0]) : null;
}

function emptyToNull(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text ? text : null;
}

function getCandidateCaseCode(candidate: EitaaMonitorCaseCandidate) {
  return toNullableInteger(candidate.casePreview.values.case_code || candidate.casePreview.code);
}

function toCandidateList(candidates: EitaaMonitorCaseCandidate[]) {
  return [...candidates].sort((left, right) => left.discoveredAt.localeCompare(right.discoveredAt));
}

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function buildCasePayload(candidate: EitaaMonitorCaseCandidate, userId: string) {
  const values = candidate.casePreview.values;

  return {
    profile_title: emptyToNull(values.profile_title),
    case_code: getCandidateCaseCode(candidate),
    gender: emptyToNull(values.gender),
    marital_status: emptyToNull(values.marital_status),
    age: toNullableInteger(values.age),
    birth_month_year: emptyToNull(values.birth_month_year),
    education: emptyToNull(values.education),
    military_status: emptyToNull(values.military_status),
    job: emptyToNull(values.job),
    monthly_income: emptyToNull(values.monthly_income),
    religiosity: emptyToNull(values.religiosity),
    clothing_and_religiosity: emptyToNull(values.clothing_and_religiosity),
    satellite_view: emptyToNull(values.satellite_view),
    height_cm: toNullableInteger(values.height_cm),
    weight_kg: toNullableInteger(values.weight_kg),
    skin_color: emptyToNull(values.skin_color),
    birth_city: emptyToNull(values.birth_city),
    residence_city: emptyToNull(values.residence_city),
    parents_birth_place: emptyToNull(values.parents_birth_place),
    parents_education: emptyToNull(values.parents_education),
    father_job_and_financial_status: emptyToNull(values.father_job_and_financial_status),
    siblings_count: emptyToNull(values.siblings_count),
    birth_order: emptyToNull(values.birth_order),
    previous_marriage_and_children: emptyToNull(values.previous_marriage_and_children),
    personality_traits: emptyToNull(values.personality_traits),
    future_spouse_criteria: emptyToNull(values.future_spouse_criteria),
    accepts_other_cities_and_villages: emptyToNull(values.accepts_other_cities_and_villages),
    acceptable_spouse_age_from: toNullableInteger(values.acceptable_spouse_age_from),
    acceptable_spouse_age_to: toNullableInteger(values.acceptable_spouse_age_to),
    raw_text: candidate.text.trim(),
    created_by: userId,
  };
}

export function EitaaMonitorPage() {
  const { loading: authLoading, user } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState<EitaaMonitorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [batchState, setBatchState] = useState<BatchState>({ phase: 'idle' });

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
    setBatchState({ phase: 'idle' });

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

  async function handleCheckBatchAvailability() {
    if (!supabase) {
      setMessage('Supabase تنظیم نشده است.');
      return;
    }

    setBatchState({ phase: 'checking' });
    setMessage(null);

    try {
      const seenCodes = new Set<number>();
      const duplicateCodes = new Set<number>();
      const codedCandidates: EitaaMonitorCaseCandidate[] = [];
      let missingCodeCount = 0;

      for (const candidate of caseCandidates) {
        const code = getCandidateCaseCode(candidate);

        if (code === null) {
          missingCodeCount += 1;
          continue;
        }

        if (seenCodes.has(code)) {
          duplicateCodes.add(code);
          continue;
        }

        seenCodes.add(code);
        codedCandidates.push(candidate);
      }

      const codes = [...seenCodes];
      const { data, error } = codes.length
        ? await supabase.from(CASE_TABLE_NAME).select('case_code').in('case_code', codes)
        : { data: [], error: null };

      if (error) {
        throw error;
      }

      const existingCodes = new Set(
        (data ?? [])
          .map((item) => toNullableInteger((item as { case_code: unknown }).case_code))
          .filter((code): code is number => code !== null)
      );
      const sendable = codedCandidates.filter((candidate) => {
        const code = getCandidateCaseCode(candidate);
        return code !== null && !existingCodes.has(code);
      });
      const availability = {
        total: caseCandidates.length,
        sendable,
        existingCodes: [...existingCodes],
        duplicateCodes: [...duplicateCodes],
        missingCodeCount,
      };

      setBatchState({ phase: 'ready', availability });
      setMessage(`${sendable.length} از ${caseCandidates.length} پرونده قابل ارسال است. برای ارسال نهایی تایید کنید.`);
    } catch (error) {
      setBatchState({ phase: 'idle' });
      setMessage(error instanceof Error ? error.message : 'بررسی قابل ارسال بودن پرونده‌ها ناموفق بود.');
    }
  }

  async function handleConfirmBatchSend() {
    if (!user || !supabase || batchState.phase !== 'ready') {
      return;
    }

    const { availability } = batchState;

    if (!availability.sendable.length) {
      setMessage('هیچ پرونده جدیدی برای ارسال وجود ندارد.');
      return;
    }

    const totalCount = availability.sendable.length;
    setBatchState({ phase: 'sending', availability, sentCount: 0, totalCount });
    setMessage(null);

    try {
      let sentCount = 0;

      for (const chunk of chunkItems(availability.sendable, BATCH_INSERT_SIZE)) {
        const payload = chunk.map((candidate) => buildCasePayload(candidate, user.id));
        const { error } = await supabase.from(CASE_TABLE_NAME).insert(payload);

        if (error) {
          throw error;
        }

        sentCount += payload.length;
        setBatchState({ phase: 'sending', availability, sentCount, totalCount });
      }

      setBatchState({
        phase: 'sent',
        insertedCount: sentCount,
        skippedCount: availability.total - sentCount,
      });
      setMessage(`${sentCount} پرونده با موفقیت به سیستم ارسال شد.`);
    } catch (error) {
      setBatchState({ phase: 'ready', availability });
      setMessage(error instanceof Error ? error.message : 'ارسال گروهی پرونده‌ها ناموفق بود.');
    }
  }

  const running = status?.running ?? false;
  const caseCandidates = toCandidateList(status?.recentCaseCandidates ?? []);
  const candidateSignature = caseCandidates.map((candidate) => candidate.key).join('|');
  const canShowBatchAction = !running && !loading && caseCandidates.length > 0;
  const batchProgressPercent =
    batchState.phase === 'sending' && batchState.totalCount > 0
      ? Math.round((batchState.sentCount / batchState.totalCount) * 100)
      : 0;

  useEffect(() => {
    setBatchState((current) => (current.phase === 'ready' ? { phase: 'idle' } : current));
  }, [candidateSignature, running]);

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

            {canShowBatchAction ? (
              <div className="batch-actions">
                {batchState.phase === 'ready' || batchState.phase === 'sending' ? (
                  <div className="notice batch-summary">
                    {batchState.availability.sendable.length} از {batchState.availability.total} پرونده قابل ارسال است.
                    {batchState.availability.existingCodes.length ? ` ${batchState.availability.existingCodes.length} کد قبلا ثبت شده است.` : ''}
                    {batchState.availability.duplicateCodes.length ? ` ${batchState.availability.duplicateCodes.length} کد در همین لیست تکراری است.` : ''}
                    {batchState.availability.missingCodeCount ? ` ${batchState.availability.missingCodeCount} پرونده بدون کد است.` : ''}
                  </div>
                ) : null}

                {batchState.phase === 'sent' ? (
                  <div className="notice batch-summary">
                    {batchState.insertedCount} پرونده ارسال شد و {batchState.skippedCount} پرونده ارسال نشد.
                  </div>
                ) : null}

                {batchState.phase === 'sending' ? (
                  <div className="batch-progress" aria-label="پیشرفت ارسال گروهی">
                    <div className="batch-progress-meta">
                      <span>
                        {batchState.sentCount} از {batchState.totalCount} ارسال شد
                      </span>
                      <span>{batchProgressPercent}%</span>
                    </div>
                    <div className="batch-progress-track">
                      <div className="batch-progress-fill" style={{ width: `${batchProgressPercent}%` }} />
                    </div>
                  </div>
                ) : null}

                <div className="admin-actions">
                  {batchState.phase === 'ready' ? (
                    <button
                      className="button"
                      type="button"
                      onClick={handleConfirmBatchSend}
                      disabled={!batchState.availability.sendable.length}
                    >
                      تایید و ارسال {batchState.availability.sendable.length} پرونده
                    </button>
                  ) : (
                    <button
                      className="button"
                      type="button"
                      onClick={handleCheckBatchAvailability}
                      disabled={batchState.phase === 'checking' || batchState.phase === 'sending'}
                    >
                      {batchState.phase === 'checking' ? 'در حال بررسی...' : 'ارسال همه به سیستم'}
                    </button>
                  )}
                  {batchState.phase === 'sending' ? (
                    <span className="case-pill case-pill-muted">
                      ارسال {batchState.sentCount} از {batchState.totalCount}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

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
