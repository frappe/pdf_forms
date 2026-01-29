import frappe
import phonenumbers
from frappe.contacts.doctype.address.address import get_address_display
from frappe.utils import cint


def format_date(date, format_string=None):
    # format the date in the system's date format
    return frappe.utils.formatdate(date)


def format_currency(value, currency=None, precision=None):
    # format the currency in the system's currency format
    default_currency = frappe.db.get_default(
        "currency") if currency is None else currency
    return frappe.utils.fmt_money(amount=value, currency=default_currency, precision=precision) if value != None else ''


def format_number(value, precision=None):
    # format the number by comma separating the thousands
    default_precision = frappe.db.get_default(
        "float_precision") if precision is None else precision
    return frappe.utils.fmt_money(amount=value, precision=cint(default_precision)) if value != None else ''


def format_float(value, precision=None):
    default_precision = frappe.db.get_default(
        "float_precision") if precision is None else precision
    return frappe.utils.fmt_money(amount=value, precision=cint(default_precision)) if value != None else ''


def format_currency_without_symbol(value, currency=None, precision=None):
    # format the currency in the system's currency format
    return frappe.utils.fmt_money(amount=value, precision=precision) if value != None else ''

def format_phone(phone):

    if not phone:
        return phone

    country = None
    # Add a plus if the phone number does not have one
    if phone[0] != '+':
        country = "US"

    phone_no = str(phone)

    try:
        # Parse the phone number using phonenumbers
        phone_number = phonenumbers.parse(phone_no, country)

        # Check if the phone number is valid
        if phonenumbers.is_valid_number(phone_number):
            # Get the international format of the phone number
            international_format = phonenumbers.format_number(
                phone_number,  phonenumbers.PhoneNumberFormat.NATIONAL if country == "US" else phonenumbers.PhoneNumberFormat.INTERNATIONAL)
            return international_format
        else:
            return phone_no
    except:
        return phone_no


def get_address(address_id):
    return get_address_display(address_id)

def get_address_object(doctype, docname):
    # get addresses for the doctype and docname
    address_ids = frappe.db.get_list('Address', filters=[
        ["Dynamic Link", "link_doctype", "=", doctype], ["Dynamic Link", "link_name", "=", docname], ['address_status', '=', 'Current']], order_by='address_status')

    address = None
    for address in address_ids:
        address = frappe.get_doc('Address', address['name']).as_dict()
        break

    return address
