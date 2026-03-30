(() => {
	let isPatched = false;
	let patchTimer = null;

	const getPromptDataQuery = (view) => {
		if (!view?.__form_printer_prompt_data) return "";
		try {
			const encoded = encodeURIComponent(JSON.stringify(view.__form_printer_prompt_data));
			return `&prompt_data=${encoded}`;
		} catch (e) {
			return "";
		}
	};

	const isFormTemplateFormat = (printFormat) =>
		Boolean(
			printFormat &&
				printFormat.form_template &&
				!(printFormat.print_designer && printFormat.print_designer_body)
		);

	const fetchTemplatePrompts = async (templateID) => {
		if (!templateID) return [];
		const response = await frappe.call({
			method: "form_printer.form_printer.doctype.form_template.form_template.get_form_template_prompts",
			args: { form_template_id: templateID },
		});
		return Array.isArray(response?.message) ? response.message : [];
	};

	const openPromptDialog = (prompts = [], existingValues = {}) =>
		new Promise((resolve) => {
			const fields = prompts.map((prompt) => ({
				label: prompt.label || prompt.field_name,
				fieldname: prompt.field_name,
				fieldtype: prompt.type === "Checkbox" ? "Check" : "Data",
				default: existingValues[prompt.field_name],
				description: prompt.description || "",
				reqd: Number(prompt.mandatory || 0) === 1 ? 1 : 0,
			}));

			const dialog = new frappe.ui.Dialog({
				title: __("Fill Prompt Fields"),
				fields,
				primary_action_label: __("Continue"),
				primary_action: () => {
					const values = dialog.get_values();
					if (!values) return;
					dialog.hide();
					resolve(values);
				},
				secondary_action_label: __("Cancel"),
				secondary_action: () => {
					dialog.hide();
					resolve(null);
				},
			});

			dialog.onhide = () => {
				if (!dialog.get_values()) {
					resolve(null);
				}
			};
			dialog.show();
		});

	const ensurePromptData = async (view, force = false) => {
		const printFormat = view.get_print_format ? view.get_print_format() : null;
		if (!isFormTemplateFormat(printFormat)) {
			view.__form_printer_prompt_data = null;
			view.__form_printer_prompt_cache_key = null;
			view.__form_printer_prompts = [];
			return true;
		}

		const cacheKey = `${printFormat.name || ""}:${printFormat.form_template || ""}`;
		if (view.__form_printer_prompt_cache_key !== cacheKey) {
			view.__form_printer_prompt_cache_key = cacheKey;
			view.__form_printer_prompt_data = null;
			view.__form_printer_prompts = [];
		}

		if (!Array.isArray(view.__form_printer_prompts) || view.__form_printer_prompts.length === 0) {
			view.__form_printer_prompts = await fetchTemplatePrompts(printFormat.form_template);
		}

		const prompts = view.__form_printer_prompts || [];
		if (!prompts.length) {
			view.__form_printer_prompt_data = null;
			return true;
		}

		if (!force && view.__form_printer_prompt_data) {
			return true;
		}

		const values = await openPromptDialog(prompts, view.__form_printer_prompt_data || {});
		if (!values) return false;
		view.__form_printer_prompt_data = values;
		return true;
	};

	const togglePrintButtons = (view, shouldHide) => {
		const show = !shouldHide;

		// Default Frappe primary action
		view.page?.btn_primary?.toggle(show);
		view.page?.wrapper?.find?.(".primary-action")?.toggle(show);

		// Default Frappe full page button selector
		view.wrapper.find(".btn-print-preview").toggle(show);

		// Fallback by button label for variants/themes
		view.page?.wrapper
			?.find?.("button, a")
			.filter((_, el) => (el.textContent || "").trim() === __("Full Page"))
			.toggle(show);

		// Print Designer keeps references to these
		if (view.full_page_btn?.toggle) view.full_page_btn.toggle(show);
		if (view.print_btn?.toggle) view.print_btn.toggle(show);
	};

	const patchPrintView = () => {
		const PrintView = frappe?.ui?.form?.PrintView;
		if (!PrintView || PrintView.prototype.__form_printer_button_patch_applied) {
			return;
		}

		const originalPreview = PrintView.prototype.preview;

		PrintView.prototype.preview = function (...args) {
			const result = originalPreview.apply(this, args);

			const printFormat = this.get_print_format ? this.get_print_format() : null;
			const shouldHide = isFormTemplateFormat(printFormat);
			togglePrintButtons(this, shouldHide);

			return result;
		};

		PrintView.prototype.__form_printer_button_patch_applied = true;

		const originalGetPrintHtml = PrintView.prototype.get_print_html;
		PrintView.prototype.get_print_html = function (callback) {
			const printFormat = this.get_print_format ? this.get_print_format() : null;
			if (!isFormTemplateFormat(printFormat)) {
				return originalGetPrintHtml.call(this, callback);
			}

			ensurePromptData(this)
				.then((canProceed) => {
					if (!canProceed) {
						callback({ html: this.get_no_preview_html ? this.get_no_preview_html() : "" });
						return;
					}

					if (printFormat.raw_printing) {
						callback({ html: this.get_no_preview_html ? this.get_no_preview_html() : "" });
						return;
					}

					if (this._req) {
						this._req.abort();
					}
					this._req = frappe.call({
						method: "frappe.www.printview.get_html_and_style",
						args: {
							doc: this.frm.doc,
							print_format: this.selected_format(),
							no_letterhead: !this.with_letterhead() ? 1 : 0,
							letterhead: this.get_letterhead(),
							settings: this.additional_settings,
							_lang: this.lang_code,
							prompt_data: this.__form_printer_prompt_data
								? JSON.stringify(this.__form_printer_prompt_data)
								: null,
						},
						callback: function (r) {
							if (!r.exc) {
								callback(r.message);
							}
						},
					});
				})
				.catch(() => originalGetPrintHtml.call(this, callback));
		};

		const originalRenderPage = PrintView.prototype.render_page;
		PrintView.prototype.render_page = async function (method, printit = false, pdf_generator) {
			const printFormat = this.get_print_format ? this.get_print_format() : null;
			if (!isFormTemplateFormat(printFormat)) {
				return originalRenderPage.call(this, method, printit, pdf_generator);
			}

			const canProceed = await ensurePromptData(this, true);
			if (!canProceed) return;

			pdf_generator = this.get_pdf_generator(pdf_generator);
			const w = window.open(
				frappe.urllib.get_full_url(
					method +
						"doctype=" +
						encodeURIComponent(this.frm.doc.doctype) +
						"&name=" +
						encodeURIComponent(this.frm.doc.name) +
						(printit ? "&trigger_print=1" : "") +
						"&format=" +
						encodeURIComponent(this.selected_format()) +
						"&no_letterhead=" +
						(this.with_letterhead() ? "0" : "1") +
						"&letterhead=" +
						encodeURIComponent(this.get_letterhead()) +
						"&settings=" +
						encodeURIComponent(JSON.stringify(this.additional_settings)) +
						(this.lang_code ? "&_lang=" + this.lang_code : "") +
						"&pdf_generator=" +
						encodeURIComponent(pdf_generator) +
						getPromptDataQuery(this)
				)
			);
			if (!w) {
				frappe.msgprint(__("Please enable pop-ups"));
			}
		};

		isPatched = true;
		return true;
	};

	const startPatchWatcher = () => {
		if (isPatched) {
			return;
		}
		if (patchTimer) clearInterval(patchTimer);
		let tries = 0;
		patchTimer = setInterval(() => {
			const patched = patchPrintView();
			tries += 1;
			if (patched || tries > 100) {
				clearInterval(patchTimer);
				patchTimer = null;
			}
		}, 100);
	};

	startPatchWatcher();
	$(document).on("app-routing-complete", startPatchWatcher);
	$(document).on("page-change", startPatchWatcher);
})();
