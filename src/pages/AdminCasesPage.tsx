import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  formatMarriageCaseValue,
  getMarriageCaseFieldLabel,
  type MarriageCase,
} from '../lib/cases';

export function AdminCasesPage() {
  const { loading: authLoading, user } = useAuth();
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
          'id, profile_title, case_code, marital_status, age, education, height_cm, weight_kg, created_at'
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
    <section className="stack detail-page">
      <div className="page-header">
        <p className="eyebrow">مدیریت پرونده‌ها</p>
        <h1 className="page-title">لیست پرونده‌ها</h1>
      </div>

      {authLoading ? <div className="notice">در حال بررسی وضعیت ورود...</div> : null}
      {!authLoading && !user ? (
        <div className="notice notice-warning">
          برای مدیریت پرونده‌ها ابتدا وارد شوید.
          <div>
            <Link className="ghost-link" to="/admin">
              رفتن به صفحه ورود
            </Link>
          </div>
        </div>
      ) : null}

      {!authLoading && user && loading ? <div className="notice">در حال دریافت پرونده‌ها...</div> : null}
      {error ? <div className="notice notice-warning">{error}</div> : null}

      {!authLoading && user && !loading && !error && cases.length === 0 ? (
        <div className="notice">هیچ پرونده‌ای پیدا نشد.</div>
      ) : null}

      {user ? (
        <div className="case-grid">
          {cases.map((item) => (
            <div key={item.id} className="case-card">
              <div className="case-card-header">
                <span className="case-pill">پرونده #{formatMarriageCaseValue('case_code', item.case_code)}</span>
                <span className="case-pill case-pill-muted">
                  {formatMarriageCaseValue('marital_status', item.marital_status)}
                </span>
              </div>

              <h2>{item.profile_title ?? 'بدون عنوان'}</h2>

              <div className="case-meta">
                <div>
                  <span className="label">{getMarriageCaseFieldLabel('age')}</span>
                  <p>{formatMarriageCaseValue('age', item.age)}</p>
                </div>
                <div>
                  <span className="label">{getMarriageCaseFieldLabel('education')}</span>
                  <p>{formatMarriageCaseValue('education', item.education)}</p>
                </div>
                <div>
                  <span className="label">{getMarriageCaseFieldLabel('height_cm')}</span>
                  <p>{formatMarriageCaseValue('height_cm', item.height_cm)}</p>
                </div>
                <div>
                  <span className="label">{getMarriageCaseFieldLabel('weight_kg')}</span>
                  <p>{formatMarriageCaseValue('weight_kg', item.weight_kg)}</p>
                </div>
              </div>

              <div className="admin-actions">
                <Link className="button" to={`/admin/cases/${item.case_code ?? item.id}`}>
                  ویرایش
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
