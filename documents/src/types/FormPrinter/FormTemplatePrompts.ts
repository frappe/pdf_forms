
export interface FormTemplatePrompts{
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
	/**	Field Name : Data	*/
	field_name: string
	/**	Label : Data	*/
	label: string
	/**	Type : Select	*/
	type?: "Text" | "Checkbox" | "Radio"
	/**	Question : Small Text	*/
	question?: string
	/**	Mandatory : Check	*/
	mandatory?: 0 | 1
}