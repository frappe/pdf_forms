import type { FormTemplateImage } from './FormTemplateImage'
import type { FormTemplateField } from './FormTemplateField'
import type { FormTemplatePrompts } from './FormTemplatePrompts'

export interface FormTemplate{
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
	/**	Template Name : Data	*/
	template_name: string
	/**	Description : Small Text	*/
	description?: string
	/**	Data Source : Select	*/
	data_source: "" | "DocType" | "Custom Data Source"
	/**	Source : Data - Source Can be DocType name or the Custom Data Source Name.	*/
	source: string
	/**	Print Format : Link - Print Format	*/
	print_format?: string
	/**	File Name : Data	*/
	file_name?: string
	/**	File : Attach	*/
	file?: string
	/**	File Extension : Data	*/
	file_extension?: string
	/**	Is PDF Converted : Check	*/
	is_pdf_converted?: 0 | 1
	/**	Is Encrypted : Check	*/
	is_encrypted?: 0 | 1
	/**	Font : Data	*/
	font?: string
	/**	Font Size : Data	*/
	font_size?: string
	/**	PDF Form Parsing Process Completed ? : Check	*/
	process_completed?: 0 | 1
	/**	Form Template Image : Table - Form Template Image	*/
	form_template_image?: FormTemplateImage[]
	/**	Form Template Field : Table - Form Template Field	*/
	form_template_field?: FormTemplateField[]
	/**	Prompts : Table - Form Template Prompts	*/
	prompts?: FormTemplatePrompts[]
}