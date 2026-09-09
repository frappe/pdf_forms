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
import { PreviewDataProvider } from './PreviewDataContext'

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

/**
 * Mirrors the real editor layout element for element: breadcrumb strip, the
 * three-zone annotator toolbar, the five underline tabs, the search/filter
 * row, and the mapping table with its sticky page separator. Sizes are the
 * real components' sizes (icon buttons 28/32px, inputs 28px, header 32px,
 * rows 45px) so the page does not jump when the data lands.
 */
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
                    {/* Toolbar: [back · fullscreen │] ‹ page › [│ zoom in · zoom out] */}
                    <div className="flex h-10 shrink-0 items-center justify-between border-b border-outline-gray-2 bg-surface-gray-1 p-1">
                        <div className="flex flex-1 items-center justify-start gap-1">
                            <Skeleton className="size-8 rounded" />
                            <Skeleton className="size-8 rounded" />
                            <span className="mx-1 h-4 w-px shrink-0 bg-outline-gray-2" aria-hidden />
                        </div>
                        <div className="flex shrink-0 items-center">
                            <Skeleton className="size-8 rounded" />
                            <Skeleton className="mx-1 h-3.5 w-[68px]" />
                            <Skeleton className="size-8 rounded" />
                        </div>
                        <div className="flex flex-1 items-center justify-end gap-1">
                            <span className="mx-1 h-4 w-px shrink-0 bg-outline-gray-2" aria-hidden />
                            <Skeleton className="size-8 rounded" />
                            <Skeleton className="size-8 rounded" />
                        </div>
                    </div>
                    {/* Flush like the real OSD area — no inset, no rounding. */}
                    <div className="min-h-0 flex-1">
                        <Skeleton className="h-full w-full rounded-none" />
                    </div>
                </div>

                {/* Editor pane — px-4 and the h-10 tab strip mirror the real Tabs wrapper */}
                <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 lg:w-[56%] lg:flex-none">
                    {/* Underline tabs: Mapping Fields · Fields · Prompts · Style · Preview */}
                    <div className="flex h-10 shrink-0 items-center gap-5 border-b border-outline-gray-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-10" />
                        <Skeleton className="h-4 w-14" />
                    </div>
                    {/* Search · All/Unmapped chips ··· Auto-map · import · export — all 28px */}
                    <div className="flex shrink-0 items-center justify-between gap-2">
                        <div className="flex flex-1 items-center gap-4">
                            <Skeleton className="h-7 w-full max-w-[390px] rounded" />
                            <Skeleton className="h-7 w-36 shrink-0 rounded" />
                        </div>
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-7 w-[104px] rounded" />
                            <Skeleton className="size-7 rounded" />
                            <Skeleton className="size-7 rounded" />
                        </div>
                    </div>
                    {/* Table, with the mapping table's own column widths */}
                    <div className="min-h-0 flex-1 overflow-hidden pb-2">
                        {/* header: No. · Label · Field Type · Value Type · Value · actions */}
                        <div className="flex h-8 items-center border-b border-outline-gray-1">
                            <div className="w-11 shrink-0 px-2"><Skeleton className="h-3 w-5" /></div>
                            <div className="w-[30%] shrink-0 px-2"><Skeleton className="h-3 w-10" /></div>
                            <div className="w-28 shrink-0 px-2"><Skeleton className="h-3 w-16" /></div>
                            <div className="w-24 shrink-0 px-2"><Skeleton className="h-3 w-16" /></div>
                            <div className="min-w-0 flex-1 px-2"><Skeleton className="h-3 w-10" /></div>
                            <div className="w-20 shrink-0" />
                        </div>
                        {/* sticky page separator: "Page 1 · 25 fields · [n unmapped]" */}
                        <div className="flex h-7 items-center gap-2 bg-surface-gray-1 px-2">
                            <Skeleton className="h-3 w-12" />
                            <Skeleton className="h-3 w-14" />
                            <Skeleton className="h-4 w-20 rounded-full" />
                        </div>
                        {Array.from({ length: 9 }).map((_, i) => (
                            <div key={i} className="flex h-[45px] items-center border-b border-outline-gray-1">
                                <div className="w-11 shrink-0 px-2"><Skeleton className="h-3.5 w-5" /></div>
                                <div className="flex w-[30%] shrink-0 items-baseline gap-1.5 px-2">
                                    <Skeleton className="h-3.5 w-24" />
                                    <Skeleton className="h-3 w-16" />
                                </div>
                                <div className="w-28 shrink-0 px-2"><Skeleton className="h-3.5 w-8" /></div>
                                <div className="w-24 shrink-0 px-2"><Skeleton className="h-5 w-11 rounded-full" /></div>
                                <div className="min-w-0 flex-1 px-2"><Skeleton className="h-3.5 w-[60%]" /></div>
                                <div className="flex w-20 shrink-0 items-center justify-end gap-1 px-2">
                                    <Skeleton className="size-7 rounded" />
                                    <Skeleton className="size-7 rounded" />
                                </div>
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
                            <PreviewDataProvider templateID={templateID}>
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
                            </PreviewDataProvider>
                            </TemplateSaveProvider>
                ) : null}
            </>
        )
    }

    return null
}
