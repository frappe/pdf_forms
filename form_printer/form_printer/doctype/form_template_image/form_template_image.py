# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class FormTemplateImage(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		did_not_convert: DF.Check
		form_template_id: DF.Link
		height: DF.Int
		image_file: DF.AttachImage | None
		page_index: DF.Int
		width: DF.Int
	# end: auto-generated types
	pass
