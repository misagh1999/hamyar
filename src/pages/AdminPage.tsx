import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatMarriageCaseValue } from '../lib/cases';
import { supabase } from '../lib/supabase';

type CaseFieldKey =
  | 'profile_title'
  | 'case_code'
  | 'gender'
  | 'marital_status'
  | 'age'
  | 'birth_month_year'
  | 'education'
  | 'military_status'
  | 'job'
  | 'monthly_income'
  | 'religiosity'
  | 'clothing_and_religiosity'
  | 'satellite_view'
  | 'height_cm'
  | 'weight_kg'
  | 'skin_color'
  | 'birth_city'
  | 'residence_city'
  | 'parents_birth_place'
  | 'parents_education'
  | 'father_job_and_financial_status'
  | 'siblings_count'
  | 'birth_order'
  | 'previous_marriage_and_children'
  | 'personality_traits'
  | 'future_spouse_criteria'
  | 'accepts_other_cities_and_villages'
  | 'acceptable_spouse_age_from'
  | 'acceptable_spouse_age_to';

type CaseFieldDefinition = {
  key: CaseFieldKey;
  label: string;
  placeholder: string;
};

type CaseFormValues = Record<CaseFieldKey, string>;

type ParseResult = {
  values: CaseFormValues;
  code: string;
};

const CASE_TABLE_NAME = 'marriage_cases';
const SHOW_EITAA_AUTO_CALL = /^(1|true|yes)$/i.test(import.meta.env.VITE_SHOW_EITAA_AUTO_CALL?.trim() || '');

const CASE_FIELD_DEFINITIONS: CaseFieldDefinition[] = [
  { key: 'profile_title', label: 'profile_title', placeholder: 'مثلا: ❤️ #خانم_دهه_هفتاد_مجرد' },
  { key: 'case_code', label: 'case_code', placeholder: 'مثلا: 1687' },
  { key: 'gender', label: 'gender', placeholder: 'male / female' },
  { key: 'marital_status', label: 'marital_status', placeholder: 'مثلا: مجرد' },
  { key: 'age', label: 'age', placeholder: 'مثلا: 25' },
  { key: 'birth_month_year', label: 'birth_month_year', placeholder: 'مثلا: آذر ۱۳۷۹' },
  { key: 'education', label: 'education', placeholder: 'مثلا: دانشجوی ارشد' },
  { key: 'military_status', label: 'military_status', placeholder: 'مثلا: پایان خدمت' },
  { key: 'job', label: 'job', placeholder: 'مثلا: کارمند' },
  { key: 'monthly_income', label: 'monthly_income', placeholder: 'مثلا: ۳۰ میلیون' },
  { key: 'religiosity', label: 'religiosity', placeholder: 'مثلا: مذهبی متوسط' },
  { key: 'clothing_and_religiosity', label: 'clothing_and_religiosity', placeholder: 'مثلا: مانتویی محجوب و مذهبی متوسط' },
  { key: 'satellite_view', label: 'satellite_view', placeholder: 'مثلا: مخالف' },
  { key: 'height_cm', label: 'height_cm', placeholder: 'مثلا: 160' },
  { key: 'weight_kg', label: 'weight_kg', placeholder: 'مثلا: 56' },
  { key: 'skin_color', label: 'skin_color', placeholder: 'مثلا: گندمی' },
  { key: 'birth_city', label: 'birth_city', placeholder: 'مثلا: کاشان' },
  { key: 'residence_city', label: 'residence_city', placeholder: 'مثلا: کاشان' },
  { key: 'parents_birth_place', label: 'parents_birth_place', placeholder: 'مثلا: کاشان' },
  { key: 'parents_education', label: 'parents_education', placeholder: 'مثلا: زیر دیپلم' },
  {
    key: 'father_job_and_financial_status',
    label: 'father_job_and_financial_status',
    placeholder: 'مثلا: بازنشسته آزاد، سطح متوسط',
  },
  { key: 'siblings_count', label: 'siblings_count', placeholder: 'مثلا: ۳ برادر' },
  { key: 'birth_order', label: 'birth_order', placeholder: 'مثلا: چهارم' },
  {
    key: 'previous_marriage_and_children',
    label: 'previous_marriage_and_children',
    placeholder: 'مثلا: ----',
  },
  {
    key: 'personality_traits',
    label: 'personality_traits',
    placeholder: 'مثلا: مقید، برونگرا، محترم',
  },
  {
    key: 'future_spouse_criteria',
    label: 'future_spouse_criteria',
    placeholder: 'مثلا: مذهبی، تحصیل‌کرده، اجتماعی',
  },
  {
    key: 'accepts_other_cities_and_villages',
    label: 'accepts_other_cities_and_villages',
    placeholder: 'مثلا: بله',
  },
  {
    key: 'acceptable_spouse_age_from',
    label: 'acceptable_spouse_age_from',
    placeholder: 'مثلا: 27',
  },
  {
    key: 'acceptable_spouse_age_to',
    label: 'acceptable_spouse_age_to',
    placeholder: 'مثلا: 33',
  },
];

