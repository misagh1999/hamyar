const CASE_FIELD_KEYS = [
  'profile_title',
  'case_code',
  'gender',
  'marital_status',
  'age',
  'birth_month_year',
  'education',
  'military_status',
  'job',
  'monthly_income',
  'religiosity',
  'clothing_and_religiosity',
  'satellite_view',
  'height_cm',
  'weight_kg',
  'skin_color',
  'birth_city',
  'residence_city',
  'parents_birth_place',
  'parents_education',
  'father_job_and_financial_status',
  'siblings_count',
  'birth_order',
  'previous_marriage_and_children',
  'personality_traits',
  'future_spouse_criteria',
  'accepts_other_cities_and_villages',
  'acceptable_spouse_age_from',
  'acceptable_spouse_age_to',
];

const FIELD_LABEL_LOOKUP = new Map([
  ['مجرد یا مطلقه', 'marital_status'],
  ['سن', 'age'],
  ['ماه و سال تولد', 'birth_month_year'],
  ['تحصیلات', 'education'],
  ['وضعیت سربازی', 'military_status'],
  ['شغل', 'job'],
  ['میزان درآمد ماهیانه', 'monthly_income'],
  ['میزان اعتقادات', 'religiosity'],
  ['نوع پوشش و میزان اعتقادات', 'clothing_and_religiosity'],
  ['نظرتون در مورد ماهواره', 'satellite_view'],
  ['قد', 'height_cm'],
  ['وزن', 'weight_kg'],
  ['رنگ پوست', 'skin_color'],
  ['شهر محل تولد', 'birth_city'],
  ['شهر محل سکونت', 'residence_city'],
  ['محل تولد والدین', 'parents_birth_place'],
  ['میزان تحصیلات والدین', 'parents_education'],
  ['شغل پدر و سطح مالی خانواده', 'father_job_and_financial_status'],
  ['تعداد خواهر و برادر', 'siblings_count'],
  ['فرزند چندم هستید', 'birth_order'],
  ['فرزند چندم خانواده', 'birth_order'],
  ['توضیحات در مورد ازدواج قبلی و تعداد فرزند', 'previous_marriage_and_children'],
  ['مشخصات اخلاقی و رفتاری', 'personality_traits'],
  ['معیار همسر آینده', 'future_spouse_criteria'],
  ['از روستا و شهرهای دیگه میپذیرید', 'accepts_other_cities_and_villages'],
  ['از روستاها و شهرهای دیگه می پذیرید', 'accepts_other_cities_and_villages'],
  ['همسر از چند تا چند سال میپذیرید', 'acceptable_spouse_age_from'],
  ['همسر از چند تا چند سال می‌پذیرید', 'acceptable_spouse_age_from'],
]);

function normalizeText(value) {
  return value
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[‌‍\u200f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeDigits(value) {
  return value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

function toNumericString(value) {
  const normalized = normalizeDigits(value);
  const match = normalized.match(/-?\d+/);
  return match ? match[0] : '';
}

function mapRangeValue(value) {
  const normalized = normalizeDigits(value);
  const match = normalized.match(/(?:از\s*)?(\d+)\s*(?:تا|-)\s*(\d+)/);

  if (!match) {
    return { from: '', to: '' };
  }

  return { from: match[1], to: match[2] };
}

function createEmptyValues() {
  return CASE_FIELD_KEYS.reduce((accumulator, field) => {
    accumulator[field] = '';
    return accumulator;
  }, {});
}

function extractProfileTitle(line) {
  return line.replace(/\s*کد\s*:?\s*[0-9۰-۹٠-٩]*.*$/, '').trim();
}

function normalizeMaritalStatus(value) {
  const status = normalizeText(value);

  if (status.includes('مجرد')) {
    return 'single';
  }

  if (status.includes('مطلق')) {
    return 'divorced';
  }

  if (status.includes('متاهل') || status.includes('متأهل')) {
    return 'married';
  }

  return value.trim();
}

function detectGenderFromText(text) {
  const normalized = normalizeText(text);

  if (
    normalized.includes('فرم_خام_معرفی_آقا') ||
    normalized.includes('فرم خام معرفی آقا') ||
    normalized.includes('معرفی آقا')
  ) {
    return 'male';
  }

  if (
    normalized.includes('فرم_خام_معرفی_خانم') ||
    normalized.includes('فرم خام معرفی خانم') ||
    normalized.includes('معرفی خانم')
  ) {
    return 'female';
  }

  return '';
}

export function countFilledMarriageCaseFields(values) {
  return CASE_FIELD_KEYS.filter((key) => Boolean(String(values[key] || '').trim())).length;
}

export function parseMarriageCaseText(text) {
  const values = createEmptyValues();
  values.gender = detectGenderFromText(text);

  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines[0]) {
    values.profile_title = extractProfileTitle(lines[0]);
  }

  let code = '';
  const matchedFields = new Set();

  for (const line of lines) {
    const codeMatch = line.match(/کد\s*:\s*([0-9۰-۹]+)/);
    if (codeMatch) {
      code = toNumericString(codeMatch[1]);
      values.case_code = code;
      matchedFields.add('case_code');
      continue;
    }

    if (line.startsWith('#') && !line.includes(':') && !line.includes('：')) {
      const status = line.replace(/^#+/, '').trim();
      values.marital_status = normalizeMaritalStatus(status);

      if (status) {
        matchedFields.add('marital_status');
      }
      continue;
    }

    const separator = line.includes(':') ? ':' : line.includes('：') ? '：' : null;
    if (!separator) {
      continue;
    }

    const [rawLabel, ...rest] = line.split(separator);
    const label = normalizeText(rawLabel.replace(/^#+/, ''));
    const value = rest.join(separator).trim();
    const mappedKey = FIELD_LABEL_LOOKUP.get(label);

    if (!mappedKey || !value) {
      continue;
    }

    if (mappedKey === 'marital_status') {
      values.marital_status = normalizeMaritalStatus(value);
      matchedFields.add(mappedKey);
      continue;
    }

    if (mappedKey === 'acceptable_spouse_age_from') {
      const { from, to } = mapRangeValue(value);
      values.acceptable_spouse_age_from = from;
      values.acceptable_spouse_age_to = to;
      matchedFields.add('acceptable_spouse_age_from');
      if (to) {
        matchedFields.add('acceptable_spouse_age_to');
      }
      continue;
    }

    values[mappedKey] = value;
    matchedFields.add(mappedKey);

    if (['military_status', 'job', 'monthly_income', 'religiosity'].includes(mappedKey)) {
      values.gender = 'male';
    } else if (mappedKey === 'clothing_and_religiosity') {
      values.gender = 'female';
    }
  }

  if (values.gender) {
    matchedFields.add('gender');
  }

  if (!code && values.case_code) {
    code = values.case_code;
  }

  return {
    values,
    code,
    matchedFields: Array.from(matchedFields),
  };
}
