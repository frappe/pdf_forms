import io
import json
from typing import Any

import fitz
import frappe

from form_printer.utils.jinja import format_currency, format_date, format_number, format_phone

# Mapping of font names to standard font names
font_mapping = {
	"CoBI": "Courier-BoldOblique",
	"CoBo": "Courier-Bold",
	"CoIt": "Courier-Oblique",
	"Cour": "Courier",
	"HeBI": "Helvetica-BoldOblique",
	"HeBo": "Helvetica-Bold",
	"HeIt": "Helvetica-Oblique",
	"Helv": "Helvetica",  # default
	"Symb": "Symbol",
	"TiBI": "Times-BoldItalic",
	"TiBo": "Times-Bold",
	"TiIt": "Times-Italic",
	"TiRo": "Times-Roman",
	"ZaDb": "ZapfDingbats",
}


@frappe.whitelist()
def print_form_template(
	template_id: str, data: str | dict[str, Any], print_name: str | None = None, print_type: str = "pdf"
) -> Any:
	"""
	Writes data to a Form Template identified by template_id.

	Args:
	    template_id (str): The ID of the Form Template.
	    data (str or dict): The data to be written to the template. If it is a string, it will be parsed as JSON.
	    print_name (str): The name of the form template to be created.
	    print_type (str): The type of print. Default is 'pdf'. Other options is 'binary'

	Returns:
	    str: A success message indicating that the template has been written successfully.
	"""

	pdf_bytes = build_form_template_pdf(template_id=template_id, data=data, print_name=print_name)
	template_name = frappe.db.get_value("Form Template", template_id, "template_name") or template_id
	frappe.response["filename"] = print_name or f"{template_name}.pdf"
	frappe.response["filecontent"] = pdf_bytes
	frappe.response["type"] = "binary" if print_type == "binary" else "pdf"


def build_form_template_pdf(
	template_id: str, data: str | dict[str, Any], print_name: str | None = None
) -> bytes:
	# parse the data to json
	if isinstance(data, str):
		data = json.loads(data or "{}")

	# get the template, template_name, font, font_size from the Document Template
	form_template, _form_template_name, font, font_size = frappe.db.get_value(
		"Form Template", template_id, ["file", "template_name", "font", "font_size"]
	)
	# ensure font_size is numeric for PyMuPDF widget formatting
	try:
		font_size = float(font_size) if font_size is not None else 12
	except (TypeError, ValueError):
		font_size = 12

	# get the file path
	file = frappe.get_site_path(form_template[1:])

    # open the pdf file
	doc = fitz.open(file)

	# Check the repeated images in the form template
	repeated_images = fetch_repeated_document_template_images(template_id)

	# get the page index include in the images
	page_index_include_in_images = [image["page_index"] for image in repeated_images]

	# maintain the repeat after map
	repeat_after_map = {}

	# loop through the pages and get the auto annotations
	for i in range(len(doc)):
		page = doc[i]

		annotate_form_template(page, i, template_id, data, font, font_size)

		if i in page_index_include_in_images:
			image = next(image for image in repeated_images if image["page_index"] == i)
			repeat_after = int(image["repeat_after"])
			# nosemgrep: frappe-semgrep-rules.rules.security.frappe-ssti - image["copies"] comes from database field, trusted source
			copies = int(frappe.render_template(image["copies"], data))

			base_index = int(image["base_index"])

			# Loop over the number of copies and apply the template logic
			for copy_num in range(copies):
				# Create a temporary PDF document with the page to be copied
				temp_doc = fitz.open()
				temp_doc.insert_pdf(doc, from_page=i, to_page=i)
				temp_page = temp_doc[0]

				xref_map = {}

				for widget in page.widgets():
					if widget.field_type == fitz.PDF_WIDGET_TYPE_TEXT:
						widget.field_value = None
					if widget.field_type == fitz.PDF_WIDGET_TYPE_CHECKBOX:
						if widget.field_value == "Yes":
							widget.field_value = widget.on_state()
						else:
							widget.field_value = False

					elif widget.field_type == fitz.PDF_WIDGET_TYPE_RADIOBUTTON:
						if widget.field_value != "Off":
							widget.field_value = widget.on_state()
						else:
							widget.field_value = False

					new_widget = temp_page.add_widget(widget)

					xref_map[str(widget.xref)] = str(new_widget.xref)

				# Apply the data print logic to the copied page
				annotate_form_template(
					temp_page,
					i,
					template_id,
					data,
					font,
					font_size,
					base_index=(base_index * (copy_num + 1)),
					xref_map=xref_map,
				)

				if repeat_after_map.get(repeat_after):
					repeat_after_map[repeat_after].append(
						{"copy_num": copy_num + 1, "temp_doc": temp_doc}  # Store the temp_doc page
					)
				else:
					repeat_after_map[repeat_after] = [
						{"copy_num": copy_num + 1, "temp_doc": temp_doc}  # Store the temp_doc page
					]

	plus_index = 1
	for key, value in repeat_after_map.items():
		for item in value:
			tempt_doc = item["temp_doc"]

			tempt_doc.bake(annots=True, widgets=True)
			try:
				doc.insert_pdf(tempt_doc, from_page=0, to_page=0, start_at=key + plus_index)
			except TypeError as e:
				print(f"Error inserting PDF: {e}")
			plus_index += 1

			tempt_doc.close()

	pdf_byte_array = io.BytesIO()
	doc.save(pdf_byte_array, garbage=4, deflate=True)
	return pdf_byte_array.getvalue()


