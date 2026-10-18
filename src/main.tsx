import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { EmpresaProvider } from './context/EmpresaContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EmpresaProvider>
      <App />
    </EmpresaProvider>
  </StrictMode>,
);

