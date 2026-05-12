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
      const v = JSON.parse(values.message)
      if (!window.frappe) window.frappe = {}
      window.frappe.boot = v
      window.frappe._messages = v["__messages"] as Record<string, string>
      const boot = window.frappe.boot
      if (boot?.docs && window.frappe.model) {
        window.frappe.model.sync(boot.docs)
      }
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
  const boot = window.frappe?.boot
  if (boot?.docs && window.frappe?.model) {
    window.frappe.model.sync(boot.docs)
  }
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
