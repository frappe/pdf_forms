import { useState, useEffect, useRef } from 'react'
import { useFormContext } from 'react-hook-form'
import { ChevronsUpDown, Check } from 'lucide-react'
import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@components/ui/command'
import { FormItem, FormLabel, FormControl, FormRequiredIndicator } from '@components/ui/form'
import { cn } from '@lib/utils'
import type { SchemaField } from '@pages/template/Configuration/Configurations'
import _ from '@lib/translate'

interface FieldMap {
    field: string
    index?: string
    nested?: FieldMap
}

interface SearchableSelectProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    isDisabled?: boolean
    isSearchable?: boolean
    options: Array<{ value: string; label: string }>
}

const SearchableSelect = ({
    value,
    onChange,
    placeholder = _("Select an option"),
    isDisabled = false,
    isSearchable = true,
    options,
}: SearchableSelectProps) => {
    const [open, setOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    const selectedOption = options.find((opt) => opt.value === value)

    const filteredOptions = isSearchable
        ? options.filter((opt) =>
              opt.label.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : options

    return (
        <Popover open={open} onOpenChange={setOpen} modal={false}>
            <PopoverTrigger asChild>
                <Button
                    variant="subtle"
                    theme="gray"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between border border-transparent font-normal"
                    disabled={isDisabled}
                    size="md"
                >
                    <span
                        className={cn(
                            'min-w-0 flex-1 truncate text-start',
                            selectedOption ? 'text-ink-gray-7' : 'text-ink-gray-4',
                        )}
                    >
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent 
                align="start" 
                className="w-(--radix-popover-trigger-width) p-0"
                style={{ zIndex: 9999 }}
            >
                <Command shouldFilter={false} className="w-full">
                    {isSearchable && (
                        <CommandInput
                            placeholder={_("Search...")}
                            value={searchQuery}
                            onValueChange={setSearchQuery}
                        />
                    )}
                    <div 
                        ref={scrollContainerRef}
                        className="max-h-[350px] overflow-y-auto"
                        onWheel={(e) => {
                            // Stop propagation to prevent Dialog from capturing wheel events
                            e.stopPropagation()
                        }}
                    >
                        <CommandList>
                            <CommandEmpty>{_("No options found.")}</CommandEmpty>
                            <CommandGroup>
                                {filteredOptions.map((option) => (
                                    <CommandItem
                                        key={option.value}
                                        value={option.value}
                                        onSelect={() => {
                                            onChange(option.value)
                                            setOpen(false)
                                            setSearchQuery('')
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                'mr-2 size-4',
                                                value === option.value
                                                    ? 'opacity-100'
                                                    : 'opacity-0'
                                            )}
                                        />
                                        {option.label}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </div>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

const IndexField = ({
    index,
    onIndexChange,
}: {
    index?: string
    onIndexChange: (newIndex: string) => void
}) => (
    <FormItem>
        <FormLabel>
            {_("Index")} <FormRequiredIndicator className="ms-0.5" />
        </FormLabel>
        <FormControl>
            <Input
                type="number"
                placeholder={_("Index")}
                value={index || ''}
                onChange={(e) => onIndexChange(e.target.value)}
            />
        </FormControl>
    </FormItem>
)

const FieldSelector = ({
    schema,
    currentMap,
    onUpdate,
}: {
    schema: SchemaField
    currentMap: FieldMap
    onUpdate: (updatedMap: FieldMap) => void
}) => {
    const handleFieldChange = (selectedKey: string) => {
        const selectedField = schema.properties?.[selectedKey]
        if (!selectedField) return

        const updatedMap: FieldMap = { field: selectedKey }

        if (selectedField.schema_type === 'array' && selectedField.items) {
            updatedMap.index = '0'
            updatedMap.nested = { field: '' }
        } else if (
            selectedField.schema_type === 'object' &&
            selectedField.properties
        ) {
            updatedMap.nested = { field: '' }
        }

        onUpdate(updatedMap)
    }

    const handleIndexChange = (newIndex?: string) => {
        onUpdate({ ...currentMap, index: newIndex ?? '0' })
    }

    const fieldOptions =
        schema.properties
            ? Object.entries(schema.properties).map(([key, fieldSchema]) => ({
                  value: key,
                  label: `${fieldSchema.description || key} (${key})`,
              }))
            : []

    return (
        <>
            <FormItem>
                <FormLabel>
                    {(schema.description ?? 'Select Field')}{' '}
                    <FormRequiredIndicator className="ms-0.5" />
                </FormLabel>
                <FormControl>
                    <SearchableSelect
                        value={currentMap.field}
                        onChange={handleFieldChange}
                        placeholder={_("Select field")}
                        isSearchable
                        options={fieldOptions}
                    />
                </FormControl>
            </FormItem>

            {schema.properties?.[currentMap.field]?.schema_type === 'array' && (
                <>
                    <IndexField
                        index={currentMap.index}
                        onIndexChange={handleIndexChange}
                    />
                    {schema.properties?.[currentMap.field]?.items && (
                        <FieldSelector
                            schema={schema.properties[currentMap.field].items!}
                            currentMap={currentMap?.nested || { field: '' }}
                            onUpdate={(nestedMap) =>
                                onUpdate({ ...currentMap, nested: nestedMap })
                            }
                        />
                    )}
                </>
            )}

            {schema.properties?.[currentMap.field]?.schema_type === 'object' &&
                schema.properties[currentMap.field]?.properties && (
                    <FieldSelector
                        schema={schema.properties[currentMap.field]}
                        currentMap={currentMap.nested || { field: '' }}
                        onUpdate={(nestedMap) =>
                            onUpdate({ ...currentMap, nested: nestedMap })
                        }
                    />
                )}
        </>
    )
}

const buildFieldMap = (segments: (string | number)[]): FieldMap => {
    const fieldMap: FieldMap = { field: segments[0] as string }
    let currentMap = fieldMap
    for (let i = 1; i < segments.length; i++) {
        if (typeof segments[i] === 'number') {
            currentMap.index = segments[i].toString()
        } else {
            currentMap.nested = { field: segments[i] as string }
            currentMap = currentMap.nested
        }
    }
    return fieldMap
}

const parseFieldPath = (path: string): (string | number)[] => {
    const parts: (string | number)[] = []
    let current = ''
    let inBrackets = false
    let bracketContent = ''

    for (let i = 0; i < path.length; i++) {
        const char = path[i]

        if (char === '[') {
            if (current) {
                parts.push(current)
                current = ''
            }
            inBrackets = true
            bracketContent = ''
        } else if (char === ']') {
            if (inBrackets) {
                const index = parseInt(bracketContent, 10)
                if (!isNaN(index)) {
                    parts.push(index)
                }
                inBrackets = false
                bracketContent = ''
            }
        } else if (char === '.') {
            if (!inBrackets && current) {
                parts.push(current)
                current = ''
            } else if (inBrackets) {
                bracketContent += char
            } else {
                current += char
            }
        } else {
            if (inBrackets) {
                bracketContent += char
            } else {
                current += char
            }
        }
    }

    if (current) {
        parts.push(current)
    }

    return parts
}

const generateFieldMap = (value: string): FieldMap | null => {
    if (!value) return null
    const segments = parseFieldPath(value)
    if (segments.length === 0) return null
    return buildFieldMap(segments)
}

const generateValueFromFieldMap = (fieldMap: FieldMap): string => {
    let value = fieldMap.field
    if (fieldMap.index) value += `[${fieldMap.index}]`
    if (fieldMap.nested)
        value += `.${generateValueFromFieldMap(fieldMap.nested)}`
    return value
}

const SelectFields = ({
    schemaField,
    name,
}: {
    schemaField: SchemaField
    name: string
}) => {
    const { setValue, getValues } = useFormContext()
    const [fieldMap, setFieldMap] = useState<FieldMap | null>(() => {
        const value = getValues(name)
        return value ? generateFieldMap(value) : null
    })

    useEffect(() => {
        if (fieldMap) {
            setValue(name, generateValueFromFieldMap(fieldMap))
        }
    }, [fieldMap, name, setValue])

    const fieldOptions =
        schemaField.properties
            ? Object.entries(schemaField.properties).map(([key, fieldSchema]) => ({
                  value: key,
                  label: `${fieldSchema.description || key} (${key})`,
              }))
            : []

    return (
        <div className="grid grid-cols-2 gap-4">
            {fieldMap ? (
                <FieldSelector
                    schema={schemaField}
                    currentMap={fieldMap}
                    onUpdate={setFieldMap}
                />
            ) : (
                <FormItem>
                    <FormLabel>
                            {(schemaField.description || 'Fields')}{' '}
                        <FormRequiredIndicator className="ms-0.5" />
                    </FormLabel>
                    <FormControl>
                        <SearchableSelect
                            value=""
                            onChange={(value) => setFieldMap({ field: value })}
                                placeholder={_("Select {0}", [(schemaField.description ?? 'field')])}
                            isSearchable
                                options={fieldOptions}
                        />
                    </FormControl>
                </FormItem>
            )}
        </div>
    )
}

export default SelectFields
