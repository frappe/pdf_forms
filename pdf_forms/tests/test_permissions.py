# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt
"""Every whitelisted endpoint is reachable by any logged-in user; the doctype
is System Manager only. These tests pin that the endpoints ask."""

import frappe
from frappe.tests.utils import FrappeTestCase

from pdf_forms.tests._fixtures import make_form_pdf, make_template

RESTRICTED = "pdf-forms-restricted@example.com"


class TestPermissions(FrappeTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.set_user("Administrator")
		if not frappe.db.exists("User", RESTRICTED):
			frappe.get_doc(
				{
					"doctype": "User",
					"email": RESTRICTED,
					"first_name": "Restricted",
					"send_welcome_email": 0,
					"roles": [{"role": "Blogger"}],
				}
			).insert(ignore_permissions=True)
		cls.tpl = make_template(
			"_Test Perm Template",
			"ToDo",
			make_form_pdf([("F1", "Description", "text", 0, "Helv", 9)], title="perm"),
		)

	@classmethod
	def tearDownClass(cls):
		frappe.set_user("Administrator")
		frappe.delete_doc("Form Template", cls.tpl.name, force=1, ignore_permissions=True)
		frappe.delete_doc("User", RESTRICTED, force=1, ignore_permissions=True)
		super().tearDownClass()

	def setUp(self):
		frappe.set_user(RESTRICTED)

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_restricted_user_has_no_read_on_form_template(self):
		self.assertFalse(frappe.has_permission("Form Template", "read", self.tpl.name))

	def test_read_endpoints_refuse(self):
		from pdf_forms.api.print import get_preview_values, print_form_template
		from pdf_forms.pdf_forms.doctype.form_template.form_template import (
			download_data_source_sheet,
			get_fields_and_prompts_for_form_template,
			get_form_template_prompts,
		)
		from pdf_forms.pdf_forms.doctype.form_template_field.form_template_field import (
			get_annotations,
			get_for_template_images,
		)

		for fn, args in [
			(get_annotations, (self.tpl.name,)),
			(get_for_template_images, (self.tpl.name,)),
			(get_form_template_prompts, (self.tpl.name,)),
			(get_fields_and_prompts_for_form_template, (self.tpl.name,)),
			(download_data_source_sheet, (self.tpl.name,)),
			(get_preview_values, (self.tpl.name, {})),
			(print_form_template, (self.tpl.name, {})),
		]:
			with self.subTest(endpoint=fn.__name__):
				self.assertRaises(frappe.PermissionError, fn, *args)

	def test_write_endpoints_refuse_and_change_nothing(self):
		from pdf_forms.api.form_template import add_prompt_to_form_template
		from pdf_forms.pdf_forms.doctype.form_template_field.form_template_field import (
			delete_annotation,
			update_annotation,
			update_form_template_fields,
		)

		before = frappe.db.get_value("Form Template", self.tpl.name, ["font", "font_size"], as_dict=True)
		self.assertRaises(
			frappe.PermissionError,
			update_form_template_fields,
			self.tpl.name,
			fields=[],
			font="courier",
			font_size=99,
		)
		after = frappe.db.get_value("Form Template", self.tpl.name, ["font", "font_size"], as_dict=True)
		self.assertEqual(before, after, "font/size must not change through a refused call")
		self.assertRaises(
			frappe.PermissionError,
			update_annotation,
			self.tpl.name,
			[
				{
					"id": "x",
					"value": "xywh=pixel:1,1,2,2",
					"source": "",
					"page_index": 0,
					"form_template_image": "x",
				}
			],
		)
		self.assertRaises(frappe.PermissionError, delete_annotation, self.tpl.name, "x")
		self.assertRaises(
			frappe.PermissionError,
			add_prompt_to_form_template,
			self.tpl.name,
			{"field_name": "p", "label": "P", "type": "Text"},
		)

	def test_administrator_can_read(self):
		from pdf_forms.pdf_forms.doctype.form_template_field.form_template_field import get_annotations

		frappe.set_user("Administrator")
		self.assertEqual(len(get_annotations(self.tpl.name)), 1)
