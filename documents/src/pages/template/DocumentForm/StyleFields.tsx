import { SelectItem } from "@components/ui/select"
import { DataField, SelectFormField } from "@components/ui/form-elements"
import _ from "@lib/translate"

/**
 * Style tab — document-wide typography for the printed PDF.
 *
 * These are template-level settings you set once, so they live in their own tab
 * instead of sitting above the mapping list. They read/write the same form as
 * the Mapping Fields tab (owned by DocumentForm), so the header's Save button
 * covers both.
 */
export const StyleFields = () => {
    return (
        <div className="flex max-w-xl flex-col gap-5 py-4">
            <div>
                <h3 className="text-lg-semibold text-ink-gray-8">{_("Document Style")}</h3>
                <p className="mt-1 text-p-sm text-ink-gray-5">
                    {_("Applies to every field on this template, unless a field overrides it in its own editor.")}
                </p>
            </div>

            <div className="flex flex-row items-start gap-4">
                <div className="w-full min-w-[140px]">
                    <SelectFormField name="font" label={_("Font")}>
                        <SelectItem value="helvetica">{_("Helvetica")}</SelectItem>
                        <SelectItem value="courier">{_("Courier")}</SelectItem>
                        <SelectItem value="times-roman">{_("Times Roman")}</SelectItem>
                        <SelectItem value="symbol">{_("Symbol")}</SelectItem>
                        <SelectItem value="zapfdingbats">{_("ZapfDingbats")}</SelectItem>
                    </SelectFormField>
                </div>
                <div className="w-full min-w-[140px]">
                    <DataField
                        name="font_size"
                        label={_("Font Size")}
                        inputProps={{ type: 'number', min: 0 }}
                    />
                </div>
            </div>
        </div>
    )
}
