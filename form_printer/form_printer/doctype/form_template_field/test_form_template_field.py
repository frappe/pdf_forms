# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase


class TestFormTemplateField(FrappeTestCase):
	"""Unit tests for Form Template Field doctype"""

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

		# Create a test Form Template Image (required for Form Template Field)
		self.form_template_image = frappe.get_doc(
			{
				"doctype": "Form Template Image",
				"form_template_id": self.form_template.name,
				"page_index": 0,
			}
		)
		self.form_template_image.insert()
		frappe.db.commit()

	def tearDown(self):
		"""Clean up test data"""
		if frappe.db.exists("Form Template Image", self.form_template_image.name):
			frappe.delete_doc("Form Template Image", self.form_template_image.name, force=1)
		if frappe.db.exists("Form Template", self.form_template.name):
			frappe.delete_doc("Form Template", self.form_template.name, force=1)
		frappe.db.commit()

	def test_create_form_template_field(self):
		"""Test creating a Form Template Field"""
		field = frappe.get_doc(
			{
				"doctype": "Form Template Field",
				"form_template": self.form_template.name,
				"form_template_image": self.form_template_image.name,
				"id": "test_field_1",
				"value": "xywh=pixel:100,200,50,30",
				"page_index": 0,
				"annotation_type": "Manual",
				"value_type": "Text",
			}
		)
		field.insert()

		self.assertTrue(frappe.db.exists("Form Template Field", field.name))

		# Cleanup
		frappe.delete_doc("Form Template Field", field.name, force=1)
		frappe.db.commit()

	def test_get_dimensions_from_value(self):
		"""Test that dimensions are extracted from value field"""
		field = frappe.get_doc(
			{
				"doctype": "Form Template Field",
				"form_template": self.form_template.name,
				"form_template_image": self.form_template_image.name,
				"id": "test_field_2",
				"value": "xywh=pixel:100,200,50,30",
				"page_index": 0,
				"annotation_type": "Manual",
				"value_type": "Text",
			}
		)
		field.insert()

		# Reload to get calculated dimensions
		field.reload()
		self.assertEqual(field.x_point, "100")
		self.assertEqual(field.y_point, "200")
		self.assertEqual(field.width, "50")
		self.assertEqual(field.height, "30")

		# Cleanup
		frappe.delete_doc("Form Template Field", field.name, force=1)
		frappe.db.commit()
