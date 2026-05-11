import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form"
import { useFrappePostCall, useSWRConfig } from "frappe-react-sdk"
import type { KeyedMutator } from 'swr'
import { useBoolean } from "usehooks-ts"
import { useCopyToClipboardHotkey, usePasteFromClipboardHotkey, useSaveHotkey } from "../../../hooks/useReactHotKeys"
import type { FormTemplateField } from "@/types/FormPrinter/FormTemplateField"
import { toast } from "sonner"
import { FormField, FormControl, FormItem, FormMessage } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SelectItem } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { DataField, SelectFormField } from "@/components/ui/form-elements"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { Pencil, Trash2, Search, ChevronLeft, ChevronRight, X, Download, Upload } from "lucide-react"
import { AnnotationDeleteModal } from "@/pages/template/Annotator/AnnotationDeleteModal"
import {
    Dialog,
    DialogContent,
    DialogClose,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { FieldEditForm } from "./FieldEditForm"
import { SpinnerLoader } from "@/components/common/FullPageLoader/SpinnerLoader"
import ErrorBanner from "@/components/ui/error-banner"
import { useHotkeys } from "react-hotkeys-hook"
import { CREATE_DEFAULT_OPTIONS } from "@/hooks/useReactHotKeys"
import { getKeyboardMetaKeyString } from "@/lib/utils"


interface FieldsListProps {
    data: {
        field: FormTemplateField[]
        font: string
        font_size: number
    }
    focusedAnnotation: string | null,
    onClick: (annotationID: string | null) => void,
    mutate: KeyedMutator<FormTemplateField[]>
    templateID: string
}

export const FieldsTable = ({ data, focusedAnnotation, onClick, mutate, templateID }: FieldsListProps) => {

    const defaultFields = useMemo(() => {
        if (data && data?.field.length > 0) {
            return data?.field.map((field: FormTemplateField) => {
                return {
                    name: field.name,
                    field_label: field.field_label,
                    field_type: field.field_type,
                    value_type: field.value_type,
                    field_value: field.field_value,
                    annotation_type: field.annotation_type,
                    override_style: field.override_style,
                    font: field.font,
                    font_size: field.font_size,
                    is_prompt: field.is_prompt,
                    formatter: field.formatter,
                    xref: field.xref,
                    field_name: field.field_name,
                    default_value: field.default_value,
                    is_default_jinja: field.is_default_jinja,
                }
            })
        }
    }, [data])

    const methods = useForm({
        defaultValues: {
            fields: defaultFields,
            font: data.font,
            font_size: data.font_size
        }
    })
    const { handleSubmit, control, reset, getValues } = methods

    const { fields } = useFieldArray({
        control,
        name: "fields"
    })

    const focusedAnnotationData = useMemo(() => {
        if (focusedAnnotation) {
            // return annotations?.message.find(a => a.annotation_id === focusedAnnotation)
            return data?.field?.find(a => a.name === focusedAnnotation)
        }
        return null
    }, [focusedAnnotation, data])

    const { call, error, loading } = useFrappePostCall('pdf_forms.pdf_forms.doctype.form_template_field.form_template_field.update_form_template_fields')

    const onSubmit = (data: { fields?: typeof defaultFields; font: string; font_size: number }) => {
        if (!data?.fields) return
        call({
            fields: data.fields as FormTemplateField[],
            form_template_id: templateID,
            font: data.font,
            font_size: data.font_size
        }).then(() => {
            toast.success("Fields updated successfully")
            mutate()
        }).catch((error: { message?: string }) => {
            toast.error("Error updating custom fields", {
                description: error.message
            })
        })
    }

    // Create a ref for each row in your table
    const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

    // ...

    // When focusedAnnotation is set, scroll that row into view and it will be highlighted
    useEffect(() => {
        if (!focusedAnnotation) return
        const focusedIndex = fields.findIndex(field => field.name === focusedAnnotation)
        if (focusedIndex === -1) return
        // Small delay so refs are set after filtered list renders
        const id = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const el = rowRefs.current[focusedIndex]
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            })
        })
        return () => cancelAnimationFrame(id)
    }, [focusedAnnotation, fields]);

    const { mutate: globalMutate } = useSWRConfig()

    const [deleteAnnotationID, setDeleteAnnotationID] = useState<string | null>(null)

    const deleteAnnotationModalClose = useCallback(() => {
        setDeleteAnnotationID(null)
        globalMutate('form_template_image')
        globalMutate('form_template_annotations')
        globalMutate('form_template_meta')
        mutate().then((doc) => {
            const defaultValue = doc?.map((field: FormTemplateField) => {
                return {
                    name: field.name,
                    field_label: field.field_label,
                    field_type: field.field_type,
                    value_type: field.value_type,
                    field_value: field.field_value,
                    annotation_type: field.annotation_type
                }
            })

            reset({
                fields: defaultValue
            })
        })
    }, [mutate, setDeleteAnnotationID, globalMutate, reset])

    const [index, setIndex] = useState<number | null>(null)

    const { value: isOpen, setTrue: onOpen, setFalse: onClose } = useBoolean(false)

    const onFieldOpen = (index: number) => {
        setIndex(index)
        onOpen()
    }


    const copyToClipboard = () => {
        const formData = getValues()
        navigator.clipboard.writeText(JSON.stringify(formData, null, 2)).then(() => {
            toast.success("Field data copied to clipboard")
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
            throw new Error("Clipboard content must be a JSON object.")
        }
        if (!Array.isArray(parsed.fields) || !parsed.fields.every(isValidFormFieldRow)) {
            throw new Error("Expected `fields` to be an array of valid field objects.")
        }
        if ("font" in parsed && parsed.font !== undefined && typeof parsed.font !== "string") {
            throw new Error("Optional `font` must be a string.")
        }
        if ("font_size" in parsed && parsed.font_size !== undefined && typeof parsed.font_size !== "number") {
            throw new Error("Optional `font_size` must be a number.")
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
                toast.error("Clipboard is empty", {
                    description: "Copy field mapping JSON and try importing again.",
                })
                return
            }

            const data = parseClipboardImportData(text)
            importDataToForm(data)
            toast.success("Field data pasted from clipboard")
        } catch (error) {
            const description = error instanceof Error
                ? `${error.message} Please copy a valid exported mapping and retry.`
                : "Please copy a valid exported mapping and retry."
            toast.error("Could not import field data", { description })
        }
    }

    const importDataToForm = (data: ClipboardImportData) => {
        const formData = getValues();
        const formFields = formData.fields;
        const newFields = data.fields;

        const updatedFields = newFields.map((newField: FormFieldRow) => {
            const matchingField = formFields?.find((formField: FormFieldRow) =>
                formField.field_name === newField.field_name
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

    const { saveButtonRef } = useSaveHotkey()

    const [searchQuery, setSearchQuery] = useState('')
    const [showUnmappedOnly, setShowUnmappedOnly] = useState(false)
    const filteredFieldsWithIndex = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        const isUnmapped = (field: (typeof fields)[number]) =>
            field.field_value == null || String(field.field_value).trim() === ''
        return fields
            .map((field, index) => ({ field, index }))
            .filter(({ field }) => {
                const matchesSearch = !q || (field.field_label ?? '').toLowerCase().includes(q) || (field.field_name ?? '').toLowerCase().includes(q)
                const matchesUnmapped = !showUnmappedOnly || isUnmapped(field)
                return matchesSearch && matchesUnmapped
            })
    }, [fields, searchQuery, showUnmappedOnly])

    return (
        <div className="flex flex-col gap-2">
            <FormProvider {...methods}>
                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-2 w-full px-2">
                        <div className="flex items-center gap-4 w-full">
                            <div className="relative flex-1 w-full max-w-[390px]">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-ink-gray-5 pointer-events-none" aria-hidden />
                                <Input
                                    type="search"
                                    placeholder="Search by field name or label..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="ps-8 w-full"
                                    inputSize="md"
                                    aria-label="Search fields"
                                />
                            </div>
                            <label className="flex items-center gap-2 shrink-0 cursor-pointer select-none text-sm text-ink-gray-5 hover:text-ink-gray-8">
                                <Checkbox
                                    checked={showUnmappedOnly}
                                    onCheckedChange={(checked) => setShowUnmappedOnly(checked === true)}
                                    aria-label="Unmapped only"
                                />
                                <span>Unmapped only</span>
                            </label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                theme="gray"
                                size="sm"
                                isIconButton
                                aria-label="Import fields from clipboard"
                                title="Import fields from clipboard"
                                onClick={pasteToClipboard}
                            >
                                <Download className="size-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                theme="gray"
                                size="sm"
                                isIconButton
                                aria-label="Export fields to clipboard"
                                title="Export fields to clipboard"
                                onClick={copyToClipboard}
                            >
                                <Upload className="size-4" />
                            </Button>
                            <Button type="submit" size="sm" ref={saveButtonRef} disabled={loading} variant="solid" theme="gray">
                                {loading && <SpinnerLoader />}
                                {loading ? 'Saving...' : 'Save'}
                            </Button>
                        </div>
                    </div>
                    <div className="flex flex-row items-start gap-4 px-2 w-full">
                        <div className="w-full min-w-[140px]">
                            <SelectFormField name="font" label="Font">
                                <SelectItem value="helvetica">Helvetica</SelectItem>
                                <SelectItem value="courier">Courier</SelectItem>
                                <SelectItem value="times-roman">Times Roman</SelectItem>
                                <SelectItem value="symbol">Symbol</SelectItem>
                                <SelectItem value="zapfdingbats">ZapfDingbats</SelectItem>
                            </SelectFormField>
                        </div>
                        <div className="w-full min-w-[140px]">
                            <DataField name="font_size" label="Font Size" inputProps={{
                                type: 'number',
                                min: 0,
                            }} />
                        </div>
                    </div>
                    {error && <ErrorBanner error={error} />}
                    <div className="overflow-y-auto px-2" style={{ height: 'calc(100vh - 200px)' }}>
                        <Table containerClassName="rounded border border-outline-gray-1">
                            <TableHeader className="sticky top-0 z-10">
                                <TableRow>
                                    <TableHead>No.</TableHead>
                                    <TableHead>Label</TableHead>
                                    <TableHead>Field Type</TableHead>
                                    <TableHead>Value Type</TableHead>
                                    <TableHead>Value</TableHead>
                                    <TableHead className="w-[50px]" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredFieldsWithIndex.map(({ field, index }) => (
                                    <TableRow
                                        ref={el => { rowRefs.current[index] = el }}
                                        key={field.id}
                                        onClick={() => onClick(field.name)}
                                        className={
                                            focusedAnnotationData?.name === field.name
                                                ? 'bg-surface-blue-2 min-h-[50px] ring-1 ring-inset ring-outline-blue-2'
                                                : ''
                                        }
                                    >
                                        <TableCell className="p-2">{index + 1}.</TableCell>
                                        <TableCell className="p-2" title={field.field_label}>
                                            {field.annotation_type === 'Auto' ? (
                                                <span className="block max-w-[25ch] truncate">{field.field_label}</span>
                                            ) : (
                                                <FormField
                                                    control={control}
                                                    name={`fields.${index}.field_label`}
                                                    rules={{ required: 'Field label is required' }}
                                                    render={({ field: f }) => (
                                                        <FormItem className="space-y-0">
                                                            <FormControl>
                                                                <Input
                                                                    id={`field-label-${field.id}`}
                                                                    className="min-w-[200px]"
                                                                    inputSize="md"
                                                                    {...f}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            )}
                                        </TableCell>
                                        <TableCell className="p-2">
                                            {field.annotation_type === 'Auto' ? (
                                                field.field_type
                                            ) : (
                                                <SelectFormField name={`fields.${index}.field_type`} label="" hideLabel>
                                                    <SelectItem value="Text">Text</SelectItem>
                                                    <SelectItem value="Checkbox">Checkbox</SelectItem>
                                                    <SelectItem value="Radio Button">Radio Button</SelectItem>
                                                </SelectFormField>
                                            )}
                                        </TableCell>
                                        <TableCell className="p-2">
                                            <SelectFormField name={`fields.${index}.value_type`} label="" hideLabel>
                                                <SelectItem value="Text">Text</SelectItem>
                                                <SelectItem value="Field">Field</SelectItem>
                                                <SelectItem value="Prompt">Prompt</SelectItem>
                                                <SelectItem value="Jinja">Jinja</SelectItem>
                                            </SelectFormField>
                                        </TableCell>
                                        <TableCell className="p-2">
                                            <FieldValueDisplay index={index} fieldId={field.id} />
                                        </TableCell>
                                        <TableCell className="p-2">
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    theme="gray"
                                                    size="sm"
                                                    isIconButton
                                                    aria-label="Edit"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        onFieldOpen(index)
                                                    }}
                                                >
                                                    <Pencil className="size-3.5" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    theme="red"
                                                    size="sm"
                                                    isIconButton
                                                    aria-label="Delete"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setDeleteAnnotationID(field.name)
                                                    }}
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <AnnotationDeleteModal annotationID={deleteAnnotationID} templateID={templateID} onClose={deleteAnnotationModalClose} />
                    {index !== null && <FieldEditModal index={index} isOpen={isOpen} onClose={onClose} setIndex={setIndex} totalLength={fields.length} />}
                </form>
            </FormProvider>
        </div>
    )
}

interface FieldEditModalProps {
    index: number
    isOpen: boolean
    onClose: () => void
    setIndex: (n: number | null) => void
    totalLength: number
}

const FieldValueDisplay = ({ index, fieldId }: { index: number; fieldId: string }) => {
    const fieldValue = useWatch({ name: `fields.${index}.field_value` })

    return (
        <InputGroup size="md">
            <InputGroupInput
                id={`field-value-${fieldId}`}
                className="min-w-[200px] pointer-events-none"
                readOnly
                value={fieldValue ?? ''}
            />
        </InputGroup>
    )
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
                className="min-w-2xl gap-6"
                showCloseButton={false}
                onOpenAutoFocus={(e) => {
                    e.preventDefault()
                }}
            >
                <DialogHeader>
                    <div className="flex items-center justify-between px-2">
                        <DialogTitle>Edit field {index + 1} of {totalLength}</DialogTitle>
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
                                    aria-label="Close"
                                    onClick={onClose}
                                >
                                    <X className="size-4" />
                                </Button>
                            </DialogClose>
                        </div>
                    </div>
                </DialogHeader>
                <div className="flex flex-col max-h-[60vh] overflow-y-auto px-2">
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
                            aria-label="Previous Field"
                            onClick={onPreviousClick}
                            disabled={index === 0}
                        >
                            <ChevronLeft className="size-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Previous Field ({getKeyboardMetaKeyString()} + ←)</p>
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
                            aria-label="Next Field"
                            onClick={onNextClick}
                            disabled={index === totalLength - 1}
                        >
                            <ChevronRight className="size-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Next Field ({getKeyboardMetaKeyString()} + →)</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </TooltipProvider>
    )
}