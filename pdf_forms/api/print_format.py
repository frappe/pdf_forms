from __future__ import annotations

import json
from urllib.parse import urlencode

import frappe
from frappe.translate import print_language
from frappe.utils.print_format import download_pdf as frappe_download_pdf
from frappe.www.printview import get_html_and_style as frappe_get_html_and_style
from frappe.www.printview import get_print_style, validate_print_permission

from pdf_forms.api.print import build_form_template_pdf


def _is_print_designer_format(print_format_doc) -> bool:
	return bool(print_format_doc.get("print_designer") and print_format_doc.get("print_designer_body"))


def _get_form_template_id(print_format_name: str | None) -> str | None:
	if not print_format_name or print_format_name == "Standard":
		return None
	try:
		print_format_doc = frappe.get_cached_doc("Print Format", print_format_name)
	except frappe.DoesNotExistError:
		return None

	if _is_print_designer_format(print_format_doc):
		return None

	return print_format_doc.get("form_template") or frappe.db.get_value(
		"Form Template", {"print_format": print_format_name}, "name"
	)


def _parse_prompt_data(prompt_data):
	if not prompt_data:
		return {}
	if isinstance(prompt_data, dict):
		return prompt_data
	if isinstance(prompt_data, str):
		try:
			parsed = json.loads(prompt_data)
			return parsed if isinstance(parsed, dict) else {}
		except (TypeError, ValueError):
			return {}
	return {}


@frappe.whitelist(allow_guest=True)
def download_pdf(
	doctype: str,
	name: str,
	format: str | None = None,
	doc=None,
	no_letterhead: bool | int = 0,
	language: str | None = None,
	letterhead: str | None = None,
	pdf_generator: str | None = None,
	prompt_data=None,
):
	template_id = _get_form_template_id(format)
	if not template_id:
		return frappe_download_pdf(
			doctype=doctype,
			name=name,
			format=format,
			doc=doc,
			no_letterhead=no_letterhead,
			language=language,
			letterhead=letterhead,
			pdf_generator=pdf_generator,
		)

	doc = doc or frappe.get_doc(doctype, name)
	validate_print_permission(doc)
	parsed_prompt_data = _parse_prompt_data(prompt_data)

	with print_language(language):
		pdf_file = build_form_template_pdf(
			template_id=template_id,
			data={**doc.as_dict(), **parsed_prompt_data},
			print_name=f"{name}.pdf",
		)

	frappe.local.response.filename = f"{name.replace(' ', '-').replace('/', '-')}.pdf"
	frappe.local.response.filecontent = pdf_file
	frappe.local.response.type = "pdf"


@frappe.whitelist()
def get_html_and_style(
	doc: str,
	name: str | None = None,
	print_format: str | None = None,
	no_letterhead: bool | None = None,
	letterhead: str | None = None,
	trigger_print: bool = False,
	style: str | None = None,
	settings: str | None = None,
	prompt_data=None,
) -> dict[str, str | None]:
	template_id = _get_form_template_id(print_format)
	if not template_id:
		return frappe_get_html_and_style(
			doc=doc,
			name=name,
			print_format=print_format,
			no_letterhead=no_letterhead,
			letterhead=letterhead,
			trigger_print=trigger_print,
			style=style,
			settings=settings,
		)

	if isinstance(name, str):
		document = frappe.get_lazy_doc(doc, name, check_permission=True)
	else:
		document = frappe.get_doc(frappe.parse_json(doc), check_permission=True)

	pdf_params = {
		"doctype": document.doctype,
		"name": document.name,
		"format": print_format,
	}
	if prompt_data:
		pdf_params["prompt_data"] = (
			prompt_data if isinstance(prompt_data, str) else frappe.as_json(prompt_data)
		)

	params = urlencode({**pdf_params})
	pdf_url = f"/api/method/frappe.utils.print_format.download_pdf?{params}"
	html = (
		f'<div class="text-muted">'
		f'<object data="{pdf_url}" '
		f'type="application/pdf" style="width:100%;height:86vh;border:none;">'
		f'<p><a href="{pdf_url}" target="_blank" rel="noopener noreferrer">'
		"Open PDF in a new tab"
		"</a></p>"
		"</object>"
		"</div>"
	)
	return {"html": html, "style": get_print_style(style=style, print_format=None)}
