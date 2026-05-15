import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { web_url } from '@/config/socket';
import type { SchemaField } from './Configurations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronDown, Download, Copy } from 'lucide-react';
import { toast } from 'sonner';
import _ from '@/lib/translate';

const SchemaFieldList: React.FC<{ schema: SchemaField, source: string }> = ({ schema, source }) => {
    const { templateID } = useParams<{ templateID: string }>();

    const renderField = (field: SchemaField, fieldKey?: string, isRoot = false) => {
        return (
            <div
                key={fieldKey}
                className="py-1 border-b border-outline-gray-2 last:border-b-0 max-h-[87vh] overflow-y-auto pr-1"
            >
                {/* Render properties recursively if they exist */}
                {field.properties && field.schema_type !== 'object' && (
                    <div className="ml-4 mt-2">
                        <div className="flex flex-col gap-2">
                            {Object.entries(field.properties).map(([subFieldKey, subField]) =>
                                renderField(subField, subFieldKey)
                            )}
                        </div>
                    </div>
                )}

                {/* Root level object: show content directly, no accordion */}
                {field.schema_type === 'object' && isRoot && (
                    <>
                        {field.properties && (
                            <div className="flex flex-col gap-2 pl-0 py-2">
                                {Object.entries(field.properties).map(([subFieldKey, subField]) =>
                                    renderField(subField, subFieldKey)
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* Nested object: use accordion */}
                {field.schema_type === 'object' && !isRoot && (
                    <CollapsibleSection
                        trigger={<FieldRow field={field} fieldKey={fieldKey} />}
                    >
                        {field.properties && (
                            <div className="flex flex-col gap-2 pl-4 py-4">
                                {Object.entries(field.properties).map(([subFieldKey, subField]) =>
                                    renderField(subField, subFieldKey)
                                )}
                            </div>
                        )}
                    </CollapsibleSection>
                )}

                {/* Only show accordion if field has items (and not root) */}
                {field.items && field.items.schema_type === 'object' ? (
                    isRoot ? (
                        field.items.properties && (
                            <div className="flex flex-col gap-2 pl-0 py-2">
                                {Object.entries(field.items.properties).map(([itemFieldKey, itemField]) =>
                                    renderField(itemField, itemFieldKey)
                                )}
                            </div>
                        )
                    ) : (
                        <CollapsibleSection
                            trigger={<FieldRow field={field} fieldKey={fieldKey} />}
                        >
                            {field.items.properties && (
                                <div className="flex flex-col gap-2 pl-4 py-4">
                                    {Object.entries(field.items.properties).map(([itemFieldKey, itemField]) =>
                                        renderField(itemField, itemFieldKey)
                                    )}
                                </div>
                            )}
                        </CollapsibleSection>
                    )
                ) : field.items ? (
                        <p className="text-sm text-ink-gray-5">{_("Items Type: {0}", [_("{0}", [field.items.schema_type])])}</p>
                ) : (
                    !isRoot && field.schema_type !== 'object' && <FieldRow field={field} fieldKey={fieldKey} />
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-semibold tracking-tight text-ink-gray-8">
                    {_("{0}", [source])}
                </h2>
                <Button
                    size="sm"
                    isIconButton
                    variant="outline"
                    theme="gray"
                    asChild
                    title="Download"
                >
                    <a
                        href={`${web_url}/api/method/pdf_forms.pdf_forms.doctype.form_template.form_template.download_data_source_sheet?template_id=${templateID}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Download Data Source"
                    >
                        <Download className="size-4" />
                    </a>
                </Button>
            </div>
            <div>
                {renderField(schema, undefined, true)}
            </div>
        </div>
    );
};

export default SchemaFieldList;

function CollapsibleSection({
    trigger,
    children,
}: {
    trigger: React.ReactNode;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border-0">
            <button
                type="button"
                className="flex w-full items-center gap-2 p-0 text-left"
                onClick={() => setOpen((o) => !o)}
            >
                <span className="flex-1">{trigger}</span>
                <ChevronDown
                    className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')}
                />
            </button>
            {open && <div>{children}</div>}
        </div>
    );
}

const FieldRow: React.FC<{ field: SchemaField; fieldKey?: string }> = ({ field, fieldKey }) => {
    const copyFieldName = () => {
        if (fieldKey) {
            void navigator.clipboard.writeText(fieldKey).then(() => {
                toast.success(_("Copied to clipboard"))
            }).catch(() => {
                toast.error(_("Failed to copy"))
            })
        }
    }

    return (
        <div className="flex flex-col gap-0 px-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                        {fieldKey ? `${_("{0}", [field.description ?? ''])} (${_("{0}", [fieldKey])})` : _("{0}", [field.description ?? ''])}
                    </span>
                    {fieldKey && (
                        <Button
                            type="button"
                            variant="ghost"
                            theme="gray"
                            size="sm"
                            isIconButton
                            onClick={(e) => {
                                e.stopPropagation()
                                copyFieldName()
                            }}
                            aria-label="Copy field name"
                            title='Copy field name'
                        >
                            <Copy className="size-3" />
                        </Button>
                    )}
                </div>
                {field.fieldtype && <Badge variant="subtle" theme="gray">{_("{0}", [field.fieldtype])}</Badge>}
            </div>
            {field.enum && (
                <p className="text-sm text-ink-gray-5">
                    {_("Option(s): {0}", [_("{0}", [field.enum.join(', ')])])}
                </p>
            )}
        </div>
    );
};
