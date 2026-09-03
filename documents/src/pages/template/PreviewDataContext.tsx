import { useFrappePostCall } from 'frappe-react-sdk'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

/** How a single field would print — mirrors the printer, not just its text. */
export type PreviewFieldValue =
    | {
        kind: 'text'
        text: string
        /** Effective font, after any per-field style override. */
        font: string
        /** Effective size in page-image pixels, ready to scale with the viewer. */
        font_size_px: number
    }
    | { kind: 'check'; checked: boolean }

/**
 * Shares "what would this template print for document X" between the Preview
 * tab (which picks the document) and the annotator (which draws the values on
 * the page). Values come from the server's own print resolver, so the overlay
 * cannot drift from the generated PDF.
 */
interface PreviewDataContextValue {
    /** Document currently being previewed, or null when preview is off. */
    docName: string | null
    /** Form Template Field row name -> how that field would print. */
    values: Record<string, PreviewFieldValue>
    loading: boolean
    /** Pass null data to turn the preview off. */
    setPreviewDocument: (docName: string | null, data: Record<string, unknown> | null) => void
}

const PreviewDataContext = createContext<PreviewDataContextValue | null>(null)

export const PreviewDataProvider = ({ templateID, children }: { templateID: string; children: ReactNode }) => {
    const [docName, setDocName] = useState<string | null>(null)
    const [values, setValues] = useState<Record<string, PreviewFieldValue>>({})

    const { call, loading } = useFrappePostCall<{ message: Record<string, PreviewFieldValue> }>(
        'pdf_forms.api.print.get_preview_values'
    )

    const setPreviewDocument = useCallback(
        (name: string | null, data: Record<string, unknown> | null) => {
            setDocName(name)
            if (!name || !data) {
                setValues({})
                return
            }
            call({ template_id: templateID, data: JSON.stringify(data) })
                .then((res) => setValues(res?.message ?? {}))
                // A failed preview should just show nothing, never break the editor.
                .catch(() => setValues({}))
        },
        [call, templateID],
    )

    const value = useMemo(
        () => ({ docName, values, loading, setPreviewDocument }),
        [docName, values, loading, setPreviewDocument],
    )

    return <PreviewDataContext.Provider value={value}>{children}</PreviewDataContext.Provider>
}

export const usePreviewData = (): PreviewDataContextValue => {
    const context = useContext(PreviewDataContext)
    return (
        context ?? {
            docName: null,
            values: {},
            loading: false,
            setPreviewDocument: () => undefined,
        }
    )
}
