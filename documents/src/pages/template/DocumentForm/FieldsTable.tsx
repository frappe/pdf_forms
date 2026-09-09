import { Fragment, memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useFieldArray, useFormContext, useWatch } from "react-hook-form"
import type { TemplateFormValues } from "./formTypes"
import { useFrappePostCall, type FrappeError } from "frappe-react-sdk"
import { useBoolean } from "usehooks-ts"
import { useCopyToClipboardHotkey, usePasteFromClipboardHotkey } from "../../../hooks/useReactHotKeys"
import type { FormTemplateField } from "@types/FormPrinter/FormTemplateField"
import { toast } from "sonner"
import { Badge } from "@components/ui/badge"
import { TabsButton, TabsButtonItem } from "@components/ui/tab-buttons"
import { Button } from "@components/ui/button"
import { Spinner } from "@components/ui/spinner"
import { Input } from "@components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@components/ui/table"
import { Pencil, Trash2, Search, ChevronLeft, ChevronRight, X, Download, Upload, Sparkles } from "lucide-react"
import { AnnotationDeleteModal } from "@pages/template/Annotator/AnnotationDeleteModal"
import {
    Dialog,
    DialogContent,
    DialogClose,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, WithTooltip } from "@components/ui/tooltip"
import { FieldEditForm } from "./FieldEditForm"
import ErrorBanner from "@components/ui/error-banner"
import { useHotkeys } from "react-hotkeys-hook"
import { CREATE_DEFAULT_OPTIONS } from "@hooks/useReactHotKeys"
import { getKeyboardMetaKeyString } from "@lib/utils"
import _ from "@lib/translate"

interface AutoMapSuggestion {
    /** Form Template Field row name. */
    name: string
    field_label: string
    suggestion: string
    confidence: number
    tier: string
    ambiguous: boolean
    /** True only for unambiguous, high-confidence matches. */
    auto_apply: boolean
}

interface AutoMapResult {
    source: string
    candidate_field_count: number
    unmapped: number
    auto_appliable: number
    needs_review: number
    suggestions: AutoMapSuggestion[]
}

interface FieldsListProps {
    data: {
        field: FormTemplateField[]
        font: string
        font_size: number
    }
    focusedAnnotation: string | null,
    onClick: (annotationID: string | null) => void,
    templateID: string
    /** Save failure from the parent form, shown above the list. */
    saveError?: FrappeError | null
}

