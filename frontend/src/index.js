import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Load IBM Plex Mono from Google Fonts
const link = document.createElement('link');
link.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700;800&display=swap';
link.rel = 'stylesheet';
document.head.appendChild(link);

document.body.style.margin = '0';
document.body.style.padding = '0';
document.body.style.background = '#07090f';

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.log('SW failed:', err));
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);
