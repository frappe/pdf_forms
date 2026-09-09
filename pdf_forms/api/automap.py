# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt
"""Suggest data-source mappings for a Form Template's unmapped PDF fields.

Nothing here knows what a buyer, a vehicle or an invoice is. Every table the
matcher uses is derived, per run, from the two corpora actually in front of it:
the PDF's own field labels, and the source doctype's own metadata.

    abbreviations   `addr` -> `address` only when that word exists in the other
                    corpus, uniquely, and is short enough to be an abbreviation
    generic tails   measured, not listed: a token in many of the doctype's
                    fields cannot pick one of them out
    qualifiers      minimal pairs. `buyer city` next to `dealer city` proves
                    those two words name different entities *on this form* --
                    which works equally well for shipper/consignee/carrier
    collisions      if two PDF fields reach the same source field by dropping
                    tokens, the dropped tokens were the ones that told them
                    apart, so neither is safe to apply

Matching runs in tiers, most trustworthy first:

    TIER 1  exact match after normalization  -- deterministic, confidence 1.0
    TIER 2  learned from your own history    -- mappings used on other templates
                                                with the same source, conf 0.95
    TIER 2b near-exact: the label minus tokens that cannot discriminate, 0.95
    TIER 3  weighted fuzzy + type            -- heuristic, confidence < 0.95

Only confident, unambiguous, non-colliding hits are auto-appliable: a
confidently wrong mapping costs the user more than an unmapped field.
"""

import difflib
import math
import re
from collections import defaultdict

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

# English function words. Grammar, not domain vocabulary.
FUNCTION_WORDS = {"the", "of", "a", "an", "and", "or", "for", "in", "to", "is", "by", "with", "on", "at"}

# Typographic convention, not domain vocabulary: "No." means numero on every
# printed form there is, and it is the one abbreviation no algorithm can derive
# (its letters are not a subsequence of "number"). Everything else is learned.
UNIVERSAL_ABBREVIATIONS = {"no": "number", "nos": "number"}

# Frappe's primary key. It is the record's ID rather than a data field, so it is
# reachable only by an exact match -- never by dropping tokens off a label that
# happens to end in "Name". Framework structure, true of every doctype.
PRIMARY_KEY = "name"

# Tiers whose match is exact, so two PDF fields legitimately sharing one source
# field (a name printed in both the header and the signature block) is fine.
EXACT_TIERS = {"exact", "exact+history", "history"}


def raw_tokens(text: str) -> list[str]:
	"""Split a label or fieldname into comparable words."""
	text = text or ""
	text = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", text)  # camelCase
	text = re.sub(r"(?<=[A-Za-z])(?=[0-9])", " ", text)  # trade1 -> trade 1
	text = re.sub(r"(?<=[0-9])(?=[A-Za-z])", " ", text)
	text = re.sub(r"[^A-Za-z0-9]+", " ", text).lower()
	return [
		token
		for token in text.split()
		if token
		and token not in FUNCTION_WORDS
		# A lone letter is punctuation debris, not a word: "Customer's Purchase
		# Order" must not carry a stray `s` that breaks the match. Lone digits
		# are kept -- `trade 1` versus `trade 2` turns on them.
		and not (len(token) == 1 and token.isalpha())
	]


def _is_subsequence(short: str, long_word: str) -> bool:
	iterator = iter(long_word)
	return all(character in iterator for character in short)


