import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { EmpresaProvider } from './context/EmpresaContext.tsx';
import './services/serpro/controleConsultasFiscoia.service';
import './services/murade/muradeSistemaCompleto.service';
import './services/murade/muradeConfigIntegracoes.service';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EmpresaProvider>
      <App />
    </EmpresaProvider>
  </StrictMode>,
);

