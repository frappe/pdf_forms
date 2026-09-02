import { useParams } from 'react-router-dom'
import { Annotator } from './Annotator/Annotator'
import { DocumentForm } from './DocumentForm/DocumentForm'
import { useFrappeEventListener, useFrappeGetDoc } from 'frappe-react-sdk'
import ErrorBanner from '@components/ui/error-banner'
import { Skeleton } from '@components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert'
import { Button } from '@components/ui/button'
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@components/ui/breadcrumb'
import { useState } from 'react'
import _ from '@lib/translate'
import { TemplateSaveProvider, useTemplateSaveHandle } from './TemplateSaveContext'

/**
 * Save button for the page header. Rendered only while a form (the mapping
 * fields form) has registered a save handle.
 */
const TemplateSaveButton = () => {
    const handle = useTemplateSaveHandle()
    if (!handle) return null
    return (
        <Button
            size="sm"
            variant="solid"
            theme="gray"
            onClick={handle.save}
            loading={handle.saving}
            loadingText={_("Saving...")}
            title={handle.dirty ? _("You have unsaved changes") : _("Save")}
        >
            {_("Save")}
        </Button>
    )
}

/**
 * Desk list view for Form Template — same target as the annotator's back arrow.
 * A plain href on purpose: leaving the SPA for Desk needs a full page load
 * (react-router's basename would mangle /app/... routes).
 */
const DESK_FORM_TEMPLATE_LIST_URL =
    import.meta.env.VITE_DESK_FORM_TEMPLATE_LIST_URL?.trim() ||
    `${String(import.meta.env.VITE_FRAPPE_PATH ?? '').replace(/\/$/, '')}/app/list/${encodeURIComponent('Form Template')}/List`

/** Breadcrumb strip shown above the editor — the route back to the Desk list, plus page actions. */
const TemplateHeader = ({ templateName }: { templateName?: string }) => (
    <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-outline-gray-2 px-4">
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem>
                    <BreadcrumbLink href={DESK_FORM_TEMPLATE_LIST_URL}>
                        {_("Form Templates")}
                    </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    <BreadcrumbPage>{templateName || _("Template")}</BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
        <TemplateSaveButton />
    </div>
)

