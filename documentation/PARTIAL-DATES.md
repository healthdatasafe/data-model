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
| `duration` | Unchanged meaning: `null` (or absent) for a point event, the length of a span otherwise. **A partial date never becomes a duration**: "March 1999" is a point known to the month, not a 31-day span. |
| `clientData.hdsTimePrecision` | How much of `time` is known: `minute`, `day`, `month`, `year` or `approx`. |
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

An unknown `hdsTimePrecision` value is read as absent.

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
(same values) describes the end; without it, the end has the start's precision. The example above carries
`hdsTimePrecision: "year"` and `hdsEndPrecision: "month"`, and reads "1997 – March 1999". "1997 to about 2000"
is `hdsEndPrecision: "approx"` with `hdsTimeText: "1997 – about 2000"`.

A span within one period ("all of March 1999" at `day` precision, starting and ending the same day) has
`duration: 0`; a point event has `duration: null`, so the two stay distinct. A span that is still running
(`duration: null` on a period item) is unchanged by this page.

## Rules

- **Written by the importer or the app that records the event**, on create, and kept in step with `time`:
  an edit that sets an exact time removes `hdsTimePrecision` (or sets `minute`); an edit that keeps a partial
  precision re-anchors `time` to the start of the period at 12:00 UTC.
- **Never store the period as a duration** to express precision (see `duration` above). Readers that sum or
  chart durations would count a "March 1999" diagnosis as a month-long episode.
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
| span | `Period.start` / `Period.end`, each truncated to its own precision | `startDate` / `endDate` |

FHIR import is the reverse: a truncated `dateTime` sets the start of its period at 12:00 UTC and the matching
precision; a full `dateTime` sets `minute`. FHIR's offset is not a zone, so a round trip through FHIR keeps
the moment and loses `hdsTimeZone`.
