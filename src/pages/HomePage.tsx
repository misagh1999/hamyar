import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { MarriageCase } from '../lib/cases';

export function HomePage() {
  const [cases, setCases] = useState<MarriageCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCases() {
      if (!supabase) {
        if (!active) return;
        setError('Supabase is not configured.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('marriage_cases')
        .select(
          'id, profile_title, case_code, marital_status, age, birth_month_year, education, clothing_and_religiosity, satellite_view, height_cm, weight_kg, skin_color, birth_city, residence_city, parents_birth_place, parents_education, father_job_and_financial_status, siblings_count, birth_order, previous_marriage_and_children, personality_traits, future_spouse_criteria, accepts_other_cities_and_villages, acceptable_spouse_age_from, acceptable_spouse_age_to, raw_text, created_by, created_at, updated_at'
        )
        .order('created_at', { ascending: false });

      if (!active) return;

      if (fetchError) {
        setError(fetchError.message);
        setCases([]);
      } else {
        setCases((data ?? []) as MarriageCase[]);
      }

      setLoading(false);
    }

    void loadCases();

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="hero hero-cases">
      <div className="hero-copy">
        <p className="eyebrow">پروژه همیار</p>
        <h1 className="title">همیار</h1>
        <p className="subtitle">لیست کیس‌های ثبت‌شده از جدول `marriage_cases`.</p>
      </div>

      {loading ? <div className="notice">در حال دریافت کیس‌ها...</div> : null}
      {error ? <div className="notice notice-warning">{error}</div> : null}

      {!loading && !error && cases.length === 0 ? <div className="notice">هیچ کیسی ثبت نشده است.</div> : null}

      <div className="case-grid">
        {cases.map((item) => (
          <Link key={item.id} className="case-card" to={`/cases/${item.case_code ?? item.id}`}>
            <div className="case-card-header">
              <span className="case-pill">case #{item.case_code ?? '-'}</span>
              <span className="case-pill case-pill-muted">{item.marital_status ?? '-'}</span>
            </div>

            <h2>{item.profile_title ?? 'بدون عنوان'}</h2>

            <div className="case-meta">
              <div>
                <span className="label">case_code</span>
                <p>{item.case_code ?? '-'}</p>
              </div>
              <div>
                <span className="label">marital_status</span>
                <p>{item.marital_status ?? '-'}</p>
              </div>
              <div>
                <span className="label">profile_title</span>
                <p>{item.profile_title ?? '-'}</p>
              </div>
              <div>
                <span className="label">age</span>
                <p>{item.age ?? '-'}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
