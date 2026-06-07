import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  formatMarriageCaseValue,
  getMarriageCaseFieldLabel,
  type CaseDropdownOption,
  type MarriageCase,
} from '../lib/cases';

type CaseFilters = {
  profileTitle: string;
  gender: string;
  maritalStatus: string;
  ageFrom: string;
  ageTo: string;
  education: string;
  heightFrom: string;
  heightTo: string;
  weightFrom: string;
  weightTo: string;
};

const DEFAULT_FILTERS: CaseFilters = {
  profileTitle: '',
  gender: '',
  maritalStatus: '',
  ageFrom: '',
  ageTo: '',
  education: '',
  heightFrom: '',
  heightTo: '',
  weightFrom: '',
  weightTo: '',
};

const CASE_QUERY_FIELDS =
  'id, profile_title, case_code, gender, marital_status, age, birth_month_year, education, military_status, job, monthly_income, religiosity, clothing_and_religiosity, satellite_view, height_cm, weight_kg, skin_color, birth_city, residence_city, parents_birth_place, parents_education, father_job_and_financial_status, siblings_count, birth_order, previous_marriage_and_children, personality_traits, future_spouse_criteria, accepts_other_cities_and_villages, acceptable_spouse_age_from, acceptable_spouse_age_to, raw_text, created_by, created_at, updated_at';

