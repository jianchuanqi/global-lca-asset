# Candidate queue

This directory stores public-evidence leads that still require identity, scope, duplicate, and expert review. Candidate records are Git-tracked review inputs, but they are not included in the generated evidence package and do not change published asset or database counts.

Create a candidate with `skills/global-lca-asset-review/scripts/candidate_queue.py new`, or add a JSON file that conforms to `candidate.schema.json`. Use one file per candidate and a filename matching its lowercase candidate ID.

Promote a candidate only after resolving whether it is a distinct asset family, version, distribution, schema, software product, repository, or mapping. Promotion means adding the reviewed records and evidence to the canonical seed, updating every affected table/count/version, rebuilding the package, and retaining or updating the candidate record with its resolution.

Do not store personal names, email addresses, questionnaire-person mappings, credentials, restricted content, or internal reviewer notes here.
