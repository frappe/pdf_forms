# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

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


# Guest access mirrors frappe.utils.print_format.download_pdf, which this
# overrides: the document's own print permission is checked below
# (validate_print_permission) before anything is rendered, so a guest only
# gets what Frappe itself would give them.
@frappe.whitelist(allow_guest=True)  # nosemgrep: frappe-semgrep-rules.rules.security.guest-whitelisted-method
def download_pdf(
	doctype: str,
	name: str,
	format: str | None = None,
	doc: str | dict | None = None,
	no_letterhead: bool | int = 0,
	language: str | None = None,
	letterhead: str | None = None,
	pdf_generator: str | None = None,
	prompt_data: str | dict | None = None,
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
	prompt_data: str | dict | None = None,
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

	page_sizes = get_page_sizes(template_id, document, prompt_data)

	return {
		"html": render_preview_sheets(pdf_url, page_sizes),
		"style": get_print_style(style=style, print_format=None),
	}


def get_page_sizes(template_id: str, document, prompt_data) -> list[tuple[float, float]]:
	"""Point size of every page the generated PDF will actually have.

	Read from the built PDF rather than the template's stored page images: a
	template may repeat a page, so the output can have more pages than the
	template does.
	"""
	try:
		import fitz

		pdf_bytes = build_form_template_pdf(
			template_id=template_id,
			data={**document.as_dict(), **_parse_prompt_data(prompt_data)},
		)
		with fitz.open(stream=pdf_bytes, filetype="pdf") as pdf:
			return [(page.rect.width, page.rect.height) for page in pdf]
	except Exception:
		# A preview must never be the thing that breaks the print view; fall back
		# to a single A4-shaped sheet.
		frappe.log_error(title="PDF Forms: could not measure preview pages")
		return [(595.0, 842.0)]


# `toolbar=0` hides the browser's own PDF chrome. Without it the preview shows
# Chrome's viewer -- a black bar with zoom and download controls -- instead of
# looking like a printed page.
VIEWER_FLAGS = "toolbar=0&navpanes=0&scrollbar=0&statusbar=0&view=Fit"

PREVIEW_STYLE = """
<style>
/* Frappe pads .print-format by the print margin, which is right for HTML
   content but wrong here: a PDF page carries its own margins, so the page IS
   the paper and has to fill the sheet edge to edge. Without this the page
   renders inset and ~140px narrower than a standard format's. */
.print-format { padding: 0 !important; }
.pdf-forms-preview { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.pdf-forms-sheet {
	position: relative;
	background: #fff;
	/* Clips the viewer backdrop exposed by the scale below. */
	overflow: hidden;
	/* Width is capped two ways: never wider than the print sheet, and never so
	   tall that a page cannot be seen at a glance. Deriving the width from the
	   height cap keeps the page's own proportions instead of letterboxing it. */
	max-width: 100%;
}
/* Only between pages -- a single-page form should read as one clean sheet,
   indistinguishable from a normal print format. */
.pdf-forms-preview > .pdf-forms-sheet + .pdf-forms-sheet {
	border-top: 1px solid var(--border-color, #e2e2e2);
	padding-top: 12px;
}
/* Left in normal flow at exactly the sheet's size on purpose. Absolutely
   positioning this frame, or moving it in the DOM, makes Chrome's PDF plugin
   reload and paint nothing but its backdrop.
   The scale is the one thing that does work: the viewer fits the page inside
   its box and paints its own dark backdrop in the leftover margin, which reads
   as a black frame. Scaling is a paint-time operation, so the plugin keeps
   rendering, and the sheet's overflow clips the backdrop away. */
.pdf-forms-sheet > iframe,
.pdf-forms-sheet > object {
	display: block;
	width: 100%;
	height: 100%;
	border: none;
	transform: scale(1.025);
	transform-origin: center center;
}
@media print {
	.pdf-forms-preview > .pdf-forms-sheet + .pdf-forms-sheet {
		border-top: none; padding-top: 0; break-before: page;
	}
}
</style>
"""

# PDF points -> CSS pixels. A page is never drawn larger than its real physical
# size; on a narrower pane it shrinks to fit. Deliberately not a vh cap: inside
# Frappe's print iframe, vh resolves against that iframe's own height, which is
# itself sized to the content.
PT_TO_PX = 96 / 72


def render_preview_sheets(pdf_url: str, page_sizes: list[tuple[float, float]]) -> str:
	"""One page-shaped sheet per PDF page, so the preview reads as paper.

	Each sheet keeps its own page's aspect ratio, so a landscape or legal page is
	not letterboxed inside an A4 frame. An `iframe` rather than an `object`: the
	Print button needs `contentWindow.print()` to reach the embedded viewer.
	"""
	sheets = []
	for index, (width, height) in enumerate(page_sizes, start=1):
		if not width or not height:
			width, height = 595.0, 842.0
		natural_width = width * PT_TO_PX
		sheets.append(
			f'<div class="pdf-forms-sheet" data-pdf-url="{pdf_url}"'
			f' style="aspect-ratio: {width:.2f} / {height:.2f};'
			f' width: min(100%, {natural_width:.0f}px);">'
			f'<iframe src="{pdf_url}#page={index}&{VIEWER_FLAGS}"'
			f' title="{frappe._("Page")} {index}" loading="eager"></iframe>'
			f"</div>"
		)
	body = "".join(sheets)
	return f'{PREVIEW_STYLE}<div class="pdf-forms-preview">{body}</div>'
