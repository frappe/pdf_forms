import io
import json
import re
from typing import Any

import fitz
import frappe
from frappe import _

from pdf_forms.utils.files import template_file_path
from pdf_forms.utils.jinja import format_currency, format_date, format_number, format_phone

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

	# Whitelisted means every logged-in user; the template itself is System
	# Manager only, so ask before rendering it.
	frappe.get_doc("Form Template", template_id).check_permission("read")

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

	# get the template, template_name, font, font_size from the Form Template
	form_template, _form_template_name, font, font_size = frappe.db.get_value(
		"Form Template", template_id, ["file", "template_name", "font", "font_size"]
	)
	# ensure font_size is numeric for PyMuPDF widget formatting
	try:
		font_size = float(font_size) if font_size is not None else 12
	except (TypeError, ValueError):
		font_size = 12

	# the uploaded PDF, confined to the site's files directories
	doc = fitz.open(template_file_path(form_template))

	# Check the repeated images in the form template
	repeated_images = fetch_repeated_document_template_images(template_id)

	# get the page index include in the images
	page_index_include_in_images = [image["page_index"] for image in repeated_images]

	# maintain the repeat after map
	repeat_after_map = {}

	# loop through the pages and get the auto annotations
	for i in range(len(doc)):
		page = doc[i]

		# Snapshot a page that will be copied BEFORE it is filled: copies made
		# from the filled page inherited its values -- widgets and drawn text --
		# and printed them on top of their own.
		pristine, original_widgets = None, []
		if i in page_index_include_in_images:
			original_widgets = [(w.field_name, w.xref) for w in page.widgets()]
			# Kept as bytes and reopened per copy: insert_pdf brings a page's
			# widgets across only the first time from a given source document,
			# so a second copy taken from the same open snapshot had no fields.
			snapshot = fitz.open()
			snapshot.insert_pdf(doc, from_page=i, to_page=i)
			pristine = snapshot.tobytes()
			snapshot.close()

		annotate_form_template(page, i, template_id, data, font, font_size)

		if pristine is not None:
			image = next(image for image in repeated_images if image["page_index"] == i)
			repeat_after = int(image["repeat_after"])
			copies = resolve_copies(image["copies"], data, template_id, i)

			base_index = int(image["base_index"])

			# Loop over the number of copies and apply the template logic
			for copy_num in range(copies):
				# Each copy starts from the pristine page, which already carries
				# every widget, empty. Rows are stored against the original
				# page's xrefs, so map those to the copy's by field name.
				temp_doc = fitz.open(stream=pristine, filetype="pdf")
				temp_page = temp_doc[0]

				copy_xref_by_name = {w.field_name: w.xref for w in temp_page.widgets()}
				xref_map = {
					str(xref): str(copy_xref_by_name[name])
					for name, xref in original_widgets
					if name in copy_xref_by_name
				}

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
				frappe.log_error(f"Error inserting PDF: {e}")
			plus_index += 1

			tempt_doc.close()

	pdf_byte_array = io.BytesIO()
	doc.save(pdf_byte_array, garbage=4, deflate=True)
	return pdf_byte_array.getvalue()


