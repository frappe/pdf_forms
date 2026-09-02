# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt
"""Suggest data-source mappings for a Form Template's unmapped PDF fields.

Matching runs in tiers, most trustworthy first:

    TIER 1  exact match after normalization  — deterministic, confidence 1.0
    TIER 2  learned from your own history    — mappings used on other templates
                                               with the same source, confidence 0.95
    TIER 3  synonyms + fuzzy + type          — heuristic, confidence < 0.95

Only tiers 1 and 2 are "auto-appliable"; a tier-1 hit that is *ambiguous*
(two source fields normalize to the same key, e.g. `source` vs `utm_source`)
is deliberately NOT auto-applied — a confidently wrong mapping costs the user
more than an unmapped field.
"""

import difflib
import re

import frappe
from frappe import _

# Confidence at or above which a suggestion may be applied without review.
AUTO_APPLY_CONFIDENCE = 0.95

# Layout-only fieldtypes carry no data worth mapping.
SKIPPED_FIELDTYPES = {
	"Section Break",
	"Column Break",
	"Tab Break",
	"HTML",
	"Button",
	"Fold",
	"Heading",
	"Table Break",
	"Table",
	"Table MultiSelect",
}

# Abbreviations seen on printed forms, expanded before comparison.
ABBREVIATIONS = {
	"no": "number",
	"nos": "number",
	"sig": "signature",
	"veh": "vehicle",
	"lic": "license",
	"addr": "address",
	"amt": "amount",
	"qty": "quantity",
	"desc": "description",
	"yr": "year",
	"tel": "telephone",
}

# Domain synonyms — deliberately conservative. Anything that could merge two
# genuinely different fields (mobile vs phone) is left out.
SYNONYMS = {
	"buyer": "customer",
	"purchaser": "customer",
	"client": "customer",
	"dealer": "company",
	"seller": "company",
	"supplier": "company",
	"zip": "pincode",
	"postal": "pincode",
	"vin": "serial",
	"mail": "email",
	"organisation": "organization",
	"firm": "organization",
}

# Words that add no meaning once the strong token is present, so
# "email address" can still meet "email id" and "phone number" meet "phone".
NOISE_AFTER_STRONG = {"address", "id", "number", "no"}
STRONG_TOKENS = {"email", "phone", "telephone", "mobile", "fax"}

STOPWORDS = {"the", "of", "a", "an", "and", "input", "field"}

# Generic tails a form designer adds that carry no meaning of their own:
# "Territory Name" is still the territory, "Industry Type" is still the industry.
# Used only to let a candidate label match as a subset — never to merge two
# candidates that differ by a real word.
GENERIC_TAIL = {"type", "name", "url", "code", "id", "number", "no", "details",
                "detail", "info", "information", "reference", "ref", "value"}

# Entity qualifiers. If a PDF field and a candidate each carry a qualifier and
# they differ, the pair is vetoed outright — this is what stops "buyer city",
# "dealer city" and "co-buyer city" collapsing onto one target.
QUALIFIER_FAMILIES = [
	{"buyer", "customer", "purchaser"},
	{"cobuyer"},
	{"dealer", "seller", "supplier"},
	{"trade1"},
	{"trade2"},
]


def normalize(text: str) -> list[str]:
	"""Lowercase, split camelCase, unify separators, expand abbreviations."""
	text = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", text or "").lower()
	text = re.sub(r"\bco[\s\-]?buyer\b", "cobuyer", text)
	text = re.sub(r"\btrade\s*1\b", "trade1", text)
	text = re.sub(r"\btrade\s*2\b", "trade2", text)
	text = re.sub(r"[_\-/.#&,()]+", " ", text)

	tokens = [ABBREVIATIONS.get(word, word) for word in text.split() if word and word not in STOPWORDS]

	# Drop trailing noise once a strong token is present: "email address" -> "email".
	if any(token in STRONG_TOKENS for token in tokens):
		tokens = [t for t in tokens if t not in NOISE_AFTER_STRONG]

	return tokens


def comparison_key(text: str) -> str:
	"""The string tier 1 compares on."""
	return " ".join(normalize(text))


def canonical(tokens: list[str]) -> set:
	return {SYNONYMS.get(token, token) for token in tokens}


def qualifier_of(tokens: list[str]):
	joined = " ".join(tokens)
	for index, family in enumerate(QUALIFIER_FAMILIES):
		if any(word in joined for word in family):
			return index
	return None


