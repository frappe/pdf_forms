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
		self.form_template.append(
			"form_template_image",
			{
				"id": "test_image_1",
				"page_index": 0,
				"width": 1000,
				"height": 1000,
			},
		)
		self.form_template.save()
		self.form_template.reload()
		self.form_template_image = self.form_template.form_template_image[0]

	def tearDown(self):
		"""Clean up test data"""
		if frappe.db.exists("Form Template", self.form_template.name):
			frappe.delete_doc("Form Template", self.form_template.name, force=1)

	def test_create_form_template_field(self):
		"""Test creating a Form Template Field child row"""
		self.form_template.append(
			"form_template_field",
			{
				"id": "test_field_1",
				"value": "xywh=pixel:100,200,50,30",
				"page_index": 0,
				"x_point": "100",
				"y_point": "200",
				"width": "50",
				"height": "30",
				"form_template_image": self.form_template_image.id,
				"annotation_type": "Manual",
				"value_type": "Text",
			},
		)
		self.form_template.save()
		self.form_template.reload()

		self.assertEqual(len(self.form_template.form_template_field), 1)
		self.assertEqual(self.form_template.form_template_field[0].id, "test_field_1")

	def test_get_dimensions_from_value(self):
		"""Test that dimensions are extracted from value field"""
		self.form_template.append(
			"form_template_field",
			{
				"id": "test_field_2",
				"value": "xywh=pixel:100,200,50,30",
				"page_index": 0,
				"x_point": "100",
				"y_point": "200",
				"width": "50",
				"height": "30",
				"form_template_image": self.form_template_image.id,
				"annotation_type": "Manual",
				"value_type": "Text",
			},
		)
		self.form_template.save()
		self.form_template.reload()

		field = self.form_template.form_template_field[0]
		self.assertEqual(field.x_point, "100")
		self.assertEqual(field.y_point, "200")
		self.assertEqual(field.width, "50")
		self.assertEqual(field.height, "30")