@frappe.whitelist()
def get_preview_values(template_id: str, data: str | dict[str, Any]) -> dict[str, Any]:
	"""Resolve how each field of a template would PRINT for the given data.

	Powers the live preview drawn over the PDF in the annotator. It mirrors the
	printer field for field — same resolver, same default fallback, same
	checkbox truthiness, same font resolution — so the preview cannot promise
	something the generated PDF won't deliver.

	Returns a map of Form Template Field row name -> one of:
	    {"kind": "text",  "text": str, "font": str, "font_size_px": float}
	    {"kind": "check", "checked": bool}

	`font_size_px` is the effective size expressed in *page image pixels*, so
	the client can scale it with the viewer without knowing about PDF points.
	Fields that would print nothing are omitted, keeping "empty" and "unmapped"
	distinguishable.
	"""
	if isinstance(data, str):
		data = json.loads(data or "{}")

	template = frappe.get_doc("Form Template", template_id)
	template.check_permission("read")

	template_font = template.font or "helvetica"
	try:
		template_font_size = float(template.font_size) if template.font_size is not None else 12
	except (TypeError, ValueError):
		template_font_size = 12

	# Widget coordinates are stored in page-image pixels while font sizes are in
	# PDF points; this is the conversion between them, per page.
	image_width_by_page = {img.page_index: img.width for img in template.form_template_image}
	page_scale: dict[int, float] = {}
	try:
		doc = fitz.open(template_file_path(template.file))
		for page_index in range(doc.page_count):
			page_width = doc[page_index].mediabox_size[0]
			image_width = image_width_by_page.get(page_index)
			page_scale[page_index] = image_width / page_width if image_width and page_width else 1.0
		doc.close()
	except Exception:
		frappe.log_error(title="Form Template preview scale failed", message=frappe.get_traceback())

	values: dict[str, Any] = {}
	# Opened once so the "is this font embedded?" check is per distinct name.
	template_pdf = fitz.open(template_file_path(template.file))
	embedded_cache: dict[str, bool] = {}
	# Comb fields print one character per cell; the overlay must lay the
	# value out the same way or an account number reads as a smudge.
	comb_cells = {
		str(widget.xref): int(widget.text_maxlen)
		for page in template_pdf
		for widget in page.widgets()
		if is_comb(widget)
	}

	for annotation in template.form_template_field:
		try:
			value = get_field_value(annotation, data, 0)
			if isinstance(value, str):
				value = value.strip()

			# Same fallback the printer applies: an empty value defers to the
			# field's default, which may itself be a Jinja template.
			if value is None or value == "" or value == "None":
				if annotation.is_default_jinja and annotation.default_value:
					# nosemgrep: frappe-semgrep-rules.rules.security.frappe-ssti - default_value is a trusted database field
					value = frappe.render_template(annotation.default_value, data)
				else:
					value = annotation.default_value
		except Exception:
			# One bad expression must not blank the whole preview.
			frappe.log_error(
				title="Form Template preview value failed",
				message=f"{template_id} / {annotation.field_label}: {frappe.get_traceback()}",
			)
			continue

		if value is None:
			continue

		field_type = (annotation.field_type or "Text").replace(" ", "").lower()

		if field_type in ("checkbox", "radiobutton"):
			# The printer ticks the widget only for these; anything else stays
			# blank, so "0" must read as unchecked rather than as the text "0".
			checked = value is True or value in ("True", "1", 1)
			values[annotation.name] = {"kind": "check", "checked": bool(checked)}
			continue

		text = str(value).strip()
		if not text or text == "None":
			continue

		try:
			annotation_font_size = float(annotation.font_size) if annotation.font_size is not None else 0
		except (TypeError, ValueError):
			annotation_font_size = 0

		# Same precedence as the printer: override, then what the PDF declared,
		# then the template default -- so the overlay cannot promise a size or
		# family the generated PDF will not deliver.
		try:
			declared_size = float(annotation.get("pdf_font_size") or 0)
		except (TypeError, ValueError):
			declared_size = 0
		if annotation.override_style and annotation_font_size > 0:
			effective_font_size = annotation_font_size
		elif declared_size > 0:
			effective_font_size = declared_size
		else:
			effective_font_size = template_font_size
		declared_font = (annotation.get("pdf_font") or "").strip()
		if annotation.override_style and annotation.font and annotation.font != "None":
			effective_font = annotation.font
		elif declared_font:
			effective_font = PREVIEW_FAMILY[guess_base14(declared_font)[:2]]
		else:
			effective_font = template_font
		scale = page_scale.get(int(annotation.page_index or 0), 1.0)

		alias = guess_base14(
			effective_font if annotation.override_style else (declared_font or effective_font)
		)
		if declared_font and not annotation.override_style and declared_font not in embedded_cache:
			embedded_cache[declared_font] = bool(
				embedded_font_buffer(template_pdf, template_pdf[0], declared_font)
			)
		values[annotation.name] = {
			"kind": "text",
			"text": text,
			"font": effective_font,
			"font_size_px": round(effective_font_size * scale, 2),
			# The declared /DA font, so the preview can draw with the real thing
			# when the PDF embeds it; bold/italic hints for base-14 variants.
			"font_name": declared_font if not annotation.override_style else "",
			"embedded": bool(embedded_cache.get(declared_font)) if declared_font else False,
			"bold": alias in ("hebo", "hebi", "tibo", "tibi", "cobo", "cobi"),
			"italic": alias in ("heit", "hebi", "tiit", "tibi", "coit", "cobi"),
		}
		cells = comb_cells.get(str(annotation.xref or ""))
		if cells:
			values[annotation.name]["comb"] = cells
			if declared_size <= 0 and not annotation.override_style:
				# The printer auto-sizes a comb to its cell; tell the overlay.
				values[annotation.name]["font_size_px"] = 0

	return values