def fetch_repeated_document_template_images(template_id):
	return frappe.get_all(
		"Form Template Image",
		filters={"form_template_id": template_id, "repeat_page": 1},
		fields=["name", "page_index", "repeat_after", "copies", "base_index"],
		order_by="page_index asc",
	)


def annotate_form_template(page, i, template_id, data, font, font_size, base_index=0, xref_map=None):
	if xref_map is None:
		xref_map = {}
	auto_annotations = frappe.get_list(
		"Form Template Field",
		filters={"form_template": template_id, "page_index": i, "annotation_type": "Auto"},
		fields="*",
	)

	# loop through the auto annotations and add the text to the page
	annotatate_auto_fields(page, auto_annotations, data, font, font_size, base_index, xref_map)

	# loop through the manual annotations and add the text to the page
	manual_annotations = frappe.get_list(
		"Form Template Field",
		filters={"form_template": template_id, "page_index": i, "annotation_type": "Manual"},
		fields="*",
	)

	annotatate_manual_fields(page, manual_annotations, data, font, font_size, base_index)


def annotatate_auto_fields(page, auto_annotations, data, font, font_size, base_index=0, xref_map=None):
	if xref_map is None:
		xref_map = {}
	fields = page.widgets()

	for field in fields:
		# get the annotation for the field from the auto_annotations list which matches the field_name and xref
		annotation = get_annotation(field.field_name, auto_annotations, field.xref, xref_map)

		if annotation:
			# get the field value from the data
			if annotation.is_default_jinja:
				# nosemgrep: frappe-semgrep-rules.rules.security.frappe-ssti - annotation.default_value comes from database field, trusted source
				default_value = frappe.render_template(annotation.default_value, data)
			else:
				default_value = annotation.default_value

			value = get_field_value(annotation, data, base_index)

			if isinstance(value, str):
				value = value.strip()

			value = value if (value is not None and value != "" and value != "None") else default_value

			if value is not None:
				# update the field value according to the field type
				if annotation.field_type == "Text":
					# set the field value, font, font size
					# if annotation have font or font size set it else set the font and font size from the document template
					# ensure numeric types for PyMuPDF (it uses format code 'g' internally)
					anno_fs = float(annotation.font_size) if annotation.font_size is not None else 0
					tpl_fs = float(font_size) if font_size is not None else 12
					field.text_fontsize = anno_fs if annotation.override_style and anno_fs > 0 else tpl_fs
					text_font = annotation.font if annotation.font and annotation.font != "None" else font
					font_name = fitz.Font(text_font).name
					field.text_font = get_fontname(font_name)
					field.field_value = str(value) if value is not None and value != "None" else ""
					field.update()
				elif annotation.field_type == "CheckBox":
					if value is True or value == "True" or value == "1" or value == 1:
						field.field_value = field.on_state()
						field.update()
				elif annotation.field_type == "RadioButton":
					if value is True or value == "True" or value == "1" or value == 1:
						field.field_value = field.on_state()
						field.update()


def annotatate_manual_fields(page, manual_annotations, data, font, font_size, base_index=0):
	for annotation in manual_annotations:
		value = get_field_value(annotation, data, base_index)

		if isinstance(value, str):
			value = value.strip()

		if annotation.is_default_jinja:
			# nosemgrep: frappe-semgrep-rules.rules.security.frappe-ssti - annotation.default_value comes from database field, trusted source
			default_value = frappe.render_template(annotation.default_value, data)
		else:
			default_value = annotation.default_value

		value = value if (value is not None and value != "" and value != "None") else default_value

		if value is not None:
			page_width, height = page.mediabox_size

			width = frappe.get_value("Form Template Image", annotation.form_template_image, "width")
			ratio = width / page_width if width and width > 0 else 1

			fields = page.widgets()

			x1_point = float(annotation.x_point) / ratio
			y1_point = float(annotation.y_point) / ratio
			width = float(annotation.width) / ratio
			height = float(annotation.height) / ratio
			x2_point = x1_point + width
			y2_point = y1_point + height
			rect = fitz.Rect(x1_point, y1_point, x2_point, y2_point)
			widget = fitz.Widget()
			widget.rect = rect
			widget.field_name = annotation.field_label
			widget.field_label = annotation.field_label
			# ensure numeric types for PyMuPDF (it uses format code 'g' internally)
			anno_fs = float(annotation.font_size) if annotation.font_size is not None else 0
			tpl_fs = float(font_size) if font_size is not None else 12
			widget.text_fontsize = anno_fs if annotation.override_style and anno_fs > 0 else tpl_fs
			text_font = annotation.font if annotation.font and annotation.font != "None" else font
			font_name = fitz.Font(text_font).name
			widget.text_font = get_fontname(font_name)
			widget.field_type = get_field_type(annotation.field_type)
			page.draw_rect(rect, color=(0, 0, 0), width=0.5)

			# create random and unique xref for the widget
			widget.xref = max([field.xref for field in fields]) + 1

			page.add_widget(widget)

			form_fields = page.widgets()
			# find the widget and update the field value
			for field in form_fields:
				if field.field_name == annotation.field_label:
					if annotation.field_type == "Text":
						field.field_value = str(value) if value is not None and value != "None" else ""
						field.update()

					elif annotation.field_type == "Checkbox":
						if value is True or value == "True" or value == "1" or value == 1:
							field.field_value = field.on_state()
							field.update()
					elif annotation.field_type == "Radio Button":
						if value is True or value == "True" or value == "1" or value == 1:
							field.field_value = field.on_state()
							field.update()


