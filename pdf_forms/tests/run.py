"""Run the app's tests on a site where `bench run-tests` cannot bootstrap.

Frappe's runner preloads legacy test records for every doctype the app
links to; on some sites that chain (Print Format -> ... -> Email Account)
is unsatisfiable and the run dies before the first test. This runs the same
test classes under the connected site:

    bench --site <site> execute pdf_forms.tests.run.main
"""

import unittest

import frappe

MODULES = (
	"pdf_forms.tests.test_permissions",
	"pdf_forms.tests.test_template_rules",
	"pdf_forms.tests.test_printing",
	"pdf_forms.tests.test_api_sanity",
)


def main() -> str:
	frappe.flags.in_test = True
	frappe.set_user("Administrator")
	suite = unittest.TestSuite()
	loader = unittest.TestLoader()
	for module in MODULES:
		suite.addTests(loader.loadTestsFromName(module))
	result = unittest.TextTestRunner(verbosity=2).run(suite)
	frappe.db.rollback()
	summary = f"{result.testsRun} run, {len(result.failures)} failed, {len(result.errors)} errors"
	if not result.wasSuccessful():
		frappe.throw(summary)
	return summary
