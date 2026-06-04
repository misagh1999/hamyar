import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { MarriageCase } from '../lib/cases';

const DETAIL_FIELDS: Array<{
  key: keyof MarriageCase;
  label: string;
}> = [
  { key: 'case_code', label: 'case_code' },
  { key: 'marital_status', label: 'marital_status' },
  { key: 'profile_title', label: 'profile_title' },
  { key: 'age', label: 'age' },
  { key: 'birth_month_year', label: 'birth_month_year' },
  { key: 'education', label: 'education' },
  { key: 'clothing_and_religiosity', label: 'clothing_and_religiosity' },
  { key: 'satellite_view', label: 'satellite_view' },
  { key: 'height_cm', label: 'height_cm' },
  { key: 'weight_kg', label: 'weight_kg' },
  { key: 'skin_color', label: 'skin_color' },
  { key: 'birth_city', label: 'birth_city' },
  { key: 'residence_city', label: 'residence_city' },
  { key: 'parents_birth_place', label: 'parents_birth_place' },
  { key: 'parents_education', label: 'parents_education' },
  { key: 'father_job_and_financial_status', label: 'father_job_and_financial_status' },
  { key: 'siblings_count', label: 'siblings_count' },
  { key: 'birth_order', label: 'birth_order' },
  { key: 'previous_marriage_and_children', label: 'previous_marriage_and_children' },
  { key: 'personality_traits', label: 'personality_traits' },
  { key: 'future_spouse_criteria', label: 'future_spouse_criteria' },
  { key: 'accepts_other_cities_and_villages', label: 'accepts_other_cities_and_villages' },
  { key: 'acceptable_spouse_age_from', label: 'acceptable_spouse_age_from' },
  { key: 'acceptable_spouse_age_to', label: 'acceptable_spouse_age_to' },
  { key: 'raw_text', label: 'raw_text' },
  { key: 'created_by', label: 'created_by' },
  { key: 'created_at', label: 'created_at' },
  { key: 'updated_at', label: 'updated_at' },
];

export function CaseDetailPage() {
  const { caseCode } = useParams();
  const [item, setItem] = useState<MarriageCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCase() {
      if (!caseCode) {
        if (!active) return;
        setError('Case code is missing.');
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
        setItem(null);
      } else if (!data) {
        setError('Case not found.');
        setItem(null);
      } else {
        setItem(data as MarriageCase);
      }

      setLoading(false);
    }

    void loadCase();

    return () => {
      active = false;
    };
  }, [caseCode]);

  return (
    <section className="stack detail-page">
      <div className="page-header">
        <p className="eyebrow">case detail</p>
        <h1 className="page-title">{item?.profile_title ?? 'جزئیات کیس'}</h1>
      </div>

      {loading ? <div className="notice">در حال دریافت جزئیات...</div> : null}
      {error ? <div className="notice notice-warning">{error}</div> : null}

      {item ? (
        <div className="card stack">
          <div className="profile-block">
            <div>
              <p className="label">summary</p>
              <h2 className="card-title">{item.profile_title ?? 'بدون عنوان'}</h2>
            </div>
            <span className="status-pill">{item.marital_status ?? '-'}</span>
          </div>

          <div className="detail-grid">
            {DETAIL_FIELDS.map((field) => (
              <div key={field.key} className="detail-item">
                <span className="label">{field.label}</span>
                <p>{String(item[field.key] ?? '-')}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
