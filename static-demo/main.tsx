import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CampusDashboard } from '@/components/campus-dashboard';
import '@/app/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CampusDashboard />
  </StrictMode>,
);