# More copies of one page than any form plausibly needs; a typo in the
# expression should not print a book.
MAX_PAGE_COPIES = 200


def resolve_copies(expression, data, template_id, page_index) -> int:
	"""How many extra copies of a repeat page to print: the page's Jinja
	expression evaluated against the data. Blank means none; a broken
	expression is logged and means none rather than failing the whole print."""
	if not (expression or "").strip():
		return 0
	try:
		# nosemgrep: frappe-semgrep-rules.rules.security.frappe-ssti - the expression is authored on the template, a trusted database field
		rendered = frappe.render_template(expression, data)
		copies = int(float(str(rendered).strip() or 0))
	except Exception:
		frappe.log_error(
			title="Form Template: page copies expression failed",
			message=f"{template_id} page {page_index}: {expression!r}\n{frappe.get_traceback()}",
		)
		return 0
	return max(0, min(copies, MAX_PAGE_COPIES))


def fetch_repeated_document_template_images(template_id):
	form_template = frappe.get_cached_doc("Form Template", template_id)
	rows = [row for row in form_template.form_template_image if row.repeat_page]
	return sorted(
		[
			{
				"name": row.name,
				"id": row.id,
				"page_index": row.page_index,
				"repeat_after": row.repeat_after,
				"copies": row.copies,
				"base_index": row.base_index,
			}
			for row in rows
		],
		key=lambda row: row["page_index"],
	)


# PyMuPDF's widget appearance can only carry the five REGULAR base-14 fonts;
# it silently rewrites anything else -- bold, italic, or an embedded font -- to
# Helvetica. Those get drawn straight onto the page with the real font instead.
WIDGET_FONTS = {
	"helv": "Helv",
	"helvetica": "Helv",
	"tiro": "TiRo",
	"times-roman": "TiRo",
	"times": "TiRo",
	"cour": "Cour",
	"courier": "Cour",
	"symb": "Symb",
	"symbol": "Symb",
	"zadb": "ZaDb",
	"zapfdingbats": "ZaDb",
}
DRAW_FONTS = {
	"hebo": "hebo",
	"helvetica-bold": "hebo",
	"heit": "heit",
	"helvetica-oblique": "heit",
	"hebi": "hebi",
	"helvetica-boldoblique": "hebi",
	"tibo": "tibo",
	"times-bold": "tibo",
	"tiit": "tiit",
	"times-italic": "tiit",
	"tibi": "tibi",
	"times-bolditalic": "tibi",
	"cobo": "cobo",
	"courier-bold": "cobo",
	"coit": "coit",
	"courier-oblique": "coit",
	"cobi": "cobi",
	"courier-boldoblique": "cobi",
}
MULTILINE_FLAG = 1 << 12
COMB_FLAG = 1 << 24


def is_comb(widget) -> bool:
	"""A comb text field: MaxLen cells, one character per cell (account
	numbers, IFSC, dates on bank forms). PyMuPDF's appearance ignores the
	flag and writes the value as a plain string, so these are always drawn."""
	return bool(widget.field_flags & COMB_FLAG) and int(widget.text_maxlen or 0) > 0


def _pdf_string(text: str) -> str:
	return "(" + text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") + ")"


