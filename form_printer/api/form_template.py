import frappe


@frappe.whitelist()
def add_prompt_to_form_template(form_template_id, prompt):
	"""
	This method will add a prompt to the form template
	1. Get the Form Template from the document
	2. Add the prompt to the Form Template
	3. Save the Form Template
	4. Return the Form Template
	"""
	# 1. Get the Form Template from the document
	form_template = frappe.get_doc("Form Template", form_template_id)
	# 2. Add the prompt to the Form Template
	form_template.append("prompts", prompt)
	# 3. Save the Form Template
	form_template.save()
	# 4. Return the Form Template
	return form_template


@frappe.whitelist()
def remove_prompt_from_form_template(form_template_id, prompt):
	"""
	This method will remove a prompt from the form template
	1. Get the Form Template from the document
	2. Find the child row by name and remove it
	3. Save the Form Template
	4. Return the Form Template
	"""
	if isinstance(prompt, str):
		prompt = frappe.parse_json(prompt)

	form_template = frappe.get_doc("Form Template", form_template_id)

	prompt_name = prompt.get("name") if isinstance(prompt, dict) else prompt

	for row in form_template.prompts:
		if row.name == prompt_name:
			form_template.remove(row)
			break
	else:
		frappe.throw(f"Prompt {prompt_name} not found")

	form_template.save()
	return form_template


@frappe.whitelist()
def update_prompt_in_form_template(form_template_id, prompt):
	"""
	This method will update a prompt in the form template
	1. Get the Form Template from the document
	2. Find the child row by name and update its fields
	3. Save the Form Template
	4. Return the Form Template
	"""
	if isinstance(prompt, str):
		prompt = frappe.parse_json(prompt)

	form_template = frappe.get_doc("Form Template", form_template_id)

	for row in form_template.prompts:
		if row.name == prompt.get("name"):
			row.field_name = prompt.get("field_name", row.field_name)
			row.label = prompt.get("label", row.label)
			row.type = prompt.get("type", row.type) or "Text"  # default to Text if type is not provided
			row.description = prompt.get("description", row.description)
			row.mandatory = prompt.get("mandatory", row.mandatory)
			break
	else:
		frappe.throw(f"Prompt {prompt.get('name')} not found")

	form_template.save()

	return form_template
