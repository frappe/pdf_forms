(() => {
	let isPatched = false;
	let patchTimer = null;

	const getPromptDataQuery = (view) => {
		if (!view?.__pdf_forms_prompt_data) return "";
		try {
			const encoded = encodeURIComponent(JSON.stringify(view.__pdf_forms_prompt_data));
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
			method: "pdf_forms.pdf_forms.doctype.form_template.form_template.get_form_template_prompts",
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
			view.__pdf_forms_prompt_data = null;
			view.__pdf_forms_prompt_cache_key = null;
			view.__pdf_forms_prompts = [];
			return true;
		}

		const cacheKey = `${printFormat.name || ""}:${printFormat.form_template || ""}`;
		if (view.__pdf_forms_prompt_cache_key !== cacheKey) {
			view.__pdf_forms_prompt_cache_key = cacheKey;
			view.__pdf_forms_prompt_data = null;
			view.__pdf_forms_prompts = [];
		}

		if (!Array.isArray(view.__pdf_forms_prompts) || view.__pdf_forms_prompts.length === 0) {
			view.__pdf_forms_prompts = await fetchTemplatePrompts(printFormat.form_template);
		}

		const prompts = view.__pdf_forms_prompts || [];
		if (!prompts.length) {
			view.__pdf_forms_prompt_data = null;
			return true;
		}

		if (!force && view.__pdf_forms_prompt_data) {
			return true;
		}

		const values = await openPromptDialog(prompts, view.__pdf_forms_prompt_data || {});
		if (!values) return false;
		view.__pdf_forms_prompt_data = values;
		return true;
	};

	// Both toolbar buttons work for these formats now, so nothing is hidden:
	// Full Page goes to the inline PDF (see render_page), and Print goes to the
	// embedded viewer's own print (see printit).
	const togglePrintButtons = (view, isFormTemplate) => {
		const show = true;

		view.page?.btn_primary?.toggle(show);
		view.page?.wrapper?.find?.(".primary-action")?.toggle(show);

		if (view.print_btn?.toggle) view.print_btn.toggle(show);
	};

	// Standard formats render through Frappe's newer "beta" preview, whose paper
	// starts 28px down; form-template formats go through the classic preview,
	// whose wrapper pads 80px. Left alone, the same page sits 52px lower than a
	// normal print format. This lives out here because the wrapper is outside
	// the print-format iframe our preview CSS is injected into.
	const PREVIEW_ALIGN_STYLE_ID = "pdf-forms-preview-align";
	const ensureAlignStyle = () => {
		if (document.getElementById(PREVIEW_ALIGN_STYLE_ID)) return;
		const style = document.createElement("style");
		style.id = PREVIEW_ALIGN_STYLE_ID;
		// Two differences between the classic preview (used by these formats) and
		// the beta preview (used by standard ones): the classic wrapper pads 80px
		// where the beta paper starts at 28px, and the classic sheet is rounded
		// where real paper -- and the beta preview -- is square.
		style.textContent =
			".pdf-forms-print-preview .print-preview-wrapper { padding-top: 28px; }" +
			".pdf-forms-print-preview .print-preview { border-radius: 0; }";
		document.head.appendChild(style);
	};

	const alignPreviewToStandard = (isFormTemplate) => {
		ensureAlignStyle();
		document.body.classList.toggle("pdf-forms-print-preview", !!isFormTemplate);
	};

	// Frappe renders its print skeleton in make() and removes it the moment the
	// format HTML arrives. For these formats that is too early: the HTML only
	// embeds a PDF, which the browser then takes seconds to paint, leaving the
	// viewer's dark backdrop on screen. So the skeleton goes back up and stays
	// until the embedded PDF has actually loaded.
	const SKELETON_GIVE_UP_MS = 20000;

	const showLoadingSkeleton = (view) => {
		const $preview = view.print_wrapper?.find?.(".print-preview");
		if (!$preview?.length || $preview.find(".print-format-skeleton").length) return;
		try {
			$preview.prepend(frappe.render_template("print_skeleton_loading"));
		} catch (e) {
			return; // No skeleton is better than a broken preview.
		}
		// visibility, not display: the iframe keeps its box, so nothing jumps
		// when the PDF appears.
		$preview.find("iframe.print-format-container").css("visibility", "hidden");
	};

	const hideLoadingSkeleton = (view) => {
		const $preview = view.print_wrapper?.find?.(".print-preview");
		if (!$preview?.length) return;
		$preview.find(".print-format-skeleton").remove();
		$preview.find("iframe.print-format-container").css("visibility", "");
	};

	/** Hold the skeleton until the first embedded page reports it has loaded. */
	const hideSkeletonWhenPdfPaints = (view, attempt = 0) => {
		const inner = getPreviewPdfFrame(view);
		if (!inner) {
			// The sheets are written into the iframe a tick after us.
			if (attempt > 60) return hideLoadingSkeleton(view);
			setTimeout(() => hideSkeletonWhenPdfPaints(view, attempt + 1), 100);
			return;
		}

		// The plugin fires load before it paints, and the gap between the two is
		// exactly when its dark backdrop is on screen. There is no paint event to
		// wait on, so hold the skeleton across two animation frames plus a beat.
		// Erring long costs a moment more skeleton; erring short shows black.
		const finish = () =>
			requestAnimationFrame(() =>
				requestAnimationFrame(() => setTimeout(() => hideLoadingSkeleton(view), 450))
			);

		if (inner.contentDocument?.readyState === "complete") {
			finish();
		} else {
			inner.addEventListener("load", finish, { once: true });
		}

		// Never strand the user on a skeleton if the viewer never reports back.
		setTimeout(() => hideLoadingSkeleton(view), SKELETON_GIVE_UP_MS);
	};

	// The preview sheets live inside Frappe's print-format iframe, one nested
	// iframe per PDF page. They are same-origin, so the embedded PDF viewer's
	// own print() is reachable -- which is what makes the toolbar Print button
	// able to print a PDF at all.
	const getPreviewPdfFrame = (view) => {
		const outer = view.print_wrapper?.find?.("iframe")?.[0];
		const inner = outer?.contentDocument?.querySelector(".pdf-forms-sheet iframe");
		return inner || null;
	};

	const patchPrintView = () => {
		const PrintView = frappe?.ui?.form?.PrintView;
		if (!PrintView || PrintView.prototype.__pdf_forms_button_patch_applied) {
			return;
		}

		const originalPreview = PrintView.prototype.preview;

		PrintView.prototype.preview = function (...args) {
			const result = originalPreview.apply(this, args);

			const printFormat = this.get_print_format ? this.get_print_format() : null;
			const isFormTemplate = isFormTemplateFormat(printFormat);
			togglePrintButtons(this, isFormTemplate);
			alignPreviewToStandard(isFormTemplate);

			return result;
		};

		PrintView.prototype.__pdf_forms_button_patch_applied = true;

		const originalGetPrintHtml = PrintView.prototype.get_print_html;
		PrintView.prototype.get_print_html = function (callback) {
			const printFormat = this.get_print_format ? this.get_print_format() : null;
			if (!isFormTemplateFormat(printFormat)) {
				return originalGetPrintHtml.call(this, callback);
			}

			ensurePromptData(this)
				.then((canProceed) => {
					if (!canProceed) {
						callback({
							html: this.get_no_preview_html ? this.get_no_preview_html() : "",
						});
						return;
					}

					if (printFormat.raw_printing) {
						callback({
							html: this.get_no_preview_html ? this.get_no_preview_html() : "",
						});
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
							prompt_data: this.__pdf_forms_prompt_data
								? JSON.stringify(this.__pdf_forms_prompt_data)
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

		const originalSetupDom = PrintView.prototype.setup_print_format_dom;
		PrintView.prototype.setup_print_format_dom = function (out, $print_format) {
			const printFormat = this.get_print_format ? this.get_print_format() : null;
			const result = originalSetupDom.call(this, out, $print_format);
			if (isFormTemplateFormat(printFormat)) {
				showLoadingSkeleton(this);
				hideSkeletonWhenPdfPaints(this);
			}
			return result;
		};

		const originalPrintIt = PrintView.prototype.printit;
		PrintView.prototype.printit = function (...args) {
			const printFormat = this.get_print_format ? this.get_print_format() : null;
			if (!isFormTemplateFormat(printFormat)) {
				return originalPrintIt.apply(this, args);
			}

			const frame = getPreviewPdfFrame(this);
			try {
				if (frame?.contentWindow?.print) {
					frame.contentWindow.focus();
					frame.contentWindow.print();
					return;
				}
			} catch (e) {
				// Falls through to opening the PDF, below.
			}

			// No reachable viewer (preview still loading, or a browser that
			// refuses): open the PDF so the user can print it from there.
			this.render_page("/api/method/frappe.utils.print_format.download_pdf?", true);
		};

		const originalRenderPage = PrintView.prototype.render_page;
		PrintView.prototype.render_page = async function (method, printit = false, pdf_generator) {
			const printFormat = this.get_print_format ? this.get_print_format() : null;
			if (!isFormTemplateFormat(printFormat)) {
				return originalRenderPage.call(this, method, printit, pdf_generator);
			}

			const canProceed = await ensurePromptData(this, true);
			if (!canProceed) return;

			// "Full Page" asks for /printview, which would render this format's
			// placeholder HTML. Send it to the PDF instead -- served inline, so
			// the browser shows the real form filling the window.
			if (method.indexOf("/printview") === 0) {
				method = "/api/method/frappe.utils.print_format.download_pdf?";
			}

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

	// Leaving the print view should not leave the alignment class behind on the
	// body; preview() re-applies it whenever a form-template format is shown.
	$(document).on("page-change", () => {
		if (!document.querySelector(".print-preview-wrapper")) {
			document.body.classList.remove("pdf-forms-print-preview");
		}
	});
})();
