import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import ErrorBanner from '@/components/ui/error-banner'
import { useAnnotationFocus } from '@/hooks/useAnnotationFocus'
import type { Annotation, AnnotationBodyElement } from '@/types/Annotation'
import type { FormTemplate } from '@/types/FormPrinter/FormTemplate'
import type { FormTemplateImage } from '@/types/FormPrinter/FormTemplateImage'
import { useFrappeGetCall, useFrappeGetDoc, useFrappePostCall, useSWRConfig } from 'frappe-react-sdk'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { ImageAnnotator } from './ImageAnnotator'
import { AnnotationDeleteModal } from './AnnotationDeleteModal'
import { AnnotationSyncState } from './AnnotationSyncState'

interface GetTemplateFieldResponse {
    name: string,
    value: string,
    source: string,
    page_index: number,
    form_template_image: string
    annotation_type: string,
    field_name: string,
    field_label: string,
}
// We only store annotation layout detail changes. Rest is combined from server data.
export interface TemplateUnsavedAnnotation {
    form_template_image: string,
    source: string,
    id: string,
    page_index: number,
    value: string,
    form_template_id: string,
}

interface AnnotatorProps {
    templateID: string
}
export const Annotator = ({ templateID }: AnnotatorProps) => {

    //Queue to maintain annotation changes
    const [unsavedAnnotations, setUnsavedAnnotations] = useState<TemplateUnsavedAnnotation[]>([])
    const { call, loading } = useFrappePostCall<void>('form_printer.form_printer.doctype.form_template_field.form_template_field.update_annotation')

    /** Fetch form template images */
    const { data: formTemplate, error } = useFrappeGetDoc<FormTemplate>('Form Template', templateID)
    const templateImages = useMemo<FormTemplateImage[]>(
        () => [...(formTemplate?.form_template_image ?? [])].sort((a, b) => a.page_index - b.page_index),
        [formTemplate?.form_template_image]
    )

    const { data: annotations, mutate } = useFrappeGetCall<{ message: GetTemplateFieldResponse[] }>('form_printer.form_printer.doctype.form_template_field.form_template_field.get_annotations', {
        form_template_id: templateID
    }, ['form_template_annotations', templateID])

    const { mutate: globalMutate } = useSWRConfig()

    const addToAnnotationUpdateQueue = useCallback((annotation: Annotation, pageIndex: number) => {

        const annotationObject = {
            form_template_image: templateImages?.[pageIndex]?.id ?? '',
            source: annotation.target.source,
            id: annotation.id,
            form_template_id: templateID,
            page_index: pageIndex,
            value: annotation.target.selector.value
        }

        const annotationIndexInQueue = unsavedAnnotations.findIndex(a => a.id === annotation.id)
        if (annotationIndexInQueue === -1) {
            setUnsavedAnnotations([...unsavedAnnotations, annotationObject])
        } else {
            const newAnnotationUpdateQueue = [...unsavedAnnotations]
            newAnnotationUpdateQueue[annotationIndexInQueue] = annotationObject
            setUnsavedAnnotations(newAnnotationUpdateQueue)
        }

    }, [unsavedAnnotations, templateImages, templateID])

    const uploadToDatabase = async () => {
        return call({
            'form_template_id': templateID,
            'annotations': unsavedAnnotations
        })
            .then(() => {
                setUnsavedAnnotations([])
                return mutate()
            })
            .then(() => {
                return
            })
    }
    // If there are any changes, send a request to the server
    useEffect(() => {

        const uploadToDatabase = async () => {
            return call({
                'form_template_id': templateID,
                'annotations': unsavedAnnotations
            })
                .then(() => {
                    setUnsavedAnnotations([])
                    return mutate()
                })

        }
        // @ts-expect-error NodeJS.Timer is not defined in the browser
        let timeout: null | NodeJS.Timer = null;
        if (unsavedAnnotations.length > 0) {
            // console.log("Pushing updates to the server after 10 seconds of inactivity")
            timeout = setInterval(uploadToDatabase, 10000)
        }

        return () => {
            // console.log("Clearing timeout")
            if (timeout) clearInterval(timeout)
        }
    }, [unsavedAnnotations, templateID, call, mutate])

    const { focusedAnnotation, onAnnotationClick, setFocusedAnnotation } = useAnnotationFocus(templateID)

    const [deleteAnnotationID, setDeleteAnnotationID] = useState<string | null>(null)

    const deleteAnnotationModalClose = useCallback(() => {
        setDeleteAnnotationID(null)
        mutate()
        globalMutate('form_template_fields')
    }, [mutate, setDeleteAnnotationID, globalMutate])

    const parsedAnnotations: Record<number, Annotation[]> = useMemo(() => {

        const annotationPages: Record<number, Annotation[]> = {}

        if (annotations) {
            annotations.message.forEach(a => {
                if (a.name !== deleteAnnotationID) {
                    if (!annotationPages[a.page_index]) {
                        annotationPages[a.page_index] = []
                    }
                    const body: AnnotationBodyElement = {
                        type: "TextualBody",
                        value: a.annotation_type === 'Auto' ? 'Auto' : 'Manual',
                        purpose: "tagging"
                    }
                    annotationPages[a.page_index].push({
                        id: a.name,
                        "type": "Annotation",
                        "@context": "http://www.w3.org/ns/anno.jsonld",
                        body: [body],
                        target: {
                            source: a.source,
                            selector: {
                                type: "FragmentSelector",
                                value: a.value,
                                "conformsTo": "http://www.w3.org/TR/media-frags/",
                            }
                        }
                    })
                }
            })
        }
        if (unsavedAnnotations.length) {
            unsavedAnnotations.forEach((a) => {
                if (a.id !== deleteAnnotationID) {
                    if (!annotationPages[a.page_index]) {
                        annotationPages[a.page_index] = []
                    }
                    //If unsaved annotation exists, we need to merge. Else we need to push
                    const existingAnnotationIndex = annotationPages[a.page_index].findIndex(ann => ann.id === a.id)
                    if (existingAnnotationIndex === -1) {
                        annotationPages[a.page_index].push({
                            "@context": "http://www.w3.org/ns/anno.jsonld",
                            "type": "Annotation",
                            "body": [
                                {
                                    "type": "TextualBody",
                                    "purpose": "tagging",
                                    "value": "Untagged"
                                }
                            ],
                            id: a.id,
                            target: {
                                source: a.source,
                                selector: {
                                    type: 'FragmentSelector',
                                    value: a.value,
                                    "conformsTo": "http://www.w3.org/TR/media-frags/",
                                }
                            }
                        })
                    } else {
                        annotationPages[a.page_index][existingAnnotationIndex] = {
                            ...annotationPages[a.page_index][existingAnnotationIndex],
                            target: {
                                source: a.source,
                                selector: {
                                    type: 'FragmentSelector',
                                    value: a.value,
                                    "conformsTo": "http://www.w3.org/TR/media-frags/",
                                }
                            }
                        }
                    }
                }
            })
        }
        return annotationPages
    }, [unsavedAnnotations, annotations, deleteAnnotationID])

    const focusedAnnotationWithPageIndex = useMemo(() => {
        if (focusedAnnotation && annotations) {
            const a = annotations?.message.find(a => a.name === focusedAnnotation)
            if (a) {
                return {
                    annotation: focusedAnnotation,
                    pageIndex: a.page_index
                }
            }
        }
        return undefined
    }, [focusedAnnotation, annotations])

    const annotationLabels = useMemo(() => {
        const m: Record<string, { field_label?: string; field_name?: string }> = {}
        annotations?.message?.forEach((a) => {
            m[a.name] = { field_label: a.field_label, field_name: a.field_name }
        })
        return m
    }, [annotations])

    if (templateImages && templateImages.length) {
        return (
            <>
                <ImageAnnotator
                    images={templateImages}
                    annotationToFocus={focusedAnnotationWithPageIndex}
                    onAnnotationClick={onAnnotationClick}
                    onAnnotationUpdate={addToAnnotationUpdateQueue}
                    annotations={parsedAnnotations}
                    annotationLabels={annotationLabels}
                    id={`osd-form-template-${templateID}`}
                    setFocusedAnnotation={setFocusedAnnotation}
                    onAnnotationDelete={setDeleteAnnotationID}
                    backTo={
                        import.meta.env.VITE_DESK_FORM_TEMPLATE_LIST_URL?.trim() ||
                        `${String(import.meta.env.VITE_FRAPPE_PATH ?? '').replace(/\/$/, '')}/app/list/${encodeURIComponent('Form Template')}/List`
                    }
                    backLabel="Back to Desk"
                    backToExternal
                    customButtons={<>
                        <AnnotationSyncState
                            hasUnsavedChanges={unsavedAnnotations.length > 0}
                            forceUpdate={uploadToDatabase}
                            syncing={loading} />
                    </>} />
                <AnnotationDeleteModal annotationID={deleteAnnotationID} templateID={templateID} onClose={deleteAnnotationModalClose} />
            </>
        )
    }

    if (templateImages && templateImages.length === 0) {
        // return <Center m='4'><AlertBanner status='warning' heading='We did not find any images.'>This can happen if the PDF file is still being converted to images. Please try again later.</AlertBanner></Center>
        return <div className='flex flex-col items-center justify-center w-full h-full'>
            <Alert variant='default'>
                <AlertTitle>
                    We did not find any images.
                </AlertTitle>
                <AlertDescription>
                    This can happen if the PDF file is still being converted to images. Please try again later.
                </AlertDescription>
            </Alert>
        </div>
    }

    if (error) {
        // return <Center m='4'><AlertBanner status='error' heading='There was an error while loading the images.'>{error.httpStatusText} [{error.httpStatus}]</AlertBanner></Center>
        return <ErrorBanner error={error} />
    }

    return null
}