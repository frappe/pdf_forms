# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase


class TestAPISanity(FrappeTestCase):
	"""Basic sanity tests for API functions"""

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

	def test_get_annotations(self):
		"""Test get_annotations API returns list"""
		from pdf_forms.pdf_forms.doctype.form_template_field.form_template_field import get_annotations

		result = get_annotations(self.form_template.name)
		self.assertIsInstance(result, list)

	def test_add_prompt_to_form_template(self):
		"""Test adding a prompt to form template"""
		from pdf_forms.api.form_template import add_prompt_to_form_template

		prompt = {
			"field_name": "test_field",
			"label": "Test Field",
			"type": "Text",
			"description": "Test description",
			"mandatory": 0,
		}

		result = add_prompt_to_form_template(self.form_template.name, prompt)
		self.assertEqual(result.name, self.form_template.name)
		self.assertEqual(len(result.prompts), 1)
		self.assertEqual(result.prompts[0].field_name, "test_field")

	def test_update_prompt_in_form_template(self):
		"""Test updating a prompt in form template"""
		from pdf_forms.api.form_template import add_prompt_to_form_template, update_prompt_in_form_template

		# First add a prompt
		prompt = {
			"field_name": "test_field",
			"label": "Test Field",
			"type": "Text",
		}
		result = add_prompt_to_form_template(self.form_template.name, prompt)
		prompt_name = result.prompts[0].name

		# Then update it
		updated_prompt = {
			"name": prompt_name,
			"field_name": "test_field",
			"label": "Updated Field",
			"type": "Text",
		}
		result = update_prompt_in_form_template(self.form_template.name, updated_prompt)
		self.assertEqual(result.name, self.form_template.name)

	def test_remove_prompt_from_form_template(self):
		"""Test removing a prompt from form template"""
		from pdf_forms.api.form_template import (
			add_prompt_to_form_template,
			remove_prompt_from_form_template,
		)

		# First add a prompt
		prompt = {
			"field_name": "test_field",
			"label": "Test Field",
			"type": "Text",
		}
		result = add_prompt_to_form_template(self.form_template.name, prompt)
		prompt_name = result.prompts[0].name

		# Then remove it
		result = remove_prompt_from_form_template(self.form_template.name, {"name": prompt_name})
		self.assertEqual(len(result.prompts), 0)

	def test_update_form_template_fields(self):
		"""Test updating form template fields"""
		from pdf_forms.pdf_forms.doctype.form_template_field.form_template_field import (
			update_form_template_fields,
		)

		# Should not raise an error
		update_form_template_fields(self.form_template.name, fields=[], font="Helvetica", font_size=12)

		# Verify the update
		updated_template = frappe.get_doc("Form Template", self.form_template.name)
		self.assertEqual(updated_template.font, "Helvetica")
		# font_size may be stored as string, so convert for comparison
		self.assertEqual(int(updated_template.font_size), 12)
