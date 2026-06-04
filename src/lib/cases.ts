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

export const CASE_FIELD_LABELS: Record<keyof Omit<MarriageCase, 'id'>, string> = {
  profile_title: 'عنوان پرونده',
  case_code: 'کد',
  marital_status: 'وضعیت تاهل',
  age: 'سن',
  birth_month_year: 'ماه و سال تولد',
  education: 'تحصیلات',
  clothing_and_religiosity: 'نوع پوشش و میزان اعتقادات',
  satellite_view: 'نظرتون در مورد ماهواره',
  height_cm: 'قد',
  weight_kg: 'وزن',
  skin_color: 'رنگ پوست',
  birth_city: 'شهر محل تولد',
  residence_city: 'شهر محل سکونت',
  parents_birth_place: 'محل تولد والدین',
  parents_education: 'میزان تحصیلات والدین',
  father_job_and_financial_status: 'شغل پدر و سطح مالی خانواده',
  siblings_count: 'تعداد خواهر و برادر',
  birth_order: 'فرزند چندم',
  previous_marriage_and_children: 'توضیحات ازدواج قبلی و فرزند',
  personality_traits: 'مشخصات اخلاقی و رفتاری',
  future_spouse_criteria: 'معیار همسر آینده',
  accepts_other_cities_and_villages: 'پذیرش شهرهای دیگر',
  acceptable_spouse_age_from: 'سن همسر از',
  acceptable_spouse_age_to: 'سن همسر تا',
  raw_text: 'متن خام',
  created_by: 'ایجادکننده',
  created_at: 'زمان ایجاد',
  updated_at: 'زمان بروزرسانی',
};

export function getMarriageCaseFieldLabel(key: keyof Omit<MarriageCase, 'id'>) {
  return CASE_FIELD_LABELS[key] ?? key;
}

export function formatMarriageCaseValue(key: keyof Omit<MarriageCase, 'id'>, value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  if (key === 'marital_status') {
    if (value === 'single') return 'مجرد';
    if (value === 'married') return 'متاهل';
  }

  if (key === 'accepts_other_cities_and_villages') {
    if (value === 'yes') return 'بله';
    if (value === 'no') return 'خیر';
  }

  return String(value);
}

export const CASE_LIST_FIELDS: Array<{
  key: keyof Pick<MarriageCase, 'case_code' | 'marital_status' | 'profile_title' | 'age'>;
  label: string;
}> = [
  { key: 'case_code', label: 'case_code' },
  { key: 'marital_status', label: 'marital_status' },
  { key: 'profile_title', label: 'profile_title' },
  { key: 'age', label: 'age' },
];

export type CaseDropdownOption = {
  value: string;
  label: string;
};
