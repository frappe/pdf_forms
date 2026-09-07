# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt
"""Comb fields (one cell per character): filled one character per cell, kept
editable, and a pre-printed hint in the cells hidden under the value."""

import re

import fitz
import frappe
from frappe.tests.utils import FrappeTestCase

from pdf_forms.api.print import build_form_template_pdf
from pdf_forms.tests._fixtures import make_template

CELLS = 8
PLAIN = fitz.Rect(40, 80, 240, 96)
HINTED = fitz.Rect(40, 120, 240, 136)


def make_comb_pdf():
	"""Two 8-cell comb fields on ruled boxes; the second has D D M M Y Y Y Y
	printed in the cells, as bank forms do, and a white field background."""
	doc = fitz.open()
	page = doc.new_page(width=595, height=842)
	page.insert_text((40, 40), "comb fixture", fontname="helv", fontsize=10)
	for rect, hint in ((PLAIN, ""), (HINTED, "DDMMYYYY")):
		cell = rect.width / CELLS
		for i in range(CELLS):
			c = fitz.Rect(rect.x0 + i * cell, rect.y0, rect.x0 + (i + 1) * cell, rect.y1)
			page.draw_rect(c, color=(0, 0, 0), width=0.6)
			if hint:
				page.insert_text((c.x0 + 4, c.y1 - 4), hint[i], fontname="helv", fontsize=8, color=(0.6, 0.6, 0.6))
	buf = doc.tobytes()
	doc = fitz.open(stream=buf, filetype="pdf")
	page = doc[0]
	for name, rect, bg in (("PLAIN", PLAIN, None), ("HINTED", HINTED, (1, 1, 1))):
		w = fitz.Widget()
		w.rect, w.field_name, w.field_label = rect, name, name
		w.field_type = fitz.PDF_WIDGET_TYPE_TEXT
		w.text_font, w.text_fontsize, w.text_color = "Cour", 0, (0, 0, 0)
		w.text_maxlen, w.field_flags = CELLS, 1 << 24
		w.border_color, w.border_width, w.fill_color = None, 0, bg
		page.add_widget(w)
	return doc.tobytes()


class TestCombFields(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.set_user("Administrator")
		cls.tpl = make_template("_Test Comb Template", "ToDo", make_comb_pdf())
		for row in cls.tpl.form_template_field:
			row.value_type, row.field_value = "Field", "description"
		cls.tpl.save()
		pdf = build_form_template_pdf(template_id=cls.tpl.name, data={"description": "01092026"})
		cls.out = fitz.open(stream=pdf, filetype="pdf")
		cls.widgets = {w.field_name: w for w in cls.out[0].widgets()}

	def appearance(self, name):
		kind, ref = self.out.xref_get_key(self.widgets[name].xref, "AP/N")
		return self.out.xref_stream(int(ref.split()[0])).decode("latin-1")

	def test_value_lands_one_character_per_cell(self):
		w = self.widgets["PLAIN"]
		self.assertEqual(w.field_value, "01092026", "the field keeps its value, so the form stays editable")
		# eight separate text-showing operators, one per cell, spread across the box
		glyphs = re.findall(r"\((.)\) Tj", self.appearance("PLAIN"))
		self.assertEqual("".join(glyphs), "01092026")
		xs = [float(m) for m in re.findall(r"([\d.]+) [\d.-]+ Td", self.appearance("PLAIN"))]
		self.assertEqual(len(xs), CELLS)
		self.assertTrue(all(x > 0 for x in xs[1:]), "each character moves right into the next cell")

	def test_hint_is_painted_over_only_when_the_field_asks(self):
		hinted, plain = self.appearance("HINTED"), self.appearance("PLAIN")
		self.assertEqual(len(re.findall(r" re\b", hinted)), CELLS, "one white patch per cell")
		self.assertIn("1.000 1.000 1.000 rg", hinted)
		self.assertNotIn(" re", plain, "a field without a background paints nothing behind its value")

	def test_patches_stay_inside_the_cell_borders(self):
		cell = HINTED.width / CELLS
		for x, y, w, h in (map(float, m) for m in re.findall(r"([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re", self.appearance("HINTED"))):
			self.assertGreater(x % cell, 0.5, "patch starts after the cell's left border")
			self.assertLess(w, cell - 1, "and ends before the right one")
			self.assertGreater(y, 0.5)
			self.assertLess(y + h, HINTED.height - 0.5)

	def test_hint_no_longer_shows_in_the_render(self):
		# the hint letters sit at the left of each cell, the digit in the middle:
		# after filling, the left strip of every cell must be plain white
		cell = HINTED.width / CELLS
		blank = fitz.open(stream=make_comb_pdf(), filetype="pdf")[0]

		def ink(page, annots=True):
			total = 0
			for i in range(CELLS):
				x0 = HINTED.x0 + i * cell
				strip = fitz.Rect(x0 + 1.6, HINTED.y0 + 1.6, x0 + 7.5, HINTED.y1 - 1.6)
				pix = page.get_pixmap(dpi=200, clip=strip, annots=annots)
				total += sum(1 for k in range(0, len(pix.samples), pix.n) if pix.samples[k] < 235)
			return total

		# the page itself (widgets aside) does print a hint there
		self.assertGreater(ink(blank, annots=False), 50)
		self.assertEqual(ink(self.out[0]), 0)
