import { memo } from "react"
import { Link } from "react-router-dom"
import { Checkbox } from "@components/ui/checkbox"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@components/ui/table"
import { FileText, Loader2 } from "lucide-react"
import type { FormTemplate } from "@types/FormPrinter/FormTemplate"
import { convertFrappeDateStringToTimeAgo } from "@lib/dateConversions"
import { Skeleton } from "@components/ui/skeleton"
import _ from "@lib/translate"

interface FormTemplateTableProps {
    data: FormTemplate[]
    count?: number
    currentCount: number
    isLoading?: boolean
    selectedRows: Set<string>
    onSelectedRowsChange: (rows: Set<string>) => void
}

export const FormTemplateTable = memo(({ data, count, currentCount, isLoading, selectedRows, onSelectedRowsChange }: FormTemplateTableProps) => {
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
                    <TableRow>
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
                        <TableHead className="text-end">
                            <div className="flex items-center justify-end gap-2">
                                {count !== undefined && (
                                    <span className="text-xs font-normal text-ink-gray-5">
                                        {currentCount} {_("of")} {count >= 1000 ? `${Math.floor(count / 1000)}K+` : count}
                                    </span>
                                )}
                            </div>
                        </TableHead>
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
                        <TableRow>
                            <TableCell
                                colSpan={6}
                                className="h-24 text-center text-ink-gray-5"
                            >
                                    {_("No results.")}
                            </TableCell>
                        </TableRow>
                    ) : (
                        data.map((row) => (
                            <TableRow
                                key={row.name}
                                data-state={selectedRows.has(row.name) ? "selected" : undefined}
                                className="h-9"
                            >
                                <TableCell>
                                    <Checkbox
                                        checked={selectedRows.has(row.name)}
                                        onCheckedChange={() => toggleRowSelection(row.name)}
                                    />
                                </TableCell>

                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <FileText className="size-4 text-ink-gray-5" />
                                        <Link
                                            to={`/template/${row.name}`}
                                            className="font-medium text-ink-gray-8 underline hover:text-ink-blue-3"
                                        >
                                            {row.template_name || row.name}
                                        </Link>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {row.description
                                        ? (row.description.length > 50
                                            ? `${row.description.substring(0, 50)}...`
                                            : row.description)
                                        : "-"}
                                </TableCell>

                                <TableCell>
                                    <span
                                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${row.is_pdf_converted
                                            ? "bg-surface-green-2 text-ink-green-4"
                                            : "bg-surface-gray-2 text-ink-gray-6"
                                            }`}
                                    >
                                        {row.is_pdf_converted ? (
                                            "Converted"
                                        ) : row.process_completed === 0 ? (
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="size-3 text-ink-blue-3 animate-spin" />
                                                    <span className="text-ink-gray-5 text-xs">{_("Processing template...")}</span>
                                            </div>
                                        ) : row.process_completed === 1 && !row.is_pdf_converted ? (
                                                    _("Conversion failed")
                                        ) : null}
                                    </span>
                                </TableCell>

                                <TableCell>
                                    {row.source || "-"}
                                </TableCell>

                                <TableCell className="text-end">
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
