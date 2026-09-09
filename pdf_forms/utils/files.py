"""Resolving a Form Template's uploaded PDF to a path on disk, safely."""

import os

import frappe
from frappe import _


def template_file_path(file_url: str | None) -> str:
	"""Absolute path of a template's attached PDF.

	`frappe.get_site_path` joins whatever it is given, `..` included, so a
	crafted `file` value could point the converter and the printer at any PDF
	on the server. The path must stay inside the site's public or private files.
	"""
	if not file_url:
		frappe.throw(_("This template has no PDF."), frappe.DoesNotExistError)

	site_root = os.path.realpath(frappe.get_site_path())
	candidate = os.path.realpath(frappe.get_site_path(file_url.lstrip("/")))
	allowed = (
		os.path.join(site_root, "private", "files") + os.sep,
		os.path.join(site_root, "public", "files") + os.sep,
	)
	if not candidate.startswith(allowed):
		frappe.throw(_("The template file must be an uploaded file."), frappe.PermissionError)
	return candidate
