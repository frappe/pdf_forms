# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt
"""Printing end to end on a generated form: every value type, defaults,
formatters, style, checkboxes, a repeat page, a manual box, and the preview."""

import fitz
import frappe
from frappe.tests.utils import FrappeTestCase

from pdf_forms.api.print import build_form_template_pdf, get_preview_values
from pdf_forms.tests._fixtures import make_form_pdf, make_template, spans_in

WIDGETS = [
	("T_FIELD", "Description", "text", 0, "Helv", 9),
	("T_TEXT", "Literal", "text", 0, "Helv", 9),
	("T_JINJA", "Jinja", "text", 0, "Helv", 9),
	("T_PROMPT", "Prompt", "text", 0, "Helv", 9),
	("T_DEFAULT", "Missing With Default", "text", 0, "Helv", 9),
	("T_DEFJINJA", "Missing With Jinja Default", "text", 0, "Helv", 9),
	("T_CURRENCY", "Amount", "text", 0, "Helv", 9),
	("T_RUPEE", "Rupee Literal", "text", 0, "Helv", 9),
	("T_TIMES", "Times Field", "text", 0, "TiRo", 11),
	("T_OVERRIDE", "Overridden", "text", 0, "Helv", 9),
	("C_ON", "Checked", "check", 0, "ZaDb", 0),
	("C_OFF", "Unchecked", "check", 0, "ZaDb", 0),
	("R_ITEM", "Item", "text", 1, "Helv", 9),
]


