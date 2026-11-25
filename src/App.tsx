import { useState } from 'react';
import { AdminPanel } from './components/AdminPanel';

export default function App() {
  const [adminToken, setAdminToken] = useState<string | null>(null);

  return <AdminPanel adminToken={adminToken} onSetAdminToken={setAdminToken} />;
}
