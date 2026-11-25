import { useState } from 'react';
import { AdminPanel } from './components/AdminPanel';

const TOKEN_KEY = 'cinevault_admin_token';

export default function App() {
  const [adminToken, setAdminTokenState] = useState<string | null>(() => {
    try {
      return window.sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });

  const handleSetAdminToken = (token: string | null) => {
    setAdminTokenState(token);
    try {
      if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
      else window.sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore storage errors
    }
  };

  return <AdminPanel adminToken={adminToken} onSetAdminToken={handleSetAdminToken} />;
}
