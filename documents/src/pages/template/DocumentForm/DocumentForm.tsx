import { useFrappeDocTypeEventListener, useFrappeDocumentEventListener, useFrappeEventListener, useFrappeGetDoc } from "frappe-react-sdk"
import { useAnnotationFocus } from "../../../hooks/useAnnotationFocus"
import type { FormTemplateField } from "@types/FormPrinter/FormTemplateField"
import type { FormTemplate } from "@types/FormPrinter/FormTemplate"
import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs"
import ErrorBanner from "@components/ui/error-banner"
import { Configurations, PromptsContent } from "../Configuration/Configurations"
import { FieldsTable } from "./FieldsTable"
import { Preview } from "./Preview"
import { useCallback, useEffect, useMemo } from "react"
import { FormProvider, useFieldArray, useForm } from "react-hook-form"
import { useFrappePostCall } from "frappe-react-sdk"
import { useHotkeys } from "react-hotkeys-hook"
import { toast } from "sonner"
import { useRegisterTemplateSave } from "../TemplateSaveContext"
import { StyleFields } from "./StyleFields"
import type { TemplateFormValues } from "./formTypes"
import _ from "@lib/translate"

interface DocumentFormProps {
    templateID: string,
}

export const DocumentForm = ({ templateID }: DocumentFormProps) => {

    const { data: formTemplate, error, mutate, isLoading } = useFrappeGetDoc<FormTemplate>('Form Template', templateID, undefined, {
        revalidateOnFocus: false,
        keepPreviousData: true,
        revalidateIfStale: false
    })

    const fields: FormTemplateField[] = useMemo(() => [...(formTemplate?.form_template_field ?? [])].sort((a, b) =>
        (a.creation ?? "").localeCompare(b.creation ?? "")
    ), [formTemplate])

    const fieldsTableData = useMemo(
        () => ({
            field: fields,
            font: formTemplate?.font ?? 'helvetica',
            font_size: Number(formTemplate?.font_size ?? 12),
        }),
        [fields, formTemplate?.font, formTemplate?.font_size],
    )
    /* ------------------------------------------------------------------ *
     * The template form lives HERE, above the tabs, not inside a tab.
     * Radix unmounts inactive tab content, so a form owned by the Mapping
     * Fields tab would be destroyed the moment you opened Style — taking
     * unsaved edits and the header's Save button with it.
     * ------------------------------------------------------------------ */
    const defaultFields = useMemo(
        () => fields.map((field) => ({
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
            page_index: field.page_index,
            default_value: field.default_value,
            is_default_jinja: field.is_default_jinja,
        })),
        [fields],
    )

    const methods = useForm<TemplateFormValues>({
        defaultValues: {
            fields: defaultFields,
            font: fieldsTableData.font,
            font_size: fieldsTableData.font_size,
        },
    })
    const { handleSubmit, control, reset, formState: { isDirty } } = methods

    useEffect(() => {
        reset({
            fields: defaultFields,
            font: fieldsTableData.font,
            font_size: fieldsTableData.font_size,
        })
    }, [defaultFields, fieldsTableData.font, fieldsTableData.font_size, reset])

    useFieldArray({ control, name: "fields" })

    const { call, error: saveError, loading: saving } = useFrappePostCall(
        'pdf_forms.pdf_forms.doctype.form_template_field.form_template_field.update_form_template_fields'
    )

    const onSubmit = useCallback((values: TemplateFormValues) => {
        if (!values?.fields) return
        call({
            fields: values.fields as FormTemplateField[],
            form_template_id: templateID,
            font: values.font,
            font_size: values.font_size,
        }).then(() => {
            toast.success(_("Fields updated successfully"))
            mutate()
        }).catch((err: { message?: string }) => {
            toast.error(_("Error updating custom fields"), {
                description: (err.message ?? ''),
            })
        })
    }, [call, templateID, mutate])

    // Desk behaviour: Save stays clickable, but a no-op save is refused.
    const submitSave = useCallback(() => {
        if (!isDirty) {
            toast.warning(_("No changes in document"))
            return
        }
        void handleSubmit(onSubmit)()
    }, [isDirty, handleSubmit, onSubmit])

    const saveHandle = useMemo(() => ({
        save: submitSave,
        saving,
        dirty: isDirty,
    }), [submitSave, saving, isDirty])
    useRegisterTemplateSave(saveHandle)

    useHotkeys(["meta+s", "ctrl+s"], submitSave, {
        preventDefault: true,
        enableOnFormTags: true,
    }, [submitSave])

    useFrappeDocTypeEventListener('Form Template', (data) => {
        if (data?.name === templateID) {
            mutate()
        }
    })

    useFrappeEventListener('form_template_process_completed', (data) => {
        if (data.form_template_id === templateID) {
            mutate()
        }
    })


    useFrappeDocumentEventListener('Form Template', templateID, (data) => {
        if (data.doctype === 'Form Template' && data.name === templateID) {
            mutate()
        }
    })

    const { focusedAnnotation, onAnnotationClick } = useAnnotationFocus(templateID)

    if (error) {
        return (
            <div className="flex justify-center items-center m-4">
                <ErrorBanner error={error} />
            </div>
        )
    }

    if (isLoading && !formTemplate) {
        return (
            <div className="flex justify-center items-center m-4">
                <Alert>
                    <AlertTitle>{_("Loading template...")}</AlertTitle>
                    <AlertDescription>{_("Fetching fields and configuration.")}</AlertDescription>
                </Alert>
            </div>
        )
    }

    if (formTemplate && fields.length === 0) {
        return (
            <div className="flex justify-center items-center m-4">
                <Alert theme="amber">
                    <AlertTitle>{_("We did not find any fields.")}</AlertTitle>
                    <AlertDescription>{_("The system could not detect any fields, try manually creating a field.")}</AlertDescription>
                </Alert>
            </div>
        )
    }
    if (!error && formTemplate && fields.length > 0) return (
        <FormProvider {...methods}>
        <div className="flex h-full min-h-0 flex-col">
            {/* h-10 tab strip, no top padding — its bottom border lines up with the
                annotator toolbar's across the pane divider. */}
            <Tabs defaultValue="map-fields" className="flex h-full min-h-0 w-full flex-col px-4">
                <TabsList variant="underline" size="md" className="h-10 w-full shrink-0 items-stretch">
                    <TabsTrigger value="map-fields">{_("Mapping Fields")}</TabsTrigger>
                    <TabsTrigger value="fields">{_("Fields")}</TabsTrigger>
                    <TabsTrigger value="prompts">{_("Prompts")}</TabsTrigger>
                    <TabsTrigger value="style">{_("Style")}</TabsTrigger>
                    <TabsTrigger value="preview">{_("Preview")}</TabsTrigger>
                </TabsList>

                {/* Each pane owns its scrolling: map-fields scrolls inside FieldsTable
                    (sticky toolbar), the rest scroll at the tab-content level.
                    The scrolling panes get 4px of side room (-mx-1 px-1): content stays
                    aligned with the tab strip, but a focused input's 2px ring is no
                    longer clipped by the pane's own overflow at its first/last column. */}
                <TabsContent value="map-fields" className="min-h-0 overflow-hidden">
                    <FieldsTable
                        data={fieldsTableData}
                        focusedAnnotation={focusedAnnotation}
                        onClick={onAnnotationClick}
                        templateID={templateID}
                        saveError={saveError}
                    />
                </TabsContent>
                <TabsContent value="fields" className="min-h-0 overflow-y-auto scroll-fade -mx-1 px-1">
                    <Configurations />
                </TabsContent>
                {/* Prompts scrolls its list internally so the Add Prompt button stays pinned. */}
                <TabsContent value="prompts" className="min-h-0 overflow-hidden">
                    <PromptsContent />
                </TabsContent>
                <TabsContent value="style" className="min-h-0 overflow-y-auto scroll-fade -mx-1 px-1">
                    <StyleFields />
                </TabsContent>
                <TabsContent value="preview" className="flex min-h-0 flex-col overflow-y-auto scroll-fade -mx-1 px-1">
                    <Preview templateID={templateID} source={formTemplate.source ?? ''} />
                </TabsContent>
            </Tabs>
        </div>
        </FormProvider>
    )
    return null
}