def fill_comb_widget(doc, widget, text: str, alias: str, size: float) -> bool:
	"""Set a comb field's value and write its appearance one character per
	cell, the way Acrobat renders comb fields. The widget is kept, so the
	downloaded PDF stays a fillable form: click the row and the digits are
	editable, one per box.

	Only for base-14 faces (that is what the field's /DA names); a bold,
	embedded or non-Latin comb falls back to drawing over the page."""
	cells = int(widget.text_maxlen)
	text = text[:cells]
	metrics = fitz.Font(WIDGET_FONT_FILES.get(alias, "helv"))
	box = fitz.Rect(widget.rect)
	cell_w = box.width / cells
	if not widget.text_fontsize:
		size = min(box.height * 0.72, cell_w * 1.1)  # Acrobat's auto-size for combs
	widest = max(metrics.text_length(ch, fontsize=size) for ch in text) or size
	if widest > cell_w * 0.85:
		size = size * (cell_w * 0.85) / widest

	widget.text_font = alias
	widget.field_value = text
	widget.update()

	kind, ref = doc.xref_get_key(widget.xref, "AP/N")
	if kind != "xref":
		return False
	ap_xref = int(ref.split()[0])
	font_res = re.search(r"/(\w+)\s+\d+\s+0\s+R", doc.xref_get_key(ap_xref, "Resources/Font")[1] or "")
	if not font_res:
		return False
	bbox = doc.xref_get_key(ap_xref, "BBox")[1]
	try:
		_, _, ap_w, ap_h = (float(v) for v in bbox.strip("[]").split())
	except ValueError:
		ap_w, ap_h = box.width, box.height
	cell_w = ap_w / cells
	glyph_h = (metrics.ascender - metrics.descender) * size
	baseline = (ap_h - glyph_h) / 2 - metrics.descender * size

	color = widget.text_color or [0]
	if len(color) == 3:
		paint = "{:.3f} {:.3f} {:.3f} rg".format(*color)
	elif len(color) == 4:
		paint = "{:.3f} {:.3f} {:.3f} {:.3f} k".format(*color)
	else:
		paint = f"{color[0]:.3f} g"
	ops = ["/Tx BMC", "q", "BT", paint, f"/{font_res.group(1)} {size:.2f} Tf"]
	x_prev = y_prev = 0.0
	for i, ch in enumerate(text):
		if ch.isspace():
			continue
		x = i * cell_w + (cell_w - metrics.text_length(ch, fontsize=size)) / 2
		ops.append(f"{x - x_prev:.2f} {baseline - y_prev:.2f} Td {_pdf_string(ch)} Tj")
		x_prev, y_prev = x, baseline
	ops += ["ET", "Q", "EMC"]
	doc.update_stream(ap_xref, "\n".join(ops).encode("latin-1"))
	return True


def draw_comb_text(page, widget, text: str, font, size: float) -> bool:
	"""Centre one character in each cell of a comb field, drawn on the page
	(the widget is removed: for faces the field's /DA cannot name)."""
	fontname, fontbuffer = font
	if not text:
		return False
	if fontbuffer:
		page.insert_font(fontname=fontname, fontbuffer=fontbuffer)
		metrics = fitz.Font(fontbuffer=fontbuffer)
	else:
		metrics = fitz.Font(fontname)
	cells = int(widget.text_maxlen)
	box = fitz.Rect(widget.rect)
	cell_w = box.width / cells
	if not widget.text_fontsize:
		# Auto-size, as Acrobat does for comb fields: fit the cell.
		size = min(box.height * 0.72, cell_w * 1.1)
	# Fit: a cell must hold its widest character with a little air.
	widest = max(metrics.text_length(ch, fontsize=size) for ch in text[:cells]) or size
	if widest > cell_w * 0.85:
		size = size * (cell_w * 0.85) / widest
	glyph_h = (metrics.ascender - metrics.descender) * size
	baseline = box.y0 + (box.height - glyph_h) / 2 + metrics.ascender * size
	color = widget.text_color if widget.text_color else (0, 0, 0)
	for i, ch in enumerate(text[:cells]):
		if ch.isspace():
			continue
		w = metrics.text_length(ch, fontsize=size)
		x = box.x0 + i * cell_w + (cell_w - w) / 2
		page.insert_text((x, baseline), ch, fontname=fontname, fontsize=size, color=color)
	page.delete_widget(widget)
	return True


# Family buckets the annotator's font stacks understand.
PREVIEW_FAMILY = {
	"he": "helvetica",
	"ti": "times-roman",
	"co": "courier",
	"sy": "symbol",
	"za": "zapfdingbats",
}


