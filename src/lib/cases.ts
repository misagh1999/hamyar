export type MarriageCase = {
  id: number;
  profile_title: string | null;
  case_code: number | null;
  gender: 'male' | 'female' | string | null;
  marital_status: string | null;
  age: number | null;
  birth_month_year: string | null;
  education: string | null;
  military_status: string | null;
  job: string | null;
  monthly_income: string | null;
  religiosity: string | null;
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
  gender: 'جنسیت',
  marital_status: 'وضعیت تاهل',
  age: 'سن',
  birth_month_year: 'ماه و سال تولد',
  education: 'تحصیلات',
  military_status: 'وضعیت سربازی',
  job: 'شغل',
  monthly_income: 'میزان درآمد ماهیانه',
  religiosity: 'میزان اعتقادات',
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
    if (value === 'divorced') return 'مطلقه';
  }

  if (key === 'gender') {
    if (value === 'male') return 'آقا';
    if (value === 'female') return 'خانم';
  }

  if (key === 'accepts_other_cities_and_villages') {
    if (value === 'yes') return 'بله';
    if (value === 'no') return 'خیر';
  }

  return String(value);
}

export const CASE_LIST_FIELDS: Array<{
  key: keyof Pick<MarriageCase, 'case_code' | 'gender' | 'marital_status' | 'profile_title' | 'age'>;
  label: string;
}> = [
  { key: 'case_code', label: 'case_code' },
  { key: 'gender', label: 'gender' },
  { key: 'marital_status', label: 'marital_status' },
  { key: 'profile_title', label: 'profile_title' },
  { key: 'age', label: 'age' },
];

export type CaseDropdownOption = {
  value: string;
  label: string;
};

export type MarriageCaseFieldKey = keyof Omit<
  MarriageCase,
  'id' | 'created_by' | 'created_at' | 'updated_at'
>;

export type MarriageCaseFieldDefinition = {
  key: MarriageCaseFieldKey;
  label: string;
  inputType: 'text' | 'number' | 'textarea' | 'select';
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
};

export const MARITAL_STATUS_OPTIONS = [
  { value: 'single', label: 'مجرد' },
  { value: 'married', label: 'متاهل' },
  { value: 'divorced', label: 'مطلقه' },
];

export const GENDER_OPTIONS = [
  { value: 'female', label: 'خانم' },
  { value: 'male', label: 'آقا' },
];

export const CASE_EDITABLE_FIELDS: MarriageCaseFieldDefinition[] = [
  { key: 'profile_title', label: 'عنوان پرونده', inputType: 'text', placeholder: 'مثلا: ❤️ #خانم_دهه_هفتاد_مجرد' },
  { key: 'case_code', label: 'کد', inputType: 'number', placeholder: '1687' },
  { key: 'gender', label: 'جنسیت', inputType: 'select', options: GENDER_OPTIONS },
  { key: 'marital_status', label: 'وضعیت تاهل', inputType: 'select', options: MARITAL_STATUS_OPTIONS },
  { key: 'age', label: 'سن', inputType: 'number', placeholder: '25' },
  { key: 'birth_month_year', label: 'ماه و سال تولد', inputType: 'text', placeholder: 'آذر ۱۳۷۹' },
  { key: 'education', label: 'تحصیلات', inputType: 'text', placeholder: 'دانشجوی ارشد' },
  { key: 'military_status', label: 'وضعیت سربازی', inputType: 'text' },
  { key: 'job', label: 'شغل', inputType: 'text' },
  { key: 'monthly_income', label: 'میزان درآمد ماهیانه', inputType: 'text' },
  { key: 'religiosity', label: 'میزان اعتقادات', inputType: 'text' },
  { key: 'clothing_and_religiosity', label: 'نوع پوشش و میزان اعتقادات', inputType: 'text' },
  { key: 'satellite_view', label: 'نظرتون در مورد ماهواره', inputType: 'text' },
  { key: 'height_cm', label: 'قد', inputType: 'number', placeholder: '160' },
  { key: 'weight_kg', label: 'وزن', inputType: 'number', placeholder: '56' },
  { key: 'skin_color', label: 'رنگ پوست', inputType: 'text' },
  { key: 'birth_city', label: 'شهر محل تولد', inputType: 'text' },
  { key: 'residence_city', label: 'شهر محل سکونت', inputType: 'text' },
  { key: 'parents_birth_place', label: 'محل تولد والدین', inputType: 'text' },
  { key: 'parents_education', label: 'میزان تحصیلات والدین', inputType: 'text' },
  { key: 'father_job_and_financial_status', label: 'شغل پدر و سطح مالی خانواده', inputType: 'text' },
  { key: 'siblings_count', label: 'تعداد خواهر و برادر', inputType: 'text' },
  { key: 'birth_order', label: 'فرزند چندم', inputType: 'text' },
  { key: 'previous_marriage_and_children', label: 'توضیحات ازدواج قبلی و فرزند', inputType: 'textarea' },
  { key: 'personality_traits', label: 'مشخصات اخلاقی و رفتاری', inputType: 'textarea' },
  { key: 'future_spouse_criteria', label: 'معیار همسر آینده', inputType: 'textarea' },
  {
    key: 'accepts_other_cities_and_villages',
    label: 'پذیرش شهرهای دیگر',
    inputType: 'text',
  },
  { key: 'acceptable_spouse_age_from', label: 'سن همسر از', inputType: 'number', placeholder: '27' },
  { key: 'acceptable_spouse_age_to', label: 'سن همسر تا', inputType: 'number', placeholder: '33' },
  { key: 'raw_text', label: 'متن خام', inputType: 'textarea' },
];
