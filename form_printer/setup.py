from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def after_install():
	"""After installation hook."""
	make_custom_fields_for_print_format()


def make_custom_fields_for_print_format():
	"""Create Form Template backlink field on Print Format."""
	custom_fields = {
		"Print Format": [
			{
				"fieldname": "form_template",
				"label": "Form Template",
				"fieldtype": "Link",
				"options": "Form Template",
				"insert_after": "doc_type",
				"read_only": 1,
				"no_copy": 1,
				"hidden": 1,
			}
		]
	}
	create_custom_fields(custom_fields, update=True)