export function HomePage() {
  const [cases, setCases] = useState<MarriageCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersError, setFiltersError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CaseFilters>(DEFAULT_FILTERS);
  const [profileTitleOptions, setProfileTitleOptions] = useState<CaseDropdownOption[]>([]);
  const [maritalStatusOptions, setMaritalStatusOptions] = useState<CaseDropdownOption[]>([]);
  const [educationOptions, setEducationOptions] = useState<CaseDropdownOption[]>([]);

  useEffect(() => {
    let active = true;

    async function loadFilterOptions() {
      if (!supabase) {
        if (!active) return;
        setFiltersError('Supabase is not configured.');
        setOptionsLoading(false);
        return;
      }

      setOptionsLoading(true);

      const [
        profileTitleResult,
        maritalStatusResult,
        educationResult,
      ] = await Promise.all([
        supabase.rpc('unique_profile_titles'),
        supabase.rpc('unique_marital_statuses'),
        supabase.rpc('unique_educations'),
      ]);

      if (!active) return;

      if (profileTitleResult.error || maritalStatusResult.error || educationResult.error) {
        setFiltersError(
          profileTitleResult.error?.message ??
            maritalStatusResult.error?.message ??
            educationResult.error?.message ??
            'Failed to load filter options.'
        );
        setProfileTitleOptions([]);
        setMaritalStatusOptions([]);
        setEducationOptions([]);
      } else {
        setFiltersError(null);
        setProfileTitleOptions(
          ((profileTitleResult.data ?? []) as Array<{ value: string }>).map((item) => ({
            value: item.value,
            label: item.value,
          }))
        );
        setMaritalStatusOptions(
          ((maritalStatusResult.data ?? []) as Array<{ value: string }>).map((item) => ({
            value: item.value,
            label: item.value,
          }))
        );
        setEducationOptions(
          ((educationResult.data ?? []) as Array<{ value: string }>).map((item) => ({
            value: item.value,
            label: item.value,
          }))
        );
      }

      setOptionsLoading(false);
    }

    void loadFilterOptions();

    return () => {
      active = false;
    };
  }, []);

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

      let query = supabase.from('marriage_cases').select(CASE_QUERY_FIELDS).order('created_at', { ascending: false });

      if (filters.profileTitle) {
        query = query.eq('profile_title', filters.profileTitle);
      }

      if (filters.gender) {
        query = query.eq('gender', filters.gender);
      }

      if (filters.maritalStatus) {
        query = query.eq('marital_status', filters.maritalStatus);
      }

      if (filters.education) {
        query = query.eq('education', filters.education);
      }

      if (filters.ageFrom) {
        query = query.gte('age', Number(filters.ageFrom));
      }

      if (filters.ageTo) {
        query = query.lte('age', Number(filters.ageTo));
      }

      if (filters.heightFrom) {
        query = query.gte('height_cm', Number(filters.heightFrom));
      }

      if (filters.heightTo) {
        query = query.lte('height_cm', Number(filters.heightTo));
      }

      if (filters.weightFrom) {
        query = query.gte('weight_kg', Number(filters.weightFrom));
      }

      if (filters.weightTo) {
        query = query.lte('weight_kg', Number(filters.weightTo));
      }

      const { data, error: fetchError } = await query;

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
  }, [filters]);

  function handleFilterChange(key: keyof CaseFilters, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  return (
    <section className="hero hero-cases">
      <div className="hero-copy">
        <p className="eyebrow">پروژه همیار</p>
        <h1 className="title">همیار</h1>
      </div>

      <div className="card stack filters-panel">
        <div className="profile-block">
          <div>
            <p className="label">فیلترها</p>
            <h2 className="card-title">جستجو در پرونده‌ها</h2>
          </div>
          <button className="button button-secondary" type="button" onClick={resetFilters}>
            پاک کردن فیلترها
          </button>
        </div>

        <div className="filters-grid">
          <div className="field">
            <label htmlFor="profile-title-filter">{getMarriageCaseFieldLabel('profile_title')}</label>
            <select
              id="profile-title-filter"
              className="filter-control"
              value={filters.profileTitle}
              onChange={(event) => handleFilterChange('profileTitle', event.target.value)}
              disabled={optionsLoading}
            >
              <option value="">همه</option>
              {profileTitleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="marital-status-filter">{getMarriageCaseFieldLabel('marital_status')}</label>
            <select
              id="marital-status-filter"
              className="filter-control"
              value={filters.maritalStatus}
              onChange={(event) => handleFilterChange('maritalStatus', event.target.value)}
              disabled={optionsLoading}
            >
              <option value="">همه</option>
              {maritalStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {formatMarriageCaseValue('marital_status', option.value)}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="gender-filter">{getMarriageCaseFieldLabel('gender')}</label>
            <select
              id="gender-filter"
              className="filter-control"
              value={filters.gender}
              onChange={(event) => handleFilterChange('gender', event.target.value)}
            >
              <option value="">همه</option>
              <option value="female">خانم</option>
              <option value="male">آقا</option>
            </select>
          </div>

          <div className="field field-span-2">
            <label>{getMarriageCaseFieldLabel('age')}</label>
            <div className="range-grid">
              <input
                className="filter-control"
                type="number"
                inputMode="numeric"
                placeholder="از"
                value={filters.ageFrom}
                onChange={(event) => handleFilterChange('ageFrom', event.target.value)}
              />
              <input
                className="filter-control"
                type="number"
                inputMode="numeric"
                placeholder="تا"
                value={filters.ageTo}
                onChange={(event) => handleFilterChange('ageTo', event.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="education-filter">{getMarriageCaseFieldLabel('education')}</label>
            <select
              id="education-filter"
              className="filter-control"
              value={filters.education}
              onChange={(event) => handleFilterChange('education', event.target.value)}
              disabled={optionsLoading}
            >
              <option value="">همه</option>
              {educationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field field-span-2">
            <label>{getMarriageCaseFieldLabel('height_cm')}</label>
            <div className="range-grid">
              <input
                className="filter-control"
                type="number"
                inputMode="numeric"
                placeholder="از"
                value={filters.heightFrom}
                onChange={(event) => handleFilterChange('heightFrom', event.target.value)}
              />
              <input
                className="filter-control"
                type="number"
                inputMode="numeric"
                placeholder="تا"
                value={filters.heightTo}
                onChange={(event) => handleFilterChange('heightTo', event.target.value)}
              />
            </div>
          </div>

          <div className="field field-span-2">
            <label>{getMarriageCaseFieldLabel('weight_kg')}</label>
            <div className="range-grid">
              <input
                className="filter-control"
                type="number"
                inputMode="numeric"
                placeholder="از"
                value={filters.weightFrom}
                onChange={(event) => handleFilterChange('weightFrom', event.target.value)}
              />
              <input
                className="filter-control"
                type="number"
                inputMode="numeric"
                placeholder="تا"
                value={filters.weightTo}
                onChange={(event) => handleFilterChange('weightTo', event.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {loading ? <div className="notice">در حال دریافت کیس‌ها...</div> : null}
      {filtersError ? <div className="notice notice-warning">{filtersError}</div> : null}
      {error ? <div className="notice notice-warning">{error}</div> : null}

      {!loading && !error && cases.length === 0 ? <div className="notice">هیچ کیسی ثبت نشده است.</div> : null}

      <div className="case-grid">
        {cases.map((item) => (
          <Link key={item.id} className="case-card" to={`/cases/${item.case_code ?? item.id}`}>
            <div className="case-card-header">
              <span className="case-pill">پرونده #{item.case_code ?? '-'}</span>
              <span className="case-pill case-pill-muted">
                {formatMarriageCaseValue('gender', item.gender)}
              </span>
            </div>

            <h2>{item.profile_title ?? 'بدون عنوان'}</h2>

            <div className="case-meta">
              <div>
                <span className="label">{getMarriageCaseFieldLabel('case_code')}</span>
                <p>{formatMarriageCaseValue('case_code', item.case_code)}</p>
              </div>
              <div>
                <span className="label">{getMarriageCaseFieldLabel('gender')}</span>
                <p>{formatMarriageCaseValue('gender', item.gender)}</p>
              </div>
              <div>
                <span className="label">{getMarriageCaseFieldLabel('profile_title')}</span>
                <p>{formatMarriageCaseValue('profile_title', item.profile_title)}</p>
              </div>
              <div>
                <span className="label">{getMarriageCaseFieldLabel('age')}</span>
                <p>{formatMarriageCaseValue('age', item.age)}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
