import { useFrappeGetCall } from "frappe-react-sdk"
import { useCallback, useEffect, useMemo, useState } from "react"
import LinkFieldCombobox from "@components/common/LinkField/LinkFieldCombobox"
import { Editor } from "@components/common/Editor/Editor"
import { Button } from "@components/ui/button"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@components/ui/accordion"
import { Label } from "@components/ui/label"
import { Input } from "@components/ui/input"
import { Checkbox } from "@components/ui/checkbox"
import { FileJson, Printer } from "lucide-react"
import { web_url } from "@config/socket"
import ErrorBanner from "@components/ui/error-banner"
import type { FormTemplatePrompts } from "@types/FormPrinter/FormTemplatePrompts"
import { usePreviewData } from "../PreviewDataContext"
import _ from "@lib/translate"

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

    // Publish the resolved document so the annotator can draw the real values
    // onto the PDF while you work.
    const { setPreviewDocument } = usePreviewData()

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

    useEffect(() => {
        setPreviewDocument(selectedDocument, printData)
    }, [selectedDocument, printData, setPreviewDocument])

    const getPrintUrl = () => {
        if (!printData) return "#"
        return `${web_url}/api/method/pdf_forms.api.print.print_form_template?template_id=${encodeURIComponent(templateID)}&data=${encodeURIComponent(JSON.stringify(printData))}&print_name=${encodeURIComponent(String(selectedDocument ?? "Print"))}.pdf`
    }

    return (
        // min-h-full: stretch to the tab pane so the editor can take what is
        // left; if a tall prompt list makes it overflow, the PANE scrolls.
        <div className="flex min-h-full flex-col gap-4">
            {/* Document selection */}
            <section className="shrink-0">
                <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
                    <div className="flex flex-1 flex-col gap-2 min-w-0 sm:min-w-[240px] sm:max-w-xs">
                        <Label>
                            {_("Select Document")}
                        </Label>
                        <LinkFieldCombobox
                            doctype={source}
                            value={selectedDocument ?? ""}
                            onChange={(value) => setSelectedDocument(value || null)}
                            placeholder={_("Select {0}", [source])}
                            buttonClassName="h-8"
                        />
                    </div>
                    {printData ? (
                        <Button
                            title={_("Download PDF")}
                            asChild
                            variant="outline"
                            size="md"
                            className="shrink-0"
                        >
                            <a
                                href={getPrintUrl()}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Download PDF"
                                className="flex items-center gap-2"
                            >
                                <Printer className="size-4" />
                                {_("Download PDF")}
                            </a>
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="outline"
                            size="md"
                            disabled
                            className="shrink-0"
                            aria-label="Download PDF"
                                title={_("Download PDF")}
                        >
                            <Printer className="size-4" />
                                {_("Download PDF")}
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
                <section>
                    <h3 className="text-lg-semibold text-ink-gray-8 mb-1">{_("Prompt fields")}</h3>
                    <p className="text-p-sm text-ink-gray-5 mb-4">
                        {_("These prompts are used in this template’s field mapping. Fill them to include in the printed PDF.")}
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {prompts.map((prompt) => (
                            <div key={prompt.name ?? prompt.field_name} className="flex flex-col gap-1">
                                <Label className="text-sm">
                                    {prompt.label}
                                    {prompt.mandatory === 1 && <span className="text-ink-red-6 ms-0.5" aria-hidden>*</span>}
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
                                            className="text-sm text-ink-gray-5 cursor-pointer"
                                        >
                                            {(prompt.description ?? _("{0} / {1}", [_("Yes"), _("No")]))}
                                        </label>
                                    </div>
                                ) : (
                                    <Input
                                        id={`prompt-${prompt.field_name}`}
                                        type="text"
                                            placeholder={(prompt.description ?? prompt.field_name)}
                                        value={String(promptValues[prompt.field_name] ?? "")}
                                        onChange={(e) => setPromptValue(prompt.field_name, e.target.value)}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Document data / empty state — the editor fills whatever height is
                left in the pane (never less than 240px) and scrolls inside itself. */}
            <section className="flex min-h-0 flex-1 flex-col overflow-x-hidden">
                {documentData ? (
                    <Accordion type="single" collapsible defaultValue="document-data" className="flex min-h-0 w-full flex-1 flex-col">
                        <AccordionItem value="document-data" className="flex min-h-0 flex-1 flex-col border-0">
                            {/* No bottom border here: the editor draws its own frame. */}
                            <AccordionTrigger className="shrink-0 p-2 text-sm font-medium hover:no-underline hover:bg-surface-gray-2">
                                {_("Document Data")}
                            </AccordionTrigger>
                            {/* contentClassName reaches the Radix wrapper so the flex chain
                                survives it; the open animation is off because Radix would
                                animate to the measured height, then snap to the flexed one. */}
                            <AccordionContent
                                contentClassName="flex min-h-0 flex-1 flex-col data-[state=open]:animate-none"
                                className="flex min-h-0 flex-1 flex-col px-0 pb-0 pt-0"
                            >
                                <div className="min-h-[240px] w-full flex-1">
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
                        <div className="rounded-full bg-surface-gray-2 p-4">
                            <FileJson className="size-8 text-ink-gray-5" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-ink-gray-8">
                                    {selectedDocument ? _("{0}...", [_("Loading document")]) : _("{0}...", [_("No document selected")])}
                            </p>
                            <p className="text-sm text-ink-gray-5 max-w-sm">
                                {selectedDocument
                                        ? _("{0}...", [_("Fetching document data")])
                                        : _("{0}...", [_("Select a {0} document above to preview its data and download a filled PDF.", [source])])}
                            </p>
                        </div>
                    </div>
                )}
            </section>
        </div>
    )
}
