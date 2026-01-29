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

		base_index: DF.Int
		copies: DF.SmallText | None
		did_not_convert: DF.Check
		form_template_id: DF.Link
		height: DF.Int
		image_file: DF.AttachImage | None
		page_index: DF.Int
		repeat_after: DF.Int
		repeat_page: DF.Check
		width: DF.Int
	# end: auto-generated types
	
	def before_save(self):
		'''
		Before saving check is repeat_page is unchecked then set repeat_after to 0, copies to "" and base_index to 0.
		'''
		if not self.repeat_page:
			self.repeat_after = 0
			self.copies = ""
			self.base_index = 0
