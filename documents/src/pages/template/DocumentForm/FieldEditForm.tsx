import { useFormContext } from 'react-hook-form'
import { useParams } from 'react-router-dom'
import { useFrappeGetCall } from 'frappe-react-sdk'
import { Type, Code } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import ErrorBanner from '@/components/ui/error-banner'
import {
    DataField,
    SelectFormField,
    CodeEditorFormField,
} from '@/components/ui/form-elements'
import { FormField, FormItem, FormControl, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import type { ConfigData } from '@/pages/template/Configuration/Configurations'
import SelectFields from './SelectFields'
import { useHotkeys } from 'react-hotkeys-hook'
import { CREATE_DEFAULT_OPTIONS } from '@/hooks/useReactHotKeys'
import { getKeyboardMetaKeyString } from '@/lib/utils'

interface FieldEditFormProps {
    index: number
}

export const FieldEditForm = ({ index }: FieldEditFormProps) => {
    const { watch, setValue } = useFormContext()
    const { templateID } = useParams<{ templateID: string }>()

    const valueType = watch(`fields.${index}.value_type`)
    const isDefaultJinja = watch(`fields.${index}.is_default_jinja`)
    const overrideStyle = watch(`fields.${index}.override_style`)

    const overrideStyleTrue = overrideStyle === '1' || overrideStyle === true || overrideStyle === 1

    const shouldFetch = (valueType === 'Field' || valueType === 'Prompt') && templateID

    const { data, error } = useFrappeGetCall<{ message: ConfigData }>(
        'form_printer.form_printer.doctype.form_template.form_template.get_fields_and_prompts_for_form_template',
        {
            form_template_id: templateID,
        },
        shouldFetch ? undefined : null,
        {
            revalidateOnFocus: false,
            revalidateIfStale: false,
            keepPreviousData: true,
        }
    )

    const resetMetaField = (value: string) => {
        setValue(`fields.${index}.field_value`, '')
        setValue(`fields.${index}.is_prompt`, value === 'Prompt')
        setValue(`fields.${index}.formatter`, '')
    }

    return (
        <div className="flex flex-col gap-4 px-4">
            {error && <ErrorBanner error={error} />}

            <div className="grid grid-cols-2 gap-4">
                <DataField
                    name={`fields.${index}.field_label`}
                    label="Label"
                    isRequired
                    readOnly
                    inputProps={{ placeholder: 'Label' }}
                />

                <DataField
                    name={`fields.${index}.field_type`}
                    label="Field Type"
                    isRequired
                    readOnly
                    inputProps={{ placeholder: 'Field Type' }}
                />

                <ValueTypeField index={index} resetMetaField={resetMetaField} />

                {valueType === 'Field' && (
                    <SelectFormField
                        name={`fields.${index}.formatter`}
                        label="Formatter"
                        rules={{ required: false }}
                        placeholder="Select Formatter"
                    >
                        <SelectItem value="Date">Date</SelectItem>
                        <SelectItem value="Currency">Currency</SelectItem>
                        <SelectItem value="Phone">Phone</SelectItem>
                        <SelectItem value="Number">Number</SelectItem>
                    </SelectFormField>
                )}

                {valueType === 'Prompt' && data?.message?.prompts && (
                    <SelectFormField
                        name={`fields.${index}.field_value`}
                        label="Select Prompt"
                        isRequired
                        rules={{ required: 'Prompt is required' }}
                    >
                        {data.message.prompts.map((prompt) => (
                            <SelectItem key={prompt.name} value={prompt.field_name}>
                                {prompt.label}
                            </SelectItem>
                        ))}
                    </SelectFormField>
                )}
            </div>

            {valueType === 'Field' && data?.message?.fields && (
                <>
                    <SelectFields schemaField={data.message.fields} name={`fields.${index}.field_value`} />
                    <DataField
                        name={`fields.${index}.field_value`}
                        label="Value"
                        readOnly
                        inputProps={{ placeholder: 'Selected field path will appear here' }}
                    />
                </>
            )}

            {valueType === 'Prompt' && (
                <DataField
                    name={`fields.${index}.field_value`}
                    label="Value"
                    readOnly
                    inputProps={{ placeholder: 'Selected prompt field name will appear here' }}
                />
            )}

            {valueType === 'Jinja' && (
                <CodeEditorFormField
                    name={`fields.${index}.field_value`}
                    label="Value"
                    isRequired
                    editorProps={{
                        placeholder: "eg: {{ frappe.format_date('2019-09-08') }}",
                        height: '30vh',
                    }}
                />
            )}

            {(valueType === 'Text') && (
                <DataField
                    name={`fields.${index}.field_value`}
                    label="Value"
                    isRequired
                    readOnly={valueType === 'Field'}
                    inputProps={{ placeholder: 'Value' }}
                />
            )}

            <FormField
                name={`fields.${index}.default_value`}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Default Value</FormLabel>
                        {isDefaultJinja ? (
                            <div className="relative min-h-[30vh]">
                                <CodeEditorFormField
                                    name={`fields.${index}.default_value`}
                                    label=""
                                    hideLabel
                                    editorProps={{
                                        placeholder: "eg: {{ frappe.format_date('2019-09-08') }}",
                                        height: '30vh',
                                    }}
                                />
                                <div className="absolute top-0 right-0">
                                    <ToggleDefaultValue index={index} />
                                </div>
                            </div>
                        ) : (
                            <div className="relative">
                                <InputGroup>
                                    <InputGroupInput
                                        {...field}
                                        placeholder="Default Value"
                                    />
                                </InputGroup>
                                <div className="absolute right-0 top-1/2 -translate-y-1/2">
                                    <ToggleDefaultValue index={index} />
                                </div>
                            </div>
                        )}
                    </FormItem>
                )}
            />

            <Separator />

            <FormField
                name={`fields.${index}.override_style`}
                render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                            <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                    field.onChange(checked)
                                    if (!checked) {
                                        setValue(`fields.${index}.font`, '')
                                        setValue(`fields.${index}.font_size`, '')
                                    } else {
                                        setValue(`fields.${index}.font`, 'helvetica')
                                        setValue(`fields.${index}.font_size`, 12)
                                    }
                                }}
                            />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel>Override Style</FormLabel>
                        </div>
                    </FormItem>
                )}
            />

            {overrideStyleTrue && (
                <div className="grid grid-cols-2 gap-4">
                    <SelectFormField name={`fields.${index}.font`} label="Font">
                        <SelectItem value="helvetica">Helvetica</SelectItem>
                        <SelectItem value="courier">Courier</SelectItem>
                        <SelectItem value="times-roman">Times Roman</SelectItem>
                        <SelectItem value="symbol">Symbol</SelectItem>
                        <SelectItem value="zapfdingbats">ZapfDingbats</SelectItem>
                    </SelectFormField>

                    <DataField
                        name={`fields.${index}.font_size`}
                        label="Font Size"
                        inputProps={{
                            type: 'number',
                            min: 0,
                            placeholder: '12',
                        }}
                    />
                </div>
            )}
        </div>
    )
}

