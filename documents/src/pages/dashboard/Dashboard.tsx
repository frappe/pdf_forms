import { useDebounce } from "@/hooks/useDebounce"
import { usePaginationWithDoctype } from "@/hooks/usePagination"
import { useFrappeDocTypeEventListener, useFrappeEventListener, useFrappeGetDocList } from "frappe-react-sdk"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus } from "lucide-react"
import type { Filter } from "frappe-react-sdk"
import type { FormTemplate } from "@/types/FormPrinter/FormTemplate"
import ErrorBanner from "@/components/ui/error-banner"
import { FormTemplateTable } from "./FormTemplateTable"
import { AddFormTemplateDialog } from "./AddFormTemplateDialog"

export const Dashboard = () => {

    const [isOpen, setOpen] = useState<boolean>(false)
    const [idFilter, setIdFilter] = useState<string>("")
    const [sourceFilter, setSourceFilter] = useState<string>("")

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

    const hasMoreData = count ? selectedPageLength < count : false
    const pageLengthOptions = [20, 100, 500, 2500]

    return (
        <div className="flex flex-col h-screen gap-4 px-6">
            {/* Header */}
            <div className="flex items-center justify-between  py-4 border-b">
                <h1 className="text-xl font-semibold">Form Template</h1>
                <Button onClick={onOpen}>
                    <Plus className="size-4" />
                    Add Form Template
                </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 ">
                {/* ID Filter */}
                    <Input
                        type="text"
                        placeholder="ID"
                        value={idFilter}
                        onChange={(e) => setIdFilter(e.target.value)}
                    className="max-w-xs bg-gray-50 rounded-md"
                />

                {/* Source Filter */}
                    <Input
                        type="text"
                        placeholder="Source"
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value)}
                    className="max-w-xs bg-gray-50 rounded-md"
                />
            </div>

            {error && <ErrorBanner error={error} />}
            <div className="flex-1 overflow-hidden flex flex-col">
                <FormTemplateTable
                    data={data ?? []}
                    count={count}
                    currentCount={data?.length ?? 0}
                    isLoading={isLoading}
                />
            </div>

            <AddFormTemplateDialog isOpen={isOpen} onClose={handleClose} />

            {/* Sticky Pagination */}
            <div className="sticky bottom-0 bg-background border-t py-3 flex items-center justify-between z-10">
                {/* Page Length Selector */}
                <div className="flex items-center gap-0 border border-gray-200 rounded-md overflow-hidden">
                    {pageLengthOptions.map((option, index) => {
                        const isSelected = selectedPageLength === option
                        const isFirst = index === 0
                        const isLast = index === pageLengthOptions.length - 1

                        return (
                            <Button
                                key={option}
                                variant="ghost"
                                size="sm"
                                onClick={() => setPageLength(option)}
                                className={`h-8 px-3 rounded-none border-0 border-r border-gray-200 last:border-r-0 ${isSelected
                                        ? "bg-transparent hover:bg-gray-200"
                                        : "bg-gray-100 hover:bg-gray-200"
                                    } ${isFirst ? "rounded-l-md" : ""} ${isLast ? "rounded-r-md" : ""}`}
                            >
                                {option}
                            </Button>
                        )
                    })}
                </div>

                {/* Load More Button */}
                {hasMoreData && (
                    <Button
                        onClick={handleLoadMore}
                        variant="outline"
                        size="sm"
                        className="h-8"
                    >
                        Load More
                    </Button>
                )}
            </div>
        </div>
    )
}
