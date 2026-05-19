import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import './lib/namespace';
import { toast } from 'sonner';

if (import.meta.env.DEV) {
  fetch('/api/method/pdf_forms.www.pdf_forms.get_context_for_dev', {
    method: 'POST',
  })
    .then(response => response.json())
    .then((values) => {
      const v = values.message;
      const boot = typeof v === 'string' ? JSON.parse(v) : v;
      if (!window.frappe) window.frappe = {};
      frappe.boot = boot;
      //@ts-expect-error - frappe will be available
      frappe._messages = frappe.boot["__messages"];
      //@ts-expect-error - frappe will be available
      frappe.model.sync(frappe.boot.docs);
      createRoot(document.getElementById('root') as HTMLElement).render(
        <StrictMode>
          <App />
        </StrictMode>,
      )

    }).catch(error => {
      console.error(error)
      toast.error('Failed to fetch context for development')
    })

} else {
  //@ts-expect-error - frappe will be available
  frappe.model.sync(frappe.boot.docs);
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
