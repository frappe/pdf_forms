import { useFrappeDocTypeEventListener, useFrappeEventListener, useFrappeGetCall, useFrappeGetDocList } from "frappe-react-sdk"
import { useAnnotationFocus } from "../../../hooks/useAnnotationFocus"
import type { FormTemplateField } from "@/types/FormPrinter/FormTemplateField"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ErrorBanner from "@/components/ui/error-banner"
import { Configurations } from "../Configuration/Configurations"
import { FieldsTable } from "./FieldsTable"
import { Preview } from "./Preview"

interface DocumentFormProps {
    templateID: string,
}

export const DocumentForm = ({ templateID }: DocumentFormProps) => {

    /** Fetch fields */
    const { data: fields, error, mutate } = useFrappeGetDocList<FormTemplateField>('Form Template Field', {
        filters: [
            ["form_template", "=", templateID]
        ],
        fields: ["name", "field_label", "field_value", "field_name", "field_type", "value_type", "annotation_type", 'override_style', 'font', 'font_size', 'is_prompt', 'formatter', 'xref', 'default_value', 'is_default_jinja'],
        orderBy: {
            field: "creation",
            order: "asc"
        },
        limit: 1000
    }, ['form_template_fields', templateID], {
        revalidateOnFocus: false,
        keepPreviousData: true,
        revalidateIfStale: false
    })

    const { data, error: docError, mutate: docMutate } = useFrappeGetCall<{
        message: {
            font: string,
            font_size: number,
            source: string
        }
    }>('frappe.client.get_value', {
        doctype: 'Form Template',
        filters: templateID,
        fieldname: JSON.stringify(['font', 'font_size', 'source'])
    }, ['font_data', templateID], {
        revalidateOnFocus: false,
        keepPreviousData: true,
        revalidateIfStale: false
    })

    const mutateAll = () => {
        docMutate()
        return mutate()
    }

    useFrappeDocTypeEventListener('Form Template Field', () => {
        mutate()
    })

    useFrappeEventListener('annotations_updated', (data) => {
        if (data.form_template_id === templateID) {
            mutate()
        }
    })


    const { focusedAnnotation, onAnnotationClick } = useAnnotationFocus(templateID)

    if (fields && fields.length === 0) {
        return (
            <div className="flex justify-center items-center m-4">
                <Alert variant="warning">
                    <AlertTitle>We did not find any fields.</AlertTitle>
                    <AlertDescription>The system could not detect any fields, try manually creating a field.</AlertDescription>
                </Alert>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex justify-center items-center m-4">
                <ErrorBanner error={error} />
            </div>
        )
    }
    if (docError) {
        return (
            <div className="flex justify-center items-center m-4">
                <ErrorBanner error={docError} />
            </div>
        )
    }

    if (!error && fields && fields.length > 0 && data?.message) return (
        <div>
            <Tabs defaultValue="map-fields" className="w-full p-1 px-2">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="map-fields">Map Fields</TabsTrigger>
                    <TabsTrigger value="metadata">Metadata</TabsTrigger>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>

                <TabsContent value="map-fields" className="mt-2">
                    <FieldsTable data={{
                        field: fields,
                        font: data.message.font,
                        font_size: data.message.font_size
                    }} focusedAnnotation={focusedAnnotation} onClick={onAnnotationClick} mutate={mutateAll}
                        templateID={templateID}
                    />
                </TabsContent>
                <TabsContent value="metadata" className="mt-2">
                    <Configurations />
                </TabsContent>
                <TabsContent value="preview" className="mt-2">
                    <Preview templateID={templateID} source={data?.message?.source ?? ''} />
                </TabsContent>
            </Tabs>
        </div>
    )
    return null
}