<p align="center">
  <img src="pdf_forms/public/images/pdf-forms-logo-large.svg" alt="PDF Forms" height="100">
</p>

<hr />

<p align="center">
  <strong>Take the PDF you already have. Map it once. Print it from your data.</strong>
</p>

<p align="center">
  <a href="#installation">Install</a>
  ·
  <a href="#how-it-works">Guide</a>
  ·
  <a href="#printing-from-outside-the-desk-the-api">API</a>
  ·
  <a href="https://github.com/frappe/pdf_forms/issues">Issues</a>
</p>


<p align="center">
  
  https://github.com/user-attachments/assets/159dbd87-1e4c-43e1-9523-499a6f4126e1
  
</p>

<br>

PDF Forms is an open-source app that turns any fillable PDF into a data-driven print template. Upload a form PDF, map each of its fields to a field of your data source, a fixed value, a Jinja expression or a question asked at print time, and from then on the form fills itself from the record you are looking at. It prints through the normal Print button, downloads as a PDF that is still a fillable form, and any application can generate the same PDF from its own data through the API.

It is built for complex PDFs whose fixed layout is difficult to reproduce in the Print Designer: bank forms, government applications, insurance proposals, customs declarations, KYC and vendor-onboarding packs, agreements, and your own intricate documents. Draw the layout as a form in Acrobat, LibreOffice or any PDF editor, and map it here instead of writing HTML.

## Key Features

1. **Any PDF form becomes a template.** Text boxes, tick boxes, radio buttons and comb fields (one cell per character) are detected on upload and listed for mapping. Flat PDFs work too: draw a box where a value belongs.
2. **Any data.** A template is mapped against a data source, a DocType out of the box, and the printing API takes a plain payload, so a portal, a script or another application can fill the same form with its own data.
3. **Four ways to fill a field.** A field of the record (with dotted paths into child tables), a fixed text, a Jinja expression, or a **Prompt** answered at print time. Formatters for dates, currency, numbers and phone numbers.
4. **Auto-map.** Reads the labels on the form and proposes a source field for each, learning from the templates you have already mapped.
5. **Faithful output.** Values are written in the font and size the PDF asks for, bold and embedded fonts included. Comb fields get one character per box. Multi-line fields wrap. The download stays a fillable form, so a value can still be corrected before signing.
6. **A real print format.** Saving a template creates a Print Format for the DocType. Print, PDF and Full Page work like any other format, with a page-shaped preview and a dialog for prompts.
7. **Live preview.** Pick a document in the workspace and see the form filled exactly as it will print, one digit per cell.
8. **Repeating pages.** A page can be repeated once per row of a child table, or a fixed number of times, from a Jinja expression.
9. **API.** Everything the desk does is a whitelisted method, so a portal or an integration can generate the same PDF from a payload.

### Tech Stack

