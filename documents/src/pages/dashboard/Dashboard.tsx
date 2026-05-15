import { useDebounce } from "@/hooks/useDebounce"
import { usePaginationWithDoctype } from "@/hooks/usePagination"
import { useFrappeDocTypeEventListener, useFrappeEventListener, useFrappeGetDocList, useFrappePostCall } from "frappe-react-sdk"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import ErrorBanner from "@/components/ui/error-banner"
import { Plus, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Filter } from "frappe-react-sdk"
import type { FormTemplate } from "@/types/FormPrinter/FormTemplate"
import { FormTemplateTable } from "./FormTemplateTable"
import { AddFormTemplateDialog } from "./AddFormTemplateDialog"
import _ from "@/lib/translate"
import { getErrorMessages } from "@/lib/frappe"

export const Dashboard = () => {

    const [isOpen, setOpen] = useState<boolean>(false)
    const [idFilter, setIdFilter] = useState<string>("")
    const [sourceFilter, setSourceFilter] = useState<string>("")
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

    const { call: deleteItems, loading: deleteLoading, error: deleteError, reset: resetDeleteError } =
        useFrappePostCall('frappe.desk.reportview.delete_items')

    useEffect(() => {
        if (deleteConfirmOpen) {
            resetDeleteError()
        }
    }, [deleteConfirmOpen, resetDeleteError])

    const onOpen = () => {
        setOpen(true)
    }

    const onClose = () => {
        setOpen(false)
    }

    const debouncedIdFilter = useDebounce(idFilter, 500)
    const debouncedSourceFilter = useDebounce(sourceFilter, 500)


    // Build base filters (without pagination filter)
    const baseFilters: Filter[] = []
    if (debouncedIdFilter) {
        baseFilters.push(['name', 'like', `%${debouncedIdFilter}%`])
    }
    if (debouncedSourceFilter) {
        baseFilters.push(['source', 'like', `%${debouncedSourceFilter}%`])
    }

    const { count, start, selectedPageLength, setPageLength, filter } = usePaginationWithDoctype('Form Template', 20, baseFilters.length > 0 ? baseFilters : undefined)

    // Build complete filters array including pagination filter
    const buildFilters = (): Filter[] | undefined => {
        const filters: Filter[] = [...baseFilters]
        
        // Also include the existing filter from pagination hook if it exists
        if (filter) {
            filters.push(['name', 'like', `%${filter}%`])
        }

        return filters.length > 0 ? filters : undefined
    }

    const { data, error, mutate, isLoading } = useFrappeGetDocList<FormTemplate>('Form Template', {
        fields: ["name", "template_name", "description", "source", "owner", "creation", "is_pdf_converted", "modified", "modified_by"],
        orderBy: {
            field: "creation",
            order: "desc"
        },
        limit: selectedPageLength,
        limit_start: start ? start - 1 : 0,
        filters: buildFilters()
    })

    useFrappeEventListener('form_template_process_completed', (eventData) => {
        if (data?.some(item => item.name === eventData.form_template_id)) {
            mutate();
        }

    })

    useFrappeDocTypeEventListener('Form Template', () => {
        mutate()
    })

    const handleClose = (refresh?: boolean) => {
        if (refresh) {
            mutate()
            onClose()
        } else {
            onClose()
        }
    }

    const handleLoadMore = () => {
        setPageLength(selectedPageLength + selectedPageLength)
    }

    const confirmBulkDelete = () => {
        const items = [...selectedRows]
        if (items.length === 0) return

        deleteItems({
            doctype: 'Form Template',
            // Match desk list BulkOperations: array is JSON-stringified in form requests
            items: JSON.stringify(items),
        }).then((res) => {
            if (res?._server_messages) {
                const errorMessages = getErrorMessages(res)
                toast.error((errorMessages.map((error) => error.message).join("\n")))
            }
            else {
                const n = items.length
                toast.success(
                    n > 10
                        ? _(`Deletion of ${n} template${n === 1 ? '' : 's'} has been queued.`)
                        : n === 1
                            ? _("Template deleted")
                            : _(`${n} templates deleted`),
                )
                setSelectedRows(new Set())
                setDeleteConfirmOpen(false)
                void mutate()
            }
        })
            .catch((err: unknown) => {
                toast.error(_("Could not delete templates"))
                console.error(err)
            })
    }

    const hasMoreData = count ? selectedPageLength < count : false
    const pageLengthOptions = [20, 100, 500, 2500]

    return (
        <div className="flex flex-col h-screen gap-4 px-6">
            {/* Header */}
            <div className="flex items-center justify-between  py-4 border-b">
                <h1 className="text-xl font-semibold">Form Template</h1>
                <Button onClick={onOpen} variant="solid" theme="gray" size="md" title={_("Add Form Template")}>
                    <Plus className="size-4" />
                    {_("Add Form Template")}
                </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center w-full gap-3 justify-between">
                <div className="flex items-center gap-3 shrink-0">
                    <Input
                        type="text"
                        placeholder={_("ID")}
                        value={idFilter}
                        onChange={(e) => setIdFilter(e.target.value)}
                        className="min-w-xs"
                    />
                    <Input
                        type="text"
                        placeholder={_("Source")}
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value)}
                        className="min-w-xs"
                    />
                </div>
                {selectedRows.size > 0 && (
                    <div className="flex justify-end w-full">
                        <Button
                            type="button"
                            variant="solid"
                            theme="red"
                            size="md"
                            onClick={() => setDeleteConfirmOpen(true)}
                            title={_("Delete templates")}
                        >
                            <Trash2 className="size-4" />
                            {_("Delete")}
                        </Button>
                    </div>
                )}
            </div>

            {error && <ErrorBanner error={error} />}
            <div className="flex-1 overflow-hidden flex flex-col">
                <FormTemplateTable
                    data={data ?? []}
                    count={count}
                    currentCount={data?.length ?? 0}
                    isLoading={isLoading}
                    selectedRows={selectedRows}
                    onSelectedRowsChange={setSelectedRows}
                />
            </div>

            <AddFormTemplateDialog isOpen={isOpen} onClose={handleClose} />

            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{_("Delete templates")}</AlertDialogTitle>
                    </AlertDialogHeader>
                    <div className="space-y-4">
                        {deleteError && <ErrorBanner error={deleteError} />}
                        <AlertDialogDescription>
                            {_(`Delete ${selectedRows.size} selected template
                            ${selectedRows.size === 1 ? '' : 's'}? This cannot be undone.`)}
                        </AlertDialogDescription>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel variant={"ghost"} disabled={deleteLoading}>{_("Cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={deleteLoading}
                            onClick={(e) => {
                                e.preventDefault()
                                confirmBulkDelete()
                            }}
                        >
                            {deleteLoading ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    {_("Deleting...")}
                                </>
                            ) : (
                                    _("Delete")
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Sticky Pagination */}
            <div className="sticky bottom-0 bg-surface-white border-t border-outline-gray-2 py-3 flex items-center justify-between z-10">
                {/* Page Length Selector */}
                <div className="flex items-center gap-0 border border-outline-gray-2 rounded-md overflow-hidden">
                    {pageLengthOptions.map((option, index) => {
                        const isSelected = selectedPageLength === option
                        const isFirst = index === 0
                        const isLast = index === pageLengthOptions.length - 1

                        return (
                            <Button
                                key={option}
                                variant={isSelected ? 'subtle' : 'ghost'}
                                theme="gray"
                                size="sm"
                                onClick={() => setPageLength(option)}
                                className={(
                                    [
                                        'h-8 px-3 rounded-none border-0 border-e border-outline-gray-2 last:border-e-0',
                                        isFirst ? 'rounded-s-md' : '',
                                        isLast ? 'rounded-e-md' : '',
                                    ].filter(Boolean).join(' ')
                                )}
                            >
                                {option}
                            </Button>
                        )
                    })}
                </div>

                {/* Load More Button */}
                {hasMoreData && (
                    <Button
                        title="Load more templates"
                        onClick={handleLoadMore}
                        variant="outline"
                        theme="gray"
                        size="md"
                    >
                        {_("Load More")}
                    </Button>
                )}
            </div>
        </div>
    )
}
