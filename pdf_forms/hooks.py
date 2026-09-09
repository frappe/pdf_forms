app_name = "pdf_forms"
app_title = "PDF Forms"
app_publisher = "Frappe Technologies Pvt. Ltd."
app_description = "Frappe app to manage PDF forms"
app_email = "contact@frappe.io"
app_license = "gpl-3.0"
app_logo_url = "/assets/pdf_forms/images/pdf-forms-logo.svg"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
add_to_apps_screen = [
	{
		"name": "pdf_forms",
		"logo": "/assets/pdf_forms/images/pdf-forms-logo.svg",
		"title": "PDF Forms",
		"route": "/pdf_forms",
		"has_permission": "pdf_forms.api.permission.has_app_permission",
	}
]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/pdf_forms/css/pdf_forms.css"
app_include_js = "/assets/pdf_forms/js/print_button_visibility.js"

# include js, css files in header of web template
# web_include_css = "/assets/pdf_forms/css/pdf_forms.css"
# web_include_js = "/assets/pdf_forms/js/pdf_forms.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "pdf_forms/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
doctype_list_js = {"Form Template": "pdf_forms/doctype/form_template/form_template_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "pdf_forms/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "pdf_forms.utils.jinja_methods",
# 	"filters": "pdf_forms.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "pdf_forms.install.before_install"
after_install = "pdf_forms.setup.after_install"

# Uninstallation
# ------------

# before_uninstall = "pdf_forms.uninstall.before_uninstall"
# after_uninstall = "pdf_forms.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "pdf_forms.utils.before_app_install"
# after_app_install = "pdf_forms.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "pdf_forms.utils.before_app_uninstall"
# after_app_uninstall = "pdf_forms.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "pdf_forms.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"pdf_forms.tasks.all"
# 	],
# 	"daily": [
# 		"pdf_forms.tasks.daily"
# 	],
# 	"hourly": [
# 		"pdf_forms.tasks.hourly"
# 	],
# 	"weekly": [
# 		"pdf_forms.tasks.weekly"
# 	],
# 	"monthly": [
# 		"pdf_forms.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "pdf_forms.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "pdf_forms.event.get_events"
# }
override_whitelisted_methods = {
	"frappe.utils.print_format.download_pdf": "pdf_forms.api.print_format.download_pdf",
	"frappe.www.printview.get_html_and_style": "pdf_forms.api.print_format.get_html_and_style",
}
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "pdf_forms.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["pdf_forms.utils.before_request"]
# after_request = ["pdf_forms.utils.after_request"]

# Job Events
# ----------
# before_job = ["pdf_forms.utils.before_job"]
# after_job = ["pdf_forms.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"pdf_forms.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }


website_route_rules = [
	{"from_route": "/pdf_forms", "to_route": "pdf_forms"},
	{"from_route": "/pdf_forms/<path:app_path>", "to_route": "pdf_forms"},
]