- [Frappe Framework](https://frappeframework.com): Python backend, Print Format integration
- [PyMuPDF](https://pymupdf.readthedocs.io) for reading and filling PDF forms, [pdf2image](https://github.com/Belval/pdf2image) with Poppler for page images
- [React](https://react.dev), [Vite](https://vitejs.dev), [frappe-react-sdk](https://github.com/nikkothari22/frappe-react-sdk), [Tailwind CSS](https://tailwindcss.com), [OpenSeadragon](https://openseadragon.github.io) and [Annotorious](https://annotorious.dev) for the template workspace

## Installation

### Production

**Managed hosting.** On [Frappe Cloud](https://frappecloud.com), add this repository to your bench as a custom app and install it on the site.

**Self hosting.** From your bench:

```bash
bench get-app https://github.com/frappe/pdf_forms
bench --site <site> install-app pdf_forms
```

Poppler must be available on the server for page rendering:

```bash
sudo apt-get install poppler-utils   # Ubuntu / Debian
brew install poppler                 # macOS
```

Templates are created from **Form Template** in the desk; the mapping workspace lives at `/pdf_forms`. Form Templates are restricted to **System Manager**.

### Development

1. Install Poppler (above) and set up a bench with a site.
2. Get the app and install it:
   ```bash
   bench get-app https://github.com/frappe/pdf_forms
   bench --site <site> install-app pdf_forms
   ```
3. Enable developer mode and start the bench:
   ```bash
   bench --site <site> set-config developer_mode 1
   bench start
   ```
4. For the React workspace with hot reload, run Vite in `documents/`. It proxies `/api`, `/app`, `/assets` and `/files` to the bench, so the workspace opens at `http://<site>:8080` with your normal login:
   ```bash
   cd apps/pdf_forms/documents
   yarn install
   yarn dev
   ```
   `documents/.env.local` sets `VITE_BASE_NAME=""` and the socket port for development; the production build (`bench build --app pdf_forms`) serves the same app at `/pdf_forms`.
5. Run the tests:
   ```bash
   bench --site <site> execute pdf_forms.tests.run.main
   ```

## How it works

The walkthrough below follows one template end to end: HDFC Bank's RTGS/NEFT request, filled from a Payment Entry. A bank form is a good example because it exercises everything at once: comb boxes, tick marks, values from linked records, a prompt for what the document does not carry. Nothing in it is specific to banks. Swap in an insurance proposal and a Sales Order, or a customs declaration and a Delivery Note, and the steps are identical.

### 1. Create the template

In the desk, open **Form Template** and click **New**. Give the template a name, upload the PDF and pick the data source whose records will fill it. For a bank form that is the **Payment Entry** DocType: it carries the amount, the cheque reference, the date, the supplier, and links to both bank accounts.

The PDF is processed in the background. Each page is rendered to an image and every form field in the PDF becomes a row you can map. Save, then open the template in the mapping workspace at `/pdf_forms`. A template keeps its PDF for life; to use a different PDF, create a new template.

> The PDF should be a real form (an AcroForm) for its fields to be detected. If all you have is a scan or a flat PDF, you can still draw boxes on it by hand (step 4), but a proper form PDF is worth the few minutes it takes in Acrobat or LibreOffice: it is what gives you comb cells and a fillable result.

### 2. The workspace

<img width="3840" height="2160" alt="image" src="https://github.com/user-attachments/assets/12abc2cd-8948-4514-ac9c-a8ef3d9d6c41" />


On the left is the PDF with every detected field outlined. On the right, one row per field with its label, its type and where its value comes from. Click a row and the page scrolls to the field; click a field on the page and the row is highlighted. The search box filters by label or field name, and **Unmapped** shows what is still to do.

**Auto-map** takes a first pass. It reads the labels the form uses ("Beneficiary Name", "Chq no", "IFSC Code") and matches them against the fields of the source, learning from templates you have already mapped. Review what it suggests, then Save.

### 3. Mapping a field

<img width="3840" height="2160" alt="image" src="https://github.com/user-attachments/assets/2773d5a8-2274-47d1-92ee-718f380c2651" />

Each field has a **value type**:

| Value type | What it does | Example from the HDFC form |
|---|---|---|
| **Field** | A field of the record. Dotted paths reach into child tables and linked rows: `items[0].item_name`. | `reference_no` for *Chq no* |
| **Text** | A fixed value. | `Supplier payment` for *Purpose* |
| **Jinja** | An expression rendered against the record. `frappe.db.get_value`, `frappe.utils` and the usual helpers are available. | `{{ frappe.db.get_value("Bank Account", party_bank_account, "bank_account_no") }}` for *Account No* |
| **Prompt** | Asked for at print time. | `remitter_lei` for the *LEI* row |

A **formatter** (Date, Currency, Number, Phone) formats a Field value on the way out, so `paid_amount` prints as `₹ 2,45,000.00`. A **default value** (plain or Jinja) is used when the mapped value is empty. **Override Style** lets you pick a different font or size for that one field; otherwise the field is written in the font and size the PDF itself asks for.

Tick boxes and radio buttons are mapped the same way. Anything that renders as `1`, `True` or a ticked checkbox ticks the box. On the HDFC form, RTGS is `{{ 1 if paid_amount >= 200000 else 0 }}` and NEFT is the opposite, so the right box is ticked by the amount.

Worth knowing while mapping:

- **Comb fields** (one box per character) are filled one character per cell, centred, with the size fitted to the cell. A value longer than the cells is cut, so slice it in Jinja when a form splits a number across several groups.
- **Multi-line fields** wrap and step the size down until the text fits.
- **Amount in words** is `{{ frappe.utils.money_in_words(paid_amount) }}`. For a form with a short line, split it across two fields with a `{% set %}` and a slice.

### 4. Manual boxes

Not every PDF is a form. For a flat PDF, switch to the annotator, draw a box where a value should go, and it becomes a field like any other, with a type of its own (text, checkbox or radio). Drawn boxes print as text only; there is no border on paper.

### 5. Prompts

<img width="3840" height="2160" alt="image" src="https://github.com/user-attachments/assets/456bba14-3379-4cf5-843d-85b19783720b" />

Some values are not in the system. A Legal Entity Identifier, a purpose code, a "verified by" name, a reference number the counterparty gave you on the phone. Add them as **Prompts** (label, key, text or checkbox, mandatory or not), map fields to them, and they are asked for at print time, in the Preview tab and in the desk's print view. A prompt field can carry a default, so the form still prints when nobody types anything.

### 6. Preview

<img width="3840" height="2160" alt="image" src="https://github.com/user-attachments/assets/a7805e51-2f96-49b3-934c-8c517a907902" />

Pick a record in the **Preview** tab. The values are drawn onto the page exactly as they will print: same font, same size, one digit per comb cell. The record's data is shown alongside so you can see what you are mapping to. **Download PDF** gives you the finished file.

### 7. Printing

<img width="3840" height="2160" alt="image" src="https://github.com/user-attachments/assets/8fdb1ee6-430e-4758-99c6-a72fef3b82d9" />

Saving a template creates a Print Format of the same name for the source DocType. From then on it is just another print format: open the document, click Print, choose the format, and the form appears as page-shaped sheets. **Print**, **PDF** and **Full Page** all work. If the template has prompts, a small dialog asks for them first.

<img width="3840" height="2160" alt="image" src="https://github.com/user-attachments/assets/b8d9bfcf-56fe-4772-8a5c-b7b9ca045b76" />

The printed PDF is still a form. Open it in Acrobat or a browser and every field is editable, so a value can be corrected before the form is signed. On paper only the values print; the field outlines you see in a viewer are the viewer's, not ink.

### 8. Repeating pages

Some forms need the same page more than once: a packing list that runs one page per pallet, a declaration with one sheet per item, an application where an annexure is filled once per director. Rather than uploading a PDF with the page duplicated, you tell the template to repeat it.

Open the page's settings (the gear on the page in the annotator) and turn on **Repeat Page**:

| Setting | What it does |
|---|---|
| **Repeat After** | The page after which the copies are inserted. Page indices start at 0, so `0` puts the copies right after the first page. |
| **Copies** | How many. A number, or a Jinja expression against the record, such as `{{ items \| length }}` for one copy per item row. Blank or `0` prints the page once. |
| **Base Index** | Where the row numbering starts, usually `0`. |

Mappings on a repeated page use an indexed path, `items[0].item_name`, `items[0].qty`, and the index advances by one on each copy, so the first copy shows row 0, the second row 1, and so on. Everything else on the page (headers, totals, a signature block) prints on every copy as usual, and the page count in the preview and the print view reflects the copies.

## Printing from outside the desk: the API

Everything the desk does goes through whitelisted methods, so the same PDF can be generated from a portal, a script or another application, with data that never lived in a DocType. Authenticate with an API key (`Authorization: token <key>:<secret>`) or a session. The caller needs read access to the Form Template and to the record.

### Render a PDF from a payload

`POST /api/method/pdf_forms.api.print.print_form_template`

| Parameter | Required | Meaning |
|---|---|---|
| `template_id` | yes | Name of the Form Template |
| `data` | yes | The values, as an object or a JSON string. Field mappings read from it, Jinja renders against it, prompts are looked up in it. |
| `print_name` | no | File name of the download |
| `print_type` | no | `pdf` (default, sends a file) or `binary` |

```bash
curl -X POST "https://erp.example.com/api/method/pdf_forms.api.print.print_form_template" \
  -H "Authorization: token $API_KEY:$API_SECRET" \
  -H "Content-Type: application/json" \
  -o request.pdf \
  -d '{
    "template_id": "HDFC Bank RTGS NEFT Request",
    "print_name": "ACC-PAY-2026-00004.pdf",
    "data": {
      "company": "Frappe",
      "party_name": "Atlas Supplies Pvt",
      "party_bank_account": "Atlas Supplies Pvt State A/c - State Bank of India",
      "paid_amount": 245000,
      "reference_no": "CHQ-104512",
      "reference_date": "2026-09-01",
      "remitter_lei": "335800FRAPPE0000MUM4"
    }
  }'
```

`data` does not have to be a document at all. Anything that satisfies the mappings works, which is how another application can print a form from its own records.

### Render a PDF for a document

`GET /api/method/frappe.utils.print_format.download_pdf`

The standard print endpoint. When the print format is linked to a Form Template, PDF Forms takes over and fills the form instead of rendering HTML.

| Parameter | Required | Meaning |
|---|---|---|
| `doctype`, `name` | yes | The document |
| `format` | yes | The Print Format (same name as the template) |
| `prompt_data` | no | JSON string with the prompt values |

```bash
curl -G "https://erp.example.com/api/method/frappe.utils.print_format.download_pdf" \
  -H "Authorization: token $API_KEY:$API_SECRET" \
  --data-urlencode "doctype=Payment Entry" \
  --data-urlencode "name=ACC-PAY-2026-00004" \
  --data-urlencode "format=HDFC Bank RTGS NEFT Request" \
  --data-urlencode 'prompt_data={"remitter_lei": "335800FRAPPE0000MUM4"}' \
  -o request.pdf
```

### Ask what a template needs

Building a form in another application? These tell you what to collect.

**Prompts a template asks for**

```
GET /api/method/pdf_forms.pdf_forms.doctype.form_template.form_template.get_form_template_prompts
    ?form_template_id=<template>
```

Returns only the prompts a mapping actually uses: label, key, type, mandatory. Enough to build the input form on your side.

**Source fields and prompts a template depends on**

```
GET /api/method/pdf_forms.pdf_forms.doctype.form_template.form_template.get_fields_and_prompts_for_form_template
    ?form_template_id=<template>
```

Returns the fields of the source the template reads, plus its prompts, so a client can show exactly the inputs a template needs and nothing else.

**What would print, without printing**

```
POST /api/method/pdf_forms.api.print.get_preview_values
     template_id=<template>  data=<object or JSON string>
```

Returns, field by field, the resolved value with its font, size and tick state. This is what the Preview tab uses to draw the overlay.

**Auto-map suggestions**

```
POST /api/method/pdf_forms.api.automap.suggest_mappings
     form_template_id=<template>
```

Returns Auto-map's proposed source field for every unmapped field, without applying anything.

### From Python

```python
import requests

resp = requests.post(
    "https://erp.example.com/api/method/pdf_forms.api.print.print_form_template",
    headers={"Authorization": f"token {API_KEY}:{API_SECRET}"},
    json={"template_id": "HDFC Bank RTGS NEFT Request", "data": payment_entry_dict},
)
resp.raise_for_status()
open("request.pdf", "wb").write(resp.content)
```

Inside the same site, skip HTTP: `pdf_forms.api.print.build_form_template_pdf(template_id, data)` returns the PDF bytes.


## Things to know

- **One PDF per template.** The mappings, page images and boxes are built on the uploaded file, so it cannot be replaced or removed. Delete the template and create a new one for a new PDF.
- **Fonts.** A field is filled in the font and size its PDF declares. Helvetica, Times and Courier are written into the field directly; bold, italic and embedded faces are drawn with the real font program from the PDF, inside the field's own appearance, so the field stays editable. Characters the form's font cannot show, such as ₹, fall back to Noto Sans.
- **Jinja is trusted.** Mappings are configuration written by a System Manager, and Jinja runs with the same reach as a Print Format. Treat access to Form Templates accordingly.
- **Fillable output.** The generated PDF keeps its fields. If you need a flattened file for archiving, flatten it downstream; the printed paper is the same either way.
- **Scans.** A scanned form has no fields to detect. Manual boxes work, but converting the scan into a real form PDF first (Acrobat's *Prepare Form* does this well) gives you comb cells and a fillable result.

## Reporting Bugs

Open an issue on [GitHub Issues](https://github.com/frappe/pdf_forms/issues) with the PDF (or a redacted copy), the data source, and what you expected to print.

## Contributing

Pull requests are welcome. Set up the pre-commit hooks once:

```bash
cd apps/pdf_forms
pre-commit install
```

Python is checked with `ruff`, the frontend with `eslint` and `prettier`. Run `bench --site <site> execute pdf_forms.tests.run.main` before opening a PR.

## License

[GPL-3.0](license.txt)
