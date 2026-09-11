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

	def tearDown(self):
		"""Clean up test data"""
		if frappe.db.exists("Form Template", self.form_template.name):
			frappe.delete_doc("Form Template", self.form_template.name, force=1)

	def test_create_form_template_image(self):
		"""Test creating a Form Template Image child row"""
		self.form_template.append(
			"form_template_image",
			{
				"id": "test_image_1",
				"page_index": 0,
				"width": 100,
				"height": 100,
			},
		)
		self.form_template.save()
		self.form_template.reload()

		self.assertEqual(len(self.form_template.form_template_image), 1)
		self.assertEqual(self.form_template.form_template_image[0].id, "test_image_1")
