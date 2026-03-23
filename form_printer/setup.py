import frappe
from frappe.custom.doctype.property_setter.property_setter import make_property_setter

def after_install():
    '''
       After installation hook
    '''
    make_property_setter_for_print_format()


def make_property_setter_for_print_format():
    '''
        Make Property Setter for Print Format as pdf_generator to form printer
    '''
    property_setter = frappe.db.get_value("Property Setter", filters={ "doc_type": "Print Format", "field_name": "pdf_generator", "property": "options" })

    if property_setter:
        property_setter_doc = frappe.get_doc("Property Setter", property_setter)

        if "form printer" not in property_setter_doc.value.split("\n"):
            property_setter_doc.value += "\n" + "form printer"
            property_setter_doc.save()
    else:
        options = frappe.get_meta("Print Format").get_field("pdf_generator").options
        options += "\n" + "form printer"

        make_property_setter(
            "Print Format",
            "pdf_generator",
            "options",
            options,
            "Text",
            validate_fields_for_doctype=False,
        )