class Lexicon:
	"""Token statistics shared by one PDF and one doctype, computed per run."""

	def __init__(self, pdf_labels: list, candidates: list[dict]):
		pdf_raw = [raw_tokens(label) for label in pdf_labels]
		candidate_raw = [
			raw_tokens(candidate["label"]) + raw_tokens(candidate["fieldname"]) for candidate in candidates
		]

		pdf_vocab = {token for document in pdf_raw for token in document}
		candidate_vocab = {token for document in candidate_raw for token in document}

		# An abbreviation is only accepted when the expansion exists in the OTHER
		# corpus and nothing else there fits, so `qty` -> `quantity` but never
		# `so` -> `signatory`.
		self.abbreviations = {}
		self.abbreviations.update(self._learn_abbreviations(pdf_vocab, candidate_vocab))
		self.abbreviations.update(self._learn_abbreviations(candidate_vocab, pdf_vocab))

		self.vocab = pdf_vocab | candidate_vocab
		pdf_documents = [self.canonical(document) for document in pdf_raw]
		candidate_documents = [self.canonical(document) for document in candidate_raw]

		self.pdf_df, self.pdf_n = self._document_frequency(pdf_documents)
		self.candidate_df, self.candidate_n = self._document_frequency(candidate_documents)

		self.contrast = defaultdict(set)
		for documents in (pdf_documents, candidate_documents):
			for first, second in self._minimal_pairs(documents):
				self.contrast[first].add(second)
				self.contrast[second].add(first)

	@staticmethod
	def _learn_abbreviations(short_vocab: set, long_vocab: set) -> dict:
		learned = {}
		for token in short_vocab:
			# Under three letters matches far too much; the length bound keeps
			# `desc` -> `description` while rejecting `cp` -> `company`.
			if len(token) < 3 or len(token) > 6 or token in long_vocab:
				continue
			hits = [
				word
				for word in long_vocab
				if len(token) + 1 < len(word) <= 3 * len(token)
				and word[0] == token[0]
				and _is_subsequence(token, word)
			]
			if len(hits) == 1:
				learned[token] = hits[0]
		return learned

	def _normalize_token(self, token: str) -> str:
		token = UNIVERSAL_ABBREVIATIONS.get(token, token)
		token = self.abbreviations.get(token, token)
		# Spelling and inflection only -- orthography, not meaning.
		for suffix, replacement in (("isation", "ization"), ("ise", "ize"), ("yse", "yze")):
			if token.endswith(suffix) and token[: -len(suffix)] + replacement in self.vocab:
				return token[: -len(suffix)] + replacement
		if len(token) > 3 and token.endswith("es") and token[:-2] in self.vocab:
			return token[:-2]
		if len(token) > 2 and token.endswith("s") and token[:-1] in self.vocab:
			return token[:-1]
		return token

	def canonical(self, tokens: list[str]) -> list[str]:
		return [self._normalize_token(token) for token in tokens]

	def tokens(self, text: str) -> list[str]:
		return self.canonical(raw_tokens(text))

	@staticmethod
	def _document_frequency(documents: list[list[str]]) -> tuple[dict, int]:
		frequency = defaultdict(int)
		for document in documents:
			for token in set(document):
				frequency[token] += 1
		return frequency, max(1, len(documents))

	@staticmethod
	def _minimal_pairs(documents: list[list[str]]) -> list[tuple[str, str]]:
		"""Labels differing by exactly one token on each side.

		`buyer city` beside `dealer city` is proof that buyer and dealer name
		different things here, without any list of what those things are.
		"""
		unique = {frozenset(document) for document in documents if document}
		by_size = defaultdict(list)
		for token_set in unique:
			by_size[len(token_set)].append(token_set)

		pairs = []
		for group in by_size.values():
			for i in range(len(group)):
				for j in range(i + 1, len(group)):
					left, right = group[i] - group[j], group[j] - group[i]
					if len(left) == 1 and len(right) == 1:
						pairs.append((next(iter(left)), next(iter(right))))
		return pairs

	def idf(self, token: str, side: str) -> float:
		frequency, total = (
			(self.pdf_df, self.pdf_n) if side == "pdf" else (self.candidate_df, self.candidate_n)
		)
		return math.log(1 + total / (frequency.get(token, 0) + 0.5))

	def weight(self, token: str) -> float:
		"""Discriminating power: a token has to be informative on both sides."""
		return min(self.idf(token, "pdf"), self.idf(token, "cand"))

	def is_selective(self, token: str) -> bool:
		"""Does this token on its own pick out only a few of the doctype's fields?

		`territory` appears in one field of Customer; `name` appears in eight. A
		subset match carried only by `name` is a collision, not a match -- which
		is what keeps `buyer name` off the record ID.
		"""
		frequency = self.candidate_df.get(token, 0)
		return 0 < frequency <= max(1, self.candidate_n / 10)

	def is_vetoed(self, pdf_tokens, candidate_tokens) -> bool:
		"""True when the two sides name directly contrasted things."""
		pdf_set, candidate_set = set(pdf_tokens), set(candidate_tokens)
		for token in pdf_set - candidate_set:
			if self.contrast[token] & (candidate_set - pdf_set):
				return True
		return False

	def overlap(self, pdf_tokens, candidate_tokens) -> float:
		pdf_set, candidate_set = set(pdf_tokens), set(candidate_tokens)
		if not pdf_set or not candidate_set:
			return 0.0
		shared = sum(self.weight(token) for token in pdf_set & candidate_set)
		total = sum(self.weight(token) for token in pdf_set | candidate_set)
		return shared / total if total else 0.0


