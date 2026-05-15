# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe import _
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
		height: DF.Int
		id: DF.Data
		image_file: DF.AttachImage | None
		page_index: DF.Int
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		repeat_after: DF.Int
		repeat_page: DF.Check
		width: DF.Int
	# end: auto-generated types

	pass


@frappe.whitelist(methods=["POST"])
def update_image_settings(
	form_template_id: str,
	form_template_image: str,
	repeat_page: int = 0,
	repeat_after: int | None = None,
	copies: str | None = None,
	base_index: int | None = None,
) -> None:
	form_template = frappe.get_doc("Form Template", form_template_id)
	image_row = next(
		(row for row in form_template.form_template_image if row.name == form_template_image), None
	)
	if not image_row:
		frappe.throw(_("Form Template Image row was not found."))

	image_row.repeat_page = 1 if frappe.utils.cint(repeat_page) else 0
	image_row.repeat_after = (
		frappe.utils.cint(repeat_after) if repeat_after is not None else image_row.repeat_after
	)
	image_row.copies = copies or ""
	image_row.base_index = frappe.utils.cint(base_index) if base_index is not None else 0
	form_template.save()
