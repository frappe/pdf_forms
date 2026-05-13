import { useFrappeDocTypeEventListener, useFrappeDocumentEventListener, useFrappeEventListener, useFrappeGetDoc } from "frappe-react-sdk"
import { useAnnotationFocus } from "../../../hooks/useAnnotationFocus"
import type { FormTemplateField } from "@/types/FormPrinter/FormTemplateField"
import type { FormTemplate } from "@/types/FormPrinter/FormTemplate"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ErrorBanner from "@/components/ui/error-banner"
import { Configurations, PromptsContent } from "../Configuration/Configurations"
import { FieldsTable } from "./FieldsTable"
import { Preview } from "./Preview"
import { useMemo } from "react"

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
    const mutateAll = () => {
        return mutate().then(() => fields)
    }

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
                    <AlertTitle>Loading template...</AlertTitle>
                    <AlertDescription>Fetching fields and configuration.</AlertDescription>
                </Alert>
            </div>
        )
    }

    if (formTemplate && fields.length === 0) {
        return (
            <div className="flex justify-center items-center m-4">
                <Alert theme="amber">
                    <AlertTitle>We did not find any fields.</AlertTitle>
                    <AlertDescription>The system could not detect any fields, try manually creating a field.</AlertDescription>
                </Alert>
            </div>
        )
    }
    if (!error && formTemplate && fields.length > 0) return (
        <div>
            <Tabs defaultValue="map-fields" className="w-full py-3 px-2">
                <TabsList variant="underline" size="sm" className="grid w-full grid-cols-4">
                    <TabsTrigger value="map-fields">Mapping Fields</TabsTrigger>
                    <TabsTrigger value="fields">Fields</TabsTrigger>
                    <TabsTrigger value="prompts">Prompts</TabsTrigger>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>

                <TabsContent value="map-fields">
                    <FieldsTable data={fieldsTableData} focusedAnnotation={focusedAnnotation} onClick={onAnnotationClick} mutate={mutateAll}
                        templateID={templateID}
                    />
                </TabsContent>
                <TabsContent value="fields">
                    <Configurations />
                </TabsContent>
                <TabsContent value="prompts">
                    <PromptsContent />
                </TabsContent>
                <TabsContent value="preview">
                    <Preview templateID={templateID} source={formTemplate.source ?? ''} />
                </TabsContent>
            </Tabs>
        </div>
    )
    return null
}