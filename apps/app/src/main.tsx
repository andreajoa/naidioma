import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import './index.css';

const isStandaloneAdminDashboard =
  typeof window !== 'undefined' &&
  (window.location.pathname === '/dashboard' || window.location.pathname.startsWith('/dashboard/'));

const AdminDashboard = lazy(() => import('./components/dashboard/AdminDashboard'));
const StudentApp = lazy(() => import('./App').then((m) => ({ default: m.App })));

if (isStandaloneAdminDashboard && 'serviceWorker' in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then((regs) => Promise.all(regs.map((r) => r.update().catch(() => {}))))
    .catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-[#FFFBF5] text-[#1E1A1D] flex items-center justify-center p-6 font-mono-code text-xs">
          {isStandaloneAdminDashboard ? 'Carregando Painel Admin NAidioma...' : 'Carregando NAidioma...'}
        </div>
      }
    >
      {isStandaloneAdminDashboard ? <AdminDashboard /> : <StudentApp />}
    </Suspense>
  </StrictMode>,
);