def comparison_key(tokens: list[str]) -> str:
	"""The string the exact tier compares on."""
	return " ".join(tokens)


def suggest_for_field(pdf_label, pdf_type, prepared, lex, history) -> dict:
	"""Run the tiers for one PDF field. Returns suggestion, confidence and tier.

	`prepared` is the candidate list with its tokens already computed, so a
	200-field template does not re-tokenize the doctype 200 times.
	"""
	none_result = {"suggestion": None, "confidence": 0.0, "tier": "none", "ambiguous": False}
	pdf_tokens = lex.tokens(pdf_label)
	if not pdf_tokens:
		return none_result
	key = comparison_key(pdf_tokens)

	# ---- TIER 1: exact match after normalization ----
	exact = []
	for candidate, label_tokens, fieldname_tokens in prepared:
		if lex.is_vetoed(pdf_tokens, label_tokens) and lex.is_vetoed(pdf_tokens, fieldname_tokens):
			continue
		if comparison_key(fieldname_tokens) == key:
			exact.append((candidate, 2))  # a fieldname hit outranks a label hit
		elif comparison_key(label_tokens) == key:
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
	if remembered and any(candidate["fieldname"] == remembered for candidate, _l, _f in prepared):
		return {"suggestion": remembered, "confidence": 0.95, "tier": "history", "ambiguous": False}

	# ---- TIER 2b: near-exact -- the candidate is the PDF label minus tokens
	# that cannot separate one field of the doctype from another.
	pdf_set = set(pdf_tokens)
	near = []
	for candidate, label_tokens, fieldname_tokens in prepared:
		if candidate["fieldname"] == PRIMARY_KEY:
			continue
		if lex.is_vetoed(pdf_tokens, label_tokens) and lex.is_vetoed(pdf_tokens, fieldname_tokens):
			continue
		for words in (set(label_tokens), set(fieldname_tokens)):
			if not words or not words < pdf_set:
				continue
			if any(lex.is_selective(token) for token in words):
				near.append((candidate, sum(lex.idf(token, "cand") for token in words)))
				break

	if near:
		# Several candidates can sit inside one label: "Item Group Name" contains
		# both `item_name` and `item_group`. The one carrying more of the label's
		# information wins; a genuine tie stays ambiguous.
		near.sort(key=lambda item: -item[1])
		winner, best = near[0]
		runner_up = near[1][1] if len(near) > 1 else 0.0
		others = {candidate["fieldname"] for candidate, _score in near[1:]}
		if not others or best > runner_up + 1e-9:
			return {
				"suggestion": winner["fieldname"],
				"confidence": 0.95,
				"tier": "near-exact",
				"ambiguous": False,
			}
		return {
			"suggestion": winner["fieldname"],
			"confidence": 0.70,
			"tier": "near-exact",
			"ambiguous": True,
			"alternatives": sorted(others)[:3],
		}

	# ---- TIER 3: weighted fuzzy + type ----
	best_candidate, best_score = None, 0.0
	for candidate, label_tokens, fieldname_tokens in prepared:
		if candidate["fieldname"] == PRIMARY_KEY:
			continue
		if not (label_tokens or fieldname_tokens):
			continue
		if lex.is_vetoed(pdf_tokens, label_tokens) and lex.is_vetoed(pdf_tokens, fieldname_tokens):
			continue

		overlap = max(lex.overlap(pdf_tokens, label_tokens), lex.overlap(pdf_tokens, fieldname_tokens))
		similarity = max(
			difflib.SequenceMatcher(None, key, comparison_key(label_tokens)).ratio(),
			difflib.SequenceMatcher(None, key, comparison_key(fieldname_tokens)).ratio(),
		)
		score = 0.55 * overlap + 0.35 * similarity

		# A PDF checkbox wants a Check field; anything else is a poor fit.
		if pdf_type == "CheckBox":
			score += 0.10 if candidate["fieldtype"] == "Check" else -0.15
		elif candidate["fieldtype"] == "Check":
			score -= 0.10

		score = max(0.0, min(1.0, score))
		if score > best_score:
			best_candidate, best_score = candidate, score

	if best_candidate and best_score >= 0.60:
		return {
			"suggestion": best_candidate["fieldname"],
			"confidence": round(best_score, 2),
			"tier": "fuzzy",
			"ambiguous": False,
		}

	return none_result


