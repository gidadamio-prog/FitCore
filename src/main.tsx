import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false } },
});

// Service Worker manuell registrieren: kein erzwungenes Neuladen bei Aktivierung (würde laufende Eingaben verwerfen).
// Neue Versionen übernehmen per skipWaiting/clientsClaim und gelten ab dem nächsten Seitenaufruf.
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => undefined));
}

// Persistenten Speicher anfragen, damit der Browser lokale Daten nicht automatisch löscht.
navigator.storage?.persist?.().catch(() => undefined);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
