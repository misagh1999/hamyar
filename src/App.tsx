import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CaseDetailPage } from './pages/CaseDetailPage';
import { HomePage } from './pages/HomePage';
import { AdminPage } from './pages/AdminPage';
import { AdminCasesPage } from './pages/AdminCasesPage';
import { AdminCaseEditPage } from './pages/AdminCaseEditPage';

function Shell() {
  const location = useLocation();
  const showBackLink = location.pathname !== '/';

  return (
    <div className="app-scaffold">
      <div className="app-frame">
        <main className="app-surface">
          {showBackLink ? (
            <div className="topbar">
              <Link className="ghost-link" to="/">
                بازگشت به صفحه اصلی
              </Link>
            </div>
          ) : null}

          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/cases/:caseCode" element={<CaseDetailPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/cases" element={<AdminCasesPage />} />
            <Route path="/admin/cases/:caseCode" element={<AdminCaseEditPage />} />
            <Route path="/admin/new-case" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </BrowserRouter>
  );
}
