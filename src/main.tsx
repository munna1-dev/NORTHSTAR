import './styles/northstar-brand.css';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './styles/northstar-ui-overrides.css';
import './styles/customer-portal-professional.css';

import './styles/customer-portal-final-fix.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
