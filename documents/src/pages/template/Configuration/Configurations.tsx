import { FullPageLoader } from "@/components/common/FullPageLoader/FullPageLoader"
import ErrorBanner from "@/components/ui/error-banner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useFrappeGetCall } from "frappe-react-sdk"
import { useParams } from "react-router-dom"
import SchemaFieldList from "./SchemaFieldList"
import { Prompts } from "./Prompts"


export interface ConfigData {
    source: string
    fields: SchemaField
    prompts: {
        field_name: string
        field_label: string
        field_type: 'Checkbox' | 'Radio' | 'Text'
    }[]
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

    const { data, isLoading, error } = useFrappeGetCall<{ message: ConfigData }>('form_printer.form_printer.doctype.form_template.form_template.get_fields_and_prompts_for_form_template', {
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
            {data && data.message && <ConfigContent data={data.message} />}
        </div>
    )

}

export const ConfigContent = ({ data }: { data: ConfigData }) => {

    return (
        <div className="flex flex-col gap-2 m-4 h-full">
            <Tabs defaultValue="fields" className="w-full h-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="fields">Fields</TabsTrigger>
                    <TabsTrigger value="prompts">Prompts</TabsTrigger>
                </TabsList>
                <TabsContent value="fields" className="p-0">
                    <SchemaFieldList schema={data.fields} source={data.source}/>
                </TabsContent>
                <TabsContent value="prompts" className="p-0">
                    <Prompts prompts={data.prompts} />
                </TabsContent>
            </Tabs>

        </div>
    )
}