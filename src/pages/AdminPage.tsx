import { FormEvent, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type ParsedItem = {
  label: string;
  value: string;
};

type ParsedCase = {
  hashtags: string[];
  items: ParsedItem[];
};

const sampleCaseText = `💙 #آقا_دهه_هفتاد_مجرد      کد: 1674

#مجرد
سن: ۳۴
ماه و سال تولد: بهمن ۱۳۷۰
تحصیلات: فوق لیسانس 
وضعیت سربازی: پایان خدمت
شغل: مربی پرورشی
میزان درآمد ماهیانه: طبق قانون 
میزان اعتقادات: مذهبی انقلابی
نظرتون در مورد ماهواره: مخالف
قد: ۱۸۳
وزن: ۶۲
رنگ پوست: گندمی
شهر محل تولد: کاشان
شهر محل سکونت: کاشان
محل تولد والدین: کاشان 
میزان تحصیلات والدین: راهنمایی 
شغل پدر و سطح مالی خانواده: آزاد ، سطح متوسط 
تعداد خواهر و برادر: یک خواهر و ۳ برادر
فرزند چندم خانواده: چهارم
توضیحات در مورد ازدواج قبلی و تعداد فرزند: ـــــــــ
مشخصات اخلاقی و رفتاری: متدین، صبور، قانع، خوش اخلاق، مهربان، آرام، مودب، سادات.
معیار همسر آینده: مذهبی انقلابی، محجبه و چادری، خوش اخلاق، باایمان، تحصیلکرده، شاغل نباشه اگرم بود شغل دولتی و یا کار خونگی باشه، معلم باشه بهتره، خانواده باایمان داشته باشه، قدش ۱۶۵ به بالا باشه بهتره.
از روستاها و شهرهای دیگه می پذیرید: بشرط سکونت در کاشان 
همسر از چند تا چند سال می‌پذیرید: از ۲۸ تا ۳۲`;

function parseCaseText(text: string): ParsedCase {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const hashtags = Array.from(
    new Set(
      lines.flatMap((line) => {
        const matches = line.match(/#[^\s#]+/g) ?? [];
        return matches;
      })
    )
  ).slice(0, 2);

  const items: ParsedItem[] = [];

  for (const line of lines) {
    const hasAsciiColon = line.includes(':');
    const hasPersianColon = line.includes('：');

    if (!hasAsciiColon && !hasPersianColon) continue;

    const separator = hasAsciiColon ? ':' : '：';
    const [rawLabel, ...rest] = line.split(separator);
    const label = rawLabel.includes('#')
      ? rawLabel.replace(/^.*#[^\s#]+\s+/u, '').trim()
      : rawLabel.trim();
    const value = rest.join(separator).trim();

    if (!label || !value) continue;

    items.push({ label, value });
  }

  return { hashtags, items };
}

function CaseCreator({ onLogout }: { onLogout: () => Promise<void> }) {
  const [text, setText] = useState(sampleCaseText);
  const [result, setResult] = useState<ParsedCase | null>(null);
  const [busy, setBusy] = useState(false);

  function handleProcess() {
    setResult(parseCaseText(text));
  }

  function handleClear() {
    setText('');
    setResult(null);
  }

  async function handleLogout() {
    setBusy(true);
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
          <h2 className="card-title">ثبت کیس جدید</h2>
        </div>
        <Link className="ghost-link ghost-button" to="/admin">
          بازگشت به داشبورد
        </Link>
      </div>

      <div className="field">
        <label htmlFor="case-text">متن کیس</label>
        <textarea
          id="case-text"
          className="case-textarea"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="متن را اینجا قرار دهید..."
        />
      </div>

      <div className="admin-actions">
        <button className="button" type="button" onClick={handleProcess} disabled={busy || !text.trim()}>
          پردازش
        </button>
        <button className="button button-secondary" type="button" onClick={handleClear} disabled={busy}>
          پاک کردن
        </button>
      </div>

      <div className="result-block">
        <p className="label">خروجی استخراج‌شده</p>
        {result ? (
          <div className="result-list">
            <ResultGroup title="هشتگ‌ها" items={result.hashtags.map((item) => ({ label: '', value: item }))} />
            <ResultGroup title="فیلدها" items={result.items} />
          </div>
        ) : (
          <div className="notice">برای نمایش نتیجه، روی دکمه «پردازش» بزنید.</div>
        )}
      </div>

      <button className="button button-secondary" type="button" onClick={handleLogout} disabled={busy}>
        {busy ? 'در حال خروج...' : 'خروج از حساب'}
      </button>
    </div>
  );
}

function ResultGroup({ title, items }: { title: string; items: ParsedItem[] }) {
  return (
    <div className="result-group">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={`${item.label}-${item.value}-${title}`}>
            {item.label ? <strong>{item.label}</strong> : null}
            <span>{item.value}</span>
          </li>
        ))}
      </ul>
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
      ) : authenticated && isCasePage ? (
        <CaseCreator onLogout={handleLogout} />
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
            <Link className="button button-secondary admin-link-button" to="/admin/new-case">
              ثبت کیس جدید
            </Link>
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
