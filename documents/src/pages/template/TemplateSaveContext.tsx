import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/**
 * Lets the page-level template header own the Save button while the form it
 * submits lives deep inside a tab (FieldsTable's react-hook-form). The form
 * registers a save handle on mount; the header renders a Save button whenever
 * a handle is registered, and hides it when the owning tab unmounts.
 */
export interface TemplateSaveHandle {
    /** Submits the owning form (already wrapped in react-hook-form validation). */
    save: () => void
    /** True while the save request is in flight. */
    saving: boolean
    /** True when the form has unsaved changes. */
    dirty: boolean
}

interface TemplateSaveContextValue {
    handle: TemplateSaveHandle | null
    setHandle: (handle: TemplateSaveHandle | null) => void
}

const TemplateSaveContext = createContext<TemplateSaveContextValue | null>(null)

export const TemplateSaveProvider = ({ children }: { children: ReactNode }) => {
    const [handle, setHandle] = useState<TemplateSaveHandle | null>(null)
    const value = useMemo(() => ({ handle, setHandle }), [handle])
    return <TemplateSaveContext.Provider value={value}>{children}</TemplateSaveContext.Provider>
}

/** Read the currently registered save handle (null when no form is mounted). */
export const useTemplateSaveHandle = (): TemplateSaveHandle | null =>
    useContext(TemplateSaveContext)?.handle ?? null

/**
 * Register (and keep up to date) the save handle for the mounted form.
 * Pass a memoized handle — a new object identity every render would loop.
 */
export const useRegisterTemplateSave = (handle: TemplateSaveHandle) => {
    const setHandle = useContext(TemplateSaveContext)?.setHandle
    useEffect(() => {
        if (!setHandle) return
        setHandle(handle)
        return () => setHandle(null)
    }, [setHandle, handle])
}