def resolve_collisions(results: list[dict], already_used: set | None = None) -> None:
	"""Demote inexact suggestions that land two PDF fields on one source field.

	If `buyer phone` and `dealer phone` both reduce to `phone`, the tokens they
	dropped were exactly the ones that told them apart. Detecting that needs no
	notion of what a buyer or a dealer is -- which is why it works for
	shipper/consignee/carrier too.
	"""
	claims = defaultdict(list)
	# A source field another row already maps to counts as a claim too, so a
	# half-mapped template gets the same protection as a fresh one.
	for fieldname in already_used or ():
		claims[fieldname].append(None)
	for result in results:
		if result["suggestion"] and result["confidence"] >= AUTO_APPLY_CONFIDENCE and not result["ambiguous"]:
			claims[result["suggestion"]].append(result)

	for fieldname, group in claims.items():
		if len(group) < 2:
			continue
		for result in group:
			if result is None:
				continue
			if result["tier"] not in EXACT_TIERS:
				result["confidence"] = 0.70
				result["ambiguous"] = True
				result["collision"] = fieldname


def get_candidate_fields(doctype: str) -> list[dict]:
	"""Mappable fields of the source doctype, plus its `name`."""
	meta = frappe.get_meta(doctype)
	candidates = [{"label": _("ID"), "fieldname": PRIMARY_KEY, "fieldtype": "Data"}]
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


def learn_from_history(source: str, exclude_template: str, lex: Lexicon) -> dict:
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
		key = comparison_key(lex.tokens(row.field_label))
		if not key:
			continue
		usage.setdefault(key, {}).setdefault(row.field_value.strip(), 0)
		usage[key][row.field_value.strip()] += 1

	return {key: max(counts, key=counts.get) for key, counts in usage.items()}


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

	# The whole template's labels form the corpus, including the already-mapped
	# ones: they are what reveal the minimal pairs.
	lex = Lexicon([field.field_label for field in template.form_template_field], candidates)
	prepared = [
		(candidate, lex.tokens(candidate["label"]), lex.tokens(candidate["fieldname"]))
		for candidate in candidates
	]
	history = learn_from_history(template.source, template.name, lex)

	pending = [
		field
		for field in template.form_template_field
		# Never touch a field that already has a value, and only propose for
		# rows that read from the data source.
		if not (field.field_value or "").strip() and (not field.value_type or field.value_type == "Field")
	]

	results = []
	for field in pending:
		result = suggest_for_field(field.field_label, field.field_type, prepared, lex, history)
		result["name"] = field.name
		result["field_label"] = field.field_label
		results.append(result)

	already_used = {
		(field.field_value or "").strip()
		for field in template.form_template_field
		if (field.field_value or "").strip() and (not field.value_type or field.value_type == "Field")
	}
	resolve_collisions(results, already_used)

	suggestions = []
	auto_appliable = 0
	for result in results:
		if not result["suggestion"]:
			continue
		can_auto_apply = result["confidence"] >= AUTO_APPLY_CONFIDENCE and not result["ambiguous"]
		if can_auto_apply:
			auto_appliable += 1
		suggestions.append(
			{
				"name": result["name"],
				"field_label": result["field_label"],
				"suggestion": result["suggestion"],
				"confidence": result["confidence"],
				"tier": result["tier"],
				"ambiguous": result["ambiguous"],
				"alternatives": result.get("alternatives") or [],
				"auto_apply": can_auto_apply,
			}
		)

	return {
		"source": template.source,
		"candidate_field_count": len(candidates),
		"unmapped": len(pending),
		"auto_appliable": auto_appliable,
		"needs_review": len(suggestions) - auto_appliable,
		"suggestions": suggestions,
	}
