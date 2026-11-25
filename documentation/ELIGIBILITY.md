# Eligibility test of a study

A study sends an **eligibility request** to people who opted in to research. The person runs the test on her own device;
only the band of her score (below 50, or 50 and more) is sent to the study's side, and only when she sends it. The reads are calls to her own
account, so the platform that hosts it logs them like any read. hds-lib `researchEligibility` is the one
implementation of what follows.

## The request

Schema: `json-schemas/hds-eligibility-request.json` (`src/schemas/eligibilityRequest.js`). It is not an event and not an
item: a study publishes it, the app evaluates it. It reaches the app by id, through a `research-eligibility-request` alert
([`RESEARCH.md`](RESEARCH.md) § Alert kinds).

```json
{
  "version": 1,
  "requestId": "req-2026-001",
  "studyId": "study-xyz",
  "studyName": { "en": "XYZ", "fr": "XYZ" },
  "title": { "en": "Test if you're eligible for XYZ", "fr": "Testez votre éligibilité à XYZ" },
  "description": { "en": "A study about sleep.", "fr": "Une étude sur le sommeil." },
  "ethicsRef": "CER-VD 2026-00001",
  "expiresAt": 1798761600,
  "criteria": [
    {
      "id": "age",
      "label": { "en": "You are 18 to 45", "fr": "Vous avez entre 18 et 45 ans" },
      "weight": 40,
      "rule": { "op": "age", "itemKey": "profile-date-of-birth", "min": 18, "max": 45 }
    },
    {
      "id": "weight",
      "label": { "en": "You weigh 50 to 90 kg", "fr": "Vous pesez entre 50 et 90 kg" },
      "weight": 30,
      "rule": { "op": "range", "itemKey": "body-weight", "eventType": "mass/kg", "min": 50, "max": 90, "withinDays": 365 },
      "question": {
        "text": { "en": "How much do you weigh?", "fr": "Combien pesez-vous ?" },
        "answer": { "type": "number", "unit": { "en": "kg", "fr": "kg" }, "min": 50, "max": 90 }
      }
    },
    {
      "id": "shift-work",
      "label": { "en": "You do not work at night", "fr": "Vous ne travaillez pas de nuit" },
      "weight": 30,
      "question": {
        "text": { "en": "Do you work at night?", "fr": "Travaillez-vous de nuit ?" },
        "answer": { "type": "boolean", "met": false }
      }
    }
  ]
}
```

- **Rules are data, never code.** Operators: `exists`, `range`, `count`, `in`, `age`. A new operator is a new
  `version`: an app refuses a request it does not fully understand.
- **Weights are the requester's**, integers from 1 to 100, fixed for a `requestId`. They need not add up to 100.
- **A question** is used only when the account has no data for the rule, or when there is no rule.
- Every text has at least `en` and `fr`.

## Outcome of a criterion

| Outcome | When |
|---|---|
| `met` | The rule holds, or the answer meets the criterion |
| `not-met` | The account has data and the rule does not hold (older than `withinDays` included), or the answer does not meet it |
| `no-data` | Nothing the rule can be applied to, and no answer |

The account wins: data that is there is never overruled by an answer. Read as `no-data`: no event; a value with a
comparator (`hdsComparator`) or in a unit that does not convert (the item's `unitConversions`, then the model's
`conversions`), when it is the latest; a date too partial to say whether
it is in the window (PARTIAL-DATES.md; `approx` always, with a window); a birth date that is not a whole date. A future event is ignored. A running span
is in the window; an ended one counts up to its end.

## What each operator means

Fixed for `version: 1`, whatever the implementation. No field can be added to it: an app refuses what it does not know.

- **Events of an item:** its own types, on its stream and the streams under it, the closest item winning. Another item of
  the same stream (a graded twin, a presence marker) is not the item, so a request names the one it means.
- **Bounds are inclusive.** `withinDays` in a rule is N times 24 hours before the test; in a date answer, N calendar days.
- **`exists`**: at least one event. **`count`**: at least `min` events, imported duplicates included.
- **`range`**, **`in`**: the latest event only. `in` is for a `select` item: `values` are some of its options, not all; a
  stored value that is no option (`notSet`, `other` on `profile-sex`) is `no-data`; on a numeric scale, use `range`. **`age`**: whole years from the declared date.

## Score

`score = weights of the criteria met / all weights`. `no-data` counts as not met. The whole %, rounded down, is for her
screen only. What may be sent is the band of the unrounded score: `0-49` or `50-100`.

## Refused at publish

`checkEligibilityRequest` with `publish: true` gives every reason; it runs again on the device before any read, where a
since-deprecated item is still accepted. Unknown or deprecated item, operator,
answer type or field; fewer than 3 criteria or more than 16; an invalid or
duplicate id; an expired request; an empty range, or a date answer with both a window and years; a missing or invalid weight; a text without `en` or `fr`; an
operator that does not fit its item; a system or document item; an item under an `explicitGrantOnly` root (genetics, ...).

**A weight of half or more.** Whoever knows the weights can work back from the band. A criterion that weighs half of the
total or more is always met in the top band, or never in the bottom one, so it is refused. Below that, neither band fixes
any single criterion. 40 / 30 / 30 passes; 90 / 5 / 5 and 50 / 25 / 25 are refused. This is about certainty, for a
reader who knows only the band: a heavy criterion is still likelier met in the top band, and a result known from elsewhere
can settle others.

This check assumes criteria that can each be met or not, independently. It does not see padding (a criterion everyone, or nobody,
meets), two criteria asking the same thing, or two requests of one study read together, so **a person reviews each request before it is published**.

## The event: `research/eligibility-band-v1`

```json
{ "requestId": "req-2026-001", "band": "50-100" }
```

One event per request, updated when she sends again (earlier content may stay in the event's history, if the platform
keeps one). Closed: no score, value, answer, criterion or mark of what was
asked. It is not an item. It is written on `hds-research-eligibility`, where HDS reads it through the research
relationship's grant ([`RESEARCH.md`](RESEARCH.md)).
