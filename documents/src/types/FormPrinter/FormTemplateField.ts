
export interface FormTemplateField{
	name: string
	creation: string
	modified: string
	owner: string
	modified_by: string
	docstatus: 0 | 1 | 2
	parent?: string
	parentfield?: string
	parenttype?: string
	idx?: number
	/**	ID : Data	*/
	id: string
	/**	Value : Small Text	*/
	value: string
	/**	Form Template Image : Data	*/
	form_template_image: string
	/**	Source : Data	*/
	source?: string
	/**	Page Index : Int	*/
	page_index: number
	/**	X Point : Data	*/
	x_point: string
	/**	Height : Data	*/
	height: string
	/**	Annotation Type : Select	*/
	annotation_type?: "Auto" | "Manual"
	/**	Field Label : Data	*/
	field_label?: string
	/**	Field Value : Small Text	*/
	field_value?: string
	/**	Xref : Data	*/
	xref?: string
	/**	Font : Data	*/
	font?: string
	/**	Font Size : Float	*/
	font_size?: number
	/**	Override Style : Check	*/
	override_style?: 0 | 1
	/**	Y Point : Data	*/
	y_point: string
	/**	Width : Data	*/
	width: string
	/**	Value Type : Select	*/
	value_type?: "Text" | "Field" | "Jinja" | "Prompt"
	/**	Field Name : Data	*/
	field_name?: string
	/**	Field Type : Data	*/
	field_type?: string
	/**	Formatter : Select	*/
	formatter?: "" | "Date" | "Currency" | "Phone" | "Number"
	/**	Is Prompt? : Check	*/
	is_prompt?: 0 | 1
	/**	Is Default Jinja : Check	*/
	is_default_jinja?: 0 | 1
	/**	Default Value : Small Text - Default Value of the Template Field.	*/
	default_value?: string
}