class TestPrinting(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.set_user("Administrator")
		cls.pdf_bytes = make_form_pdf(WIDGETS, pages=2, title="printing")
		cls.tpl = make_template("_Test Printing Template", "ToDo", cls.pdf_bytes)
		rows = {r.field_name: r for r in cls.tpl.form_template_field}
		cfg = {
			"T_FIELD": dict(value_type="Field", field_value="description"),
			"T_TEXT": dict(value_type="Text", field_value="LITERAL TEXT"),
			"T_JINJA": dict(value_type="Jinja", field_value="{{ description|upper }}"),
			"T_PROMPT": dict(value_type="Prompt", field_value="remarks"),
			"T_DEFAULT": dict(value_type="Field", field_value="no_such_field", default_value="fallback"),
			"T_DEFJINJA": dict(
				value_type="Field",
				field_value="no_such_field",
				default_value="{{ priority }}-default",
				is_default_jinja=1,
			),
			"T_CURRENCY": dict(value_type="Field", field_value="amount", formatter="Currency"),
			# A glyph Helvetica does not have, whatever the site's currency is.
			"T_RUPEE": dict(value_type="Text", field_value="₹ 1,00,000.00"),
			"T_TIMES": dict(value_type="Field", field_value="description"),
			"T_OVERRIDE": dict(
				value_type="Field", field_value="description", override_style=1, font="courier", font_size=13
			),
			"C_ON": dict(value_type="Jinja", field_value="{{ 1 if priority == 'High' else 0 }}"),
			"C_OFF": dict(value_type="Field", field_value="no_such_flag"),
			"R_ITEM": dict(value_type="Field", field_value="items[0].label"),
		}
		for name, values in cfg.items():
			for k, v in values.items():
				setattr(rows[name], k, v)
		# manual box on page 1, which also has a widget
		img1 = next(i for i in cls.tpl.form_template_image if i.page_index == 1)
		ratio = img1.width / 595
		cls.tpl.append(
			"form_template_field",
			{
				"id": frappe.generate_hash(length=10),
				"form_template_image": img1.id,
				"source": "",
				"value": f"xywh=pixel:{40 * ratio},{300 * ratio},{300 * ratio},{22 * ratio}",
				"page_index": 1,
				"x_point": str(40 * ratio),
				"y_point": str(300 * ratio),
				"width": str(300 * ratio),
				"height": str(22 * ratio),
				"annotation_type": "Manual",
				"value_type": "Jinja",
				"field_value": "manual {{ priority }}",
				"field_label": "Manual Box",
				"field_type": "Text",
			},
		)
		# page 1 repeats once per extra item
		img1.repeat_page, img1.repeat_after, img1.copies, img1.base_index = (
			1,
			1,
			"{{ (items|length) - 1 }}",
			1,
		)
		cls.tpl.save(ignore_permissions=True)
		cls.tpl = frappe.get_doc("Form Template", cls.tpl.name)

		cls.data = {
			"description": "Water the plants",
			"priority": "High",
			"amount": 1234.5,
			"remarks": "from prompt",
			"items": [{"label": "first item"}, {"label": "second item"}, {"label": "third item"}],
		}
		cls.out = fitz.open(
			stream=build_form_template_pdf(template_id=cls.tpl.name, data=cls.data), filetype="pdf"
		)
		src = fitz.open(stream=cls.pdf_bytes, filetype="pdf")
		cls.rects = {w.field_name: (i, fitz.Rect(w.rect)) for i, p in enumerate(src) for w in p.widgets()}

	@classmethod
	def tearDownClass(cls):
		frappe.delete_doc("Form Template", cls.tpl.name, force=1, ignore_permissions=True)
		super().tearDownClass()

	def text_of(self, field, page=None):
		pi, rect = self.rects[field]
		return " ".join(t for t, _, _ in spans_in(self.out[page if page is not None else pi], rect))

	def test_value_types(self):
		self.assertIn("Water the plants", self.text_of("T_FIELD"))
		self.assertIn("LITERAL TEXT", self.text_of("T_TEXT"))
		self.assertIn("WATER THE PLANTS", self.text_of("T_JINJA"))
		self.assertIn("from prompt", self.text_of("T_PROMPT"))

	def test_defaults(self):
		self.assertIn("fallback", self.text_of("T_DEFAULT"))
		self.assertIn("High-default", self.text_of("T_DEFJINJA"))

	def test_currency_with_rupee_prints_whole(self):
		want = frappe.utils.fmt_money(1234.5, currency=frappe.db.get_default("currency"))
		self.assertIn(want, self.text_of("T_CURRENCY"))

	def test_declared_and_overridden_fonts(self):
		pi, rect = self.rects["T_TIMES"]
		fonts = {(f, s) for _, f, s in spans_in(self.out[pi], rect)}
		self.assertTrue(any("Times" in f and s == 11.0 for f, s in fonts), fonts)
		pi, rect = self.rects["T_OVERRIDE"]
		fonts = {(f, s) for _, f, s in spans_in(self.out[pi], rect)}
		self.assertTrue(any("Courier" in f and s == 13.0 for f, s in fonts), fonts)

	def test_checkboxes(self):
		states = {
			w.field_name: w.field_value for w in self.out[0].widgets() if w.field_type_string == "CheckBox"
		}
		self.assertNotIn(states["C_ON"], (None, "Off", "", False))
		self.assertIn(states["C_OFF"], (None, "Off", "", False))

	def test_repeat_page_copies_walk_the_child_rows(self):
		self.assertEqual(self.out.page_count, 4, "2 base pages + 2 copies for 3 items")
		self.assertIn("first item", self.text_of("R_ITEM", page=1))
		self.assertIn("second item", self.text_of("R_ITEM", page=2))
		self.assertIn("third item", self.text_of("R_ITEM", page=3))
		# a copy must not carry the original's value on top of its own
		self.assertNotIn("first item", self.text_of("R_ITEM", page=2))

	def test_manual_box_prints_without_a_frame(self):
		rect = fitz.Rect(40, 300, 340, 322)
		self.assertIn("manual High", " ".join(t for t, _, _ in spans_in(self.out[1], rect)))
		# the only drawings on page 1 are the form's own ruled boxes
		self.assertEqual(
			len(self.out[1].get_drawings()),
			len(fitz.open(stream=self.pdf_bytes, filetype="pdf")[1].get_drawings()),
		)

	def test_output_stays_fillable_even_in_fonts_the_field_cannot_name(self):
		widgets = {w.field_name: w for w in self.out[0].widgets()}
		self.assertIn("T_FIELD", widgets)
		self.assertIn("T_CURRENCY", widgets)
		# the rupee sign is outside the field's Helvetica; it is drawn in Noto
		# Sans, but inside the field's own appearance, so the field survives
		self.assertIn("T_RUPEE", widgets)
		self.assertEqual(widgets["T_RUPEE"].field_value, "₹ 1,00,000.00")
		_kind, ref = self.out.xref_get_key(widgets["T_RUPEE"].xref, "AP/N")
		ap = int(ref.split()[0])
		self.assertIn("cm", self.out.xref_stream(ap).decode("latin-1"))
		self.assertEqual(self.out.xref_get_key(ap, "Resources/Font")[0] in ("dict", "xref"), True)
		# and nothing was left behind on the page itself
		self.assertEqual(
			len(self.out[0].get_drawings()),
			len(fitz.open(stream=self.pdf_bytes, filetype="pdf")[0].get_drawings()),
		)
		self.assertIn("T_OVERRIDE", widgets, "an overridden face is drawn into the field too")

	def test_preview_mirrors_the_printer(self):
		pv = get_preview_values(self.tpl.name, self.data)
		by_name = {r.field_name: r.name for r in self.tpl.form_template_field if r.annotation_type == "Auto"}
		self.assertEqual(pv[by_name["T_JINJA"]]["text"], "WATER THE PLANTS")
		self.assertEqual(pv[by_name["T_DEFJINJA"]]["text"], "High-default")
		self.assertTrue(pv[by_name["C_ON"]]["checked"])
		# a field that prints nothing is absent from the preview by design
		self.assertNotIn(by_name["C_OFF"], pv)
		self.assertEqual(pv[by_name["T_TIMES"]]["font"], "times-roman")
		self.assertEqual(pv[by_name["T_OVERRIDE"]]["font"], "courier")