const FIELD_LABEL_LOOKUP = new Map<string, CaseFieldKey>([
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

const sampleCaseText = `❤️ #خانم_دهه_هفتاد_مجرد
کد: 1687

#مجرد
سن: ۲۵
ماه و سال تولد: آذر ۱۳۷۹
تحصیلات: دانشجوی ارشد
نوع پوشش و میزان اعتقادات: مانتویی محجوب و گاهی چادر ، مذهبی متوسط
نظرتون در مورد ماهواره: مخالف
قد: ۱۶۰
وزن: ۵۶
رنگ پوست: گندمی
شهر محل تولد: کاشان
شهر محل سکونت: کاشان
محل تولد والدین: کاشان
میزان تحصیلات والدین: زیر دیپلم
شغل پدر و سطح مالی خانواده: بازنشسته آزاد ، سطح متوسط
تعداد خواهر و برادر: ۳ برادر
فرزند چندم هستید: چهارم
توضیحات در مورد ازدواج قبلی و تعداد فرزند: ----
مشخصات اخلاقی و رفتاری: مقید، برونگرا، اهل رعایت آداب و احترام در رفتار و بیان، به مطالعه و رشد و یادگیری خیلی بها میدن.
معیار همسر آینده: مذهبی و مقید باشن، از نظر تحصیلات هم کفو، اهل مطالعه، شغل خوب، اجتماعی مردم دار
از روستا و شهرهای دیگه می‌پذیرید: بله
همسر از چند تا چند سال می‌پذیرید: از ۲۷ تا ۳۳`;

function createEmptyCaseValues(): CaseFormValues {
  return CASE_FIELD_DEFINITIONS.reduce((accumulator, field) => {
    accumulator[field.key] = '';
    return accumulator;
  }, {} as CaseFormValues);
}

function normalizeText(value: string) {
  return value
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[‌‍\u200f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

function toNumericString(value: string) {
  const normalized = normalizeDigits(value);
  const match = normalized.match(/-?\d+/);
  return match ? match[0] : '';
}

function mapRangeValue(value: string) {
  const normalized = normalizeDigits(value);
  const match = normalized.match(/(?:از\s*)?(\d+)\s*(?:تا|-)\s*(\d+)/);

  if (!match) {
    return { from: '', to: '' };
  }

  return { from: match[1], to: match[2] };
}

function extractProfileTitle(line: string) {
  return line.replace(/\s*کد\s*:?\s*[0-9۰-۹٠-٩]*.*$/, '').trim();
}

function normalizeMaritalStatus(value: string) {
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

function detectGenderFromText(text: string) {
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

function parseCaseText(text: string): ParseResult {
  const values = createEmptyCaseValues();
  values.gender = detectGenderFromText(text);

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines[0]) {
    values.profile_title = extractProfileTitle(lines[0]);
  }

  let code = '';

  for (const line of lines) {
    const codeMatch = line.match(/کد\s*:\s*([0-9۰-۹]+)/);
    if (codeMatch) {
      code = toNumericString(codeMatch[1]);
      values.case_code = code;
      continue;
    }

    if (line.startsWith('#') && !line.includes(':') && !line.includes('：')) {
      const status = line.replace(/^#+/, '').trim();
      values.marital_status = normalizeMaritalStatus(status);
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
      continue;
    }

    if (mappedKey === 'acceptable_spouse_age_from') {
      const { from, to } = mapRangeValue(value);
      values.acceptable_spouse_age_from = from;
      values.acceptable_spouse_age_to = to;
      continue;
    }

    values[mappedKey] = value;

    if (['military_status', 'job', 'monthly_income', 'religiosity'].includes(mappedKey)) {
      values.gender = 'male';
    } else if (mappedKey === 'clothing_and_religiosity') {
      values.gender = 'female';
    }
  }

  if (!code && values.case_code) {
    code = values.case_code;
  }

  return { values, code };
}

function toNullableInteger(value: string) {
  const normalized = toNumericString(value);
  return normalized ? Number(normalized) : null;
}

function buildEditorUrl(text: string) {
  const base = `${window.location.origin}${import.meta.env.BASE_URL || '/'}`;
  return `${base}admin/new-case?text=${encodeURIComponent(text)}`;
}

function CaseCreator({
  userId,
  onLogout,
  initialText,
}: {
  userId: string;
  onLogout: () => Promise<void>;
  initialText?: string | null;
}) {
  const [text, setText] = useState(initialText?.trim() ? initialText : sampleCaseText);
  const [parsedValues, setParsedValues] = useState<CaseFormValues | null>(null);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!initialText?.trim()) {
      return;
    }

    setText(initialText);
    const result = parseCaseText(initialText);
    setParsedValues(result.values);
    setMessage(result.code ? `پرونده ${result.code} از Eitaa بارگذاری شد.` : 'پیش‌نمایش Eitaa بارگذاری شد.');
  }, [initialText]);

  function handleProcess() {
    const result = parseCaseText(text);
    setParsedValues(result.values);
    setMessage(result.code ? `پرونده ${result.code} پردازش شد.` : 'پرونده پردازش شد.');
  }

  function handleClear() {
    setText('');
    setParsedValues(null);
    setMessage(null);
  }

  async function handleSendToSystem() {
    if (!parsedValues) {
      setMessage('First click پردازش to parse the case.');
      return;
    }

    setSending(true);
    setMessage(null);

    try {
      if (!supabase) {
        throw new Error('Supabase تنظیم نشده است.');
      }

      const payload = {
        profile_title: parsedValues.profile_title || null,
        case_code: toNullableInteger(parsedValues.case_code),
        gender: parsedValues.gender || null,
        marital_status: parsedValues.marital_status || null,
        age: toNullableInteger(parsedValues.age),
        birth_month_year: parsedValues.birth_month_year || null,
        education: parsedValues.education || null,
        military_status: parsedValues.military_status || null,
        job: parsedValues.job || null,
        monthly_income: parsedValues.monthly_income || null,
        religiosity: parsedValues.religiosity || null,
        clothing_and_religiosity: parsedValues.clothing_and_religiosity || null,
        satellite_view: parsedValues.satellite_view || null,
        height_cm: toNullableInteger(parsedValues.height_cm),
        weight_kg: toNullableInteger(parsedValues.weight_kg),
        skin_color: parsedValues.skin_color || null,
        birth_city: parsedValues.birth_city || null,
        residence_city: parsedValues.residence_city || null,
        parents_birth_place: parsedValues.parents_birth_place || null,
        parents_education: parsedValues.parents_education || null,
        father_job_and_financial_status: parsedValues.father_job_and_financial_status || null,
        siblings_count: parsedValues.siblings_count || null,
        birth_order: parsedValues.birth_order || null,
        previous_marriage_and_children: parsedValues.previous_marriage_and_children || null,
        personality_traits: parsedValues.personality_traits || null,
        future_spouse_criteria: parsedValues.future_spouse_criteria || null,
        accepts_other_cities_and_villages: parsedValues.accepts_other_cities_and_villages || null,
        acceptable_spouse_age_from: toNullableInteger(parsedValues.acceptable_spouse_age_from),
        acceptable_spouse_age_to: toNullableInteger(parsedValues.acceptable_spouse_age_to),
        raw_text: text.trim(),
        created_by: userId,
      };

      const { error } = await supabase.from(CASE_TABLE_NAME).insert(payload);

      if (error) {
        throw error;
      }

      setText('');
      setParsedValues(null);
      setMessage('با موفقیت به سیستم ارسال شد.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ارسال پرونده ناموفق بود.');
    } finally {
      setSending(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    setMessage(null);
    try {
      await onLogout();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card stack">
      <div className="profile-block">
        <div>
          <p className="label">ابزار</p>
          <h2 className="card-title">ثبت پرونده جدید</h2>
        </div>
        <Link className="ghost-link ghost-button" to="/admin">
          بازگشت به داشبورد
        </Link>
      </div>

      <div className="field">
        <label htmlFor="case-text">قالب پرونده</label>
        <textarea
          id="case-text"
          className="case-textarea"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="متن قالب پرونده را اینجا قرار دهید..."
        />
      </div>

      {initialText?.trim() ? <div className="notice">این پرونده از پیام Eitaa بارگذاری شده است.</div> : null}

      <div className="admin-actions">
        <button className="button" type="button" onClick={handleProcess} disabled={busy || sending || !text.trim()}>
          پردازش
        </button>
        <button className="button button-secondary" type="button" onClick={handleClear} disabled={busy || sending}>
          پاک کردن
        </button>
      </div>

      {parsedValues ? (
        <div className="case-table-block">
          <div className="result-block-header">
            <p className="label">فیلدهای استخراج‌شده</p>
            <div className="notice case-note">می‌توانید مقادیر زیر را قبل از ارسال به سیستم ویرایش کنید.</div>
          </div>

          <div className="case-table-wrap">
            <table className="case-table">
              <thead>
                <tr>
                  <th>فیلد</th>
                  <th>مقدار</th>
                </tr>
              </thead>
              <tbody>
                {CASE_FIELD_DEFINITIONS.map((field) => (
                  <tr key={field.key}>
                    <td>{field.label}</td>
                    <td>
                      <input
                        className="case-table-input"
                        type="text"
                        inputMode={field.key.includes('age') || field.key.endsWith('_cm') || field.key === 'case_code' ? 'numeric' : 'text'}
                        value={parsedValues[field.key]}
                        placeholder={field.placeholder}
                        onChange={(event) =>
                          setParsedValues((current) =>
                            current
                              ? {
                                  ...current,
                                  [field.key]: event.target.value,
                                }
                              : current
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-actions">
            <button className="button" type="button" onClick={handleSendToSystem} disabled={busy || sending}>
              {sending ? 'در حال ارسال...' : 'ارسال به سیستم'}
            </button>
          </div>
        </div>
      ) : null}

      <button className="button button-secondary" type="button" onClick={handleLogout} disabled={busy || sending}>
        {busy ? 'در حال خروج...' : 'خروج از حساب'}
      </button>

  {message ? <div className="notice">{message}</div> : null}
    </div>
  );
}

function CasePreview({
  text,
  onOpenEditor,
}: {
  text: string;
  onOpenEditor: () => void;
}) {
  const parsed = useMemo(() => parseCaseText(text), [text]);
  const filledFields = CASE_FIELD_DEFINITIONS.filter((field) => parsed.values[field.key].trim());

  return (
    <div className="card stack">
      <div className="profile-block">
        <div>
          <p className="label">پیش‌نمایش</p>
          <h2 className="card-title">{parsed.values.profile_title || 'پرونده تشخیص داده شده'}</h2>
        </div>
        <span className="status-pill">{parsed.code ? `کد ${parsed.code}` : 'بدون کد'}</span>
      </div>

      <div className="monitor-hint">
        این نما فقط برای بررسی سریع جزئیات پیام است. اگر بخواهید می‌توانید بعداً آن را در ویرایشگر کامل باز کنید.
      </div>

      <div className="monitor-candidate-grid">
        {filledFields.map((field) => (
          <article key={field.key} className="monitor-candidate">
            <div className="monitor-candidate-meta">
              <span>{field.label}</span>
            </div>
            <p>{formatMarriageCaseValue(field.key, parsed.values[field.key])}</p>
          </article>
        ))}
      </div>

      <div className="admin-actions">
        <button className="button button-secondary" type="button" onClick={onOpenEditor}>
          باز کردن در ویرایشگر کامل
        </button>
      </div>
    </div>
  );
}

export function AdminPage() {
  const location = useLocation();
  const { configured, loading, user, accessToken, login, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const authenticated = Boolean(user);
  const isCasePage = location.pathname === '/admin/new-case';
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialText = searchParams.get('text');
  const isPreviewMode = searchParams.get('preview') === '1';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSubmitting(true);

    try {
      await login(email.trim(), password);
      setPassword('');
      setMessage('ورود با موفقیت انجام شد و توکن ذخیره شد.');
    } catch (error) {
      const fallback = 'ورود ناموفق بود. ایمیل و رمز عبور را بررسی کنید.';
      setMessage(error instanceof Error ? error.message || fallback : fallback);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    setMessage(null);
    setSubmitting(true);

    try {
      await logout();
      setMessage('خروج انجام شد و توکن پاک شد.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'خروج ناموفق بود.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="admin-page">
      <div className="page-header">
        <p className="eyebrow">پنل مدیریت</p>
        <h1 className="page-title">{isCasePage ? 'ثبت کیس جدید' : 'ورود و پروفایل'}</h1>
      </div>

      {!configured ? (
        <div className="notice notice-warning">
          مقدارهای `VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY` در `.env` تنظیم نشده‌اند.
        </div>
      ) : null}

      {loading ? (
        <div className="card">
          <p>در حال بررسی وضعیت ورود...</p>
        </div>
      ) : user && isCasePage && isPreviewMode ? (
        <CasePreview
          text={initialText || ''}
          onOpenEditor={() => {
            if (!initialText) {
              return;
            }

            window.open(buildEditorUrl(initialText), '_blank', 'noopener,noreferrer');
          }}
        />
      ) : user && isCasePage ? (
        <CaseCreator userId={user.id} onLogout={handleLogout} initialText={initialText} />
      ) : authenticated ? (
        <div className="card stack">
          <div className="profile-block">
            <div>
              <p className="label">پروفایل</p>
              <h2 className="card-title">{user?.email ?? 'کاربر وارد شده'}</h2>
            </div>
            <span className="status-pill">فعال</span>
          </div>

          <div className="info-grid">
            <div className="info-item">
              <span className="label">شناسه کاربر</span>
              <p>{user?.id ?? '-'}</p>
            </div>
            <div className="info-item">
              <span className="label">توکن دسترسی</span>
              <p>{accessToken ? 'ذخیره شد' : 'موجود نیست'}</p>
            </div>
          </div>

          <div className="admin-actions">
            <Link className="button button-secondary admin-link-button" to="/admin/cases">
              مدیریت کیس ها
            </Link>
            <Link className="button button-secondary admin-link-button" to="/admin/new-case">
              ثبت کیس جدید
            </Link>
            {SHOW_EITAA_AUTO_CALL ? (
              <Link className="button button-secondary admin-link-button" to="/admin/eitaa?autostart=1">
                فراخوانی خودکار
              </Link>
            ) : null}
            <button className="button button-secondary" type="button" onClick={handleLogout} disabled={submitting}>
              {submitting ? 'در حال خروج...' : 'خروج از حساب'}
            </button>
          </div>
        </div>
      ) : isCasePage ? (
        <div className="card stack">
          <p>برای ورود به این بخش ابتدا لاگین کنید.</p>
          <form className="stack" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">ایمیل</label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="password">رمز عبور</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="رمز عبور"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <button className="button" type="submit" disabled={submitting}>
              {submitting ? 'در حال ورود...' : 'ورود'}
            </button>
          </form>
        </div>
      ) : (
        <form className="card stack" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">ایمیل</label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">رمز عبور</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="رمز عبور"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <button className="button" type="submit" disabled={submitting}>
            {submitting ? 'در حال ورود...' : 'ورود'}
          </button>
        </form>
      )}

      {message ? <div className="notice">{message}</div> : null}
    </section>
  );
}