export const FieldsTable = ({ data, focusedAnnotation, onClick, templateID, saveError }: FieldsListProps) => {

    // The form is owned by DocumentForm so it survives tab switches; this tab is
    // just one view onto it.
    const methods = useFormContext<TemplateFormValues>()
    const { control, getValues, reset } = methods

    const { fields } = useFieldArray({
        control,
        name: "fields"
    })

    // Live row values: useFieldArray's `fields` snapshot doesn't update as the
    // edit dialog changes values, so watch the array and read display values
    // from it. Rows take primitives as props, so they stay memoized.
    const watchedFields = useWatch({ control, name: 'fields' }) as TemplateFormValues['fields'] | undefined

    /** Fields still without a value — drives the "Unmapped" filter chip. */
    const unmappedCount = useMemo(
        () => fields.reduce((n, field, index) => {
            const value = watchedFields?.[index]?.field_value ?? field.field_value
            return n + (value == null || String(value).trim() === '' ? 1 : 0)
        }, 0),
        [fields, watchedFields],
    )

    const focusedAnnotationData = useMemo(() => {
        if (focusedAnnotation) {
            // return annotations?.message.find(a => a.annotation_id === focusedAnnotation)
            return data?.field?.find(a => a.name === focusedAnnotation)
        }
        return null
    }, [focusedAnnotation, data])

    const { call: fetchSuggestions, loading: autoMapping } =
        useFrappePostCall<{ message: AutoMapResult }>('pdf_forms.api.automap.suggest_mappings')

    /**
     * Fill in the fields the matcher is confident about, into the FORM (not the
     * database) — so the result lands as unsaved changes the user can review,
     * adjust and Save, or walk away from. Anything ambiguous or low-confidence
     * is deliberately left untouched.
     */
    const runAutoMap = useCallback(() => {
        fetchSuggestions({ form_template_id: templateID })
            .then((res) => {
                const result = res?.message
                if (!result) return
                const applied = result.suggestions.filter((s) => s.auto_apply)
                const byRowName = new Map(applied.map((s) => [s.name, s.suggestion]))

                let count = 0
                getValues().fields?.forEach((row, index) => {
                    const suggestion = byRowName.get(row?.name as string)
                    if (!suggestion) return
                    methods.setValue(`fields.${index}.field_value`, suggestion, { shouldDirty: true })
                    methods.setValue(`fields.${index}.value_type`, 'Field', { shouldDirty: true })
                    count++
                })

                if (count > 0) {
                    toast.success(_(`Mapped ${count} field${count === 1 ? '' : 's'} automatically`), {
                        description: _("Review the changes and Save."),
                    })
                } else if (result.unmapped === 0) {
                    toast.info(_("Every field is already mapped"))
                } else {
                    toast.warning(_("No confident matches found"), {
                        description: _(`${result.source} exposes ${result.candidate_field_count} fields — none matched the remaining ${result.unmapped} closely enough.`),
                    })
                }
            })
            .catch(() => toast.error(_("Could not run auto-map")))
    }, [fetchSuggestions, templateID, getValues, methods])

    // Create a ref for each row in your table
    const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
    // The table's own scroll container — the ONLY thing that scrolls for row focus.
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);

    // When focusedAnnotation is set, center that row inside the table's scroll
    // container. Deliberately NOT scrollIntoView: that scrolls every scrollable
    // ancestor too, dragging the page header out of view.
    useEffect(() => {
        if (!focusedAnnotation) return
        const focusedIndex = fields.findIndex(field => field.name === focusedAnnotation)
        if (focusedIndex === -1) return
        // Small delay so refs are set after filtered list renders
        const id = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const el = rowRefs.current[focusedIndex]
                const container = scrollContainerRef.current
                if (!el || !container) return
                const cRect = container.getBoundingClientRect()
                const eRect = el.getBoundingClientRect()
                const target = container.scrollTop + (eRect.top - cRect.top)
                    - container.clientHeight / 2 + eRect.height / 2
                container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
            })
        })
        return () => cancelAnimationFrame(id)
    }, [focusedAnnotation, fields]);

    const [deleteAnnotationID, setDeleteAnnotationID] = useState<string | null>(null)

    const deleteAnnotationModalClose = useCallback(() => {
        setDeleteAnnotationID(null)

    }, [setDeleteAnnotationID,])

    const [index, setIndex] = useState<number | null>(null)

    const { value: isOpen, setTrue: onOpen, setFalse: onClose } = useBoolean(false)

    const onFieldOpen = useCallback((index: number) => {
        setIndex(index)
        onOpen()
    }, [onOpen])

    // Stable row callbacks so the memoized MappingRow only re-renders when its
    // own data (or focus) changes — not 197 times per click.
    const onEditRow = useCallback((name: string, idx: number) => {
        // Open the modal in the urgent update; defer the row-focus + annotator
        // pan (which re-renders the focused row and animates OSD) so the dialog
        // paints without jank on large templates.
        onFieldOpen(idx)
        startTransition(() => onClick(name))
    }, [onClick, onFieldOpen])
    const onDeleteRow = useCallback((name: string) => setDeleteAnnotationID(name), [])
    const setRowRef = useCallback((idx: number, el: HTMLTableRowElement | null) => {
        rowRefs.current[idx] = el
    }, [])


    const copyToClipboard = () => {
        const formData = getValues()
        navigator.clipboard.writeText(JSON.stringify(formData, null, 2)).then(() => {
            toast.success(_("Field data copied to clipboard"))
        })
    }

    type FormFieldRow = { name: string; field_name?: string; [key: string]: unknown }
    type ClipboardImportData = { fields: FormFieldRow[]; font?: string; font_size?: number }

    const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
        typeof value === "object" && value !== null

    const isValidFormFieldRow = (value: unknown): value is FormFieldRow => {
        if (!isObjectRecord(value)) return false
        if (typeof value.name !== "string") return false
        if ("field_name" in value && value.field_name !== undefined && typeof value.field_name !== "string") return false
        return true
    }

    const parseClipboardImportData = (text: string): ClipboardImportData => {
        const parsed: unknown = JSON.parse(text)
        if (!isObjectRecord(parsed)) {
            throw new Error(_("Clipboard content must be a JSON object."))
        }
        if (!Array.isArray(parsed.fields) || !parsed.fields.every(isValidFormFieldRow)) {
            throw new Error(_("Expected `fields` to be an array of valid field objects."))
        }
        if ("font" in parsed && parsed.font !== undefined && typeof parsed.font !== "string") {
            throw new Error(_("Optional `font` must be a string."))
        }
        if ("font_size" in parsed && parsed.font_size !== undefined && typeof parsed.font_size !== "number") {
            throw new Error(_("Optional `font_size` must be a number."))
        }

        return {
            fields: parsed.fields,
            font: parsed.font as string | undefined,
            font_size: parsed.font_size as number | undefined,
        }
    }

    const pasteToClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText()
            if (!text.trim()) {
                toast.error(_("Clipboard is empty"), {
                    description: _("{0}", ["Copy field mapping JSON and try importing again."]),
                })
                return
            }

            const data = parseClipboardImportData(text)
            importDataToForm(data)
            toast.success(_("Field data pasted from clipboard"))
        } catch (error) {
            const description = error instanceof Error
                ? `${_("{0}", [error.message])} ${_("Please copy a valid exported mapping and retry.")}`
                : _("{0}", ["Please copy a valid exported mapping and retry."])
            toast.error(_("Could not import field data"), { description })
        }
    }

    const importDataToForm = (data: ClipboardImportData) => {
        const formData = getValues();
        const formFields = formData.fields;
        const newFields = data.fields;

        const updatedFields = newFields.map((newField: FormFieldRow) => {
            const matchingField = formFields?.find(
                (formField) => formField.field_name === newField.field_name
            );

            if (matchingField) {
                return {
                    ...newField,
                    name: matchingField.name,
                };
            } else {
                return newField;
            }
        });

        reset({
            ...formData,
            fields: updatedFields,
            font: data.font,
            font_size: data.font_size
        });
    }

    usePasteFromClipboardHotkey(pasteToClipboard)

    useCopyToClipboardHotkey(copyToClipboard)

    const [searchQuery, setSearchQuery] = useState('')
    const [showUnmappedOnly, setShowUnmappedOnly] = useState(false)
    const filteredFieldsWithIndex = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        return fields
            .map((field, index) => {
                const live = watchedFields?.[index]
                return {
                    field,
                    index,
                    label: String(live?.field_label ?? field.field_label ?? ''),
                    fieldName: String(field.field_name ?? ''),
                    fieldType: String(live?.field_type ?? field.field_type ?? ''),
                    valueType: String(live?.value_type ?? field.value_type ?? 'Text'),
                    value: String(live?.field_value ?? field.field_value ?? ''),
                    formatter: String(live?.formatter ?? field.formatter ?? ''),
                    hasDefault: String(live?.default_value ?? field.default_value ?? '').trim() !== '',
                    pageIndex: Number(live?.page_index ?? field.page_index ?? 0),
                }
            })
            .filter((row) => {
                const matchesSearch = !q
                    || row.label.toLowerCase().includes(q)
                    || (row.field.field_name ?? '').toLowerCase().includes(q)
                const matchesUnmapped = !showUnmappedOnly || row.value.trim() === ''
                return matchesSearch && matchesUnmapped
            })
    }, [fields, watchedFields, searchQuery, showUnmappedOnly])

    /** True per-page totals — independent of search/filter, so the separator
     *  always describes the page itself rather than what happens to be shown. */
    const pageTotals = useMemo(() => {
        const totals = new Map<number, { total: number; unmapped: number }>()
        fields.forEach((field, index) => {
            const live = watchedFields?.[index]
            const page = Number(live?.page_index ?? field.page_index ?? 0)
            const value = String(live?.field_value ?? field.field_value ?? '')
            const t = totals.get(page) ?? { total: 0, unmapped: 0 }
            t.total++
            if (value.trim() === '') t.unmapped++
            totals.set(page, t)
        })
        return totals
    }, [fields, watchedFields])

    /** Rows grouped by the PDF page they sit on, for the page separators. */
    const pageGroups = useMemo(() => {
        const map = new Map<number, { pageIndex: number; rows: typeof filteredFieldsWithIndex; unmapped: number }>()
        for (const row of filteredFieldsWithIndex) {
            let g = map.get(row.pageIndex)
            if (!g) {
                g = { pageIndex: row.pageIndex, rows: [], unmapped: 0 }
                map.set(row.pageIndex, g)
            }
            g.rows.push(row)
            if (row.value.trim() === '') g.unmapped++
        }
        return [...map.values()].sort((a, b) => a.pageIndex - b.pageIndex)
    }, [filteredFieldsWithIndex])


    return (
        <div className="flex h-full min-h-0 flex-col gap-2">
            <div className="flex h-full min-h-0 flex-col gap-4">
                    <div className="flex items-center justify-between gap-2 w-full">
                        <div className="flex items-center gap-4 w-full">
                            <div className="relative flex-1 w-full max-w-[390px]">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-ink-gray-5 pointer-events-none" aria-hidden />
                                <Input
                                    type="search"
                                    placeholder={_("Search by field name or label...")}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="ps-8 w-full [&::-webkit-search-cancel-button]:hidden"
                                    inputSize="sm"
                                    aria-label={_("Search fields")}
                                />
                            </div>
                            <TabsButton
                                value={showUnmappedOnly ? 'unmapped' : 'all'}
                                onValueChange={(v) => setShowUnmappedOnly(v === 'unmapped')}
                                aria-label={_("Filter fields")}
                                className="shrink-0"
                            >
                                <TabsButtonItem value="all">
                                    {_("All")}
                                    <span className="text-xs text-ink-gray-4">{fields.length}</span>
                                </TabsButtonItem>
                                <TabsButtonItem value="unmapped">
                                    {_("Unmapped")}
                                    <span className="text-xs text-ink-gray-4">{unmappedCount}</span>
                                </TabsButtonItem>
                            </TabsButton>
                        </div>
                        <div className="flex items-center gap-2">
                            <WithTooltip tip={_("Fill in fields that clearly match the data source")}>
                                <Button
                                    type="button"
                                    variant="outline"
                                    theme="gray"
                                    size="sm"
                                    onClick={runAutoMap}
                                    disabled={autoMapping}
                                    aria-busy={autoMapping || undefined}
                                >
                                    {/* Only the icon swaps while matching — the label stays put
                                        so the button keeps its width and nothing shifts. */}
                                    {autoMapping ? <Spinner className="size-4" /> : <Sparkles className="size-4" />}
                                    {_("Auto-map")}
                                </Button>
                            </WithTooltip>
                            <WithTooltip tip={<p>{_("Import fields from clipboard")} ({getKeyboardMetaKeyString()} + I)</p>}>
                                <Button
                                    type="button"
                                    variant="outline"
                                    theme="gray"
                                    size="sm"
                                    isIconButton
                                    aria-label={_("Import fields from clipboard")}
                                    onClick={pasteToClipboard}
                                >
                                    <Download className="size-4" />
                                </Button>
                            </WithTooltip>
                            <WithTooltip tip={<p>{_("Export fields to clipboard")} ({getKeyboardMetaKeyString()} + E)</p>}>
                                <Button
                                    type="button"
                                    variant="outline"
                                    theme="gray"
                                    size="sm"
                                    isIconButton
                                    aria-label={_("Export fields to clipboard")}
                                    onClick={copyToClipboard}
                                >
                                    <Upload className="size-4" />
                                </Button>
                            </WithTooltip>
                        </div>
                    </div>
                    {saveError && <ErrorBanner error={saveError} />}
                    {/* scroll-fade (bottom only — the sticky header must never dim):
                        rows fade at the bottom edge while more remain, so a mid-scroll
                        cut doesn't read as clipped content. */}
                    {/* Vertical scroll only: this container is the sticky thead's
                        scroll ancestor. The table is table-fixed and every cell
                        truncates, so there is nothing to scroll sideways to. */}
                    <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-2 scroll-fade [--scroll-fade-t-size:0px]">
                        {/* overflow-x-visible: the default overflow-x-auto wrapper would
                            become the sticky thead's scroll ancestor and break sticking
                            (it never scrolls vertically). Open table, Frappe-style —
                            no card border. */}
                        {/* table-fixed: columns take the widths below instead of
                            growing to fit content, so a long value truncates rather
                            than pushing the table wider than the pane. */}
                        <Table containerClassName="overflow-x-visible" className="table-fixed">
                            {/* Solid bg: with the transparent Frappe-style header, rows
                                would bleed through this sticky thead while scrolling. */}
                            <TableHeader className="sticky top-0 z-10 bg-surface-base">
                                <TableRow className="h-8 hover:bg-transparent">
                                    <TableHead className="w-11">No.</TableHead>
                                    <TableHead className="w-[30%]">{_("Label")}</TableHead>
                                    <TableHead className="w-28">{_("Field Type")}</TableHead>
                                    <TableHead className="w-24">{_("Value Type")}</TableHead>
                                    {/* Widthless on purpose — Value soaks up whatever
                                        the fixed columns leave over. */}
                                    <TableHead>{_("Value")}</TableHead>
                                    <TableHead className="w-20" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pageGroups.length === 0 && (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={6} className="h-32 whitespace-normal text-center align-middle">
                                            <p className="text-base text-ink-gray-7">{_("No fields match")}</p>
                                            <p className="mt-1 text-p-sm text-ink-gray-5">
                                                {/* Search wins the explanation: it's the narrower cause. */}
                                                {searchQuery.trim()
                                                    ? _("Try a different search term.")
                                                    : _("Every field on this template is mapped.")}
                                            </p>
                                            {(searchQuery || showUnmappedOnly) && (
                                                <Button
                                                    type="button"
                                                    variant="subtle"
                                                    theme="gray"
                                                    size="sm"
                                                    className="mt-3"
                                                    onClick={() => { setSearchQuery(''); setShowUnmappedOnly(false) }}
                                                >
                                                    {_("Clear filters")}
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )}
                                {pageGroups.map((group) => (
                                    <Fragment key={`page-${group.pageIndex}`}>
                                        <PageSeparator
                                            pageIndex={group.pageIndex}
                                            fieldCount={pageTotals.get(group.pageIndex)?.total ?? group.rows.length}
                                            unmapped={pageTotals.get(group.pageIndex)?.unmapped ?? group.unmapped}
                                            shown={group.rows.length}
                                            firstFieldName={group.rows[0]?.field.name ?? ''}
                                            onGoToPage={onClick}
                                        />
                                        {group.rows.map(({ field, index, label, fieldName, fieldType, valueType, value, formatter, hasDefault }) => (
                                            <MappingRow
                                                key={field.id}
                                                name={field.name ?? ''}
                                                index={index}
                                                isFocused={focusedAnnotationData?.name === field.name}
                                                label={label}
                                                fieldName={fieldName}
                                                fieldType={fieldType}
                                                valueType={valueType}
                                                value={value}
                                                formatter={formatter}
                                                hasDefault={hasDefault}
                                                onRowClick={onClick}
                                                onEditRow={onEditRow}
                                                onDeleteRow={onDeleteRow}
                                                setRowRef={setRowRef}
                                            />
                                        ))}
                                    </Fragment>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <AnnotationDeleteModal annotationID={deleteAnnotationID} templateID={templateID} onClose={deleteAnnotationModalClose} />
                    {index !== null && <FieldEditModal index={index} isOpen={isOpen} onClose={onClose} setIndex={setIndex} totalLength={fields.length} />}
            </div>
        </div>
    )
}

const VALUE_TYPE_THEME = {
    Field: "blue",
    Prompt: "violet",
    Jinja: "green",
    Text: "gray",
} as const

interface PageSeparatorProps {
    pageIndex: number
    /** Fields on this page in total (not affected by search/filter). */
    fieldCount: number
    /** Unmapped fields on this page in total. */
    unmapped: number
    /** How many are currently listed under this separator. */
    shown: number
    firstFieldName: string
    onGoToPage: (name: string | null) => void
}

/**
 * Sticky strip that splits the list by the PDF page each field sits on.
 * "Go to page" focuses that page's first field — the annotator already
 * switches pages when a focused annotation lives on another one.
 */
const PageSeparator = memo(function PageSeparator({
    pageIndex, fieldCount, unmapped, shown, firstFieldName, onGoToPage,
}: PageSeparatorProps) {
    const isFiltered = shown !== fieldCount
    return (
        <TableRow className="group/page hover:bg-transparent">
            {/* top-8 clears the sticky table header above it */}
            <TableCell colSpan={6} className="sticky top-[31px] z-9 bg-surface-gray-1 p-0">
                <div className="flex h-7 items-center gap-2 px-2">
                    <span className="text-sm-medium text-ink-gray-7">
                        {_("Page {0}", [String(pageIndex + 1)])}
                    </span>
                    <span className="text-xs text-ink-gray-5">
                        {isFiltered
                            ? _("{0} of {1} fields", [String(shown), String(fieldCount)])
                            : _("{0} fields", [String(fieldCount)])}
                    </span>
                    {unmapped > 0 && (
                        <Badge theme="amber" size="sm">{_("{0} unmapped", [String(unmapped)])}</Badge>
                    )}
                    <Button
                        type="button"
                        variant="ghost"
                        theme="gray"
                        size="xs"
                        className="ms-auto opacity-0 transition-opacity group-hover/page:opacity-100 focus-visible:opacity-100"
                        onClick={(e) => {
                            e.stopPropagation()
                            if (firstFieldName) onGoToPage(firstFieldName)
                        }}
                    >
                        {_("Go to page")}
                        <ChevronRight className="size-3.5" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    )
})

interface MappingRowProps {
    name: string
    index: number
    isFocused: boolean
    label: string
    /** The PDF widget's own name — shown under the label when it differs. */
    fieldName: string
    /** Text / CheckBox / Radio Button, from the PDF. */
    fieldType: string
    valueType: string
    value: string
    /** Date / Currency / Phone / Number, when one is applied. */
    formatter: string
    /** Whether a default value is configured. */
    hasDefault: boolean
    onRowClick: (name: string | null) => void
    onEditRow: (name: string, index: number) => void
    onDeleteRow: (name: string) => void
    setRowRef: (index: number, el: HTMLTableRowElement | null) => void
}

/**
 * One mapping row — display only: label, a value-type badge, and the mapped
 * value as text (empty when unmapped). All editing happens in the edit dialog
 * (pencil or double-click), so ~200 rows render as text instead of ~400 live
 * form controls. Memoized on primitives.
 */
const MappingRow = memo(function MappingRow({
    name, index, isFocused, label, fieldName, fieldType, valueType, value, formatter, hasDefault,
    onRowClick, onEditRow, onDeleteRow, setRowRef,
}: MappingRowProps) {
    const theme = VALUE_TYPE_THEME[valueType as keyof typeof VALUE_TYPE_THEME] ?? "gray"

    return (
        <TableRow
            ref={el => setRowRef(index, el)}
            onClick={() => onRowClick(name)}
            onDoubleClick={() => onEditRow(name, index)}
            data-focused={isFocused || undefined}
            className={`group/row h-10 cursor-pointer ${isFocused
                ? 'bg-surface-blue-2 ring-1 ring-inset ring-outline-blue-2 hover:bg-surface-blue-2'
                : ''}`}
        >
            <TableCell className="p-2 text-ink-gray-4">{index + 1}.</TableCell>
            <TableCell className="overflow-hidden p-2" title={fieldName && fieldName !== label ? `${label} · ${fieldName}` : label}>
                {/* The PDF widget's own name only when it differs — inline, so every
                    row stays one line and the vertical rhythm holds. The label wins
                    the space; the widget name gives way first. */}
                <div className="flex min-w-0 items-baseline gap-1.5">
                    <span className="min-w-0 flex-1 truncate font-medium text-ink-gray-8">{label}</span>
                    {fieldName && fieldName !== label && (
                        <span className="min-w-0 max-w-[45%] truncate font-mono text-xs text-ink-gray-4">{fieldName}</span>
                    )}
                </div>
            </TableCell>
            <TableCell className="p-2 text-ink-gray-6">{_("{0}", [fieldType])}</TableCell>
            <TableCell className="p-2">
                <Badge variant="subtle" theme={theme}>{_("{0}", [valueType])}</Badge>
            </TableCell>
            <TableCell className="overflow-hidden p-2" title={value || undefined}>
                <div className="flex min-w-0 items-center gap-1.5">
                    {/* min-w-0 so the flex item may shrink below its text width —
                        without it `truncate` never kicks in and the row widens. */}
                    <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink-gray-6">{value}</span>
                    {formatter && (
                        <Badge variant="outline" theme="gray" size="sm" className="shrink-0 font-normal">
                            {_("{0}", [formatter])}
                        </Badge>
                    )}
                    {hasDefault && (
                        <WithTooltip tip={_("Has a default value")}>
                            <span className="size-1.5 shrink-0 rounded-full bg-surface-gray-5" aria-label={_("Has a default value")} />
                        </WithTooltip>
                    )}
                </div>
            </TableCell>
            <TableCell className="p-2">
                <div className="flex items-center justify-end gap-1">
                    <WithTooltip tip={_("Edit")}>
                        <Button
                            type="button"
                            variant="ghost"
                            theme="gray"
                            size="sm"
                            isIconButton
                            aria-label={_("Edit")}
                            className="group-data-[focused]/row:hover:bg-surface-base/60 group-data-[focused]/row:active:bg-surface-base/80"
                            onClick={(e) => {
                                e.stopPropagation()
                                // Editing a row also selects it, so the annotator pans to it.
                                onEditRow(name, index)
                            }}
                        >
                            <Pencil className="size-3.5" />
                        </Button>
                    </WithTooltip>
                    <WithTooltip tip={_("Delete")}>
                        <Button
                            type="button"
                            variant="ghost"
                            theme="gray"
                            size="sm"
                            isIconButton
                            aria-label={_("Delete")}
                            className="text-ink-gray-5 hover:text-ink-red-6 hover:bg-surface-red-2 active:bg-surface-red-3 group-data-[focused]/row:hover:bg-surface-base/60 group-data-[focused]/row:active:bg-surface-base/80"
                            onClick={(e) => {
                                e.stopPropagation()
                                onDeleteRow(name)
                            }}
                        >
                            <Trash2 className="size-3.5" />
                        </Button>
                    </WithTooltip>
                </div>
            </TableCell>
        </TableRow>
    )
})

interface FieldEditModalProps {
    index: number
    isOpen: boolean
    onClose: () => void
    setIndex: (n: number | null) => void
    totalLength: number
}


const FieldEditModal = ({ index, isOpen, onClose, setIndex, totalLength }: FieldEditModalProps) => {
    const onNextClick = () => {
        if (index < totalLength - 1) {
            setIndex(index + 1)
        }
    }

    const onPreviousClick = () => {
        if (index > 0) {
            setIndex(index - 1)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { setIndex(null); onClose() } }} modal={true}>
            <DialogContent
                className="sm:max-w-3xl gap-6"
                showCloseButton={false}
                tabIndex={-1}
                onOpenAutoFocus={(e) => {
                    e.preventDefault()
                        ; (e.target as HTMLElement | null)?.focus?.()
                }}
            >
                <DialogHeader>
                    <DialogDescription className="sr-only">
                        {_("Edit this mapping field's label, value type, value and style.")}
                    </DialogDescription>
                    <div className="flex items-center justify-between">
                        <DialogTitle>{_("Edit field")} {index + 1} {_("of")} {totalLength}</DialogTitle>
                        <div className="flex items-center gap-2">
                            <NextPreviousButtons
                                onNextClick={onNextClick}
                                onPreviousClick={onPreviousClick}
                                totalLength={totalLength}
                                index={index}
                            />
                            <DialogClose asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    theme="gray"
                                    size="sm"
                                    isIconButton
                                    aria-label={_("Close")}
                                    onClick={onClose}
                                    title={_("Close")}
                                >
                                    <X className="size-4" />
                                </Button>
                            </DialogClose>
                        </div>
                    </div>
                </DialogHeader>
                {/* Bleed the scroller into the dialog's p-6 gutter (-mx-6/px-6):
                    the overlay scrollbar then rides in the margin, 24px clear of
                    content, instead of overlapping whatever sits at the right edge. */}
                <div className="-mx-6 flex max-h-[70vh] flex-col overflow-y-auto px-6">
                    <FieldEditForm index={index} />
                </div>
            </DialogContent>
        </Dialog>
    )
}

interface NextPreviousButtonsProps {
    onNextClick: () => void
    onPreviousClick: () => void
    totalLength: number
    index: number
}

const NextPreviousButtons = ({ onNextClick, onPreviousClick, totalLength, index }: NextPreviousButtonsProps) => {
    const previousButtonRef = useRef<HTMLButtonElement | null>(null)
    const nextButtonRef = useRef<HTMLButtonElement | null>(null)
    useHotkeys(
        ['meta+left', 'ctrl+left'],
        (e) => {
            e.preventDefault()
            if (index > 0) {
                previousButtonRef.current?.click()
            }
        },
        CREATE_DEFAULT_OPTIONS,
        [index]
    )

    useHotkeys(
        ['meta+right', 'ctrl+right'],
        (e) => {
            e.preventDefault()
            if (index < totalLength - 1) {
                nextButtonRef.current?.click()
            }
        },
        CREATE_DEFAULT_OPTIONS,
        [index, totalLength]
    )

    return (
        <TooltipProvider>
            <div className="flex items-center gap-1">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            ref={previousButtonRef}
                            autoFocus={false}
                            type="button"
                            variant="ghost"
                            theme="gray"
                            size="sm"
                            isIconButton
                            aria-label={_("Previous Field")}
                            onClick={onPreviousClick}
                            disabled={index === 0}
                        >
                            <ChevronLeft className="size-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{_("Previous Field")} ({getKeyboardMetaKeyString()} + ←)</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            ref={nextButtonRef}
                            autoFocus={false}
                            type="button"
                            variant="ghost"
                            theme="gray"
                            size="sm"
                            isIconButton
                            aria-label={_("Next Field")}
                            onClick={onNextClick}
                            disabled={index === totalLength - 1}
                        >
                            <ChevronRight className="size-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{_("Next Field")} ({getKeyboardMetaKeyString()} + →)</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </TooltipProvider>
    )
}