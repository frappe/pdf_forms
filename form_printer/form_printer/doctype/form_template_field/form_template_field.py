# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

# import frappe
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
