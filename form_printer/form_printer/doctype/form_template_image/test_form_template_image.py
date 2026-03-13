# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase


class TestFormTemplateImage(FrappeTestCase):
	"""Unit tests for Form Template Image doctype"""

	def setUp(self):
		"""Set up test data"""
		# Create a test Form Template
		self.form_template = frappe.get_doc(
			{
				"doctype": "Form Template",
				"template_name": f"Test Template {frappe.generate_hash(length=6)}",
				"data_source": "DocType",
				"source": "User",
			}
		)
		self.form_template.insert()
		frappe.db.commit()

	def tearDown(self):
		"""Clean up test data"""
		if frappe.db.exists("Form Template", self.form_template.name):
			frappe.delete_doc("Form Template", self.form_template.name, force=1)
			frappe.db.commit()

	def test_create_form_template_image(self):
		"""Test creating a Form Template Image"""
		image = frappe.get_doc(
			{
				"doctype": "Form Template Image",
				"form_template_id": self.form_template.name,
				"page_index": 0,
				"width": 100,
				"height": 100,
			}
		)
		image.insert()

		self.assertTrue(frappe.db.exists("Form Template Image", image.name))

		# Cleanup
		frappe.delete_doc("Form Template Image", image.name, force=1)
		frappe.db.commit()
