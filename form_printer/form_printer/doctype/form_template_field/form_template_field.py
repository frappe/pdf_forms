# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from typing import Any

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
		form_template_image: DF.Data
		formatter: DF.Literal["", "Date", "Currency", "Phone", "Number"]
		height: DF.Data
		id: DF.Data
		is_default_jinja: DF.Check
		is_prompt: DF.Check
		override_style: DF.Check
		page_index: DF.Int
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
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
		xywh = self.value.split("=")[1].split(":")[1].split(",")
		self.x_point = xywh[0]
		self.y_point = xywh[1]
		self.width = xywh[2]
		self.height = xywh[3]


def _extract_dimensions(value: str) -> tuple[str, str, str, str]:
	xywh = value.split("=")[1].split(":")[1].split(",")
	return xywh[0], xywh[1], xywh[2], xywh[3]


@frappe.whitelist()
def get_annotations(form_template_id: str) -> list[dict[str, Any]]:
	form_template = frappe.get_cached_doc("Form Template", form_template_id)
	return [
		{
			"name": row.name,
			"value": row.value,
			"source": row.source,
			"page_index": row.page_index,
			"form_template_image": row.form_template_image,
			"annotation_type": row.annotation_type,
			"field_label": row.field_label,
			"field_name": row.field_name,
		}
		for row in sorted(
			form_template.form_template_field,
			key=lambda r: r.creation or "",
			reverse=True,
		)
	]


@frappe.whitelist(methods=["POST"])
def update_form_template_fields(
	form_template_id: str,
	fields: list[dict[str, Any]] | None = None,
	font: str | None = None,
	font_size: int | None = None,
) -> None:
	if fields is None:
		fields = []
	# 1. Update the form template fields only those are changed
	# 2. Update the font and font size for the form template

	# update the font and font size for the form template
	if font or font_size:
		frappe.db.set_value("Form Template", form_template_id, {"font": font, "font_size": font_size})

	form_template = frappe.get_doc("Form Template", form_template_id)
	has_updates = False
	for field in fields:
		existing_field = next(
			(row for row in form_template.form_template_field if row.name == field["name"]),
			None,
		)
		if not existing_field:
			continue
		doc_fields = [
			"value_type",
			"field_value",
			"field_label",
			"field_type",
			"override_style",
			"font",
			"font_size",
			"is_prompt",
			"formatter",
			"default_value",
			"is_default_jinja",
		]

		# if the field is the same, skip
		condition = all([existing_field.get(f) == field.get(f) for f in doc_fields])
		if condition:
			continue
		else:
			for f in doc_fields:
				if field.get(f) is not None:
					setattr(existing_field, f, field.get(f))
			has_updates = True

	if has_updates:
		form_template.save()


@frappe.whitelist(methods=["POST"])
def update_annotation(form_template_id: str, annotations: list[dict[str, Any]]) -> str:
	form_template = frappe.get_doc("Form Template", form_template_id)
	for annotation in annotations:
		existing_row = next(
			(row for row in form_template.form_template_field if row.name == annotation["id"]),
			None,
		)

		if existing_row:
			existing_row.value = annotation["value"]
			existing_row.source = annotation["source"]
			existing_row.page_index = annotation["page_index"]
			existing_row.form_template_image = annotation["form_template_image"]
			x_point, y_point, width, height = _extract_dimensions(annotation["value"])
			existing_row.x_point = x_point
			existing_row.y_point = y_point
			existing_row.width = width
			existing_row.height = height
		else:
			x_point, y_point, width, height = _extract_dimensions(annotation["value"])
			form_template.append(
				"form_template_field",
				{
					"id": frappe.generate_hash(length=10),
					"value": annotation["value"],
					"source": annotation["source"],
					"page_index": annotation["page_index"],
					"x_point": x_point,
					"y_point": y_point,
					"width": width,
					"height": height,
					"form_template_image": annotation["form_template_image"],
					"annotation_type": "Manual",
					"value_type": "Text",
				},
			)

	form_template.save()

	frappe.publish_realtime(
		"annotations_updated",
		{"form_template_id": form_template_id},
		doctype="Form Template",
		docname=form_template_id,
		after_commit=True,
	)

	return "Success"


@frappe.whitelist(methods=["POST"])
def delete_annotation(form_template_id: str, annotation_id: str) -> str:
	form_template = frappe.get_doc("Form Template", form_template_id)
	row_index = next(
		(index for index, row in enumerate(form_template.form_template_field) if row.name == annotation_id),
		-1,
	)
	if row_index == -1:
		return "Not Found"

	form_template.form_template_field.pop(row_index)
	form_template.save()

	frappe.publish_realtime(
		"annotations_updated",
		{"form_template_id": form_template_id},
		doctype="Form Template",
		docname=form_template_id,
		after_commit=True,
	)

	return "Success"
