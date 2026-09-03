# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt
"""Rules the Form Template enforces, and the small helpers the printer trusts."""

import frappe
from frappe.tests.utils import FrappeTestCase

from pdf_forms.tests._fixtures import make_form_pdf, make_template


class TestTemplateRules(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.set_user("Administrator")
		cls.tpl = make_template(
			"_Test Rules Template",
			"ToDo",
			make_form_pdf([("F1", "Description", "text", 0, "Helv", 9)], title="rules"),
		)

	@classmethod
	def tearDownClass(cls):
		frappe.delete_doc("Form Template", cls.tpl.name, force=1, ignore_permissions=True)
		super().tearDownClass()

	def test_pdf_cannot_be_replaced(self):
		tpl = frappe.get_doc("Form Template", self.tpl.name)
		tpl.file = "/private/files/other.pdf"
		self.assertRaises(frappe.ValidationError, tpl.save)

	def test_pdf_cannot_be_removed(self):
		tpl = frappe.get_doc("Form Template", self.tpl.name)
		tpl.file = None
		self.assertRaises(frappe.ValidationError, tpl.save)

	def test_upload_records_declared_font_and_size(self):
		row = self.tpl.form_template_field[0]
		self.assertEqual(row.pdf_font, "Helv")
		self.assertEqual(float(row.pdf_font_size), 9.0)
		self.assertEqual(self.tpl.font, "helvetica")

	def test_manual_annotation_is_text_by_default(self):
		from pdf_forms.pdf_forms.doctype.form_template_field.form_template_field import update_annotation

		img = self.tpl.form_template_image[0]
		update_annotation(
			self.tpl.name,
			[
				{
					"id": "new",
					"value": "xywh=pixel:10,10,100,20",
					"source": "",
					"page_index": 0,
					"form_template_image": img.id,
				}
			],
		)
		manual = [
			r
			for r in frappe.get_doc("Form Template", self.tpl.name).form_template_field
			if r.annotation_type == "Manual"
		]
		self.assertEqual(len(manual), 1)
		self.assertEqual(manual[0].field_type, "Text")

	def test_malformed_geometry_is_a_validation_error(self):
		from pdf_forms.pdf_forms.doctype.form_template_field.form_template_field import _extract_dimensions

		self.assertRaises(frappe.ValidationError, _extract_dimensions, "garbage")
		self.assertRaises(frappe.ValidationError, _extract_dimensions, "xywh=pixel:1,2")
		self.assertEqual(_extract_dimensions("xywh=pixel:1,2,3,4"), ("1.0", "2.0", "3.0", "4.0"))

	def test_template_file_path_stays_inside_site_files(self):
		from pdf_forms.utils.files import template_file_path

		self.assertTrue(template_file_path("/private/files/x.pdf").endswith("/private/files/x.pdf"))
		for bad in (
			"/private/files/../../../../etc/hosts",
			"/etc/hosts",
			"private/../../sites/other/private/files/a.pdf",
		):
			with self.subTest(path=bad):
				self.assertRaises(frappe.PermissionError, template_file_path, bad)
		self.assertRaises(frappe.DoesNotExistError, template_file_path, None)

	def test_copies_expression_is_robust(self):
		from pdf_forms.api.print import MAX_PAGE_COPIES, resolve_copies

		data = {"items": [1, 2, 3]}
		self.assertEqual(resolve_copies("{{ (items|length) - 1 }}", data, "t", 0), 2)
		self.assertEqual(resolve_copies("", data, "t", 0), 0)
		self.assertEqual(resolve_copies("   ", data, "t", 0), 0)
		self.assertEqual(resolve_copies("abc", data, "t", 0), 0)
		self.assertEqual(resolve_copies("{{ items|length ", data, "t", 0), 0)
		self.assertEqual(resolve_copies("{{ -5 }}", data, "t", 0), 0)
		self.assertEqual(resolve_copies("{{ 999 }}", data, "t", 0), MAX_PAGE_COPIES)

	def test_delete_annotation_reports_the_id(self):
		from pdf_forms.pdf_forms.doctype.form_template_field.form_template_field import delete_annotation

		with self.assertRaises(frappe.ValidationError) as ctx:
			delete_annotation(self.tpl.name, "no-such-row")
		self.assertIn("no-such-row", str(ctx.exception))
