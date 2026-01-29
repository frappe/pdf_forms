import { type FieldValues, type RegisterOptions, useFormContext } from "react-hook-form"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "./form"
import { Input } from "./input"
import { type ComponentProps } from "react"
import { Textarea } from "./textarea"
import { Select, SelectContent, SelectTrigger, SelectValue } from "./select"
import LinkFieldCombobox, { type LinkFieldComboboxProps } from "../common/LinkField/LinkFieldCombobox"
import { FormCodeEditor } from "../common/Editor/FormCodeEditor"
import type { IAceEditorProps } from "react-ace"

interface FormElementProps {
    name: string,
    rules?: Omit<RegisterOptions<FieldValues, string>, "disabled" | "valueAsNumber" | "valueAsDate" | "setValueAs">,
    label: string,
    isRequired?: boolean,
    disabled?: boolean,
    formDescription?: string,
    hideLabel?: boolean,
    readOnly?: boolean,

}

interface DataFieldProps extends FormElementProps {
    inputProps?: Omit<ComponentProps<"input">, "value" | "onChange" | "onBlur" | "name" | "ref">
}

export const DataField = ({ name, rules, label, isRequired, formDescription, inputProps, hideLabel, disabled, readOnly }: DataFieldProps) => {

    const { control } = useFormContext()
    return <FormField
        control={control}
        disabled={disabled}
        name={name}
        rules={rules}
        render={({ field }) => (
            <FormItem className='flex flex-col'>
                <FormLabel className={hideLabel ? 'sr-only' : ''}>{label}{isRequired && <span className="text-destructive -ml-1">*</span>}</FormLabel>
                <FormControl>
                    <Input {...field} maxLength={140} aria-readonly={readOnly} readOnly={readOnly} {...inputProps} />
                </FormControl>
                {formDescription && <FormDescription>{formDescription}</FormDescription>}
                <FormMessage />
            </FormItem>
        )}
    />
}

interface SelectFieldProps extends FormElementProps {
    children: React.ReactNode
}

export const SelectFormField = ({ name, rules, label, isRequired, formDescription, hideLabel, children, disabled, readOnly }: SelectFieldProps) => {

    const { control } = useFormContext()

    return <FormField
        control={control}
        name={name}
        disabled={disabled}
        rules={rules}
        render={({ field }) => (
            <FormItem>
                <FormLabel className={hideLabel ? 'sr-only' : ''}>{label}{isRequired && <span className="text-destructive -ml-1">*</span>}</FormLabel>
                <FormControl>
                    <Select onValueChange={field.onChange} value={field.value} disabled={disabled || readOnly} aria-readonly={readOnly}>
                        <FormControl>
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {children}
                        </SelectContent>
                    </Select>
                </FormControl>
                {formDescription && <FormDescription>{formDescription}</FormDescription>}
                <FormMessage />
            </FormItem>
        )}
    />
}


interface SmallTextFieldProps extends FormElementProps {
    inputProps?: Omit<ComponentProps<"textarea">, "value" | "onChange" | "onBlur" | "name" | "ref">
}

export const SmallTextField = ({ name, rules, label, isRequired, formDescription, inputProps, hideLabel, disabled, readOnly }: SmallTextFieldProps) => {

    const { control } = useFormContext()
    return <FormField
        control={control}
        name={name}
        disabled={disabled}
        rules={rules}
        render={({ field }) => (
            <FormItem className='flex flex-col'>
                <FormLabel className={hideLabel ? 'sr-only' : ''}>{label}{isRequired && <span className="text-destructive -ml-1">*</span>}</FormLabel>
                <FormControl>
                    <Textarea {...field} {...inputProps} readOnly={readOnly} aria-readonly={readOnly} />
                </FormControl>
                {formDescription && <FormDescription>{formDescription}</FormDescription>}
                <FormMessage />
            </FormItem>
        )}
    />
}

interface LinkFormFieldProps extends FormElementProps, Omit<LinkFieldComboboxProps, 'value' | 'onChange'> {
}

export const LinkFormField = ({ name, rules, label, isRequired, formDescription, hideLabel, disabled, readOnly, ...inputProps }: LinkFormFieldProps) => {

    const { control } = useFormContext()

    return <FormField
        control={control}
        name={name}
        disabled={disabled}
        rules={rules}
        render={({ field }) => (
            <FormItem className='flex flex-col'>
                <FormLabel className={hideLabel ? 'sr-only' : ''}>{label}{isRequired && <span className="text-destructive -ml-1">*</span>}</FormLabel>
                <LinkFieldCombobox {...inputProps} value={field.value} onChange={field.onChange} useInForm disabled={disabled} readOnly={readOnly} />
                {formDescription && <FormDescription>{formDescription}</FormDescription>}
                <FormMessage />
            </FormItem>
        )}
    />
}

interface CodeEditorFormFieldProps extends FormElementProps {
    editorProps?: Omit<IAceEditorProps, "value" | "onChange" | "name">
}

export const CodeEditorFormField = ({
    name,
    rules,
    label,
    isRequired,
    formDescription,
    hideLabel,
    disabled,
    readOnly,
    editorProps = {},
}: CodeEditorFormFieldProps) => {
    const { control } = useFormContext()
    return (
        <FormField
            control={control}
            name={name}
            disabled={disabled}
            rules={rules}
            render={({ field }) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars -- onBlur from editorProps excluded so we always use field.onBlur
                const { onBlur: _omit, ...restEditorProps } = editorProps ?? {}
                return (
                <FormItem className="flex flex-col">
                    <FormLabel className={hideLabel ? "sr-only" : ""}>
                        {label}
                        {isRequired && <span className="text-destructive -ml-1">*</span>}
                    </FormLabel>
                    <FormControl>
                        <div className="min-h-[20vh] w-full rounded-md border border-input">
                            <FormCodeEditor
                                name={name}
                                value={field.value ?? ""}
                                onChange={field.onChange}
                                onBlur={() => field.onBlur()}
                                readOnly={readOnly}
                                {...restEditorProps}
                            />
                        </div>
                    </FormControl>
                    {formDescription && <FormDescription>{formDescription}</FormDescription>}
                    <FormMessage />
                </FormItem>
                )
            }}
        />
    )
}