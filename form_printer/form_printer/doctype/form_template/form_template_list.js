// Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.listview_settings["Form Template"] = {
	get_form_link(doc) {
		// Redirect to documents app template view instead of standard form
		return "/documents/template/" + encodeURIComponent(doc.name);
	},
	primary_action() {
		let d;

		const onCreate = async (values) => {
			const fileUrl = values.file;
			if (!fileUrl) {
				frappe.msgprint(__("Please upload a PDF file."));
				return;
			}

			// Attach control uploads first and returns a file URL. Enforce PDF-only here.
			const lower = String(fileUrl).toLowerCase();
			if (!lower.endsWith(".pdf")) {
				frappe.msgprint(__("Only PDF files are allowed."));
				d.set_value("file", null);
				return;
			}

			d.set_primary_action(__("Creating..."), () => {});

			try {
				const insertRes = await frappe.call({
					method: "frappe.client.insert",
					args: {
						doc: {
							doctype: "Form Template",
							template_name: values.template_name,
							description: values.description || "",
							data_source: "DocType",
							source: values.source,
						},
					},
				});

				const docname = insertRes?.message?.name;
				if (!docname) throw new Error("Missing docname");

				// Attach uploader already created a File record and returned file URL.
				// Now just link it to this document's `file` field.
				await frappe.call({
					method: "frappe.client.set_value",
					args: {
						doctype: "Form Template",
						name: docname,
						fieldname: "file",
						value: fileUrl,
					},
				});

				frappe.show_alert({ message: __("Form template created"), indicator: "green" });
				d.hide();
				if (cur_list) cur_list.refresh();
			} catch (e) {
				console.error(e);
				frappe.msgprint(__("Failed to create form template."));
				d.set_primary_action(__("Create"), onCreate);
			}
		};

		d = new frappe.ui.Dialog({
			title: __("Add Form Template"),
			fields: [
				{
					fieldname: "file",
					fieldtype: "Attach",
					label: __("PDF File"),
					reqd: 1,
					description: __("Upload a PDF to create a new form template."),
				},
				{
					fieldname: "template_name",
					fieldtype: "Data",
					label: __("Template Name"),
					reqd: 1,
					placeholder: __("eg: User Appointment Letter"),
				},
				{
					fieldname: "source",
					fieldtype: "Link",
					label: __("Source"),
					options: "DocType",
					reqd: 1,
					placeholder: __("Select a source"),
				},
				{
					fieldname: "description",
					fieldtype: "Small Text",
					label: __("Description"),
				},
			],
			primary_action_label: __("Create"),
			primary_action: onCreate,
		});

		// Clear non-PDFs immediately after upload selection (best-effort, still validated in onCreate).
		d.fields_dict.file?.$input?.on("change", () => {
			const v = d.get_value("file");
			if (v && !String(v).toLowerCase().endsWith(".pdf")) {
				frappe.msgprint(__("Only PDF files are allowed."));
				d.set_value("file", null);
			}
		});

		d.show();
	},
};
