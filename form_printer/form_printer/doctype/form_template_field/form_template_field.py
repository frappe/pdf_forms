# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class FormTemplateField(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		annotation_type: DF.Literal["Auto", "Manual"]
		default_value: DF.SmallText | None
		field_label: DF.Data | None
		field_name: DF.Data | None
		field_type: DF.Data | None
		field_value: DF.SmallText | None
		font: DF.Data | None
		font_size: DF.Float
		form_template: DF.Link
		form_template_image: DF.Link
		formatter: DF.Literal["", "Date", "Currency", "Phone", "Number"]
		height: DF.Data
		id: DF.Data
		is_default_jinja: DF.Check
		is_prompt: DF.Check
		override_style: DF.Check
		page_index: DF.Int
		source: DF.Data | None
		value: DF.SmallText
		value_type: DF.Literal["Text", "Field", "Jinja", "Prompt"]
		width: DF.Data
		x_point: DF.Data
		xref: DF.Data | None
		y_point: DF.Data
	# end: auto-generated types
	def before_save(self):
        # get the dimensions of the annotation from value field and set x_point, y_point, width and height
		self.get_dimensions()

	def get_dimensions(self):
		xywh = self.value.split("=")[1].split(':')[1].split(',')
		self.x_point = xywh[0]
		self.y_point = xywh[1]
		self.width = xywh[2]
		self.height = xywh[3]

@frappe.whitelist()
def get_annotations(form_template_id):
    annotations = frappe.db.get_list('Form Template Field',
        filters={
            'form_template': form_template_id
        },
        fields=['id', 'value', 'source', 'page_index',
                'form_template_image', 'annotation_type'],
        order_by='creation desc',
    )

    return annotations  


@frappe.whitelist(methods=['POST'])
def update_form_template_fields(form_template_id, fields=[], font=None, font_size=None):
    # 1. Update the document template fields only those are changed
    # 2. Update the font and font size for the document template

    # update the font and font size for the document template
    if font or font_size:
        frappe.db.set_value('Form Template', form_template_id, {
            'font': font,
            'font_size': font_size
        })

    for field in fields:

        existing_field = frappe.get_doc("Form Template Field", field['name'])
        doc_fields = ['value_type', 'field_value', 'field_label', 'field_type', 'override_style', 'font', 'font_size',
                      'is_prompt', 'formatter', 'default_value', 'is_default_jinja']

        # if the field is the same, skip
        condition = all([existing_field.get(f) == field.get(f)
                        for f in doc_fields])
        if condition:
            continue
        else:
            for f in doc_fields:
                if field.get(f) != None:
                    setattr(existing_field, f, field.get(f))

        
        existing_field.save()


@frappe.whitelist(methods=['POST'])
def update_annotation(form_template_id, annotations):

    for annotation in annotations:
        # check if annotation exists
        annotation_exists = frappe.db.exists(
            'Form Template Field', annotation['id'])

        if annotation_exists:
            # update the annotation
            doc = frappe.get_doc(
                'Form Template Field', annotation['id'])
            doc.value = annotation['value']
            doc.source = annotation['source']
            doc.page_index = annotation['page_index']
            doc.form_template_image = annotation['form_template_image']

            doc.save()
        else:
            # create a new annotation
            frappe.get_doc({
                "doctype": "Form Template Field",
                "id": annotation["id"],
                "value": annotation["value"],
                "source": annotation["source"],
                "page_index": annotation["page_index"],
                "form_template": form_template_id,
                "form_template_image": annotation["form_template_image"],
                "annotation_type": 'Manual',
                "value_type": 'Text',
            }).insert()

    frappe.publish_realtime('annotations_updated', {
                            'form_template_id': form_template_id}, after_commit=True)

    return "Success"