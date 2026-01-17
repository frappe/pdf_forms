import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

if (import.meta.env.DEV) {
  fetch('/api/method/doc_mapper.www.documents.get_context_for_dev', {
    method: 'POST',
  })
    .then(response => response.json())
    .then((values) => {
      const v = JSON.parse(values.message)
      // @ts-expect-error expected
      if (!window.frappe) window.frappe = {};

      // @ts-expect-error expected
      window.frappe.boot = v;
    })
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
