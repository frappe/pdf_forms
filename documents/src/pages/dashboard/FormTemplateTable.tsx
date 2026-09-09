import { memo } from "react"
import { useNavigate } from "react-router-dom"
import { Checkbox } from "@components/ui/checkbox"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@components/ui/table"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@components/ui/empty"
import { FileText, Loader2, Plus } from "lucide-react"
import { convertFrappeDateStringToTimeAgo } from "@lib/dateConversions"
import { Skeleton } from "@components/ui/skeleton"
import _ from "@lib/translate"
import type { FormTemplate } from "@/types/FormPrinter/FormTemplate"

interface FormTemplateTableProps {
    data: FormTemplate[]
    isLoading?: boolean
    /** True when no filters are applied — an empty result then means "no templates yet". */
    isUnfiltered?: boolean
    selectedRows: Set<string>
    onSelectedRowsChange: (rows: Set<string>) => void
    onAddNew?: () => void
}

const StatusBadge = ({ row }: { row: FormTemplate }) => {
    if (row.is_pdf_converted) {
        return <Badge theme="green">{_("Ready")}</Badge>
    }
    if (row.process_completed === 1) {
        return (
            <Badge
                theme="red"
                title={_("Something went wrong while converting the PDF. Open the template for details.")}
            >
                {_("Failed")}
            </Badge>
        )
    }
    return (
        <Badge theme="gray">
            <Loader2 className="size-2.5 animate-spin" />
            {_("Processing")}
        </Badge>
    )
}

export const FormTemplateTable = memo(({ data, isLoading, isUnfiltered, selectedRows, onSelectedRowsChange, onAddNew }: FormTemplateTableProps) => {
    const navigate = useNavigate()

    const toggleRowSelection = (id: string) => {
        const newSet = new Set(selectedRows)
        if (newSet.has(id)) {
            newSet.delete(id)
        } else {
            newSet.add(id)
        }
        onSelectedRowsChange(newSet)
    }

    const toggleSelectAll = (checked: boolean) => {
        if (checked) {
            onSelectedRowsChange(new Set(data.map(item => item.name)))
        } else {
            onSelectedRowsChange(new Set())
        }
    }

    const isAllSelected = data.length > 0 && selectedRows.size === data.length

    return (
        <div className="flex-1 overflow-auto pb-4">
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="w-12">
                            <Checkbox
                                checked={isAllSelected}
                                onCheckedChange={toggleSelectAll}
                            />
                        </TableHead>

                        <TableHead>{_("Template Name")}</TableHead>
                        <TableHead>{_("Description")}</TableHead>
                        <TableHead>{_("Status")}</TableHead>
                        <TableHead>{_("Source")}</TableHead>
                        <TableHead className="text-end">{_("Last Updated")}</TableHead>
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {isLoading && data.length === 0 ? (
                        Array.from({ length: 8 }).map((_, index) => (
                            <TableRow key={index} className="h-9">
                                <TableCell>
                                    <Checkbox disabled />
                                </TableCell>

                                <TableCell>
                                    <div className="flex items-start gap-2">
                                        <FileText className="size-4 text-ink-gray-5 mt-1" />

                                        <Skeleton className="h-4 w-52" />
                                    </div>
                                </TableCell>

                                <TableCell>
                                    <Skeleton className="h-4 w-64" />
                                </TableCell>

                                <TableCell>
                                    <Skeleton className="h-5 w-20 rounded-full" />
                                </TableCell>

                                <TableCell>
                                    <Skeleton className="h-4 w-24" />
                                </TableCell>

                                <TableCell className="text-end">
                                    <Skeleton className="h-4 w-16 ms-auto" />
                                </TableCell>
                            </TableRow>
                        ))
                    ) : data.length === 0 ? (
                        <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={6} className="whitespace-normal">
                                <Empty>
                                    <EmptyHeader>
                                        <EmptyMedia>
                                            <FileText />
                                        </EmptyMedia>
                                        <EmptyTitle>
                                            {isUnfiltered ? _("No form templates yet") : _("No results")}
                                        </EmptyTitle>
                                        <EmptyDescription>
                                            {isUnfiltered
                                                ? _("Upload a PDF, map its fields to your data, and print filled PDFs from any document.")
                                                : _("No templates match the current filters.")}
                                        </EmptyDescription>
                                    </EmptyHeader>
                                    {isUnfiltered && onAddNew && (
                                        <Button onClick={onAddNew} variant="solid" theme="gray" size="md">
                                            <Plus className="size-4" />
                                            {_("Add Form Template")}
                                        </Button>
                                    )}
                                </Empty>
                            </TableCell>
                        </TableRow>
                    ) : (
                        data.map((row) => (
                            <TableRow
                                key={row.name}
                                data-state={selectedRows.has(row.name) ? "selected" : undefined}
                                className="h-9 cursor-pointer"
                                onClick={() => navigate(`/template/${row.name}`)}
                            >
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                    <Checkbox
                                        checked={selectedRows.has(row.name)}
                                        onCheckedChange={() => toggleRowSelection(row.name)}
                                    />
                                </TableCell>

                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <FileText className="size-4 text-ink-gray-5" />
                                        <span className="font-medium text-ink-gray-8">
                                            {row.template_name || row.name}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-ink-gray-6">
                                    <span className="block max-w-[48ch] truncate" title={row.description || undefined}>
                                        {row.description || "-"}
                                    </span>
                                </TableCell>

                                <TableCell>
                                    <StatusBadge row={row} />
                                </TableCell>

                                <TableCell className="text-ink-gray-6">
                                    {row.source || "-"}
                                </TableCell>

                                <TableCell className="text-end text-ink-gray-5">
                                    {convertFrappeDateStringToTimeAgo(row.modified)}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    )
})

FormTemplateTable.displayName = "FormTemplateTable"
