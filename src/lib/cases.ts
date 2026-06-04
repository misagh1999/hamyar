export type MarriageCase = {
  id: number;
  profile_title: string | null;
  case_code: number | null;
  marital_status: string | null;
  age: number | null;
  birth_month_year: string | null;
  education: string | null;
  clothing_and_religiosity: string | null;
  satellite_view: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  skin_color: string | null;
  birth_city: string | null;
  residence_city: string | null;
  parents_birth_place: string | null;
  parents_education: string | null;
  father_job_and_financial_status: string | null;
  siblings_count: string | null;
  birth_order: string | null;
  previous_marriage_and_children: string | null;
  personality_traits: string | null;
  future_spouse_criteria: string | null;
  accepts_other_cities_and_villages: string | null;
  acceptable_spouse_age_from: number | null;
  acceptable_spouse_age_to: number | null;
  raw_text: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export const CASE_LIST_FIELDS: Array<{
  key: keyof Pick<MarriageCase, 'case_code' | 'marital_status' | 'profile_title' | 'age'>;
  label: string;
}> = [
  { key: 'case_code', label: 'case_code' },
  { key: 'marital_status', label: 'marital_status' },
  { key: 'profile_title', label: 'profile_title' },
  { key: 'age', label: 'age' },
];
