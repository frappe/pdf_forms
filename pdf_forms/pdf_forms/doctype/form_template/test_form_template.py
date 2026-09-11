# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase


class TestFormTemplate(FrappeTestCase):
	"""Unit tests for Form Template doctype"""

	def test_create_form_template(self):
		"""Test creating a Form Template"""
		form_template = frappe.get_doc(
			{
				"doctype": "Form Template",
				"template_name": f"Test Template {frappe.generate_hash(length=6)}",
				"data_source": "DocType",
				"source": "User",
			}
		)
		form_template.insert()

		self.assertTrue(frappe.db.exists("Form Template", form_template.name))

		# Cleanup
		frappe.delete_doc("Form Template", form_template.name, force=1)

	def test_form_template_required_fields(self):
		"""Test that required fields are enforced"""
		# Test missing template_name (required for naming)
		form_template1 = frappe.get_doc(
			{
				"doctype": "Form Template",
			}
		)
		with self.assertRaises((frappe.MandatoryError, frappe.ValidationError)):
			form_template1.insert()

		# Test missing source field (required)
		form_template2 = frappe.get_doc(
			{
				"doctype": "Form Template",
				"template_name": f"Test Template {frappe.generate_hash(length=6)}",
				"data_source": "DocType",
				# Missing source field
			}
		)
		with self.assertRaises(frappe.MandatoryError):
			form_template2.insert()