const ToggleDefaultValue = ({ index }: { index: number }) => {
    const { setValue, watch } = useFormContext()
    const isDefaultJinja = watch(`fields.${index}.is_default_jinja`)

    return (
        <div className="flex border rounded-md overflow-hidden bg-white">
            <Button
                type="button"
                variant={!isDefaultJinja ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-none border-r"
                onClick={() => setValue(`fields.${index}.is_default_jinja`, false)}
            >
                <Type className="size-4" />
            </Button>
            <Button
                type="button"
                variant={isDefaultJinja ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-none"
                onClick={() => setValue(`fields.${index}.is_default_jinja`, true)}
            >
                <Code className="size-4" />
            </Button>
        </div>
    )
}

const ValueTypeField = ({
    index,
    resetMetaField,
}: {
    index: number
    resetMetaField: (value: string) => void
}) => {
    const { setValue } = useFormContext()

    useHotkeys(
        ['meta+t', 'ctrl+t'],
        () => {
            setValue(`fields.${index}.value_type`, 'Text')
            resetMetaField('Text')
        },
        CREATE_DEFAULT_OPTIONS
    )

    useHotkeys(
        ['meta+f', 'ctrl+f'],
        () => {
            setValue(`fields.${index}.value_type`, 'Field')
            resetMetaField('Field')
        },
        CREATE_DEFAULT_OPTIONS
    )

    useHotkeys(
        ['meta+p', 'ctrl+p'],
        () => {
            setValue(`fields.${index}.value_type`, 'Prompt')
            resetMetaField('Prompt')
        },
        CREATE_DEFAULT_OPTIONS
    )

    useHotkeys(
        ['meta+j', 'ctrl+j'],
        () => {
            setValue(`fields.${index}.value_type`, 'Jinja')
            resetMetaField('Jinja')
        },
        CREATE_DEFAULT_OPTIONS
    )

    const { control } = useFormContext()

    return (
        <FormField
            control={control}
            name={`fields.${index}.value_type`}
            rules={{ required: 'Value Type is required' }}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>
                        Value Type <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                        <Select
                            onValueChange={(value) => {
                                field.onChange(value)
                                resetMetaField(value)
                            }}
                            value={field.value}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Value Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Text">
                                    Text <span className="text-xs text-muted-foreground ml-2">({getKeyboardMetaKeyString()} + T)</span>
                                </SelectItem>
                                <SelectItem value="Field">
                                    Field <span className="text-xs text-muted-foreground ml-2">({getKeyboardMetaKeyString()} + F)</span>
                                </SelectItem>
                                <SelectItem value="Prompt">
                                    Prompt <span className="text-xs text-muted-foreground ml-2">({getKeyboardMetaKeyString()} + P)</span>
                                </SelectItem>
                                <SelectItem value="Jinja">
                                    Jinja <span className="text-xs text-muted-foreground ml-2">({getKeyboardMetaKeyString()} + J)</span>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}
