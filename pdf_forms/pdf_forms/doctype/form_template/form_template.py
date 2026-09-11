# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import io
import tempfile
from collections import Counter

import fitz
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils.file_manager import save_file
from pdf2image import convert_from_path

from pdf_forms.utils.files import template_file_path


class FormTemplate(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from pdf_forms.pdf_forms.doctype.form_template_field.form_template_field import FormTemplateField
		from pdf_forms.pdf_forms.doctype.form_template_image.form_template_image import FormTemplateImage
		from pdf_forms.pdf_forms.doctype.form_template_prompts.form_template_prompts import (
			FormTemplatePrompts,
		)

		data_source: DF.Literal["", "DocType", "Custom Data Source"]
		description: DF.SmallText | None
		file: DF.Attach | None
		file_extension: DF.Data | None
		file_name: DF.Data | None
		font: DF.Data | None
		font_size: DF.Data | None
		form_template_field: DF.Table[FormTemplateField]
		form_template_image: DF.Table[FormTemplateImage]
		is_encrypted: DF.Check
		is_pdf_converted: DF.Check
		print_format: DF.Link | None
		process_completed: DF.Check
		prompts: DF.Table[FormTemplatePrompts]
		source: DF.Data
		template_name: DF.Data
	# end: auto-generated types

	def before_insert(self):
		"""
		Check if template_name Print Format exists
		"""
		if self.template_name and frappe.db.exists("Print Format", self.template_name):
			frappe.throw(_("A Print Format with this name already exists. Please use a different name."))

	def validate(self):
		self.enforce_single_upload()

	def enforce_single_upload(self):
		"""The PDF is attached once. Replacing or removing it would orphan every
		mapping, page image and annotation built on it, so neither is allowed:
		to use a different PDF, delete the template and create a new one."""
		old = self.get_doc_before_save()
		if not old or not old.file:
			return
		if not self.file:
			frappe.throw(
				_("The PDF cannot be removed from a template. Delete the template instead."),
				frappe.ValidationError,
			)
		if self.file != old.file:
			frappe.throw(
				_("The PDF cannot be replaced once uploaded. Delete this template and create a new one."),
				frappe.ValidationError,
			)

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

		if self.is_pdf_converted and self.has_value_changed("is_pdf_converted"):
			if not self.print_format:
				self.create_print_format()

	def get_form_template_prompts(self):
		# This method will return all those Prompts which get used in mapping with the Form Template Fields
		return get_form_template_prompts(self.name)

	def create_print_format(self):
		# This method will create a print format for the form template
		# 1. Create a print format document
		# 2. Return the print format document

		module = frappe.db.get_value("DocType", self.source, "module")
		print_format = frappe.get_doc(
			{
				"doctype": "Print Format",
				"name": self.template_name,
				"print_format_name": self.template_name,
				"print_format_for": "DocType",
				"standard": "No",
				# This format is rendered by pdf_forms' own overrides
				# (api.print_format.download_pdf / get_html_and_style), never by
				# Frappe's HTML print-format builder. Without this flag Frappe
				# treats it as a "builder beta" format and forces
				# pdf_generator="chrome", which fails on sites where that is not
				# an allowed option — breaking template creation outright.
				"custom_format": 1,
				# Mandatory alongside custom_format, but never rendered: both the
				# PDF and the print preview come from the uploaded template.
				"html": (
					"<!-- Rendered by PDF Forms from the uploaded PDF template. -->"
					'<div class="text-muted">This print format is generated from a PDF form template.</div>'
				),
				"doc_type": self.source,
				"module": module,
				"form_template": self.name,
			}
		)
		print_format.insert()

		# Set the print format in the form template
		self.db_set("print_format", print_format.name)

	def on_trash(self):
		"""
		Delete Form Template Field, Form Template Image and Print Format
		"""
		if self.print_format:
			frappe.delete_doc("Print Format", self.print_format, force=1)


def convert_pdf_to_image(form_template_id):
	# Trimming first letter since we want o remove '/' from the file path

	# 1. get the file path from the document
	# 2. convert the pdf to images
	# 3. open the pdf file in fitz
	# 4  set the font and font size counter to get most common font and font size
	# 5. create a Form Template Images document for each page
	# 6. Get Form Fields Annotations and create Form Template Field for each field

	try:
		form_template = frappe.get_doc("Form Template", form_template_id)
		# Reset previously generated rows before re-processing the source PDF.
		form_template.set("form_template_image", [])
		form_template.set("form_template_field", [])

		# the uploaded PDF, confined to the site's files directories
		file_path = template_file_path(form_template.file)

		# convert the pdf to images
		# create a temporary directory to store the images
		with tempfile.TemporaryDirectory() as path:
			images = convert_from_path(file_path, output_folder=path, fmt="jpeg")

		# open the pdf file in fitz
		pdf_doc = fitz.open(file_path)

		# set the font and font size counter to get most common font and font size
		font_counter = Counter()
		font_size_counter = Counter()

		# loop through the images and create a Form Template Images document for each page
		for i in range(len(images)):
			# Save pages as images in the file system
			did_not_convert = 0

			width, height = images[i].size

			# Save images by converting to bytes
			img_byte_array = io.BytesIO()

			images[i].save(img_byte_array, format="JPEG")

			if width <= 1 and height <= 1:
				did_not_convert = 1

			image_row = form_template.append(
				"form_template_image",
				{
					"id": frappe.generate_hash(length=10),
					"page_index": i,
					"width": width,
					"height": height,
				},
			)

			# Upload images to the file system
			f = save_file(
				form_template_id + "_" + str(i) + ".jpeg",
				img_byte_array.getvalue(),
				"Form Template",
				form_template_id,
				is_private=1,
			)
			image_row.image_file = f.file_url
			image_row.did_not_convert = did_not_convert

			# current page
			page = pdf_doc[i]

			# Get the Form Fields Annotations
			create_form_fields_annotations(
				page, image_row, f.file_url, font_counter, font_size_counter, form_template
			)

		# Determine the most common font and font size
		default_font = font_counter.most_common(1)[0][0] if font_counter else "helvetica"
		# 0 is Acrobat's "auto-size"; it must not become the template default.
		sized = Counter({k: v for k, v in font_size_counter.items() if k and k > 0})
		default_font_size = sized.most_common(1)[0][0] if sized else 12

		font_names = fitz.Base14_fontdict.keys()
		if default_font not in font_names:
			default_font = "helvetica"

		# Set the font and font size in the document and set is_pdf_converted to 1
		# Set the is_pdf_converted to 1
		form_template.is_pdf_converted = 1
		# Set the is_encrypted to the pdf document is encrypted
		form_template.is_encrypted = pdf_doc.is_encrypted
		# Set the font to the standard font
		form_template.font = return_standard_font(default_font)
		# Set the font size to the default font size
		form_template.font_size = default_font_size
		# Save the form template; the background job (or the request) commits.
		form_template.save()

	except Exception:
		frappe.log_error(
			title="Form Template conversion failed",
			message=frappe.get_traceback(),
		)
		raise
	finally:
		# Mark the background process as completed for both success and failure paths.
		frappe.db.set_value("Form Template", form_template_id, "process_completed", 1)
		# Publish the form_template_converted event
		# To the user who uploaded the PDF (the job runs as them), not the whole site.
		frappe.publish_realtime(
			"form_template_process_completed",
			{"form_template_id": form_template_id},
			user=frappe.session.user,
			after_commit=True,
		)


def create_form_fields_annotations(page, image_doc, image_url, font_counter, font_size_counter, parent_doc):
	# 1. Get the Metadata from the page
	# 2. Fetch the All Widgets (Mostly Form Fields) from the page
	# 3. Loop through the widgets and create a Form Template Field for each field

	# 1. Get the Metadata from the page
	width, _height = page.mediabox_size
	ratio = image_doc.width / width if image_doc.width and image_doc.width > 0 else 1

	# 2. Get the All Widgets (Mostly Form Fields) from the page
	fields = page.widgets()

	for field in fields:
		# Get the font and font size of the field. PyMuPDF reports base-14
		# aliases in mixed case (TiRo, Cour, Helv); return_standard_font matches
		# lowercase, so without this every form defaulted to Helvetica.
		declared_font = (field.text_font or "").strip()
		declared_size = float(field.text_fontsize or 0)
		font_counter[declared_font.lower()] += 1
		font_size_counter[declared_size] += 1

		# Get the dimensions of the field
		rect = field.rect
		x, y, w, h = ratio * rect.x0, ratio * rect.y0, ratio * rect.width, ratio * rect.height

		# Create a Form Template Field document
		parent_doc.append(
			"form_template_field",
			{
				"id": frappe.generate_hash(length=10),
				"form_template_image": image_doc.id,
				"source": frappe.get_site_path(image_url[1:]),
				"value": f"xywh=pixel:{x},{y},{w},{h}",
				"page_index": image_doc.page_index,
				"x_point": str(x),
				"y_point": str(y),
				"width": str(w),
				"height": str(h),
				"annotation_type": "Auto",
				"value_type": "Field",
				"field_name": field.field_name,
				"field_label": field.field_label,
				"xref": field.xref,
				"field_value": "",
				"field_type": field.field_type_string,
				# What the form itself asked for, kept per field so printing can
				# honour it. Override Style still wins when the user sets it.
				"pdf_font": declared_font,
				"pdf_font_size": declared_size,
			},
		)


STANDARD_FONT_FAMILIES = {
	"courier": (
		"courier",
		"courier-bold",
		"courier-boldoblique",
		"courier-oblique",
		"cour",
		"cobo",
		"cobi",
		"coit",
	),
	"helvetica": (
		"helvetica",
		"helvetica-bold",
		"helvetica-boldoblique",
		"helvetica-oblique",
		"helv",
		"heit",
		"hebo",
		"hebi",
	),
	"times-roman": (
		"times-roman",
		"times-bold",
		"times-bolditalic",
		"times-italic",
		"tiro",
		"tibo",
		"tiit",
		"tibi",
	),
	"symbol": ("symbol", "symb"),
	"zapfdingbats": ("zapfdingbats", "zadb"),
}


def return_standard_font(font):
	"""The base-14 family a PDF font name or alias belongs to; Helvetica when unknown."""
	for family, names in STANDARD_FONT_FAMILIES.items():
		if font in names:
			return family
	return "helvetica"


@frappe.whitelist()
def get_form_template_prompts(form_template_id: str):
	# This method will return all those Prompts which get used in mapping with the Form Template Fields
	# 1. Get the Form Template from the document
	# 2. Get All Form Template Fields which are prompts from the form template
	# 3. Loop through the Prompts and Form Template fields to check if the field_value is equal to the prompt_field_name
	# 4. If the field_value is equal to the prompt_field_name then add the prompt to the list
	# 5. Return the list of prompts

	# 1. Get the Form Template from the document
	form_template = frappe.get_doc("Form Template", form_template_id)
	form_template.check_permission("read")

	# 2. Get All Form Template Fields which are prompts from the form template
	prompts = form_template.prompts

	# Get all the Form Template Fields which are prompts from the form template
	form_template_fields = [
		field for field in form_template.form_template_field if field.value_type == "Prompt"
	]

	# Initialize the list of prompt fields
	prompt_fields = []

	# Loop through the Prompts and Form Template fields to check if the field_value is equal to the prompt_field_name
	for field in form_template_fields:
		prompt_field = next((obj for obj in prompts if obj.field_name == field.field_value), None)
		if prompt_field:
			prompt_fields.append(prompt_field)

	return prompt_fields


@frappe.whitelist()
def get_fields_and_prompts_for_form_template(form_template_id: str):
	# This method will return the fields and prompts metadata from the form template
	# 1. Get the form template document
	# 2. Get all the Prompt fields
	# 3. Check if data_source is Doctype or Custom Data Source
	# 4. If data_source is Doctype, then get the fields from the doctype
	# 5. If data_source is Custom Data Source, then get the fields from the custom data source
	# 6. Return the fields and prompts

	# Lazy import to avoid circular import (form_template -> adapter; adapter must not import form_template)
	from pdf_forms.api.adapter import get_json_schema_for_doctype, get_json_schema_from_custom_source

	# 1. Get the Form Template from the document
	form_template = frappe.get_doc("Form Template", form_template_id)
	form_template.check_permission("read")

	# 3. Check if data_source is Doctype or Custom Data Source
	if form_template.data_source == "DocType":
		# The schema is the source doctype's own metadata: field names, labels
		# and options. Only hand it to someone who may read that doctype.
		if not frappe.has_permission(form_template.source, "read"):
			frappe.throw(_("Not permitted to read {0}").format(form_template.source), frappe.PermissionError)
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
	from pdf_forms.api.adapter import generate_excel_from_json_schema

	# Fetch data source
	data_source = get_fields_and_prompts_for_form_template(template_id).get("fields")

	# Generate the Excel file
	xlsx_file = generate_excel_from_json_schema(data_source)

	# Return the file as a Frappe response for direct download
	frappe.response["filename"] = f"{template_id}.xlsx"
	frappe.response["filecontent"] = xlsx_file.getvalue()
	frappe.response["type"] = "download"
