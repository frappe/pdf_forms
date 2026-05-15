/// <reference types="vite/client" />

export {}

/** Minimal boot payload used by the Documents SPA inside Frappe / dev stub */
interface FrappeBoot {
  /** User Desk Theme: Light | Dark | Automatic (see frappe.sessions) */
  desk_theme?: 'Light' | 'Dark' | 'Automatic'
  docs?: unknown[]
  __messages?: Record<string, unknown>
  time_zone?: {
    system?: string
    user?: string
  }
  sysdefaults?: {
    date_format?: string
  }
  user?: {
    defaults?: {
      date_format?: string
    }
    can_read?: string[]
    can_write?: string[]
    can_create?: string[]
    can_delete?: string[]
    can_cancel?: string[]
    can_search?: string[]
    can_import?: string[]
    can_export?: string[]
    roles?: string[]
  }
}

/** Frappe client globals when mounted in Desk (or simulated in DEV) */
interface FrappeGlobals {
  boot?: FrappeBoot
  _messages?: Record<string, unknown>
  model?: {
    sync(docs: unknown): void
  }
}

declare global {
  interface Window {
    frappe?: FrappeGlobals
  }
  /** Global `frappe` is provided by Frappe Desk; dev mode assigns `window.frappe` */
  var frappe: FrappeGlobals
}