def guess_base14(name: str) -> str:
	"""Nearest base-14 alias for a font we cannot use directly (e.g. ArialMT,
	HelveticaLTStd-Bold, Georgia-Italic): family from the name, then style."""
	n = (name or "").lower()
	# Base-14 aliases (TiRo, HeBo, Cour...) name their family directly.
	if n in WIDGET_FONTS:
		return {"Helv": "helv", "TiRo": "tiro", "Cour": "cour", "Symb": "symb", "ZaDb": "zadb"}[
			WIDGET_FONTS[n]
		]
	if n in DRAW_FONTS:
		return DRAW_FONTS[n]
	bold = "bold" in n or "black" in n or "heavy" in n or n.endswith(",b") or n.endswith("-b")
	italic = "italic" in n or "oblique" in n or n.endswith(",i") or n.endswith("-i")
	if any(k in n for k in ("courier", "mono", "consol")):
		fam = "co"
	elif any(k in n for k in ("times", "serif", "georgia", "garamond", "book", "roman", "cambria")):
		fam = "ti"
	elif "symbol" in n:
		return "symb"
	elif "zapf" in n or "dingbat" in n:
		return "zadb"
	else:
		fam = "he"
	if fam == "ti":
		return {(False, False): "tiro", (True, False): "tibo", (False, True): "tiit", (True, True): "tibi"}[
			(bold, italic)
		]
	if fam == "co":
		return {(False, False): "cour", (True, False): "cobo", (False, True): "coit", (True, True): "cobi"}[
			(bold, italic)
		]
	return {(False, False): "helv", (True, False): "hebo", (False, True): "heit", (True, True): "hebi"}[
		(bold, italic)
	]


def regular_widget_font(alias: str) -> str:
	"""The regular base-14 widget font of the same family as a draw alias."""
	family = (alias or "he")[:2]
	return {"he": "Helv", "ti": "TiRo", "co": "Cour", "sy": "Symb", "za": "ZaDb"}.get(family, "Helv")


def embedded_font_buffer(doc, page, da_name: str):
	"""The font program the form embeds under this /DA name, if any."""
	if not da_name:
		return None
	try:
		ref = doc.xref_get_key(doc.pdf_catalog(), f"AcroForm/DR/Font/{da_name}")
		xref = int(ref[1].split()[0]) if ref[0] == "xref" else None
		if xref is None:
			xref = next((f[0] for f in page.get_fonts() if f[4] == da_name), None)
		if xref is None:
			return None
		_name, _ext, _type, buf = doc.extract_font(xref)
		return buf or None
	except Exception:
		return None


def resolve_text_style(doc, page, annotation, template_font, template_font_size):
	"""How this field's text should be set: override, else what the PDF
	declared, else the template default.

	Returns (mode, font, size): mode "widget" with a base-14 alias the widget
	can carry, or mode "draw" with a fontname/fontbuffer pair for insert_textbox.
	"""
	try:
		override_size = float(annotation.font_size) if annotation.font_size is not None else 0
	except (TypeError, ValueError):
		override_size = 0
	try:
		declared_size = float(annotation.get("pdf_font_size") or 0)
	except (TypeError, ValueError):
		declared_size = 0
	try:
		tpl_size = float(template_font_size) if template_font_size is not None else 12
	except (TypeError, ValueError):
		tpl_size = 12

	if annotation.override_style and override_size > 0:
		size = override_size
	elif declared_size > 0:
		size = declared_size
	else:
		size = tpl_size
	if not size or size <= 0:
		size = 12

	declared_font = (annotation.get("pdf_font") or "").strip()
	if annotation.override_style and annotation.font and annotation.font != "None":
		name = annotation.font
	elif declared_font:
		name = declared_font
	else:
		name = template_font or "helvetica"

	key = name.lower()
	if key in WIDGET_FONTS:
		return "widget", WIDGET_FONTS[key], size
	if key in DRAW_FONTS:
		return "draw", (DRAW_FONTS[key], None), size

	buf = embedded_font_buffer(doc, page, name) if name == declared_font else None
	if buf:
		return "draw", (f"pdfforms_{re.sub(r'[^A-Za-z0-9]', '', name)}", buf), size

	alias = guess_base14(name)
	if alias in WIDGET_FONTS:
		return "widget", WIDGET_FONTS[alias], size
	return "draw", (alias, None), size


