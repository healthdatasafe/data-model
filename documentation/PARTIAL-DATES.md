# Partial and approximate dates — "March 1999", "1997", "spring 1998"

Records of the past are often known only to the month or the year: a letter says "operated in 03.1999", a
history says "since 1997", a person remembers "about spring 1998". An event's `time` is a timestamp, so it
always names a second; without a convention every importer picks its own (the 1st of the month, the 15th,
midnight local time), and every reader shows "01.03.1999" for "March 1999".

This page is the convention (site-agents#26). It changes no item, stream or eventType: it is a set of
`clientData` keys, indexed in [PROVENANCE.md](PROVENANCE.md), and a rule for `time` and `duration`.

## The rule

| What | Value |
|---|---|
| `time` | The **start of the period**, at **12:00 UTC**: 1999-03-01T12:00:00Z for "March 1999", 1997-01-01T12:00:00Z for "1997". |
| `duration` | Unchanged meaning: absent for a point event, the length of a span otherwise, and `null` for a span still running, on an item that allows it (an ongoing medication period, treatment or stay: MEDICATION.md § One intake or a period of use, ENCOUNTER.md § Period and status). `condition-coded` never carries `null`: there an absent duration means the abatement is not known (CONDITION.md § status and abatement). **A partial date never becomes a duration**: "March 1999" is a point known to the month, not a 31-day span. |
| `clientData.hdsTimePrecision` | How much of `time` is known: `minute`, `day`, `month`, `year` or `approx`; `unknown` (4.19.0) when the date is not known at all. |
| `clientData.hdsTimeText` | The whole date expression as the source wrote it, span included (`"03.1999"`, `"spring 1998"`, `"1997 – about 2000"`). **Required when the start or the end is `approx`**, optional otherwise. |
| `clientData.hdsTimeZone` | IANA zone name (`"Europe/Zurich"`) of the place where an exact time was recorded. Only with `minute`. |
| `clientData.hdsEndPrecision` | For a span whose end is known to a different precision than its start; see "Spans" below. |

```json
{
  "streamIds": ["procedure"],
  "type": "procedure/basic",
  "time": 920289600,
  "content": { "name": "Appendectomy" },
  "clientData": { "hdsTimePrecision": "month", "hdsTimeText": "03.1999" }
}
```

`920289600` is 1999-03-01T12:00:00Z.

### Precisions

| `hdsTimePrecision` | `time` is | A reader shows |
|---|---|---|
| *(absent)* | Whatever the writer recorded; no claim is made | the date (and time) as today |
| `minute` | The exact moment (to the second, as any timestamp) | date and time, in `hdsTimeZone` when present, otherwise in the viewer's zone as today |
| `day` | 12:00 UTC on that day | the date |
| `month` | 12:00 UTC on the 1st of the month | month and year: "March 1999" |
| `year` | 12:00 UTC on 1 January | the year: "1997" |
| `approx` | 12:00 UTC at the start of the period the writer judges best (1998-03-01 for "spring 1998" in the northern hemisphere, 1998-01-01 for "around 1998") | "about" + `hdsTimeText`: "about spring 1998" |
| `unknown` (4.19.0) | The moment the event was recorded. It makes no claim about when the event happened | "date unknown", and the event is kept off any time axis (§ A date nobody knows) |

A `hdsTimePrecision` value the reader does not recognise is read as absent. A reader written before 4.19.0 therefore
reads `unknown` as absent and shows the recording moment as the event's date (§ A date nobody knows).

**Read the calendar fields in UTC.** For `day`, `month`, `year` and `approx`, a reader takes the year, month
and day from `time` (and from the end, `time + duration`) **in UTC**, not in the viewer's zone. The noon anchor
keeps a viewer from UTC−12 up to UTC+11:45 on the right day even if a reader gets this wrong, but from UTC+12
eastward (New Zealand, Fiji, Kiribati) a zone-local reader shows the next day, so the rule is UTC, not "local is
close enough".

### Spans

A span with partial bounds keeps `time` at the start of its start period and ends at **12:00 UTC on the last
day of its end period**: "1997 to March 1999" is `time` = 1997-01-01T12:00:00Z, end = 1999-03-31T12:00:00Z,
so `duration` = end − `time`.

`hdsTimePrecision` describes the start. When the end is known to a different precision, `hdsEndPrecision`
(same values, except `unknown`) describes the end; without it, the end has the start's precision. An `unknown` start
never lends its precision to an end: its end always carries `hdsEndPrecision` (§ A date nobody knows). The example above carries
`hdsTimePrecision: "year"` and `hdsEndPrecision: "month"`, and reads "1997 – March 1999". "1997 to about 2000"
is `hdsEndPrecision: "approx"` with `hdsTimeText: "1997 – about 2000"`.

A span within one period (start and end in the same period, or one period inside the other) is written with **no
duration**: it is a point event known to that period, and the last-day anchor above does not apply to it (it would
store the period as a duration). Until 4.11.1 this page said `duration: 0` kept such a span distinct from a point
event; the core reads a duration of 0 back as absent, so no stored event could (B-2026-11-13-12). What the event then
reads as is the item's: `condition-coded` keeps its abated status (CONDITION.md § status and abatement); a medication
period reads as one intake (MEDICATION.md § One intake or a period of use); a visit, a procedure or a treatment as a
point event (ENCOUNTER.md § Period and status, FHIR-MAPPING.md § Procedures). A span that is still running
(`duration: null` on a period item) is unchanged by this page.

### A date nobody knows (`unknown`, 4.19.0)

When the person is asked for the date and answers that they do not know it at all, not even roughly, the event is
written with `hdsTimePrecision: "unknown"`. `time` is then the moment the event was recorded. It is there because
every event needs a `time`, and it says nothing about when the event happened.

- **Only from the person's answer.** `unknown` records that the person was asked and does not know. A source that
  prints no date is not a person saying "I don't know": an importer that cannot ask still holds the event for review
  (§ Rules) and never writes `unknown` on its own.
- **A rough answer is not `unknown`.** "About ten years ago" or "in my twenties" is written at `year` or `approx`
  with `hdsTimeText`, as § Rules says.
- **On these items only (4.19.0):** `condition-coded`, `finding-coded`, `procedure-basic`, `procedure-coded`,
  `treatment-basic`, `treatment-coded`, `encounter-visit`, `medication-intake-basic`, `medication-intake-coded` and
  `document`: the person's history. Any other item is an addition to this list, made in a later release. A measured
  value (a lab result, a vital sign, a body measure) with no date cannot be compared with anything: it is not written
  as an event, and stays with its document or with the importer's review. A prescription is never written with
  `unknown`.
- **The end may be known, the length never is.** `duration: null` is a span still running (a medication period, a
  treatment or a stay begun on a date the person does not know). A finite `duration` is allowed only as an end:
  `time + duration` is when the span ended, `hdsEndPrecision` is then required, and no reader computes or shows a
  length. This is what stopping an open period writes (MEDICATION.md), and how a condition of unknown onset records
  its abatement (CONDITION.md). The recording moment counts as an exact instant in the period tests of CONDITION.md
  § status and abatement, for every item: an end whose period precedes or contains the recording moment carries no
  duration and no `hdsEndPrecision`. Only a later end is written, and `duration` is then positive. For an earlier
  end the writer asks for a rough start (`year`, `approx`), or, where a point states the same fact (a condition with
  its status, a visit, a treatment), keeps the event a point with no duration. Never on a medication intake, where a
  point is one dose: a course that ended before it is recorded needs a rough start. `hdsEndPrecision` has no
  `unknown` value.
- **No `hdsTimeText`, no `hdsTimeZone`.** There is no date expression to quote, and no exact moment.
- **Readers** show "date unknown" in place of the date. They never place the event on a time axis, and never count
  it in anything ordered or computed by time: a chart, a position in a timeline, the latest value, "since", an age at
  onset, a cycle day. They list it apart, for example at the end of a history under "date unknown". Sorting by `time`
  puts it at its recording moment, so a reader that sorts by time handles it explicitly. An ongoing period with an
  unknown start is still current: it stays in "taking now" and in active lists, and only its start reads "date
  unknown". A known end is shown as an end ("until March 2027").
- **A date learned later** replaces it: the edit sets `time` and the new precision, and `unknown` goes. It keeps
  the end: `duration` is recomputed as the end minus the new `time`. **An edit that withdraws a date** (the person
  says the date they gave was wrong and they do not know it) sets `time` to the moment of the edit, removes
  `hdsTimeText` and `hdsTimeZone`, and sets `unknown`. It keeps `duration: null`; a finite duration is dropped with
  its `hdsEndPrecision` (its end is now before the recording moment), and on a medication intake the withdrawal is
  refused for an ended period (it would turn a course into one dose).

A reader written before 4.19.0 reads `unknown` as absent (§ Precisions) and shows the recording moment as the date.
That degradation cannot be avoided by an additive value, so readers that display the person's history should honour
the value.

## Rules

- **Written by the importer or the app that records the event**, on create, and kept in step with `time`:
  an edit that sets an exact time removes `hdsTimePrecision` (or sets `minute`); an edit that keeps a partial
  precision re-anchors `time` to the start of the period at 12:00 UTC.
- **Never store the period as a duration** to express precision (see `duration` above). Readers that sum or
  chart durations would count a "March 1999" diagnosis as a month-long episode.
- **An unknown date is asked, never filled in.** When the source gives no date for the event itself (an undated
  diagnosis, an operation with no year), ask the person. The document's date is never used in its place: on the event
  it would read as the onset, the operation or the intake. What the person answers, even roughly ("about ten years
  ago"), is written at `year` or `approx` with `hdsTimeText`; a person who does not know at all gets `unknown`
  (§ A date nobody knows). An importer that cannot ask holds the event for review.
  This extends to events the rule DOCUMENTS.md § Which date is a document's date states for a document; unlike a
  document, an event never takes a date derived from the document.
- **`hdsTimeText` is visible to everyone who can read the event.** It is copied from the source as written;
  do not put anything in it that the event itself would not show.
- **Pre-1970 dates** are negative timestamps; nothing else changes.
- A reader that ignores these keys shows the period start ("01.03.1999"). That is the degradation the
  convention exists to fix, so readers that display dates of past records should honour it; hds-lib does
  (`formatEventDate(event)`).

## Cross-system mapping

| HDS | HL7 FHIR R4 / R5 `dateTime` | Apple HealthKit |
|---|---|---|
| `minute` | Full `dateTime` with the offset of `hdsTimeZone` at that moment (UTC `Z` when absent) | `startDate` |
| `day` | `YYYY-MM-DD` | `startDate` (the precision is lost) |
| `month` | `YYYY-MM` | `startDate` (the precision is lost) |
| `year` | `YYYY` | `startDate` (the precision is lost) |
| `approx` | `hdsTimeText` as a string where the element allows one (`Condition.onsetString`, R4 `Procedure.performedString`); otherwise `YYYY` of `time`, with `hdsTimeText` as a note (`dateTime` has no approximate form) | `startDate` (the precision is lost) |
| `unknown` | No date: the date element carries only the `data-absent-reason` extension (`http://hl7.org/fhir/StructureDefinition/data-absent-reason`), code `asked-unknown` (`_onsetDateTime`, `_performedDateTime`, `_effectiveDateTime`; in a period, `effectivePeriod._start` with the known `end`); a DocumentReference has no `date` (FHIR-MAPPING.md § DocumentReference) | not exported (a sample needs a date) |
| span | `Period.start` / `Period.end`, each truncated to its own precision | `startDate` / `endDate` |
| span of an abated condition (`condition-coded`, 4.1.0) | `Condition.onsetDateTime` = `time`, `Condition.abatementDateTime` = `time + duration`, each truncated to its own precision (`hdsEndPrecision`, else the start's) | n/a |

FHIR import is the reverse: a truncated `dateTime` sets the start of its period at 12:00 UTC and the matching
precision; a full `dateTime` sets `minute`; a truncated end (`abatementDateTime`) is anchored at 12:00 UTC on the last
day of its period, as "Spans" says, and sets `hdsEndPrecision` when it differs from the start's. FHIR's offset is not
a zone, so a round trip through FHIR keeps the moment and loses `hdsTimeZone`. A resource with no date, including
one whose date element carries only a `data-absent-reason`, is still refused on import (FHIR-MAPPING.md § Time):
reading `asked-unknown` back as `unknown` is an open point, since the import has no person to confirm it.
