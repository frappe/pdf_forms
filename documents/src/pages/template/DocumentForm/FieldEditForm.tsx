import { useFormContext } from 'react-hook-form'
import { useParams } from 'react-router-dom'
import { useFrappeGetCall } from 'frappe-react-sdk'
import { TabsButton, TabsButtonItem } from '@components/ui/tab-buttons'
import { Checkbox } from '@components/ui/checkbox'
import { Separator } from '@components/ui/separator'
import ErrorBanner from '@components/ui/error-banner'
import {
    DataField,
    SelectFormField,
    CodeEditorFormField,
} from '@components/ui/form-elements'
import { FormField, FormItem, FormControl, FormLabel, FormMessage, FormRequiredIndicator } from '@components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select'
import { InputGroup, InputGroupInput } from '@components/ui/input-group'
import type { ConfigData } from '@pages/template/Configuration/Configurations'
import SelectFields from './SelectFields'
import { useHotkeys } from 'react-hotkeys-hook'
import { CREATE_DEFAULT_OPTIONS } from '@hooks/useReactHotKeys'
import { getKeyboardMetaKeyString } from '@lib/utils'
import _ from '@lib/translate'

/** Radix Select forbids `SelectItem value=""`. Map this to `""` in the form. */
const FORMATTER_CLEAR = '__formatter_clear__'

interface FieldEditFormProps {
    index: number
}