def is_vetoed(pdf_tokens, label_tokens, fieldname_tokens) -> bool:
	"""True when both sides name a different entity (buyer vs dealer vs co-buyer)."""
	pdf_qualifier = qualifier_of(pdf_tokens)
	candidate_qualifier = qualifier_of(label_tokens)
	if candidate_qualifier is None:
		candidate_qualifier = qualifier_of(fieldname_tokens)
	return pdf_qualifier is not None and candidate_qualifier is not None and pdf_qualifier != candidate_qualifier


def fuzzy_score(pdf_label, candidate_label, candidate_fieldname, pdf_type, candidate_type) -> float:
	"""Tier 3: token overlap + string similarity, adjusted for field type."""
	pdf_tokens = normalize(pdf_label)
	label_tokens = normalize(candidate_label)
	fieldname_tokens = normalize(candidate_fieldname)

	if not pdf_tokens or not (label_tokens or fieldname_tokens):
		return 0.0
	if is_vetoed(pdf_tokens, label_tokens, fieldname_tokens):
		return 0.0

	pdf_canonical = canonical(pdf_tokens)
	candidate_canonical = canonical(label_tokens) | canonical(fieldname_tokens)

	overlap = (
		len(pdf_canonical & candidate_canonical) / len(pdf_canonical | candidate_canonical)
		if (pdf_canonical | candidate_canonical)
		else 0
	)
	similarity = max(
		difflib.SequenceMatcher(None, " ".join(pdf_tokens), " ".join(label_tokens)).ratio(),
		difflib.SequenceMatcher(None, " ".join(pdf_tokens), " ".join(fieldname_tokens)).ratio(),
	)

	score = 0.55 * overlap + 0.35 * similarity

	# A PDF checkbox wants a Check field; anything else is a poor fit.
	if pdf_type == "CheckBox":
		score += 0.10 if candidate_type == "Check" else -0.15
	elif candidate_type == "Check":
		score -= 0.10

	pdf_qualifier = qualifier_of(pdf_tokens)
	candidate_qualifier = qualifier_of(label_tokens)
	if candidate_qualifier is None:
		candidate_qualifier = qualifier_of(fieldname_tokens)
	if pdf_qualifier is not None and pdf_qualifier == candidate_qualifier:
		score += 0.10

	return max(0.0, min(1.0, score))


def get_candidate_fields(doctype: str) -> list[dict]:
	"""Mappable fields of the source doctype, plus its `name`."""
	meta = frappe.get_meta(doctype)
	candidates = [{"label": _("ID"), "fieldname": "name", "fieldtype": "Data"}]
	for field in meta.fields:
		if field.fieldtype in SKIPPED_FIELDTYPES or not field.fieldname:
			continue
		candidates.append(
			{
				"label": field.label or field.fieldname,
				"fieldname": field.fieldname,
				"fieldtype": field.fieldtype,
			}
		)
	return candidates


def learn_from_history(source: str, exclude_template: str) -> dict:
	"""normalized PDF label -> the fieldname most often chosen for it before."""
	usage = {}
	template_names = frappe.get_all(
		"Form Template", filters={"source": source, "name": ("!=", exclude_template)}, pluck="name"
	)
	if not template_names:
		return {}

	rows = frappe.get_all(
		"Form Template Field",
		filters={"parent": ("in", template_names), "value_type": "Field"},
		fields=["field_label", "field_value"],
	)
	for row in rows:
		if not (row.field_value or "").strip():
			continue
		key = comparison_key(row.field_label)
		if not key:
			continue
		usage.setdefault(key, {}).setdefault(row.field_value.strip(), 0)
		usage[key][row.field_value.strip()] += 1

	return {key: max(counts, key=counts.get) for key, counts in usage.items()}


