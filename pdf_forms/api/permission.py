import frappe


def has_app_permission() -> bool:
	"""Show PDF Forms on the desk apps screen."""
	if frappe.session.user == "Guest":
		return False
	if frappe.session.user == "Administrator":
		return True

	return "System Manager" in frappe.get_roles()
