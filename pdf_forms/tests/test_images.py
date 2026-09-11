# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt
"""Picture values: a Signature field's data URL or an attached image is
stamped into the field's box instead of being written as text."""

import base64

import fitz
import frappe
from frappe.tests.utils import FrappeTestCase

from pdf_forms.api.print import build_form_template_pdf, get_preview_values, image_bytes_for
from pdf_forms.tests._fixtures import make_form_pdf, make_template

WIDGETS = [
	("SIGN", "Signature", "text", 0, "Helv", 9),
	("NAME", "Name", "text", 0, "Helv", 9),
]


def signature_data_url():
	doc = fitz.open()
	page = doc.new_page(width=200, height=60)
	shape = page.new_shape()
	shape.draw_bezier((10, 40), (60, -10), (120, 80), (190, 20))
	shape.finish(color=(0, 0, 0.5), width=2)
	shape.commit()
	png = page.get_pixmap(dpi=100, alpha=True).tobytes("png")
	return "data:image/png;base64," + base64.b64encode(png).decode()


class TestImageValues(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.set_user("Administrator")
		cls.pdf_bytes = make_form_pdf(WIDGETS, title="images")
		cls.tpl = make_template("_Test Image Template", "ToDo", cls.pdf_bytes)
		for row in cls.tpl.form_template_field:
			row.value_type = "Field"
			row.field_value = "signature" if row.field_name == "SIGN" else "description"
		cls.tpl.save()
		cls.data = {"description": "Water the plants", "signature": signature_data_url()}
		pdf = build_form_template_pdf(template_id=cls.tpl.name, data=cls.data)
		cls.out = fitz.open(stream=pdf, filetype="pdf")

	def test_only_images_are_images(self):
		self.assertIsNotNone(image_bytes_for(self.data["signature"]))
		self.assertIsNone(image_bytes_for("Water the plants"))
		self.assertIsNone(image_bytes_for("https://example.com/x.png"), "nothing is fetched from the web")
		self.assertIsNone(image_bytes_for("/etc/passwd"))
		self.assertIsNone(image_bytes_for(42))

	def test_signature_is_stamped_inside_its_box(self):
		page = self.out[0]
		names = {w.field_name for w in page.widgets()}
		self.assertNotIn("SIGN", names, "a stamped picture replaces the field")
		self.assertIn("NAME", names, "the text field next to it is untouched")
		infos = page.get_image_info()
		self.assertEqual(len(infos), 1)
		box = fitz.Rect(infos[0]["bbox"])
		sign_rect = next(
			fitz.Rect(w["rect"]) for w in _fixture_widgets(self.pdf_bytes) if w["name"] == "SIGN"
		)
		self.assertTrue(sign_rect.contains(box), f"{box} outside {sign_rect}")
		# proportions kept: the 200x60 picture is wider than tall
		self.assertGreater(box.width / box.height, 2.5)

	def test_preview_reports_the_picture(self):
		pv = get_preview_values(self.tpl.name, self.data)
		by_name = {r.field_name: r.name for r in self.tpl.form_template_field}
		self.assertEqual(pv[by_name["SIGN"]]["kind"], "image")
		self.assertTrue(pv[by_name["SIGN"]]["src"].startswith("data:image/png"))
		self.assertEqual(pv[by_name["NAME"]]["kind"], "text")


def _fixture_widgets(pdf_bytes):
	doc = fitz.open(stream=pdf_bytes, filetype="pdf")
	return [{"name": w.field_name, "rect": w.rect} for w in doc[0].widgets()]
