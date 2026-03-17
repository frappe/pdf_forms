# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import io
import tempfile
from collections import Counter

import fitz
import frappe
from frappe.model.document import Document
from frappe.utils.file_manager import save_file
from pdf2image import convert_from_path


class FormTemplate(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from form_printer.form_printer.doctype.form_template_prompts.form_template_prompts import (
			FormTemplatePrompts,
		)

		data_source: DF.Literal["", "DocType", "Custom Data Source"]
		description: DF.SmallText | None
		file: DF.Attach | None
		file_extension: DF.Data | None
		file_name: DF.Data | None
		font: DF.Data | None
		font_size: DF.Data | None
		is_encrypted: DF.Check
		is_pdf_converted: DF.Check
		prompts: DF.Table[FormTemplatePrompts]
		source: DF.Data
		template_name: DF.Data
	# end: auto-generated types

	def before_save(self):
		# get filename and extension from the file path
		if self.file:
			words = self.file.split("/")
			file_name = words[-1]
			file_name_parts = file_name.split(".")
			self.file_extension = file_name_parts[-1]
			self.file_name = ".".join(file_name_parts[:-1])

	def on_update(self):
		# if the file has changed, convert the pdf to images
		# 1. get the old document
		# 2. check if the file has changed
		# 3. if the file has changed, enqueue the conversion of the pdf to images
		old_doc = self.get_doc_before_save()
		if self.file and self.file_extension == "pdf":
			if old_doc and old_doc.file != self.file:
				frappe.enqueue(
					method=convert_pdf_to_image,
					queue="long",
					is_async=True,
					job_name="Convert Document to Image files",
					enqueue_after_commit=True,
					form_template_id=self.name,
				)

	def get_form_template_prompts(self):
		# This method will return all those Prompts which get used in mapping with the Form Template Fields
		return get_form_template_prompts(self.name)


def convert_pdf_to_image(form_template_id):
	# Trimming first letter since we want o remove '/' from the file path

	# 1. get the file path from the document
	# 2. convert the pdf to images
	# 3. open the pdf file in fitz
	# 4  set the font and font size counter to get most common font and font size
	# 5. create a Form Template Images document for each page
	# 6. Get Form Fields Annotations and create Form Template Field for each field

	# get the file path from the document
	file = frappe.db.get_value("Form Template", form_template_id, "file")

	# convert the pdf to images

	# create a temporary directory to store the images
	with tempfile.TemporaryDirectory() as path:
		images = convert_from_path(
			frappe.get_site_path(file[1:]),
			output_folder=path,
			fmt="jpeg",
		)

	# open the pdf file in fitz
	pdf_doc = fitz.open(frappe.get_site_path(file[1:]))

	# set the font and font size counter to get most common font and font size
	font_counter = Counter()
	font_size_counter = Counter()

	# loop through the images and create a Document Template Images document for each page
	for i in range(len(images)):
		# Save pages as images in the file system
		did_not_convert = 0

		width, height = images[i].size

		# Save images by converting to bytes
		img_byte_array = io.BytesIO()

		images[i].save(img_byte_array, format="JPEG")

		if width <= 1 and height <= 1:
			did_not_convert = 1

		doc = frappe.get_doc(
			{
				"doctype": "Form Template Image",
				"page_index": i,
				"width": width,
				"height": height,
				"form_template_id": form_template_id,
			}
		)
		doc.insert()

		# Upload images to the file system
		f = save_file(
			form_template_id + "_" + str(i) + ".jpeg",
			img_byte_array.getvalue(),
			"Form Template Image",
			doc.name,
			is_private=1,
			df="image_file",
		)

		frappe.db.set_value(
			"Form Template Image", doc.name, {"image_file": f.file_url, "did_not_convert": did_not_convert}
		)

		# current page
		page = pdf_doc[i]

		# Get the Form Fields Annotations
		create_form_fields_annotations(page, doc, f.file_url, font_counter, font_size_counter)

	# Determine the most common font and font size
	default_font = font_counter.most_common(1)[0][0] if font_counter else "helvetica"
	default_font_size = font_size_counter.most_common(1)[0][0] if font_size_counter else 12

	font_names = fitz.Base14_fontdict.keys()
	if default_font not in font_names:
		default_font = "helvetica"

	# Set the font and font size in the document and set is_pdf_converted to 1
	form_template = frappe.get_doc("Form Template", form_template_id)

	# Set the is_pdf_converted to 1
	form_template.is_pdf_converted = 1
	# Set the is_encrypted to the pdf document is encrypted
	form_template.is_encrypted = pdf_doc.is_encrypted
	# Set the font to the standard font
	form_template.font = return_standard_font(default_font)
	# Set the font size to the default font size
	form_template.font_size = default_font_size
	# Save the form template
	form_template.save()

	# Publish the form_template_converted event
	frappe.publish_realtime(
		"form_template_converted",
		{"form_template_id": form_template_id},
		after_commit=True,
	)

	# Commit the changes to the database
	frappe.db.commit()


def create_form_fields_annotations(page, image_doc, image_url, font_counter, font_size_counter):
	# 1. Get the Metadata from the page
	# 2. Fetch the All Widgets (Mostly Form Fields) from the page
	# 3. Loop through the widgets and create a Form Template Field for each field

	# 1. Get the Metadata from the page
	width, height = page.mediabox_size
	ratio = image_doc.width / width if image_doc.width and image_doc.width > 0 else 1

	# 2. Get the All Widgets (Mostly Form Fields) from the page
	fields = page.widgets()

	for field in fields:
		# Get the font and font size of the field
		font_counter[field.text_font] += 1
		font_size_counter[field.text_fontsize] += 1

		# Get the dimensions of the field
		rect = field.rect
		x, y, w, h = ratio * rect.x0, ratio * rect.y0, ratio * rect.width, ratio * rect.height

		# Create a Form Template Field document
		field_doc = frappe.get_doc(
			{
				"doctype": "Form Template Field",
				"form_template_image": image_doc.name,
				"form_template": image_doc.form_template_id,
				"id": frappe.generate_hash(length=10),
				"source": frappe.get_site_path(image_url[1:]),
				"value": f"xywh=pixel:{x},{y},{w},{h}",
				"page_index": image_doc.page_index,
				"annotation_type": "Auto",
				"value_type": "Field",
				"field_name": field.field_name,
				"field_label": field.field_label,
				"xref": field.xref,
				"field_value": "",
				"field_type": field.field_type_string,
			}
		)

		field_doc.insert()


# function to return the standard font
def return_standard_font(font):
	# 1. Check the font name and return the standard font name
	match font:
		case (
			"courier"
			| "courier-bold"
			| "courier-boldoblique"
			| "courier-oblique"
			| "cour"
			| "cobo"
			| "cobi"
			| "coit"
		):
			return "courier"
		case (
			"helvetica"
			| "helvetica-bold"
			| "helvetica-boldoblique"
			| "helvetica-oblique"
			| "helv"
			| "heit"
			| "hebo"
			| "hebi"
		):
			return "helvetica"
		case (
			"times-roman"
			| "times-bold"
			| "times-bolditalic"
			| "times-italic"
			| "tiro"
			| "tibo"
			| "tiit"
			| "tibi"
		):
			return "times-roman"
		case "symbol" | "symb":
			return "symbol"
		case "zapfdingbats" | "zadb":
			return "zapfdingbats"
		case _:
			return "helvetica"


@frappe.whitelist()
def get_form_template_prompts(form_template_id):
	# This method will return all those Prompts which get used in mapping with the Form Template Fields
	# 1. Get the Form Template from the document
	# 2. Get All Form Template Fields which are prompts from the form template
	# 3. Loop through the Prompts and Form Template fields to check if the field_value is equal to the prompt_field_name
	# 4. If the field_value is equal to the prompt_field_name then add the prompt to the list
	# 5. Return the list of prompts

	# 1. Get the Form Template from the document
	form_template = frappe.get_cached_doc("Form Template", form_template_id)

	# 2. Get All Form Template Fields which are prompts from the form template
	prompts = form_template.prompts

	# Get all the Form Template Fields which are prompts from the form template
	form_template_fields = frappe.get_all(
		"Form Template Field",
		filters=[["form_template", "=", form_template_id], ["value_type", "=", "Prompt"]],
		fields=["name", "field_value"],
	)

	# Initialize the list of prompt fields
	prompt_fields = []

	# Loop through the Prompts and Form Template fields to check if the field_value is equal to the prompt_field_name
	for field in form_template_fields:
		prompt_field = next((obj for obj in prompts if obj.field_name == field["field_value"]), None)
		if prompt_field:
			prompt_fields.append(prompt_field)

	return prompt_fields


@frappe.whitelist()
def get_form_template_meta(form_template_id):
	# get the did_not_convert and is_encrypted from the Document Template Images and Document Template
	form_template = frappe.db.get_value(
		"Form Template",
		{"template_name": form_template_id},
		["is_encrypted", "is_pdf_converted"],
		as_dict=True,
	)

	return {"is_encrypted": form_template.is_encrypted, "is_pdf_converted": form_template.is_pdf_converted}


@frappe.whitelist()
def get_fields_and_prompts_for_form_template(form_template_id):
	# This method will return the fields and prompts metadata from the form template
	# 1. Get the form template document
	# 2. Get all the Prompt fields
	# 3. Check if data_source is Doctype or Custom Data Source
	# 4. If data_source is Doctype, then get the fields from the doctype
	# 5. If data_source is Custom Data Source, then get the fields from the custom data source
	# 6. Return the fields and prompts

	# Lazy import to avoid circular import (form_template -> adapter; adapter must not import form_template)
	from form_printer.api.adapter import get_json_schema_for_doctype, get_json_schema_from_custom_source

	# 1. Get the Form Template from the document
	form_template = frappe.get_cached_doc("Form Template", form_template_id)

	# 3. Check if data_source is Doctype or Custom Data Source
	if form_template.data_source == "DocType":
		# 4. Get the fields from the doctype
		fields = get_json_schema_for_doctype(form_template.source)
	else:
		# 5. Get the fields from the custom data source
		fields = get_json_schema_from_custom_source(form_template.source)

	# 6. Return the fields and prompts
	return {"fields": fields, "prompts": form_template.prompts, "source": form_template.source}


@frappe.whitelist()
def download_data_source_sheet(template_id: str):
	"""Frappe API to generate an Excel file from JSON Schema and trigger a download."""
	# Lazy import to avoid circular import
	from form_printer.api.adapter import generate_excel_from_json_schema

	# Fetch data source
	data_source = get_fields_and_prompts_for_form_template(template_id).get("fields")

	# Generate the Excel file
	xlsx_file = generate_excel_from_json_schema(data_source)

	# Return the file as a Frappe response for direct download
	frappe.response["filename"] = f"{template_id}.xlsx"
	frappe.response["filecontent"] = xlsx_file.getvalue()
	frappe.response["type"] = "download"
