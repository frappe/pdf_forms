(() => {
	let isPatched = false;
	let patchTimer = null;

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

		const isFormTemplateFormat = (printFormat) =>
			Boolean(
				printFormat &&
					printFormat.form_template &&
					!(printFormat.print_designer && printFormat.print_designer_body)
			);

		PrintView.prototype.preview = function (...args) {
			const result = originalPreview.apply(this, args);

			const printFormat = this.get_print_format ? this.get_print_format() : null;
			const shouldHide = isFormTemplateFormat(printFormat);
			togglePrintButtons(this, shouldHide);

			return result;
		};

		PrintView.prototype.__form_printer_button_patch_applied = true;
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
