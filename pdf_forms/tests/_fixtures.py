# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

"""Shared fixtures: a tiny AcroForm PDF and a Form Template built from it."""

import fitz
import frappe
from frappe.utils.file_manager import save_file

from pdf_forms.pdf_forms.doctype.form_template.form_template import convert_pdf_to_image


def make_form_pdf(widgets, pages=1, size=(595, 842), title="test form"):
	"""widgets: [(name, label, kind, page, font, size)], kind in text|check.
	Returns PDF bytes. Boxes are ruled in black; widgets are invisible, like a
	form made in Acrobat. `title` is printed on every page so two fixtures never
	produce byte-identical page images: Frappe's save_file de-duplicates files
	by content hash, and a hash shared with a rolled-back fixture points at a
	File record whose file is already gone."""
	doc = fitz.open()
	rects = {}
	for p in range(pages):
		page = doc.new_page(width=size[0], height=size[1])
		page.insert_text((40, 40), f"{title} - page {p + 1}", fontname="helv", fontsize=10)
		y = 60
		for w in [w for w in widgets if w[3] == p]:
			rect = fitz.Rect(40, y, 400, y + 24) if w[2] == "text" else fitz.Rect(40, y, 52, y + 12)
			page.draw_rect(rect, color=(0, 0, 0), width=0.6)
			rects[w[0]] = (p, rect)
			y += 36
	buf = doc.tobytes()
	doc.close()
	doc = fitz.open(stream=buf, filetype="pdf")
	for name, label, kind, p, font, fsize in widgets:
		wg = fitz.Widget()
		wg.rect = rects[name][1]
		wg.field_name, wg.field_label = name, label
		wg.fill_color = wg.border_color = None
		wg.border_width = 0
		if kind == "text":
			wg.field_type = fitz.PDF_WIDGET_TYPE_TEXT
			wg.text_font, wg.text_fontsize, wg.text_color = font, fsize, (0, 0, 0)
		else:
			wg.field_type = fitz.PDF_WIDGET_TYPE_CHECKBOX
		doc[p].add_widget(wg)
	out = doc.tobytes()
	doc.close()
	return out


def make_template(name, source, pdf_bytes):
	"""Create + convert a Form Template the way the UI does, but without the
	on_update enqueue (file is set with db_set) so tests never race a worker."""
	if frappe.db.exists("Form Template", name):
		frappe.delete_doc("Form Template", name, force=1, ignore_permissions=True)
	# File records left behind by an earlier, rolled-back run (their files are
	# deleted with the template, the records come back with the rollback).
	for stale in frappe.get_all(
		"File", filters={"attached_to_doctype": "Form Template", "attached_to_name": name}, pluck="name"
	):
		frappe.delete_doc("File", stale, force=1, ignore_permissions=True)
	tpl = frappe.get_doc(
		{"doctype": "Form Template", "template_name": name, "data_source": "DocType", "source": source}
	).insert(ignore_permissions=True)
	f = save_file(f"{name}.pdf", pdf_bytes, "Form Template", tpl.name, is_private=1)
	tpl.db_set("file", f.file_url)
	convert_pdf_to_image(tpl.name)
	return frappe.get_doc("Form Template", tpl.name)


def spans_in(page, rect):
	return [
		(s["text"], s["font"], round(s["size"], 1))
		for b in page.get_text("dict")["blocks"]
		for line in b.get("lines", [])
		for s in line["spans"]
		if fitz.Rect(s["bbox"]).intersects(rect) and s["text"].strip()
	]
