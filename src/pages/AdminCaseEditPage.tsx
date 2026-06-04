import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  CASE_EDITABLE_FIELDS,
  formatMarriageCaseValue,
  type MarriageCase,
  type MarriageCaseFieldKey,
} from '../lib/cases';

type FormValues = Record<MarriageCaseFieldKey, string>;

const EMPTY_FORM_VALUES = CASE_EDITABLE_FIELDS.reduce((accumulator, field) => {
  accumulator[field.key] = '';
  return accumulator;
}, {} as FormValues);

function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

function numericOrNull(value: string) {
  const normalized = normalizeDigits(value).trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function valuesFromCase(caseRow: MarriageCase): FormValues {
  const values = { ...EMPTY_FORM_VALUES };

  for (const field of CASE_EDITABLE_FIELDS) {
    const rawValue = caseRow[field.key];

    if (rawValue === null || rawValue === undefined) {
      values[field.key] = '';
      continue;
    }

    values[field.key] = String(rawValue);
  }

  return values;
}

function buildUpdatePayload(values: FormValues) {
  return {
    profile_title: emptyToNull(values.profile_title),
    case_code: numericOrNull(values.case_code),
    marital_status: emptyToNull(values.marital_status),
    age: numericOrNull(values.age),
    birth_month_year: emptyToNull(values.birth_month_year),
    education: emptyToNull(values.education),
    clothing_and_religiosity: emptyToNull(values.clothing_and_religiosity),
    satellite_view: emptyToNull(values.satellite_view),
    height_cm: numericOrNull(values.height_cm),
    weight_kg: numericOrNull(values.weight_kg),
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
    acceptable_spouse_age_from: numericOrNull(values.acceptable_spouse_age_from),
    acceptable_spouse_age_to: numericOrNull(values.acceptable_spouse_age_to),
    raw_text: values.raw_text.trim(),
  };
}

export function AdminCaseEditPage() {
  const { loading: authLoading, user } = useAuth();
  const { caseCode } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [caseRow, setCaseRow] = useState<MarriageCase | null>(null);
  const [values, setValues] = useState<FormValues>(EMPTY_FORM_VALUES);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const pageTitle = useMemo(() => caseRow?.profile_title ?? 'ویرایش پرونده', [caseRow]);

  useEffect(() => {
    let active = true;

    async function loadCase() {
      if (!caseCode) {
        if (!active) return;
        setError('شناسه پرونده مشخص نیست.');
        setLoading(false);
        return;
      }

      if (!supabase) {
        if (!active) return;
        setError('Supabase is not configured.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const numericCode = Number(caseCode);
      const query = Number.isNaN(numericCode)
        ? supabase.from('marriage_cases').select('*').eq('case_code', caseCode)
        : supabase.from('marriage_cases').select('*').eq('case_code', numericCode);

      const { data, error: fetchError } = await query.maybeSingle();

      if (!active) return;

      if (fetchError) {
        setError(fetchError.message);
        setCaseRow(null);
      } else if (!data) {
        setError('پرونده پیدا نشد.');
        setCaseRow(null);
      } else {
        const nextCase = data as MarriageCase;
        setCaseRow(nextCase);
        setValues(valuesFromCase(nextCase));
      }

      setLoading(false);
    }

    void loadCase();

    return () => {
      active = false;
    };
  }, [caseCode]);

  function handleChange(key: MarriageCaseFieldKey, value: string) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !caseRow) {
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const payload = buildUpdatePayload(values);
      const { error: updateError } = await supabase.from('marriage_cases').update(payload).eq('id', caseRow.id);

      if (updateError) {
        throw updateError;
      }

      setCaseRow((current) => (current ? ({ ...current, ...payload } as MarriageCase) : current));
      setMessage('تغییرات با موفقیت ذخیره شد.');

      const nextCaseCode = payload.case_code ?? caseRow.case_code;
      if (nextCaseCode !== caseRow.case_code && nextCaseCode !== null) {
        navigate(`/admin/cases/${nextCaseCode}`, { replace: true });
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ذخیره‌سازی ناموفق بود.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!supabase || !caseRow) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase.from('marriage_cases').delete().eq('id', caseRow.id);

      if (deleteError) {
        throw deleteError;
      }

      navigate('/admin/cases', { replace: true });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'حذف ناموفق بود.');
    } finally {
      setDeleting(false);
      setConfirmDeleteOpen(false);
    }
  }

  return (
    <section className="stack detail-page">
      <div className="page-header">
        <p className="eyebrow">ویرایش پرونده</p>
        <h1 className="page-title">{pageTitle}</h1>
      </div>

      {authLoading ? <div className="notice">در حال بررسی وضعیت ورود...</div> : null}
      {!authLoading && !user ? (
        <div className="notice notice-warning">
          برای ویرایش پرونده‌ها ابتدا وارد شوید.
        </div>
      ) : null}

      {!authLoading && user && loading ? <div className="notice">در حال دریافت اطلاعات...</div> : null}
      {error ? <div className="notice notice-warning">{error}</div> : null}
      {message ? <div className="notice">{message}</div> : null}

      {user && caseRow ? (
        <form className="card stack" onSubmit={handleSubmit}>
          <div className="profile-block">
            <div>
              <p className="label">خلاصه</p>
              <h2 className="card-title">{caseRow.profile_title ?? 'بدون عنوان'}</h2>
            </div>
            <span className="status-pill">{formatMarriageCaseValue('marital_status', caseRow.marital_status)}</span>
          </div>

          <div className="edit-form-grid">
            {CASE_EDITABLE_FIELDS.map((field) => (
              <div key={field.key} className={field.inputType === 'textarea' ? 'field field-span-2' : 'field'}>
                <label htmlFor={`field-${field.key}`}>{field.label}</label>

                {field.inputType === 'select' ? (
                  <select
                    id={`field-${field.key}`}
                    className="filter-control"
                    value={values[field.key]}
                    onChange={(event) => handleChange(field.key, event.target.value)}
                  >
                    <option value="">انتخاب کنید</option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.inputType === 'textarea' ? (
                  <textarea
                    id={`field-${field.key}`}
                    className="case-textarea case-textarea-compact"
                    value={values[field.key]}
                    onChange={(event) => handleChange(field.key, event.target.value)}
                    placeholder={field.placeholder}
                  />
                ) : (
                  <input
                    id={`field-${field.key}`}
                    className="filter-control"
                    type={field.inputType === 'number' ? 'number' : 'text'}
                    inputMode={field.inputType === 'number' ? 'numeric' : 'text'}
                    value={values[field.key]}
                    onChange={(event) => handleChange(field.key, event.target.value)}
                    placeholder={field.placeholder}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="admin-actions">
            <button className="button" type="submit" disabled={saving || deleting}>
              {saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={saving || deleting}
            >
              حذف پرونده
            </button>
          </div>
        </form>
      ) : null}

      {user && confirmDeleteOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
            <h2 id="delete-modal-title" className="card-title">
              حذف پرونده
            </h2>
            <p>آیا مطمئن هستید که می‌خواهید این پرونده را حذف کنید؟ این عملیات قابل بازگشت نیست.</p>
            <div className="admin-actions">
              <button className="button" type="button" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'در حال حذف...' : 'بله، حذف شود'}
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                disabled={deleting}
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
