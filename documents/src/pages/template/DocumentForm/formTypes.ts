import type { FormTemplateField } from "@types/FormPrinter/FormTemplateField"

/**
 * Shape of the template editor's form.
 *
 * Owned by DocumentForm (so it survives tab switches) and consumed by the
 * Mapping Fields and Style tabs through `useFormContext<TemplateFormValues>()`.
 * Typing it here is what keeps `fields[i].field_value` and friends checked in
 * both places.
 */
export interface TemplateFormValues {
	fields: Partial<FormTemplateField>[]
	/** Document-wide font, set in the Style tab. */
	font: string
	/** Document-wide font size, set in the Style tab. */
	font_size: number
}
