import { useFrappeGetCall } from "frappe-react-sdk"
import { useCallback, useMemo, useState } from "react"
import LinkFieldCombobox from "@/components/common/LinkField/LinkFieldCombobox"
import { Editor } from "@/components/common/Editor/Editor"
import { Button } from "@/components/ui/button"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { FileJson, Printer } from "lucide-react"
import { web_url } from "@/config/socket"
import ErrorBanner from "@/components/ui/error-banner"
import type { FormTemplatePrompts } from "@/types/FormPrinter/FormTemplatePrompts"

export interface PreviewProps {
    templateID: string
    source: string
}

/** Prompt field values keyed by field_name: string for Text/Radio, boolean for Checkbox */
export type PromptValues = Record<string, string | boolean>

export const Preview = ({ templateID, source }: PreviewProps) => {
    const [selectedDocument, setSelectedDocument] = useState<string | null>(null)
    const [promptValues, setPromptValues] = useState<PromptValues>({})

    const { data: promptsData } = useFrappeGetCall<{ message: FormTemplatePrompts[] }>(
        "pdf_forms.pdf_forms.doctype.form_template.form_template.get_form_template_prompts",
        { form_template_id: templateID },
        ["preview_prompts", templateID],
        { revalidateOnFocus: false }
    )

    const prompts = useMemo(() => promptsData?.message ?? [], [promptsData])

    const { data: docData, error: docError } = useFrappeGetCall<{ message: Record<string, unknown> }>(
        "frappe.client.get",
        { doctype: source, name: selectedDocument ?? "" },
        selectedDocument && source ? ["preview_doc", source, selectedDocument] : null,
        { revalidateOnFocus: false }
    )

    const documentData = useMemo(() => docData?.message ?? null, [docData])

    const setPromptValue = useCallback((fieldName: string, value: string | boolean) => {
        setPromptValues((prev) => ({ ...prev, [fieldName]: value }))
    }, [])

    const printData = useMemo(() => {
        if (!documentData) return null
        const merged = { ...documentData } as Record<string, unknown>
        for (const [key, val] of Object.entries(promptValues)) {
            merged[key] = val
        }
        return merged
    }, [documentData, promptValues])

    const getPrintUrl = () => {
        if (!printData) return "#"
        return `${web_url}/api/method/pdf_forms.api.print.print_form_template?template_id=${encodeURIComponent(templateID)}&data=${encodeURIComponent(JSON.stringify(printData))}&print_name=${encodeURIComponent(String(selectedDocument ?? "Print"))}.pdf`
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Document selection */}
            <section className="px-2">
                <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
                    <div className="flex flex-1 flex-col gap-2 min-w-0 sm:min-w-[240px] sm:max-w-xs">
                        <Label className="text-muted-foreground font-normal">
                            Select Document
                        </Label>
                        <LinkFieldCombobox
                            doctype={source}
                            value={selectedDocument ?? ""}
                            onChange={(value) => setSelectedDocument(value || null)}
                            placeholder={`Select ${source}`}
                            buttonClassName="h-10 rounded-lg"
                        />
                    </div>
                    {printData ? (
                        <Button
                            asChild
                            variant="default"
                            size="default"
                            className="h-10 shrink-0"
                        >
                            <a
                                href={getPrintUrl()}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Download PDF"
                                className="flex items-center gap-2"
                            >
                                <Printer className="size-4" />
                                Download PDF
                            </a>
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="default"
                            size="default"
                            disabled
                            className="h-10 shrink-0"
                            aria-label="Download PDF"
                        >
                            <Printer className="size-4" />
                            Download PDF
                        </Button>
                    )}
                </div>
                {docError && (
                    <div className="mt-3">
                        <ErrorBanner error={docError} />
                    </div>
                )}
            </section>

            {/* Prompt fields used in mapping */}
            {prompts.length > 0 && (
                <section className="px-5">
                    <h3 className="text-sm font-medium text-foreground mb-4">Prompt fields</h3>
                    <p className="text-xs text-muted-foreground mb-4">
                        These prompts are used in this template’s field mapping. Fill them to include in the printed PDF.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {prompts.map((prompt) => (
                            <div key={prompt.name ?? prompt.field_name} className="flex flex-col gap-2">
                                <Label className="text-sm">
                                    {prompt.label}
                                    {prompt.mandatory === 1 && <span className="text-destructive ml-0.5">*</span>}
                                </Label>
                                {prompt.type === "Checkbox" ? (
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id={`prompt-${prompt.field_name}`}
                                            checked={Boolean(promptValues[prompt.field_name])}
                                            onCheckedChange={(checked) =>
                                                setPromptValue(prompt.field_name, checked === true)
                                            }
                                        />
                                        <label
                                            htmlFor={`prompt-${prompt.field_name}`}
                                            className="text-sm text-muted-foreground cursor-pointer"
                                        >
                                            {prompt.description ?? "Yes / No"}
                                        </label>
                                    </div>
                                ) : (
                                    <Input
                                        id={`prompt-${prompt.field_name}`}
                                        type="text"
                                        placeholder={prompt.description ?? prompt.field_name}
                                        value={String(promptValues[prompt.field_name] ?? "")}
                                        onChange={(e) => setPromptValue(prompt.field_name, e.target.value)}
                                        className="h-10 rounded-lg"
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Document data / empty state */}
            <section className="overflow-hidden min-h-[280px]">
                {documentData ? (
                    <Accordion type="single" collapsible defaultValue="document-data" className="w-full">
                        <AccordionItem value="document-data" className="border-0">
                            <AccordionTrigger className="px-5 py-4 text-sm font-medium hover:no-underline hover:bg-muted/50 data-[state=open]:border-b data-[state=open]:border-border">
                                Document Data
                            </AccordionTrigger>
                            <AccordionContent className="px-0 pb-0 pt-0">
                                <div>
                                    <Editor
                                        jsonValue={documentData as Record<string, unknown>}
                                        templateID={templateID}
                                        readOnly
                                    />
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                ) : (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
                        <div className="rounded-full bg-muted p-4">
                            <FileJson className="size-8 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">
                                {selectedDocument ? "Loading document…" : "No document selected"}
                            </p>
                            <p className="text-sm text-muted-foreground max-w-sm">
                                {selectedDocument
                                    ? "Fetching document data…"
                                    : `Select a ${source} document above to preview its data and download a filled PDF.`}
                            </p>
                        </div>
                    </div>
                )}
            </section>
        </div>
    )
}
