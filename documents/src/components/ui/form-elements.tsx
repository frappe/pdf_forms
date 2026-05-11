import { type FieldValues, type RegisterOptions, useFormContext } from "react-hook-form"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, FormRequiredIndicator } from "@/components/ui/form"
import _ from "@/lib/translate"
import { Input } from "./input"
import { type ComponentProps, useState } from "react"
import { parseDate } from "chrono-node"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Button } from "./button"
import { CalendarIcon } from "lucide-react"
import { Calendar } from "./calendar"
import dayjs from "dayjs"
import { Textarea } from "./textarea"
import { Select, SelectContent, SelectTrigger, SelectValue } from "./select"
import { getUserDateFormat, formatDate, toDate } from "@/lib/date"
import LinkFieldCombobox, { type LinkFieldComboboxProps } from "../common/LinkField/LinkFieldCombobox"
import type { IAceEditorProps } from "react-ace"
import { FormCodeEditor } from "../common/Editor/FormCodeEditor"

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
                <FormLabel className={hideLabel ? 'sr-only' : ''}>{label}{isRequired && <FormRequiredIndicator />}</FormLabel>
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
                <FormLabel className={hideLabel ? 'sr-only' : ''}>{label}{isRequired && <FormRequiredIndicator />}</FormLabel>
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
                {formDescription && <FormDescription>{formDescription}</FormDescription>}
                <FormMessage />
            </FormItem>
        )}
    />
}

interface DateFieldProps extends FormElementProps {
    inputProps?: Omit<ComponentProps<"input">, "value" | "onChange" | "onBlur" | "name" | "ref">
}

export const DateField = ({ name, rules, label, isRequired, formDescription, inputProps, hideLabel, disabled }: DateFieldProps) => {

    const { control } = useFormContext()

    const DatePicker = ({ field }: { field: FieldValues }) => {

        const userDateFormat = getUserDateFormat()
        const [open, setOpen] = useState(false)

        const [value, setValue] = useState<string | undefined>(field.value ? formatDate(field.value) : undefined)

        const date = field.value ? toDate(field.value) : undefined

        return <div className="relative flex gap-2">
            <FormControl>
                <Input className="pe-10"
                    name={field.name}
                    onBlur={() => {
                        setValue(formatDate(field.value))
                        field.onBlur()
                    }}
                    placeholder={userDateFormat}
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value)
                        if (e.target.value) {
                            // On change in value, try computing date usning standard formats first
                            const dateObj = toDate(e.target.value, userDateFormat)
                            // If we find a valid date, use it
                            if (dateObj && !isNaN(dateObj.getTime())) {
                                field.onChange(formatDate(dateObj, "YYYY-MM-DD"))
                            } else {
                                // If not, try parsing using chrono-node for things like "1st July 2025"
                                const date = parseDate(e.target.value)
                                if (date) {
                                    field.onChange(formatDate(date, "YYYY-MM-DD"))
                                }
                            }
                        } else {
                            field.onChange("")
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "ArrowDown") {
                            e.preventDefault()
                            setOpen(true)
                        }
                    }}
                    maxLength={140}
                    {...inputProps} />
            </FormControl>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        id="date-picker-button"
                        variant="ghost"
                        theme="gray"
                        isIconButton
                        size="sm"
                        className="absolute top-1/2 ltr:right-2 rtl:left-2 -translate-y-1/2"
                    >
                        <CalendarIcon className="size-3.5" />
                        <span className="sr-only">{_("Select date")}</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto overflow-hidden p-0" align="center">
                    <Calendar
                        mode="single"
                        selected={date}
                        fixedWeeks
                        endMonth={dayjs().add(1, "year").toDate()}
                        captionLayout="dropdown"
                        defaultMonth={date}
                        onSelect={(selectedDate) => {
                            if (!selectedDate) return
                            setValue(formatDate(selectedDate))
                            field.onChange(formatDate(selectedDate, "YYYY-MM-DD"))
                            setOpen(false)
                        }}
                    />
                </PopoverContent>
            </Popover>
        </div>
    }

    return <FormField
        control={control}
        name={name}
        disabled={disabled}
        rules={rules}
        render={({ field }) => (
            <FormItem className='flex flex-col'>
                <FormLabel className={hideLabel ? 'sr-only' : ''}>{label}{isRequired && <FormRequiredIndicator />}</FormLabel>
                <DatePicker field={field} />
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
                <FormLabel className={hideLabel ? 'sr-only' : ''}>{label}{isRequired && <FormRequiredIndicator />}</FormLabel>
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
                <FormLabel className={hideLabel ? 'sr-only' : ''}>{label}{isRequired && <FormRequiredIndicator />}</FormLabel>
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
                        {isRequired && <FormRequiredIndicator className="-ml-1" />}
                    </FormLabel>
                    <FormControl>
                        <div className="min-h-[20vh] w-full rounded-md border border-outline-gray-2">
                            <FormCodeEditor
                                name={name}
                                value={field.value ?? ""}
                                    onChange={(value) => field.onChange(value)}
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