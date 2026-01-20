
export interface FormTemplateImage{
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
	/**	Form Template ID : Link - Form Template	*/
	form_template_id: string
	/**	Page Index : Int	*/
	page_index: number
	/**	Image File : Attach Image	*/
	image_file?: string
	/**	Height : Int	*/
	height?: number
	/**	Width : Int	*/
	width?: number
	/**	Image : Image	*/
	image?: string
	/**	Did Not Convert : Check	*/
	did_not_convert?: 0 | 1
}