# Base-14 widget fonts cover WinAnsi only. A value with a glyph outside that --
# the rupee sign in every INR amount -- makes PyMuPDF build the appearance with
# a fallback font whose baseline lands outside the clip box, so the amount
# prints cut in half. Such values are drawn with Noto Sans (bundled with
# pymupdf-fonts), which has the glyphs.
WIDGET_FONT_FILES = {"Helv": "helv", "TiRo": "tiro", "Cour": "cour", "Symb": "symb", "ZaDb": "zadb"}
UNICODE_DRAW_FONT = "notos"


def widget_font_can_render(alias: str, text: str) -> bool:
	try:
		font = fitz.Font(WIDGET_FONT_FILES.get(alias, "helv"))
	except Exception:
		return True
	return all(font.has_glyph(ord(ch)) for ch in text if not ch.isspace())


def draw_field_text(page, widget, text: str, font, size: float) -> bool:
	"""Write the value into the field's box with the real font, then remove the
	widget: the drawn text is the field now. Returns False (and leaves the
	widget alone) if nothing could be drawn, so a field is never lost silently.
	"""
	fontname, fontbuffer = font
	if not text:
		return False
	if fontbuffer:
		page.insert_font(fontname=fontname, fontbuffer=fontbuffer)
		metrics = fitz.Font(fontbuffer=fontbuffer)
	else:
		metrics = fitz.Font(fontname)

	box = fitz.Rect(widget.rect)
	inset = fitz.Rect(box.x0 + 2, box.y0 + 1, box.x1 - 2, box.y1 - 1)
	color = widget.text_color if widget.text_color else (0, 0, 0)
	align = {0: fitz.TEXT_ALIGN_LEFT, 1: fitz.TEXT_ALIGN_CENTER, 2: fitz.TEXT_ALIGN_RIGHT}.get(
		widget.text_format or 0, fitz.TEXT_ALIGN_LEFT
	)

	if widget.field_flags & MULTILINE_FLAG:
		# Fixed-size text that does not fit is stepped down rather than dropped:
		# insert_textbox refuses outright when the block is too tall.
		fs = size
		while fs >= 4:
			if (
				page.insert_textbox(inset, text, fontname=fontname, fontsize=fs, color=color, align=align)
				>= 0
			):
				page.delete_widget(widget)
				return True
			fs -= 0.5
		return False

	if not widget.text_fontsize and size >= box.height:
		size = box.height * 0.72  # auto-size: fit the box
	# Single line: centre by the font's own ascent/descent, like a viewer does.
	# insert_text places a baseline and never refuses, so tall faces (Lora's
	# ascent is 1.006) cannot make the value disappear.
	glyph_h = (metrics.ascender - metrics.descender) * size
	baseline = box.y0 + (box.height - glyph_h) / 2 + metrics.ascender * size
	width = metrics.text_length(text, fontsize=size)
	x = inset.x0
	if align == fitz.TEXT_ALIGN_CENTER:
		x = inset.x0 + max(0, (inset.width - width) / 2)
	elif align == fitz.TEXT_ALIGN_RIGHT:
		x = max(inset.x0, inset.x1 - width)
	page.insert_text((x, baseline), text, fontname=fontname, fontsize=size, color=color)
	page.delete_widget(widget)
	return True


def annotate_form_template(page, i, template_id, data, font, font_size, base_index=0, xref_map=None):
	if xref_map is None:
		xref_map = {}
	form_template = frappe.get_cached_doc("Form Template", template_id)
	auto_annotations = [
		row
		for row in form_template.form_template_field
		if row.page_index == i and row.annotation_type == "Auto"
	]

	# loop through the auto annotations and add the text to the page
	annotatate_auto_fields(page, auto_annotations, data, font, font_size, base_index, xref_map)

	# loop through the manual annotations and add the text to the page
	manual_annotations = [
		row
		for row in form_template.form_template_field
		if row.page_index == i and row.annotation_type == "Manual"
	]

	annotatate_manual_fields(page, manual_annotations, data, font, font_size, base_index)