def get_annotation(field_name, annotations, xref, xref_map):
	# get the annotation for the field from the auto_annotations list which matches the field_name and xref
	annotation = None
	for a in annotations:
		a_xref = xref_map.get(a.xref) if xref_map.get(str(a.xref)) else a.xref
		if a.field_name == field_name and int(a_xref) == int(xref):
			annotation = a
			break
	return annotation


def get_field_value(annotation, data, base_index):
	# 1. Get the value from the data according to the value_type
	# 2. If the value_type is Text, return the field_value as it is
	# 3. If the value_type is Field, get the value from the data according to the field_value
	# 4. If the value_type is Prompt get the value from the data according to the field_value
	# 6. If the value_type is Jinja, render the field_value as a jinja template and return the value

	if annotation.value_type == "Text":
		value = (
			str(annotation.field_value)
			if annotation.field_value and annotation.field_value != "None"
			else None
		)
		return (
			str(annotation.field_value)
			if annotation.field_value and annotation.field_value != "None"
			else None
		)

	elif annotation.value_type == "Field":
		value = get_field_value_type_data(annotation, data, base_index)
		formatted_value = get_formatted_value(value, annotation.formatter)
		return formatted_value if formatted_value is not None else None

	elif annotation.value_type == "Prompt":
		value = data.get(annotation.field_value, None)
		return value if value is not None else None

	elif annotation.value_type == "Jinja":
		# render the field_value as a jinja template
		value = ""
		try:
			# nosemgrep: frappe-semgrep-rules.rules.security.frappe-ssti - annotation.field_value comes from database field, trusted source
			value = frappe.render_template(annotation.field_value, data)
		except Exception as e:
			print(e)

		return value if value is not None else ""

	return None


def get_formatted_value(value, formatter):
	if formatter == "Date":
		return format_date(value)
	elif formatter == "Phone":
		return format_phone(value)
	elif formatter == "Currency":
		return format_currency(value)
	elif formatter == "Number":
		return format_number(value)
	else:
		return value


def get_field_value_type_data(annotation, data, base_index):
	# Check field_value if normal field or nested field or array field
	# eg: field_value = 'field_name' or 'field_name.field_name' or 'field_name[0].field_name' or 'field_name[0].field_name[0].field_name'
	# 1. If field_value is normal field, get the value from the data
	# 2. If field_value is nested field, split the field_value by '.' and get the value from the data
	# 3. If field_value is array field, split the field_value by '.' and get the value from the data even get the value from the array according to the index

	value = data
	keys = annotation.field_value.split(".")

	# Identify the last array index
	last_array_index = -1
	for i, key in enumerate(keys):
		if "[" in key and "]" in key:
			last_array_index = i

	for i, key in enumerate(keys):
		try:
			if "[" in key and "]" in key:  # check if the key contains a list index
				# split the key and the index
				key, index = key[:-1].split("[")
				index = int(index)
				if i == last_array_index:  # if it's the last array index, add base_index
					index += base_index
				value = value[key][index]  # access the list element
			else:
				value = value[key]
		except (KeyError, IndexError):
			return None

	return value


def get_field_type(field_type):
	if field_type == "Text":
		return fitz.PDF_WIDGET_TYPE_TEXT
	elif field_type == "Checkbox":
		return fitz.PDF_WIDGET_TYPE_CHECKBOX
	elif field_type == "Radio Button":
		return fitz.PDF_WIDGET_TYPE_RADIOBUTTON
	else:
		return fitz.PDF_WIDGET_TYPE_TEXT


def get_fontname(font):
	# get the font name from the font_mapping
	for key, value in font_mapping.items():
		if value.lower() == font.lower():
			return key
	return "Helv"
