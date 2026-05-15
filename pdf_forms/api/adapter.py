from io import BytesIO

import frappe
from frappe import _
from openpyxl import Workbook

removed_column_type = [
	"Attach",
	"Attach Image",
	"Autocomplete",
	"Column Break",
	"Button",
	"Barcode",
	"HTML",
	"Fold",
	"Geolocation",
	"Heading",
	"Icon",
	"Section Break",
	"Tab Break",
	"Signature",
	"Color",
	"HTML Editor",
	"Image",
	"Markdown Editor",
]


def get_json_schema_for_doctype(doctype):
	# Fetch metadata for the doctype
	doc_meta = frappe.get_meta(doctype).as_dict()
	fields = doc_meta.get("fields", [])

	id_field = {"fieldname": "name", "fieldtype": "Data", "label": "ID", "required": True, "doctype": doctype}
	# Remove fields with column type
	fields = [field for field in fields if field.get("fieldtype") not in removed_column_type]

	# Add ID field in the first position
	fields.insert(0, id_field)

	# Map Frappe fields to JSON schema
	return map_frappe_fields_to_json_schema(fields, doctype)


def map_frappe_fields_to_json_schema(fields, doctype=None):
	# Helper function to map Frappe field types to JSON schema types
	def map_frappe_type_to_json_type(fieldtype):
		mapping = {
			"Data": "string",
			"Int": "integer",
			"Float": "number",
			"Currency": "number",
			"Date": "string",
			"Datetime": "string",
			"Check": "boolean",
			"Select": "string",
			"Table": "array",  # Define Table as array for child tables
			"Text": "string",
		}
		return mapping.get(fieldtype, "string")

	schema_properties = {}
	required_fields = []

	for field in fields:
		json_field = {
			"description": field.get("label") or field.get("fieldname"),
			"schema_type": map_frappe_type_to_json_type(field.get("fieldtype")),
			"fieldtype": field.get("fieldtype"),
			"doctype": doctype,
		}

		# Handle array of objects for child tables by fetching child doctype metadata
		if field.get("fieldtype") == "Table" and field.get("options"):
			# Fetch metadata for child doctype
			child_doc_meta = frappe.get_meta(field.get("options")).as_dict()
			child_fields = child_doc_meta.get("fields", [])

			# Remove fields with column type
			child_fields = [
				child_field
				for child_field in child_fields
				if child_field.get("fieldtype") not in removed_column_type
			]

			id_field = {
				"fieldname": "name",
				"fieldtype": "Data",
				"label": "ID",
				"required": True,
				"doctype": field.get("options"),
			}

			# Add ID field in the first position
			child_fields.insert(0, id_field)

			# Recursively map fields for the child table
			json_field["items"] = {
				"schema_type": "object",
				"description": field.get("label") or field.get("fieldname"),
				"properties": map_frappe_fields_to_json_schema(
					child_fields, child_doc_meta.get("name", None)
				)["properties"],
				"required": map_frappe_fields_to_json_schema(child_fields, child_doc_meta.get("name", None))[
					"required"
				],
			}

		# Add enum for select fields with options
		if field.get("fieldtype") in ["Select", "Link"] and field.get("options"):
			json_field["enum"] = field["options"].split("\n")

		# Additional constraints
		if field.get("fieldtype") == "Currency":
			json_field["exclusiveMinimum"] = 0
		if field.get("required"):
			required_fields.append(field.get("fieldname"))

		schema_properties[field.get("fieldname")] = json_field

	# Return the final JSON schema structure
	return {"schema_type": "object", "properties": schema_properties, "required": required_fields}


def get_json_schema_from_custom_source(source):
	"""
	# 1. Get the API for the custom source
	# 2. Call the get_meta method of the source and get the fields in valid JSON Schema
	"""

	# 1. Get the API for the custom source
	api_path = get_custom_data_source_api(source)

	# 2. Call the get_meta method of the source and get the fields in valid JSON Schema

	if api_path:
		# execute the get_meta method of the source
		return execute_function_from_path(api_path)


