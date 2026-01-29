import { Badge } from '@/components/ui/badge'

export const Prompts = ({ prompts }: {
    prompts: {
        field_name: string
        field_label: string
        field_type: 'Checkbox' | 'Radio' | 'Text'
    }[]
}) => {
    return (
        <div>
            {prompts.length > 0 ? (
                <div className="flex flex-col">
                    {prompts.map((customAttribute, index) => (
                        <div
                            key={index}
                            className={`flex items-center justify-between py-2 pl-4 text-sm font-medium ${index < prompts.length - 1 ? 'border-b border-gray-200' : ''}`}
                        >
                            <span>
                                {customAttribute.field_label} ({customAttribute.field_name})
                            </span>
                            <Badge variant="secondary">{customAttribute.field_type}</Badge>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">
                    No custom attributes set for this document.
                </p>
            )}
        </div>
    )
}