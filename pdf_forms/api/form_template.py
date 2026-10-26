# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from typing import Any

import frappe
from frappe import _

from pdf_forms.pdf_forms.doctype.form_template.form_template import convert_pdf_to_image
from pdf_forms.pdf_forms.doctype.form_template_field.form_template_field import (
	get_annotations,
	get_for_template_images,
)
from pdf_forms.utils.files import template_file_path


@frappe.whitelist(methods=["POST"])
def create_form_template(
	template_name: str, source: str, file_url: str, data_source: str = "DocType"
) -> dict[str, Any]:
	"""Create a template from an already uploaded PDF and detect its fields, in
	one call and synchronously, so a client without a browser (an MCP tool, a
	script) gets back a template that is ready to map.

	`file_url` is the URL `upload_file` returned; the PDF must be an uploaded
	site file. The File record is attached to the new template so that it is
	removed with it. Returns the template name, its Print Format, the detected
	fields in the shape of get_annotations, and the page images.
	"""
	path = template_file_path(file_url)
	if not path.lower().endswith(".pdf"):
		frappe.throw(_("The uploaded file must be a PDF."), frappe.ValidationError)

	# insert() checks the caller's create permission on Form Template.
	template = frappe.get_doc(
		{
			"doctype": "Form Template",
			"template_name": template_name,
			"data_source": data_source,
			"source": source,
			"file": file_url,
		}
	).insert()

	# A file uploaded without a docname floats free; own it so it goes when
	# the template goes.
	file_name = frappe.db.get_value(
		"File", {"file_url": file_url, "attached_to_name": ("in", ("", None))}, "name"
	)
	if file_name:
		frappe.db.set_value(
			"File",
			file_name,
			{
				"attached_to_doctype": "Form Template",
				"attached_to_name": template.name,
				"attached_to_field": "file",
			},
			update_modified=False,
		)

	# Inserting does not enqueue the conversion (that is for a later change of
	# file); run it here so the caller gets the fields back.
	convert_pdf_to_image(template.name)
	template.reload()

	return {
		"name": template.name,
		"print_format": template.print_format,
		"font": template.font,
		"font_size": template.font_size,
		"fields": get_annotations(template.name),
		"images": [
			{
				"id": row.id,
				"page_index": row.page_index,
				"width": row.width,
				"height": row.height,
				"image_file": row.image_file,
			}
			for row in get_for_template_images(template.name)
		],
	}


@frappe.whitelist()
def add_prompt_to_form_template(form_template_id: str, prompt: dict[str, Any] | str) -> Any:
	"""
	This method will add a prompt to the form template
	1. Get the Form Template from the document
	2. Add the prompt to the Form Template
	3. Save the Form Template
	4. Return the Form Template
	"""
	# 1. Get the Form Template from the document
	form_template = frappe.get_doc("Form Template", form_template_id)
	# 2. Add the prompt to the Form Template
	form_template.append("prompts", prompt)
	# 3. Save the Form Template
	form_template.save()
	# 4. Return the Form Template
	return form_template


@frappe.whitelist()
def remove_prompt_from_form_template(form_template_id: str, prompt: dict[str, Any] | str) -> Any:
	"""
	This method will remove a prompt from the form template
	1. Get the Form Template from the document
	2. Find the child row by name and remove it
	3. Save the Form Template
	4. Return the Form Template
	"""
	if isinstance(prompt, str):
		prompt = frappe.parse_json(prompt)

	form_template = frappe.get_doc("Form Template", form_template_id)

	prompt_name = prompt.get("name") if isinstance(prompt, dict) else prompt

	for row in form_template.prompts:
		if row.name == prompt_name:
			form_template.remove(row)
			break
	else:
		frappe.throw(_("Prompt {0} was not found").format(prompt_name))

	form_template.save()
	return form_template


@frappe.whitelist()
def update_prompt_in_form_template(form_template_id: str, prompt: dict[str, Any] | str) -> Any:
	"""
	This method will update a prompt in the form template
	1. Get the Form Template from the document
	2. Find the child row by name and update its fields
	3. Save the Form Template
	4. Return the Form Template
	"""
	if isinstance(prompt, str):
		prompt = frappe.parse_json(prompt)

	form_template = frappe.get_doc("Form Template", form_template_id)

	for row in form_template.prompts:
		if row.name == prompt.get("name"):
			row.field_name = prompt.get("field_name", row.field_name)
			row.label = prompt.get("label", row.label)
			row.type = prompt.get("type", row.type) or "Text"  # default to Text if type is not provided
			row.description = prompt.get("description", row.description)
			row.mandatory = prompt.get("mandatory", row.mandatory)
			break
	else:
		frappe.throw(_("Prompt {0} was not found").format(prompt.get("name")))

	form_template.save()

	return form_template
