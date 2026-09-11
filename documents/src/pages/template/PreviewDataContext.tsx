import { useFrappePostCall } from 'frappe-react-sdk'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { web_url } from '@config/socket'

/** How a single field would print — mirrors the printer, not just its text. */
export type PreviewFieldValue =
    | {
        kind: 'text'
        text: string
        /** Family bucket (helvetica / times-roman / courier ...) for the CSS fallback stack. */
        font: string
        /** Effective size in page-image pixels, ready to scale with the viewer. */
        font_size_px: number
        /** The font the PDF's own /DA names for this field, when it governs. */
        font_name?: string
        /** True when the PDF embeds that font's program, so the preview can draw with the real one. */
        embedded?: boolean
        bold?: boolean
        italic?: boolean
        /** Number of cells when the field is a comb (one character per box). */
        comb?: number
    }
    | { kind: 'check'; checked: boolean }
    /** A signature or an attached picture, shown as the image itself. */
    | { kind: 'image'; src: string }

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
    /** Declared /DA font name -> CSS family registered from the PDF's own embedded program. */
    fonts: Record<string, string>
    loading: boolean
    /** Pass null data to turn the preview off. */
    setPreviewDocument: (docName: string | null, data: Record<string, unknown> | null) => void
}

const PreviewDataContext = createContext<PreviewDataContextValue | null>(null)

export const PreviewDataProvider = ({ templateID, children }: { templateID: string; children: ReactNode }) => {
    const [docName, setDocName] = useState<string | null>(null)
    const [values, setValues] = useState<Record<string, PreviewFieldValue>>({})
    const [fonts, setFonts] = useState<Record<string, string>>({})

    // Fonts the PDF embeds are fetched once and registered as web fonts, so the
    // overlay renders Lora as Lora rather than as the nearest system sans.
    // Failure just leaves the CSS stack in place.
    useEffect(() => {
        const wanted = new Set<string>()
        for (const v of Object.values(values)) {
            if (v.kind === 'text' && v.embedded && v.font_name && !fonts[v.font_name]) wanted.add(v.font_name)
        }
        if (!wanted.size || typeof FontFace === 'undefined') return
        let cancelled = false
        for (const name of wanted) {
            const family = `pdfforms-${name.replace(/[^A-Za-z0-9_-]/g, '')}`
            const url = `${web_url}/api/method/pdf_forms.api.print.get_template_font?template_id=${encodeURIComponent(templateID)}&font_name=${encodeURIComponent(name)}`
            fetch(url, { credentials: 'include' })
                .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
                .then((buf) => new FontFace(family, buf).load())
                .then((face) => {
                    if (cancelled) return
                    document.fonts.add(face)
                    setFonts((prev) => ({ ...prev, [name]: family }))
                })
                .catch(() => undefined)
        }
        return () => { cancelled = true }
    }, [values, fonts, templateID])

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
        () => ({ docName, values, fonts, loading, setPreviewDocument }),
        [docName, values, fonts, loading, setPreviewDocument],
    )

    return <PreviewDataContext.Provider value={value}>{children}</PreviewDataContext.Provider>
}

export const usePreviewData = (): PreviewDataContextValue => {
    const context = useContext(PreviewDataContext)
    return (
        context ?? {
            docName: null,
            values: {},
            fonts: {},
            loading: false,
            setPreviewDocument: () => undefined,
        }
    )
}
