import { useState, memo } from "react"
import { Link } from "react-router-dom"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { FileText, Loader2 } from "lucide-react"
import type { FormTemplate } from "@/types/FormPrinter/FormTemplate"
import { convertFrappeDateStringToTimeAgo } from "@/lib/dateConversions"
import { Skeleton } from "@/components/ui/skeleton"

interface FormTemplateTableProps {
    data: FormTemplate[]
    count?: number
    currentCount: number
    isLoading?: boolean
}

export const FormTemplateTable = memo(({ data, count, currentCount, isLoading }: FormTemplateTableProps) => {
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

    const toggleRowSelection = (id: string) => {
        setSelectedRows(prev => {
            const newSet = new Set(prev)
            if (newSet.has(id)) {
                newSet.delete(id)
            } else {
                newSet.add(id)
            }
            return newSet
        })
    }

    const toggleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedRows(new Set(data.map(item => item.name)))
        } else {
            setSelectedRows(new Set())
        }
    }

    const isAllSelected = data.length > 0 && selectedRows.size === data.length

    return (
        <div className="flex-1 overflow-auto pb-4">
            <Table>
                <TableHeader className="rounded-md">
                    <TableRow className="bg-gray-100 border-b-transparent">
                        <TableHead className="w-12 px-4 rounded-l-md">
                            <Checkbox
                                checked={isAllSelected}
                                onCheckedChange={toggleSelectAll}
                            />
                        </TableHead>

                        <TableHead className="px-4 text-gray-700">Template Name</TableHead>
                        <TableHead className="px-4 text-gray-700">Description</TableHead>
                        <TableHead className="px-4 text-gray-700">Status</TableHead>
                        <TableHead className="px-4 text-gray-700">Source</TableHead>
                        <TableHead className="px-4 text-right text-gray-700 rounded-r-md">
                            <div className="flex items-center justify-end gap-2">
                                {count !== undefined && (
                                    <span className="text-xs font-normal text-gray-500">
                                        {currentCount} of {count >= 1000 ? `${Math.floor(count / 1000)}K+` : count}
                                    </span>
                                )}
                            </div>
                        </TableHead>
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {isLoading && data.length === 0 ? (
                        Array.from({ length: 8 }).map((_, index) => (
                            <TableRow
                                key={index}
                                className={`border-b h-12 ${index % 2 === 1 ? "bg-gray-50/40" : ""}`}
                            >
                                <TableCell className="px-4">
                                    <Checkbox disabled />
                                </TableCell>

                                <TableCell className="px-4">
                                    <div className="flex items-start gap-2">
                                        <FileText className="size-4 text-muted-foreground mt-1" />

                                        <Skeleton className="h-4 w-52" />
                                    </div>
                                </TableCell>

                                <TableCell className="px-4">
                                    <Skeleton className="h-4 w-64" />
                                </TableCell>

                                <TableCell className="px-4">
                                    <Skeleton className="h-5 w-20 rounded-full" />
                                </TableCell>

                                <TableCell className="px-4">
                                    <Skeleton className="h-4 w-24" />
                                </TableCell>

                                <TableCell className="px-4 text-right">
                                    <Skeleton className="h-4 w-16 ml-auto" />
                                </TableCell>
                            </TableRow>
                        ))
                    ) : data.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={6}
                                className="h-24 text-center text-muted-foreground"
                            >
                                No results.
                            </TableCell>
                        </TableRow>
                    ) : (
                        data.map((row, index) => (
                            <TableRow
                                key={row.name}
                                data-state={selectedRows.has(row.name) ? "selected" : undefined}
                                className={`border-b h-12 ${index % 2 === 1 ? "bg-gray-50/40" : ""
                                    }`}
                            >
                                <TableCell className="px-4">
                                    <Checkbox
                                        checked={selectedRows.has(row.name)}
                                        onCheckedChange={() => toggleRowSelection(row.name)}
                                    />
                                </TableCell>

                                <TableCell className="px-4">
                                    <div className="flex items-start gap-2">
                                        <FileText className="size-4 text-muted-foreground mt-1" />
                                        {row.is_pdf_converted === 1 ? (
                                            <Link
                                                to={`/template/${row.name}`}
                                                className="font-medium underline hover:text-primary"
                                            >
                                                {row.template_name || row.name}
                                            </Link>
                                        ) : (
                                                <span className="text-gray-500 font-medium">
                                                    {row.template_name || row.name}
                                                </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="px-4">
                                    {row.description
                                        ? (row.description.length > 50
                                            ? `${row.description.substring(0, 50)}...`
                                            : row.description)
                                        : "-"}
                                </TableCell>

                                <TableCell className="px-4">
                                    <span
                                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${row.is_pdf_converted
                                            ? "bg-green-100 text-green-700"
                                            : "bg-gray-200 text-gray-700"
                                            }`}
                                    >
                                        {row.is_pdf_converted ? "Converted" : <div className="flex items-center gap-2">
                                            <Loader2 className="size-3 text-blue-500 animate-spin" />
                                            <span className="text-gray-500 text-xs">Processing template...</span>
                                        </div>}
                                    </span>
                                </TableCell>

                                <TableCell className="px-4">
                                    {row.source || "-"}
                                </TableCell>

                                <TableCell className="px-4 text-right">
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