def annotatate_auto_fields(page, auto_annotations, data, font, font_size, base_index=0, xref_map=None):
	if xref_map is None:
		xref_map = {}
	# A list, not the generator: the draw path deletes widgets as it goes.
	fields = list(page.widgets())
	doc = page.parent

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
					text = str(value) if value is not None and value != "None" else ""
					mode, text_font, size = resolve_text_style(doc, page, annotation, font, font_size)
					if mode == "widget" and text and not widget_font_can_render(text_font, text):
						mode, text_font = "draw", (UNICODE_DRAW_FONT, None)
					if is_comb(field) and text:
						if mode == "widget" and fill_comb_widget(doc, field, text, text_font, size):
							continue
						if mode == "widget":
							text_font = (WIDGET_FONT_FILES.get(text_font, "helv"), None)
						if draw_comb_text(page, field, text, text_font, size):
							continue
					if mode == "widget":
						field.text_fontsize = size
						field.text_font = text_font
						field.field_value = text
						field.update()
					elif not draw_field_text(page, field, text, text_font, size):
						# Could not draw (empty value, or a multiline box too small
						# even at 4pt): keep the field as a widget in its regular face.
						field.text_fontsize = size
						field.text_font = regular_widget_font(text_font[0])
						field.field_value = text
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
	image_width_by_id = {}
	for annotation in manual_annotations:
		if annotation.form_template_image and annotation.form_template_image not in image_width_by_id:
			row = frappe.db.get_value(
				"Form Template Image",
				{"parent": annotation.parent, "id": annotation.form_template_image},
				["width"],
				as_dict=True,
			)
			image_width_by_id[annotation.form_template_image] = row.width if row else None

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

			width = image_width_by_id.get(annotation.form_template_image)
			ratio = width / page_width if width and width > 0 else 1

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
			mode, text_font, size = resolve_text_style(page.parent, page, annotation, font, font_size)
			widget.text_fontsize = size
			# A manual box is a fresh widget with nothing declared, so it stays a
			# widget; a variant the widget cannot carry uses its regular face.
			widget.text_font = text_font if mode == "widget" else regular_widget_font(text_font[0])
			# A box drawn in the annotator arrives with no field_type; it is text.
			manual_type = annotation.field_type or "Text"
			widget.field_type = get_field_type(manual_type)
			# No frame: a manual box says where the value goes, not what to draw.
			# If the form wants a box there, the form already has one.

			# PyMuPDF assigns the xref on add_widget; computing one from the
			# page's existing widgets crashed on a page that had none.
			page.add_widget(widget)

			form_fields = page.widgets()
			# find the widget and update the field value
			for field in form_fields:
				if field.field_name == annotation.field_label:
					if manual_type == "Text":
						field.field_value = str(value) if value is not None and value != "None" else ""
						field.update()

					elif manual_type == "Checkbox":
						if value is True or value == "True" or value == "1" or value == 1:
							field.field_value = field.on_state()
							field.update()
					elif manual_type == "Radio Button":
						if value is True or value == "True" or value == "1" or value == 1:
							field.field_value = field.on_state()
							field.update()


def get_annotation(field_name, annotations, xref, xref_map):
	# get the annotation for the field from the auto_annotations list which matches the field_name and xref
	annotation = None
	for a in annotations:
		mapped_xref = xref_map.get(str(a.xref), xref_map.get(a.xref))
		a_xref = mapped_xref if mapped_xref is not None else a.xref
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
			frappe.log_error(f"Error rendering Jinja template: {e}")

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


@frappe.whitelist()
def get_template_font(template_id: str, font_name: str):
	"""The font program a template's PDF embeds under a /DA name, for the
	annotator preview to register as a web font. Only fonts the PDF's own
	AcroForm declares are reachable, and only when a program is embedded.
	"""
	template = frappe.get_doc("Form Template", template_id)
	template.check_permission("read")
	doc = fitz.open(template_file_path(template.file))
	buffer = embedded_font_buffer(doc, doc[0], font_name)
	if not buffer:
		frappe.throw(
			_("The PDF does not embed a font named {0}.").format(font_name), frappe.DoesNotExistError
		)

	frappe.local.response.filename = f"{re.sub(r'[^A-Za-z0-9_-]', '', font_name) or 'font'}.bin"
	frappe.local.response.filecontent = buffer
	frappe.local.response.type = "binary"
