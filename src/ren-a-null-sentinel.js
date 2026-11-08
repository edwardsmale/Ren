// Sentinel value representing SQL NULL.  For compressed (string/date) columns it sits at
// dictionary index 0 and survives decompression as "\x01".  For non-compressed (numeric)
// columns the CV stores literal null; ren-filter and the filter module normalise
// null to this sentinel at their boundaries so a single representation flows through the
// rest of the pipeline.  Must be defined before all other aggregate JS files (enforced by
// filename).  Matches ReportingConstants.NullSentinel on the C# side.
Ren.NullSentinel = "\x01";
Ren.NullSentinelDisplayLabel = "NULL";
Ren.EmptyStringDisplayLabel = "(blank)";

// The caption a raw value reads as wherever showing its own text would show nothing at all: SQL
// NULL as "NULL", an empty string as "(blank)".  The two are values of their own that filter
// separately from one another, so each is captioned distinctly rather than both left blank.
Ren.ValueDisplayLabel = val => {

    if (val === Ren.NullSentinel) return Ren.NullSentinelDisplayLabel;
    if (val === "") return Ren.EmptyStringDisplayLabel;
    return val;
};

// True if v is the unified NULL marker in any of its representations (sentinel string for
// compressed/aggregation contexts, or null/undefined for non-compressed CV slots).
Ren.IsNull = val => val == null || val === Ren.NullSentinel;
Ren.IsNullOrEmpty = val => val == null || val === "" || val === Ren.NullSentinel;
Ren.Coalesce = (val, defaultVal) => Ren.IsNull(val) ? defaultVal : val;
Ren.NullIf = (val, nullVal) => val === nullVal ? Ren.NullSentinel : val;
