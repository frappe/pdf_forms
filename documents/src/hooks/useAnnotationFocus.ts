import { useState, useEffect, useCallback } from 'react'
import sysend from 'sysend'

export const useAnnotationFocus = (templateID: string) => {

    const [focusedAnnotation, setFocusedAnnotation] = useState<string | null>(null)

    useEffect(() => {
        sysend.on(`template_${templateID}_annotation_focus`, (data: { annotation_id: string }) => {
            setFocusedAnnotation(data.annotation_id)
        })

        return () => {
            sysend.off(`template_${templateID}_annotation_focus`)
        }
    }, [templateID])

    const onAnnotationClick = useCallback((annotationID: string | null) => {
        setFocusedAnnotation(annotationID)
        sysend.emit(`template_${templateID}_annotation_focus`, { annotation_id: annotationID })
    }, [templateID])

    return {
        focusedAnnotation,
        onAnnotationClick,
        setFocusedAnnotation
    }

}