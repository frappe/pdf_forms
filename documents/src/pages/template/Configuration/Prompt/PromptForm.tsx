import { Checkbox } from "@/components/ui/checkbox"
import { FormControl, FormItem, FormLabel } from "@/components/ui/form"
import { FormField } from "@/components/ui/form"
import { DataField, SmallTextField } from "@/components/ui/form-elements"
import type { FormTemplatePrompts } from "@/types/FormPrinter/FormTemplatePrompts"
import { useFormContext } from "react-hook-form"


export const PromptForm = ({ isEdit }: { isEdit: boolean }) => {

    const { control } = useFormContext<FormTemplatePrompts>()

    return (
        <div className="flex flex-col gap-6">
            <DataField name="field_name" label="Field Name" isRequired formDescription={isEdit ? "Changing this may require updating mappings where it's used." : "Use lowercase letters and join words with underscores (e.g. order_date, customer_name)."} />
            <DataField name="label" label="Label" isRequired formDescription="The label to display for the prompt." />
            <SmallTextField name="description" label="Description" />
            <FormField
                control={control}
                name="mandatory"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-start gap-3 space-y-0">
                        <FormControl>
                            <Checkbox
                                checked={field.value === 1 ? true : false}
                                onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)}
                            />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel>Mandatory</FormLabel>
                        </div>
                    </FormItem>
                )}
            />
        </div>
    )
}