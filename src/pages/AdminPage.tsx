import { FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function AdminPage() {
  const { configured, loading, user, accessToken, login, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const authenticated = Boolean(user);

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
        <h1 className="page-title">ورود و پروفایل</h1>
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

          <button className="button button-secondary" type="button" onClick={handleLogout} disabled={submitting}>
            {submitting ? 'در حال خروج...' : 'خروج از حساب'}
          </button>
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