/** Mirrors the real editor layout: breadcrumb strip, annotator pane, tabs + toolbar + table. */
const ViewTemplateLoader = () => {
    return (
        <div className="flex h-screen flex-col overflow-hidden">
            {/* Breadcrumb strip + Save */}
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-outline-gray-2 px-4">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-28" />
                    <span className="text-ink-gray-3">/</span>
                    <Skeleton className="h-4 w-36" />
                </div>
                <Skeleton className="h-7 w-12 rounded" />
            </div>

            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                {/* Annotator pane — hidden on mobile, like the editor's default pane */}
                <div className="hidden min-h-0 flex-col border-r border-outline-gray-2 lg:flex lg:w-[44%]">
                    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-outline-gray-2 bg-surface-gray-1 px-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="size-7 rounded" />
                        ))}
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="ms-auto size-7 rounded" />
                    </div>
                    {/* Flush like the real OSD area — no inset, no rounding. */}
                    <div className="min-h-0 flex-1">
                        <Skeleton className="h-full w-full rounded-none" />
                    </div>
                </div>

                {/* Editor pane — px-4 and the h-10 tab strip mirror the real Tabs wrapper */}
                <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 lg:w-[56%] lg:flex-none">
                    {/* Underline tab strip — same 40px as the annotator toolbar */}
                    <div className="flex h-10 shrink-0 items-center gap-5 border-b border-outline-gray-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-10" />
                        <Skeleton className="h-4 w-14" />
                    </div>
                    {/* Toolbar — every control is 28px tall, like the real one */}
                    <div className="flex shrink-0 items-center gap-2">
                        <Skeleton className="h-7 flex-1 max-w-[340px] rounded" />
                        <Skeleton className="h-7 w-32 rounded" />
                        <Skeleton className="ms-auto h-7 w-24 rounded" />
                        <Skeleton className="size-7 rounded" />
                        <Skeleton className="size-7 rounded" />
                    </div>
                    {/* Table: header row + 49px rows with borders, like the mapping table */}
                    <div className="min-h-0 flex-1 overflow-hidden">
                        <div className="flex h-8 items-center gap-4 border-b border-outline-gray-1">
                            <Skeleton className="h-3 w-6" />
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-3 w-16" />
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="h-3 w-24" />
                        </div>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="flex h-[49px] items-center gap-4 border-b border-outline-gray-1">
                                <Skeleton className="h-4 w-6" />
                                <Skeleton className="h-4 w-28" />
                                <Skeleton className="h-4 w-10" />
                                <Skeleton className="h-8 w-24 rounded" />
                                <Skeleton className="h-8 flex-1 rounded" />
                                <Skeleton className="size-7 rounded" />
                                <Skeleton className="size-7 rounded" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export const ViewTemplate = () => {

    const { templateID } = useParams<{ templateID: string }>()
    const { data, error, isLoading, mutate } = useFrappeGetDoc('Form Template', templateID, templateID ? undefined : null)
    const [mobilePane, setMobilePane] = useState<'annotator' | 'editor'>('editor')

    useFrappeEventListener('form_template_process_completed', (eventData) => {
        if (data?.name === eventData.form_template_id) {
            mutate();
        }

    })

    if (error) {
        return <div className="flex items-center justify-center h-full">
            <ErrorBanner error={error} />
        </div>
    }


    if (isLoading) {
        return <ViewTemplateLoader />
    }


    if (templateID && data) {
        return (
            <>
                {data.process_completed === 0 && data.is_pdf_converted === 0 ? (
                    <div className="relative h-screen overflow-hidden">
                        <div className="pointer-events-none">
                            <ViewTemplateLoader />
                        </div>
                        <div className="absolute inset-0 bg-surface-gray-1/80" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <p className="text-lg font-medium text-ink-gray-5">{_("The document is still processing. Please wait.")}</p>
                        </div>
                    </div>
                ) : data.process_completed === 1 && data.is_pdf_converted === 0 ? (
                    <div className="flex items-center justify-center h-full p-4">
                        <Alert variant="subtle" theme="red" className="max-w-2xl">
                                <AlertTitle>{_("Issue with Form PDF")}</AlertTitle>
                            <AlertDescription>
                                    {_("Something went wrong while converting the PDF. Please check the uploaded file or inspect the background job to find the actual issue.")}
                            </AlertDescription>
                        </Alert>
                    </div>
                ) : data.process_completed === 1 && data.is_pdf_converted === 1 ? (
                            <TemplateSaveProvider>
                            {/* Fixed-viewport layout: the page never scrolls; each pane owns its scrolling. */}
                            <div className="flex h-screen flex-col overflow-hidden">
                                <TemplateHeader templateName={data.template_name} />
                                <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                                <div className="shrink-0 border-b border-outline-gray-2 bg-surface-base/95 p-2 backdrop-blur lg:hidden">
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            type="button"
                                            variant={mobilePane === 'annotator' ? 'solid' : 'outline'}
                                            theme="gray"
                                            onClick={() => setMobilePane('annotator')}
                                            title={_("PDF Annotator")}
                                        >
                                            {_("PDF Annotator")}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={mobilePane === 'editor' ? 'solid' : 'outline'}
                                            theme="gray"
                                            onClick={() => setMobilePane('editor')}
                                            title={_("Field Editor")}
                                        >
                                            {_("Field Editor")}
                                        </Button>
                                    </div>
                                </div>
                                <div className={`${mobilePane === 'editor' ? 'hidden' : 'block'} min-h-0 flex-1 overflow-hidden border-b lg:block lg:h-full lg:w-[44%] lg:flex-none lg:border-b-0 lg:border-r`}>
                                    <Annotator templateID={templateID} />
                                </div>
                                <div className={`${mobilePane === 'annotator' ? 'hidden' : 'block'} min-h-0 flex-1 overflow-hidden lg:block lg:h-full lg:w-[56%] lg:flex-none`}>
                                    <DocumentForm templateID={templateID} />
                                </div>
                                </div>
                            </div>
                            </TemplateSaveProvider>
                ) : null}
            </>
        )
    }

    return null
}