def suggest_for_field(pdf_label, pdf_type, candidates, history) -> dict:
	"""Run the tiers for one PDF field. Returns suggestion, confidence and tier."""
	pdf_tokens = normalize(pdf_label)
	key = comparison_key(pdf_label)
	none_result = {"suggestion": None, "confidence": 0.0, "tier": "none", "ambiguous": False}

	if not key:
		return none_result

	# ---- TIER 1: exact match after normalization ----
	exact = []
	for candidate in candidates:
		if is_vetoed(pdf_tokens, normalize(candidate["label"]), normalize(candidate["fieldname"])):
			continue
		if comparison_key(candidate["fieldname"]) == key:
			exact.append((candidate, 2))  # a fieldname hit outranks a label hit
		elif comparison_key(candidate["label"]) == key:
			exact.append((candidate, 1))

	if exact:
		# Your own past choice settles a tie between equally exact candidates.
		if len(exact) > 1 and history.get(key):
			for candidate, _rank in exact:
				if candidate["fieldname"] == history[key]:
					return {
						"suggestion": candidate["fieldname"],
						"confidence": 1.0,
						"tier": "exact+history",
						"ambiguous": False,
					}

		exact.sort(
			key=lambda item: (
				-item[1],
				0 if (pdf_type == "CheckBox") == (item[0]["fieldtype"] == "Check") else 1,
			)
		)
		ambiguous = len(exact) > 1 and exact[0][1] == exact[1][1]
		return {
			"suggestion": exact[0][0]["fieldname"],
			# Ambiguous exact hits are reported but must not be auto-applied.
			"confidence": 0.70 if ambiguous else 1.0,
			"tier": "exact",
			"ambiguous": ambiguous,
			"alternatives": [candidate["fieldname"] for candidate, _ in exact[1:4]] if ambiguous else [],
		}

	# ---- TIER 2: learned from your own history ----
	remembered = history.get(key)
	if remembered and any(candidate["fieldname"] == remembered for candidate in candidates):
		return {"suggestion": remembered, "confidence": 0.95, "tier": "history", "ambiguous": False}

	# ---- TIER 2b: near-exact — candidate label is the PDF label minus a generic
	# tail ("Territory Name" -> Territory, "Industry Type" -> Industry). Still
	# deterministic string containment, so it is trustworthy enough to apply,
	# but only when exactly one candidate qualifies.
	pdf_words = set(pdf_tokens)
	near = []
	for candidate in candidates:
		if is_vetoed(pdf_tokens, normalize(candidate["label"]), normalize(candidate["fieldname"])):
			continue
		for words in (set(normalize(candidate["label"])), set(normalize(candidate["fieldname"]))):
			if not words or not words < pdf_words:
				continue
			if (pdf_words - words) <= GENERIC_TAIL:
				near.append(candidate)
				break

	if near:
		unique = {candidate["fieldname"] for candidate in near}
		if len(unique) == 1:
			return {
				"suggestion": near[0]["fieldname"],
				"confidence": 0.95,
				"tier": "near-exact",
				"ambiguous": False,
			}
		return {
			"suggestion": near[0]["fieldname"],
			"confidence": 0.70,
			"tier": "near-exact",
			"ambiguous": True,
			"alternatives": sorted(unique)[1:4],
		}

	# ---- TIER 3: synonyms + fuzzy + type ----
	best, best_score = None, 0.0
	for candidate in candidates:
		score = fuzzy_score(
			pdf_label, candidate["label"], candidate["fieldname"], pdf_type, candidate["fieldtype"]
		)
		if score > best_score:
			best, best_score = candidate, score

	if best and best_score >= 0.60:
		return {
			"suggestion": best["fieldname"],
			"confidence": round(best_score, 2),
			"tier": "fuzzy",
			"ambiguous": False,
		}

	return none_result


@frappe.whitelist()
def suggest_mappings(form_template_id: str) -> dict:
	"""Suggest a source field for every unmapped field of the template.

	Returns the suggestions plus a summary; applying them is the client's call,
	so the user can review the result and Save (or discard) as usual.
	"""
	template = frappe.get_doc("Form Template", form_template_id)
	template.check_permission("read")

	if template.data_source and template.data_source != "DocType":
		frappe.throw(_("Auto-map currently supports templates whose data source is a DocType."))

	candidates = get_candidate_fields(template.source)
	history = learn_from_history(template.source, template.name)

	suggestions = []
	auto_appliable = 0
	for field in template.form_template_field:
		# Never touch a field that already has a value, and only propose for
		# rows that read from the data source.
		if (field.field_value or "").strip() or (field.value_type and field.value_type != "Field"):
			continue

		result = suggest_for_field(field.field_label, field.field_type, candidates, history)
		if not result["suggestion"]:
			continue

		can_auto_apply = result["confidence"] >= AUTO_APPLY_CONFIDENCE and not result["ambiguous"]
		if can_auto_apply:
			auto_appliable += 1

		suggestions.append(
			{
				"name": field.name,
				"field_label": field.field_label,
				"suggestion": result["suggestion"],
				"confidence": result["confidence"],
				"tier": result["tier"],
				"ambiguous": result["ambiguous"],
				"alternatives": result.get("alternatives") or [],
				"auto_apply": can_auto_apply,
			}
		)

	unmapped = sum(
		1
		for field in template.form_template_field
		if not (field.field_value or "").strip() and (not field.value_type or field.value_type == "Field")
	)

	return {
		"source": template.source,
		"candidate_field_count": len(candidates),
		"unmapped": unmapped,
		"auto_appliable": auto_appliable,
		"needs_review": len(suggestions) - auto_appliable,
		"suggestions": suggestions,
	}