export const FieldEditForm = ({ index }: FieldEditFormProps) => {
    const { watch, setValue, control } = useFormContext()
    const { templateID } = useParams<{ templateID: string }>()

    const valueType = watch(`fields.${index}.value_type`)
    const isDefaultJinja = watch(`fields.${index}.is_default_jinja`)
    const overrideStyle = watch(`fields.${index}.override_style`)

    const overrideStyleTrue = overrideStyle === '1' || overrideStyle === true || overrideStyle === 1

    const shouldFetch = (valueType === 'Field' || valueType === 'Prompt') && templateID

    const { data, error } = useFrappeGetCall<{ message: ConfigData }>(
        'pdf_forms.pdf_forms.doctype.form_template.form_template.get_fields_and_prompts_for_form_template',
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
        <div className="flex flex-col gap-4">
            {error && <ErrorBanner error={error} />}

            <div className="grid grid-cols-2 gap-4">
                <DataField
                    name={`fields.${index}.field_label`}
                    label={_("Label")}
                    isRequired
                    readOnly
                    inputProps={{ placeholder: _("{0}", ["Label"]) }}
                />

                <DataField
                    name={`fields.${index}.field_type`}
                    label={_("Field Type")}
                    isRequired
                    readOnly
                    inputProps={{ placeholder: _("{0}", ["Field Type"]) }}
                />

                <ValueTypeField index={index} resetMetaField={resetMetaField} />

                {valueType === 'Field' && (
                    <FormField
                        control={control}
                        name={`fields.${index}.formatter`}
                        rules={{ required: false }}
                        render={({ field }) => {
                            const raw = field.value as string | null | undefined
                            const empty = raw == null || raw === ''
                            return (
                                <FormItem>
                                    <FormLabel>{_("Formatter")}</FormLabel>
                                    <Select
                                        value={empty ? FORMATTER_CLEAR : raw}
                                        onValueChange={(v) =>
                                            field.onChange(v === FORMATTER_CLEAR ? '' : v)
                                        }
                                    >
                                        <FormControl>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder={_("No formatter")} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value={FORMATTER_CLEAR}>{_("No formatter")}</SelectItem>
                                            <SelectItem value="Date">{_("{0}", ["Date"])}</SelectItem>
                                            <SelectItem value="Currency">{_("{0}", ["Currency"])}</SelectItem>
                                            <SelectItem value="Phone">{_("{0}", ["Phone"])}</SelectItem>
                                            <SelectItem value="Number">{_("{0}", ["Number"])}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )
                        }}
                    />
                )}

                {valueType === 'Prompt' && data?.message?.prompts && (
                    <SelectFormField
                        name={`fields.${index}.field_value`}
                        label={_("Select Prompt")}
                        isRequired
                        rules={{ required: _("{0}", ["Prompt is required"]) }}
                    >
                        {data.message.prompts.map((prompt) => (
                            <SelectItem key={prompt.name} value={prompt.field_name}>
                                {_("{0}", [prompt.label ?? ''])}
                            </SelectItem>
                        ))}
                    </SelectFormField>
                )}
            </div>

            {valueType === 'Field' && data?.message?.fields && (
                <>
                    <SelectFields key={`fields.${index}.field_value`} schemaField={data.message.fields} name={`fields.${index}.field_value`} />
                    <DataField
                        name={`fields.${index}.field_value`}
                        label={_("Value")}
                        readOnly
                        inputProps={{ placeholder: _("{0}", ["Selected field path will appear here"]) }}
                    />
                </>
            )}

            {valueType === 'Prompt' && (
                <DataField
                    name={`fields.${index}.field_value`}
                    label={_("Value")}
                    readOnly
                    inputProps={{ placeholder: _("{0}", ["Selected prompt field name will appear here"]) }}
                />
            )}

            {valueType === 'Jinja' && (
                <CodeEditorFormField
                    name={`fields.${index}.field_value`}
                    label={_("Value")}
                    isRequired
                    editorProps={{
                        placeholder: _("{0}", ["e.g. {{ frappe.format_date('2019-09-08') }}"]),
                        height: '30vh',
                    }}
                />
            )}

            {(valueType === 'Text') && (
                <DataField
                    name={`fields.${index}.field_value`}
                    label={_("Value")}
                    isRequired
                    readOnly={valueType === 'Field'}
                    inputProps={{ placeholder: _("{0}", ["Value"]) }}
                />
            )}

            <FormField
                name={`fields.${index}.default_value`}
                render={({ field }) => (
                    <FormItem>
                        {/* Mode switcher trails the label — one stable spot in both
                            modes (frappe-ui TabButtons pattern, à la Gameplan/CRM
                            view switchers). */}
                        <div className="flex items-center justify-between">
                            <FormLabel>{_("Default value")}</FormLabel>
                            <ToggleDefaultValue index={index} />
                        </div>
                        {isDefaultJinja ? (
                            <CodeEditorFormField
                                name={`fields.${index}.default_value`}
                                label=""
                                hideLabel
                                editorProps={{
                                    placeholder: _("{0}", ["e.g. {{ frappe.format_date('2019-09-08') }}"]),
                                    height: '30vh',
                                }}
                            />
                        ) : (
                            <InputGroup>
                                <InputGroupInput
                                    {...field}
                                    placeholder={_("{0}", ["e.g. 2019-09-08"])}
                                />
                            </InputGroup>
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
                            <FormLabel>{_("Override Style")}</FormLabel>
                        </div>
                    </FormItem>
                )}
            />

            {overrideStyleTrue && (
                <div className="grid grid-cols-2 gap-4">
                    <SelectFormField name={`fields.${index}.font`} label="Font">
                        <SelectItem value="helvetica">{_("Helvetica")}</SelectItem>
                        <SelectItem value="courier">{_("Courier")}</SelectItem>
                        <SelectItem value="times-roman">{_("Times Roman")}</SelectItem>
                        <SelectItem value="symbol">{_("Symbol")}</SelectItem>
                        <SelectItem value="zapfdingbats">{_("ZapfDingbats")}</SelectItem>
                    </SelectFormField>

                    <DataField
                        name={`fields.${index}.font_size`}
                        label={_("Font Size")}
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

    // frappe-ui TabButtons (subtle · sm): labeled segments beat cryptic icons,
    // and the radio-group semantics give arrow-key switching for free.
    return (
        <TabsButton
            value={isDefaultJinja ? 'jinja' : 'text'}
            onValueChange={(v) => setValue(`fields.${index}.is_default_jinja`, v === 'jinja')}
            aria-label={_("Default value mode")}
        >
            <TabsButtonItem value="text">{_("Text")}</TabsButtonItem>
            <TabsButtonItem value="jinja">{_("Jinja")}</TabsButtonItem>
        </TabsButton>
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
            rules={{ required: _("{0}", ["Value Type is required"]) }}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>
                        {_("Value Type")} <FormRequiredIndicator className="ms-0.5" />
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
                                <SelectValue placeholder={_("{0}", ["Select Value Type"])} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Text">
                                    {_("Text")} <span className="text-xs text-ink-gray-5 ms-2">({getKeyboardMetaKeyString()} + T)</span>
                                </SelectItem>
                                <SelectItem value="Field">
                                    {_("Field")} <span className="text-xs text-ink-gray-5 ms-2">({getKeyboardMetaKeyString()} + F)</span>
                                </SelectItem>
                                <SelectItem value="Prompt">
                                    {_("Prompt")} <span className="text-xs text-ink-gray-5 ms-2">({getKeyboardMetaKeyString()} + P)</span>
                                </SelectItem>
                                <SelectItem value="Jinja">
                                    {_("Jinja")} <span className="text-xs text-ink-gray-5 ms-2">({getKeyboardMetaKeyString()} + J)</span>
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
