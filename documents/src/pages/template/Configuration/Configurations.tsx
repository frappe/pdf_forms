import { FullPageLoader } from "@components/common/FullPageLoader/FullPageLoader"
import ErrorBanner from "@components/ui/error-banner"
import { useFrappeGetCall } from "frappe-react-sdk"
import { useParams } from "react-router-dom"
import SchemaFieldList from "./SchemaFieldList"
import { Prompts } from "./Prompts"
import type { FormTemplatePrompts } from "@types/FormPrinter/FormTemplatePrompts"


export interface ConfigData {
    source: string
    fields: SchemaField
    prompts: FormTemplatePrompts[]
}

export interface SchemaField {
    schema_type: string;
    description?: string;
    fieldtype?: string;
    properties?: Record<string, SchemaField>;
    enum?: any[];
    items?: SchemaField;
}


export const Configurations = () => {

    const { templateID } = useParams<{ templateID: string }>()

    const { data, isLoading, error } = useFrappeGetCall<{ message: ConfigData }>('pdf_forms.pdf_forms.doctype.form_template.form_template.get_fields_and_prompts_for_form_template', {
        form_template_id: templateID
    }, undefined, {
        revalidateOnFocus: false,
        revalidateIfStale: false,
        keepPreviousData: true
    })

    return (
        <div>
            {isLoading && <FullPageLoader />}
            {error && <ErrorBanner error={error} />}
            {data && data.message && templateID && <ConfigContent data={data.message} />}
        </div>
    )

}

export const ConfigContent = ({ data }: { data: ConfigData }) => {

    return (
        <div className="flex flex-col gap-2 px-2 h-full">
            <SchemaFieldList schema={data.fields} source={data.source} />
        </div>
    )
}

export const PromptsContent = () => {
    const { templateID } = useParams<{ templateID: string }>()

    const { data, isLoading, error, mutate } = useFrappeGetCall<{ message: ConfigData }>('pdf_forms.pdf_forms.doctype.form_template.form_template.get_fields_and_prompts_for_form_template', {
        form_template_id: templateID
    }, undefined, {
        revalidateOnFocus: false,
        revalidateIfStale: false,
        keepPreviousData: true
    })

    return (
        <div className="flex flex-col gap-2 px-2 h-full">
            {isLoading && <FullPageLoader />}
            {error && <ErrorBanner error={error} />}
            {data && data.message && templateID && <Prompts prompts={data.message.prompts} templateID={templateID} onRefresh={mutate} />}
        </div>
    )
}