def get_custom_data_source_api(source):
	"""
	# 1. Fetch all apps installed in the site
	# 2. Fetch all app's hooks
	# 3. look for the hook with the name 'document_manager_data_source'
	# 4. If found, then loop over the array and return the name of all objects
	"""
	# Fetch all apps installed in the site
	install_app_doc = frappe.get_cached_doc("Installed Applications")
	install_apps = install_app_doc.get("installed_applications")
	found = False
	for app in install_apps:
		app_name = app.get("app_name")

		# Fetch all app's hooks
		app_hooks = frappe.get_hooks(app_name=app_name)

		# look for the hook with the name 'pdf_forms_data_source'
		if "pdf_forms_data_source" in app_hooks:
			data = app_hooks.get("pdf_forms_data_source")
			for key, value in data.items():
				if key == source:
					found = True
					return (
						value.get("get_meta")[0]
						if isinstance(value.get("get_meta"), list)
						else value.get("get_meta")
					)
	if not found:
		return frappe.throw(_("Source {0} was not found in any installed app").format(source))

	return None


def execute_function_from_path(api_path, *args, **kwargs):
	# Split the path into module and function parts
	function_to_call = frappe.get_attr(api_path)

	# Filter kwargs to only include arguments that the function accepts
	from inspect import signature

	func_signature = signature(function_to_call)
	valid_kwargs = {key: value for key, value in kwargs.items() if key in func_signature.parameters}

	# Execute the function with filtered arguments
	return function_to_call(*args, **valid_kwargs)


def generate_excel_from_json_schema(json_schema):
	"""Generate an Excel file with multiple sheets from a JSON Schema."""

	def process_schema(schema, sheet_name):
		"""Extracts fields and handles child tables."""
		fields_data = []
		for key, field in schema.get("properties", {}).items():
			field_data = {
				"key": key,
				"description": field.get("description", ""),
				"fieldtype": field.get("fieldtype", ""),
				"options": ", ".join(field.get("enum", [])) if "enum" in field else "",
				"doctype": field.get("doctype", ""),
			}
			fields_data.append(field_data)

			# Handle child tables (Array fields)
			if field.get("schema_type") == "array" and "items" in field and "properties" in field["items"]:
				child_schema = field["items"]

				# Create sheet name (avoid invalid characters)
				child_sheet_name = field.get("description", key).strip() or f"Sheet_{key}"

				# Ensure unique sheet name
				if child_sheet_name in table_sheets:
					child_sheet_name += f"_{len(table_sheets)}"

				# Process child schema
				table_sheets[child_sheet_name] = process_schema(child_schema, child_sheet_name)

				# Add hyperlink reference to child table
				field_data["options"] = child_sheet_name

			# Handle nested objects similarly (direct properties instead of items)
			if field.get("schema_type") == "object" and "properties" in field:
				child_schema = field

				# Create unique sheet name for object-based child tables
				child_sheet_name = field.get("description", key).strip() or f"Sheet_{key}"
				if child_sheet_name in table_sheets:
					child_sheet_name += f"_{len(table_sheets)}"

				table_sheets[child_sheet_name] = process_schema(child_schema, child_sheet_name)
				# Add hyperlink reference
				field_data["options"] = child_sheet_name

		return fields_data

	# Dictionary to store child table sheets
	table_sheets = {}

	# Process main schema
	main_sheet_data = process_schema(json_schema, "Main")

	# Create a new workbook
	wb = Workbook()

	# Function to write a sheet
	def write_sheet(sheet_name, data):
		ws = wb.create_sheet(title=sheet_name) if sheet_name != "Main" else wb.active
		ws.title = sheet_name

		# Add headers
		headers = ["Key", "Description", "Fieldtype", "Options", "Doctype"]
		ws.append(headers)

		# Add rows
		for row in data:
			ws.append([row["key"], row["description"], row["fieldtype"], row["options"], row["doctype"]])

	# Write the main sheet
	write_sheet("Main", main_sheet_data)

	# Write child table sheets
	for sheet_name, sheet_data in table_sheets.items():
		write_sheet(sheet_name, sheet_data)

	# Save to BytesIO for Frappe response
	xlsx_file = BytesIO()
	wb.save(xlsx_file)
	xlsx_file.seek(0)  # Reset file pointer for reading
	return xlsx_file
