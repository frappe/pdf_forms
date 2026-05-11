# PDF Forms

**Convert static PDFs into reusable, data-driven forms for Frappe/ERPNext.**

PDF Forms lets teams upload an existing PDF, map fields once, and generate filled PDFs from live document data, prompts, or Jinja logic.

> Works with both:
> - built-in `/pdf_forms` interface
> - custom frontend/backend using APIs

---

## Why PDF Forms

Most teams already have official PDFs (invoices, declarations, onboarding forms, compliance templates).  
Manual filling is slow, inconsistent, and hard to scale.

PDF Forms helps you:
- keep your existing PDF format,
- automate value mapping,
- collect runtime prompt inputs when needed,
- generate consistent PDFs quickly.
- replace hard-to-maintain complex Print Format HTML.

If your Print Format HTML has become too complex, create a Form Template from the final PDF layout and map fields instead of expanding HTML/Jinja complexity further.

---

## Feature walkthrough

### 1) Create template from PDF
- Create a **Form Template**
- Upload PDF
- Link source (`DocType`)

`[IMAGE REQUIRED]` Add Form Template dialog

### 2) Auto-detect fields and pages
- Converts PDF pages to images
- Extracts PDF widgets/fields where available
- Opens editable mapping workspace

`[IMAGE REQUIRED]` Template opened after processing

### 3) Map fields visually
- Annotation types: Auto + Manual
- Value types:
  - `Text` (fixed value)
  - `Field` (source data path)
  - `Prompt` (runtime input)
  - `Jinja` (template expression)
- Formatters: Date, Currency, Number, Phone

`[IMAGE REQUIRED]` Field mapping table with value types

### 4) Add prompts for runtime input
- Define prompt label/type/required flag
- Only prompt values used in mapping need to be collected

`[IMAGE REQUIRED]` Prompts tab

### 5) Preview and generate PDF
- Select source document
- Enter prompt values
- Download final rendered PDF

`[IMAGE REQUIRED]` Preview tab + generated output

`[RECORDING REQUIRED]` End-to-end flow: create -> map -> preview -> download

---

## Quick start

### Prerequisite: Poppler (required by `pdf2image`)

**Ubuntu/Debian**
```bash
sudo apt-get install poppler-utils
```

**macOS**
```bash
brew install poppler
```

**CentOS/RHEL**
```bash
sudo yum install poppler-utils
```

### Install app

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO
bench --site <site_name> install-app pdf_forms
```

### Open app

Visit: `/pdf_forms`

---

## Important endpoints for PDF generation

Use the following endpoints to fetch required metadata and generate final PDFs.

### API 1: Get prompts used in mapping

`GET /api/method/pdf_forms.pdf_forms.doctype.form_template.form_template.get_form_template_prompts`

Query params:
- `form_template_id` (required)

Returns only prompts actually referenced by mapped fields (`Prompt` mappings).

Use when building a lightweight prompt input UI.

---

### API 2: Render final PDF (payload-based)

`POST /api/method/pdf_forms.api.print.print_form_template`

Body params:
- `template_id` (required)
- `data` (required, object or JSON string)
- `print_name` (optional)
- `print_type` (optional: `pdf` or `binary`)

This is the main API for custom integrations.

---

### API 3: Render final PDF (docname + prompt_data)

`GET /api/method/frappe.utils.print_format.download_pdf`

Query params:
- `doctype` (required)
- `name` (required, document name/docname)
- `format` (required, linked Print Format)
- `prompt_data` (optional, JSON string)

Use this when you already have `doctype` + `docname` and want server-side document fetch plus prompt merge.

> Note: this works when the selected Print Format is linked to a Form Template.

---

## API examples

### Get prompts used by template

```bash
curl "https://<your-site>/api/method/pdf_forms.pdf_forms.doctype.form_template.form_template.get_form_template_prompts?form_template_id=FT-0001" \
  -H "Authorization: token <api_key>:<api_secret>"
```

### Generate PDF

```bash
curl -X POST "https://<your-site>/api/method/pdf_forms.api.print.print_form_template" \
  -H "Content-Type: application/json" \
  -H "Authorization: token <api_key>:<api_secret>" \
  -d '{
    "template_id": "FT-0001",
    "print_name": "Invoice-0001",
    "print_type": "pdf",
    "data": {
      "name": "INV-0001",
      "customer_name": "Acme Corp",
      "approval_note": "Approved by manager"
    }
  }'
```

### Generate PDF using docname + prompts

```bash
curl "https://<your-site>/api/method/frappe.utils.print_format.download_pdf?doctype=Sales%20Invoice&name=ACC-SINV-2026-00001&format=My%20Invoice%20Template&prompt_data=%7B%22approval_note%22%3A%22Approved%22%7D" \
  -H "Authorization: token <api_key>:<api_secret>"
```

---

## Troubleshooting

- **PDF did not process**: ensure Poppler is installed and check worker logs.
- **Fields not detected**: some PDFs do not expose standard widgets; map manually.
- **Wrong output values**: verify mapping type, field path, prompt keys, and Jinja expression.
- **Style mismatch**: use template default font/font-size or per-field style override.

---

## Security and permissions

- `Form Template` is restricted to `System Manager` by default.
- Treat Jinja mappings as privileged configuration.
- If exposing APIs to custom clients, enforce authentication and permission checks.

---

## Contributing

```bash
cd apps/pdf_forms
pre-commit install
```

Tooling: `ruff`, `eslint`, `prettier`, `pyupgrade`.

---

## License

`gpl-3.0`
