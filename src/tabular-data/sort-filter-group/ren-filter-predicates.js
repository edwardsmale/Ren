/**
 * Compiles row-filter predicates (the rowFilter.predicates list held alongside columnValueFilters
 * in a data grouping settings' filter set) into fast per-row inclusion checks.
 *
 * A predicate is a plain JSON descriptor, so it can be authored by hand directly in a report's
 * dataGroupingSettings as well as being written by visualisations (e.g. the filter module's
 * hierarchical items).  Predicates are ANDed together: a row survives only when every predicate
 * includes it - bar compare predicates put in the same OR group, which are ORed with one another
 * first and contribute that one verdict to the AND (see compilePredicateList).  The supported types
 * are:
 *
 *     { type: "excludeCombinations", columns: [colA, colB, ...], tuples: [[a1, b1, ...], ...] }
 *         Excludes rows whose tuple of the named columns matches any listed combination. Everything
 *         not listed is kept, so an empty tuples list (or absent predicate) keeps every row.
 *
 *     { type: "includeCombinations", columns: [colA, colB, ...], tuples: [[a1, b1, ...], ...] }
 *         The inverse: keeps only rows whose tuple matches a listed combination.
 *
 *     A tuple may be shorter than columns, naming only the leading ones: it then matches every
 *     combination beneath it, whatever the columns it stops short of hold.  So one hierarchy's
 *     whole branch - a department, say - is a single tuple rather than one per product under it,
 *     and a settings file states a selection at the level the person made it at.  Tuples of
 *     different lengths may sit in the same predicate; an empty one says nothing and is ignored.
 *
 *     Either combination predicate may carry a calcFunctions array parallel to columns, naming a
 *     calc function (as a spec object or a bare name) to derive the value a column is matched on -
 *     e.g. ["OrderDate"] with [{ name: "date-month-start" }] matches on the month a row falls in
 *     rather than on its date.  Null (or an absent array) matches on the raw value.  A calc
 *     function used here transforms its value alone: it is applied once per distinct value rather
 *     than once per row, so it is given no row context, and where it writes a sortable
 *     "<sort key>¬<display text>" value it is the display text that is matched.
 *
 *     { type: "compare", column: <colIdOrHeading>, operator: <id>, value: <v>, value2: <v2> }
 *         An Excel-style comparison on one column (see Ren.FilterCompareOperators).  It may carry a
 *         calcFunction deriving the value it tests, exactly as the combination predicates'
 *         calcFunctions array does, except that a date operator on a function whose OUTPUT: line
 *         names dates tests the sort key, the date the bin starts on, rather than the display
 *         text.  Where a column carries several, each names its own slot, and
 *         one may name another slot of the same column in orGroup to be ORed with it rather than
 *         ANDed.  Its "custom" operator is the one exception to all of that: its value is a
 *         function's own source, run per row exactly as a "function" predicate's is and keeping the
 *         row when it returns something truthy.  It is handed its own column's value as the
 *         function's value argument.  Needing the row, it is skipped on the row-object path.
 *
 *     { type: "includeRowIndexes", rowIndexes: [i1, i2, ...] }
 *         Keeps only the rows at the listed data row indexes (indexes into the tabular data's
 *         RowModels), which is what the Find window's Filter Rows button writes, there being no
 *         column value its matches have in common.  The indexes belong to the data as it stands, so
 *         the predicate is never written to a settings file, and it has no meaning on the
 *         row-object path, where a materialised row does not know its index.
 *
 *     { type: "function", spec: <formatFunctionSpec | rawFunctionString> }
 *         Evaluates a function with the same signature as a format function (value, rowVals,
 *         groupSummaryStats, overallSummaryStats, compressedRowVals); the row is kept when it
 *         returns a truthy value.  value and the summary-stats arguments are null here, there being
 *         no single cell or group in a whole-row filter.
 *
 * A column value is normalised the same way the filter module's hierarchy nodes are (null /
 * undefined -> empty string, otherwise String(value)), so hand-authored tuples match either the raw
 * or the stringified form of a value, and blank / NULL cells both read as "".
 *
 * Three compile entry points share all of this logic, differing only in how a row's value in a
 * column is read:
 *
 *     compilePredicates(predicates, tabularData)  ->  (rowIndex) => isExcluded
 *         The grid path.  Reads columns by index from the tabular data's compressed value columns
 *         (decompressed once per column), and supports every predicate type including "function".
 *
 *     compileRowObjectPredicates(predicates)  ->  (dataRow) => isExcluded
 *         The begotten-chart path (date/value chart, word cloud).  Reads columns by property lookup
 *         on the materialised row objects those visualisations filter.  Combination and compare
 *         predicates only: "function" predicates - and the compare predicate's custom function
 *         operator, which is one in all but name - need the per-row index context a materialised
 *         row object lacks, so they are skipped and left to the grid's index-based filter.
 *
 *     compileGroupPredicates(predicates, tabularData, groups)  ->  (group) => isExcluded
 *         The group-row path. Tests one grouping level's group rows rather than data rows, which is
 *         what a predicate held on a grouping entry filters.  A group row is a row of values like
 *         any other - its own value for each of the level's group-by columns, and an aggregated
 *         figure for the rest - so every predicate type but "includeRowIndexes" works here, reading
 *         the group's values as rowVals.  A ranking operator ranks the level's groups against one
 *         another, so they are passed in.
 */
Ren.FilterPredicates = (() => {

    // Separates a tuple's values when building the lookup key. A unit separator, as it cannot occur
    // in a column value, so tuples never run together ambiguously.
    const TUPLE_SEPARATOR = String.fromCharCode(31);

    // NULL cells in compressed columns decompress to Ren.NullSentinel rather than null, so the
    // sentinel must also read as "" for blank / NULL cells to be indistinguishable here.
    const normalise = (value) =>
        (value === null || value === undefined || value === Ren.NullSentinel)
            ? "" : String(value);

    // Compiles the calc function a predicate derives one column's matched value with, or null where
    // that column matches on its raw value.  A specification is a format function spec, a bare
    // function name, or a custom function's own source - exactly the three forms a grouping's
    // groupByCalcFunctions holds, so a predicate written alongside one states it identically.
    const compileValueCalcFunction = (calcFunctions, position, paras) => {

        const specification = calcFunctions?.[position];
        if (!specification) return null;

        // Already compiled, as a compare predicate's is (see compileCompareCalcFunction).
        if (typeof specification === "function") return specification;

        try {

            return Ren.FormatFunctions.createFunction(
                Ren.FormatFunctions.isFunctionName(specification)
                    ? { name: specification }
                    : specification,
                paras
            );
        }
        catch (e) {

            Ren.GlobalErrorHandler.logError(
                "[FilterPredicates] Could not build value calc function:",
                e
            );

            return null;
        }
    };

    // A column's normalised matched value: its own value, or the value its calc function derives
    // from it.  The function is handed the value as it stands rather than its normalised string,
    // and is handed blank / NULL cells too, exactly as a grouping's group-by calc function is, so a
    // predicate deriving a value matches the groups a grouping derived the same way.  A function
    // that throws on a value leaves it underived, as it does when a grouping applies it.
    //
    // A derived value is matched as it reads rather than as it sorts: a binning function whose bins
    // have to order a certain way writes each of them as "<sort key>¬<display text>", and it is
    // the display text alone that a predicate written against those bins states.
    const deriveValue = (value, calcFunction) => {

        if (!calcFunction) return normalise(value);

        try {

            return Ren.TextUtils.stripSortPrefix(normalise(calcFunction(value)));
        }
        catch (e) {

            Ren.GlobalErrorHandler.logError(
                "[FilterPredicates] Error applying value calc function:",
                e
            );

            return normalise(value);
        }
    };

    // Gets a value indicating whether a compare predicate tests its derived values' sort keys: a
    // date operator on a function whose OUTPUT: line names dates.  Such a function's sort key is
    // the sortable date its bin starts on, as the text shown for a week, month, quarter or year
    // names no single day.
    const comparesSortKeys = (predicate) => {

        const specification = predicate.calcFunction;

        const functionName = Ren.FormatFunctions.isFunctionName(specification)
            ? specification
            : specification?.name;

        return !!functionName
            && Ren.FunctionTags.getOutputKind(functionName) === "date"
            && Ren.FilterCompareOperators.getOperator(predicate.operator)?.group === "Date";
    };

    // Compiles the calc function a compare predicate derives its tested values with, or null.
    const compileCompareCalcFunction = (predicate, paras) => {

        const calcFunction = compileValueCalcFunction([predicate.calcFunction], 0, paras);

        if (!calcFunction || !comparesSortKeys(predicate)) return calcFunction;

        return (value) => Ren.TextUtils.getSortKey(normalise(calcFunction(value)));
    };

    // The predicate list held in a filter set parent (dataRows or a grouping) for the given data
    // tab, or an empty array when none is present.
    const getPredicates = (filterSetParent, tabularData) => {

        const tabFilters = filterSetParent?.filterSet?.[tabularData.Title];
        const predicates = tabFilters?.rowFilter?.predicates;

        return Array.isArray(predicates) ? predicates : [];
    };

    const hasPredicates = (filterSetParent, tabularData) =>
        getPredicates(filterSetParent, tabularData).length > 0;

    // The distinct compressed values of one column, for the unusual data shape whose tabular data
    // has no precomputed distinct set to read them from.
    const collectDistinctColumnCVs = (columnCVs) => {

        const seen = new Set();

        for (let rowIndex = 0; rowIndex < columnCVs.length; rowIndex++) {
            seen.add(columnCVs[rowIndex]);
        }

        return Array.from(seen);
    };

    // Builds, for each named column, a function reading a row's normalised value in that column by
    // index.  Each column's compressed values are decompressed once (deduplicated by compressed
    // value) into a lookup, so no per-row decompression happens at match time.  A column's calc
    // function is applied in that same pass, once per distinct value, so deriving a value costs no
    // more per row than reading it.  Null where any named column is absent.
    const buildIndexColumnValueReaders = (tabularData, columns, calcFunctions, paras) => {

        const readers = [];
        const isColumnCompressed = tabularData.IsColumnCompressed;

        for (let c = 0; c < columns.length; c++) {

            const columnIndex = tabularData.columnResolver.getColumnIndex(columns[c]);
            if (columnIndex === null) return null;

            const columnCVs = tabularData.getColumnCV(columnIndex);
            const compressed = isColumnCompressed[columnIndex];
            const calcFunction = compileValueCalcFunction(calcFunctions, c, paras);

            const valueByCompressed = new Map();

            // The column's distinct values, taken from getDistinctColumnCV where the data has them
            // and rediscovered by scanning the rows otherwise.
            const distinctCVs = tabularData.getDistinctColumnCV?.(columnIndex)
                ?? collectDistinctColumnCVs(columnCVs);

            for (let i = 0; i < distinctCVs.length; i++) {

                const cv = distinctCVs[i];

                const value = compressed
                    ? tabularData.CompressionDictionary.decompressValue(cv, columnIndex)
                    : cv;

                valueByCompressed.set(cv, deriveValue(value, calcFunction));
            }

            readers.push((rowIndex) => valueByCompressed.get(columnCVs[rowIndex]) ?? "");
        }

        return readers;
    };

    // Builds, for each named column, a function reading a materialised row object's normalised
    // value in that column by property lookup.  Row objects are keyed by column id / heading, the
    // same keys predicates name their columns with.  Never fails, an absent property simply reading
    // as "".  A column's calc function is applied per row, there being no distinct-value pass.
    const buildRowObjectColumnValueReaders = (columns, calcFunctions, paras) => {

        const readers = [];

        for (let c = 0; c < columns.length; c++) {

            const column = columns[c];
            const calcFunction = compileValueCalcFunction(calcFunctions, c, paras);

            readers.push((dataRow) => deriveValue(dataRow[column], calcFunction));
        }

        return readers;
    };

    // Builds, for each named column, a function reading a group row's normalised value in that
    // column by index.  A group row's values are compressed exactly as a data row's are, and each
    // is decompressed as it is read: a level has few enough groups that the per-distinct-value
    // lookup the index path builds would cost more than it saved.  A column's calc function is
    // applied as the value is read.  Null where any named column is absent.
    const buildGroupColumnValueReaders = (tabularData, columns, calcFunctions, paras) => {

        const readers = [];
        const dictionary = tabularData.CompressionDictionary;

        for (let c = 0; c < columns.length; c++) {

            const columnIndex = tabularData.columnResolver.getColumnIndex(columns[c]);
            if (columnIndex === null || columnIndex === undefined) return null;

            const calcFunction = compileValueCalcFunction(calcFunctions, c, paras);

            readers.push((group) => deriveValue(
                dictionary.decompressValue(
                    group.groupValues.get(group.position, columnIndex),
                    columnIndex
                ),
                calcFunction
            ));
        }

        return readers;
    };

    // Builds the key of one tuple (an array of values, one per column) using TUPLE_SEPARATOR.
    const tupleKey = (values, length) => {

        let key = "";

        for (let i = 0; i < length; i++) {
            key += (i ? TUPLE_SEPARATOR : "") + normalise(values[i]);
        }

        return key;
    };

    // Gets how many of the predicate's columns each tuple names, a tuple stopping short standing
    // for every combination beneath it.  An empty tuple says nothing, so it is left out.
    const tupleLengthsOf = (tuples, columnCount) => {

        const lengths = new Array(tuples.length);

        for (let i = 0; i < tuples.length; i++) {

            const tuple = tuples[i];
            const length = Array.isArray(tuple) ? tuple.length : 0;

            lengths[i] = length < columnCount ? length : columnCount;
        }

        return lengths;
    };

    // Gets the lengths tuples are stated at, as flags indexed by length, and the longest of them.
    // A row is tested against a length only where some tuple is stated at it, and read no further
    // than the longest, so the common case of full-length tuples costs one test at the end.
    const tupleLengthFlagsOf = (lengths) => {

        let maxLength = 0;

        for (let i = 0; i < lengths.length; i++) {

            if (lengths[i] > maxLength) maxLength = lengths[i];
        }

        const flags = new Uint8Array(maxLength + 1);

        for (let i = 0; i < lengths.length; i++) {

            if (lengths[i] > 0) flags[lengths[i]] = 1;
        }

        return { flags, maxLength };
    };

    // Compiles a combination predicate into (rowToken) => isIncluded, parameterised over how the
    // per-column value readers are built so the same logic serves both the index-based grid path
    // and the row-object begotten-chart path.  buildReaders(columns, calcFunctions) returns an
    // array of readers, each mapping a rowToken to that column's normalised (and, where the
    // predicate names a calc function for it, derived) value, or null when a column is missing.
    // isInclude selects between the "includeCombinations" and "excludeCombinations" senses.  Null
    // where the columns are missing or invalid.
    const compileCombination = (predicate, isInclude, buildReaders) => {

        const columns = predicate.columns;
        if (!Array.isArray(columns) || columns.length === 0) return null;

        const tuples = predicate.tuples ?? [];
        const lengths = tupleLengthsOf(tuples, columns.length);
        const { flags, maxLength } = tupleLengthFlagsOf(lengths);

        // Only the columns some tuple reaches are read, so a column none of them stops at need
        // not resolve - as the index path, which numbers no values for it, does not need it to.
        const readers = buildReaders(columns.slice(0, maxLength), predicate.calcFunctions);
        if (!readers) return null;

        const matchKeys = new Set();

        for (let i = 0; i < tuples.length; i++) {

            if (lengths[i] > 0) matchKeys.add(tupleKey(tuples[i], lengths[i]));
        }

        // The values each column has some tuple naming - counting only the tuples that reach it.
        // A row can only match a tuple when every one of its columns holds such a value, and a
        // tuple list names only a handful of any one column's values, so testing column by column
        // abandons nearly every row on its first.
        const namedValues = new Array(maxLength);

        for (let i = 0; i < maxLength; i++) {

            const values = new Set();

            for (let t = 0; t < tuples.length; t++) {

                if (lengths[t] > i) values.add(normalise(tuples[t][i]));
            }

            namedValues[i] = values;
        }

        return (rowToken) => {

            let key = "";

            for (let i = 0; i < maxLength; i++) {

                const value = readers[i](rowToken);

                // No tuple reaching this column names its value in this row, and the shorter ones
                // have been tested already, so no tuple can match it.
                if (!namedValues[i].has(value)) return !isInclude;

                key += (i ? TUPLE_SEPARATOR : "") + value;

                if (flags[i + 1] === 1 && matchKeys.has(key)) return isInclude;
            }

            return !isInclude;
        };
    };

    // Compiles a row-index predicate into (rowIndex) => isIncluded, keeping only the rows it names.
    // Index path only: a materialised row object does not know which row it came from.  Null where
    // no indexes are named, an empty list meaning "nothing to say" rather than "hide every row".
    const compileIncludeRowIndexes = (predicate) => {

        const rowIndexes = predicate.rowIndexes;

        if (!Array.isArray(rowIndexes) || rowIndexes.length === 0) return null;

        const includedRowIndexes = new Set();

        for (let i = 0; i < rowIndexes.length; i++) includedRowIndexes.add(rowIndexes[i]);

        return (rowIndex) => includedRowIndexes.has(rowIndex);
    };

    // Compiles a function specification into (rowIndex) => isIncluded, evaluating the function like
    // a format function but reading its truthiness.  Index path only: it reads the row's values by
    // index, which a materialised row object cannot supply.  Shared by the "function" predicate and
    // the compare predicate's custom function operator; valueColumn, where one is given, names the
    // column whose value is passed as the function's value argument.
    const compileRowFunction = (specification, tabularData, valueColumn, paras) => {

        const rowModels = tabularData.RowModels;

        return compileFunctionOverValues(
            specification,
            tabularData,
            valueColumn,
            (rowIndex) => rowModels[rowIndex].CV,
            paras
        );
    };

    // The shared body of compileRowFunction and its group-row counterpart: a function specification
    // compiled into (rowToken) => isIncluded, where getCompressedValues(rowToken) is the row of
    // compressed values the function reads through rowVals.  A group's values are a row like any
    // other, so nothing below cares which it was handed.
    const compileFunctionOverValues = (
        specification, tabularData, valueColumn, getCompressedValues, paras
    ) => {

        let filterFunction;

        try {

            filterFunction = Ren.FormatFunctions.createFunction(specification, paras);
        }
        catch (e) {

            Ren.GlobalErrorHandler.logError(
                "[FilterPredicates] Could not build function predicate:",
                e
            );

            return null;
        }

        return (rowToken) => {

            const cv = getCompressedValues(rowToken);
            const rowVals = Ren.RowValues.getRowValuesForFormatFunction(tabularData, cv, true);
            const compressedRowVals = Ren.RowValues.getCompressedRowValuesForFormatFunction(tabularData, cv);
            const value = valueColumn == null ? null : rowVals[valueColumn];

            return !!filterFunction(value, rowVals, null, null, compressedRowVals);
        };
    };

    // Compiles a function predicate, which holds the function's source (or a format function spec)
    // in its spec and belongs to no column, so its function is given no value to test.
    const compileFunction = (predicate, tabularData, paras) =>
        compileRowFunction(predicate.spec, tabularData, null, paras);

    // The group-row counterpart of compileRowFunction, into (group) => isIncluded.  A group's own
    // row of values is handed to the function exactly as a data row's is, so a function written
    // against a grouping level reads its groups through rowVals.
    const compileGroupFunction = (specification, tabularData, valueColumn, paras) =>
        compileFunctionOverValues(
            specification,
            tabularData,
            valueColumn,
            (group) => group.groupValues.getRow(group.position),
            paras
        );

    // Compiles a compare predicate into (rowToken) => isIncluded, parameterised - like
    // compileCombination - over how the column's value reader is built and, for ranking operators
    // (top / bottom N), how the column's whole value population is enumerated.
    // buildReader(column, calcFunction) returns a single (rowToken) => normalised-value reader, or
    // null when the column is missing; enumerateValues(reader) returns every row's value in that
    // column.  Null where the operator is unknown or the column cannot be read.
    const compileCompare = (predicate, buildReader, enumerateValues, paras) => {

        const compiled = Ren.FilterCompareOperators.compile(predicate);
        if (!compiled) return null;

        // A custom function operator needs the per-row index context this path does not have,
        // exactly as a "function" predicate does; it is left to the grid's index-based filter.
        if (compiled.needsRow) return null;

        const reader = buildReader(predicate.column, compileCompareCalcFunction(predicate, paras));
        if (!reader) return null;

        if (compiled.needsScan) {

            const test = compiled.makeScanTest(enumerateValues(reader));
            return (rowToken) => test(reader(rowToken));
        }

        const test = compiled.test;
        return (rowToken) => test(reader(rowToken));
    };

    // Enumerates every row's value in one column for the index path, reusing the same single reader
    // the per-row test uses so a ranking scan sees exactly the values the test will.
    const enumerateIndexColumnValues = (tabularData, reader) => {

        const rowCount = tabularData.RowModels.length;
        const values = new Array(rowCount);

        for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) values[rowIndex] = reader(rowIndex);

        return values;
    };

    // Enumerates every row's value in one column for the row-object path.  A ranking scan needs the
    // materialised rows; without them the population is empty, making the test a no-op rather than
    // hiding the column.
    const enumerateRowObjectColumnValues = (rows, reader) => {

        if (!Array.isArray(rows)) return [];

        const values = new Array(rows.length);

        for (let i = 0; i < rows.length; i++) values[i] = reader(rows[i]);

        return values;
    };

    // Enumerates every group's value in one column for the group path, so a ranking operator ranks
    // the level's groups against one another.  Without the groups the population is empty, making
    // the test a no-op rather than hiding every group.
    const enumerateGroupColumnValues = (groups, reader) => {

        if (!Array.isArray(groups)) return [];

        const values = new Array(groups.length);

        for (let i = 0; i < groups.length; i++) values[i] = reader(groups[i]);

        return values;
    };

    const alwaysIncluded = () => true;

    // Compiles a compare predicate for the index-based grid path into (rowIndex) => isIncluded, the
    // fast path for the common case.  Rather than running the operator's test on every row, it
    // tests each of the column's distinct values once and caches the verdict, reducing the per-row
    // work to a lookup.  Where the column is stored as a dense Int32 dictionary that cache is a
    // typed-array bitset indexed by the compressed value itself; otherwise it is a Map keyed on it.
    // Falls back to the generic per-row reader path where the column has no precomputed distinct
    // set, and to alwaysIncluded where the column is missing or the predicate does not compile.
    const compileIndexCompare = (predicate, tabularData, paras) => {

        const compiled = Ren.FilterCompareOperators.compile(predicate);
        if (!compiled) return alwaysIncluded;

        // The custom function operator tests the row rather than one of the column's values, so
        // none of the per-value machinery below applies to it.  A column it does not resolve leaves
        // value null rather than dropping the filter, the function still being free to read the
        // row.
        if (compiled.needsRow) {

            return compileRowFunction(
                compiled.functionSpecification,
                tabularData,
                predicate.column,
                paras
            ) ?? alwaysIncluded;
        }

        const columnIndex = tabularData.columnResolver.getColumnIndex(predicate.column);
        if (columnIndex === null) return alwaysIncluded;

        const distinctCVs = tabularData.getDistinctColumnCV?.(columnIndex);

        // No precomputed distinct set (an unusual data shape): use the generic reader path, which
        // rediscovers the distinct values by scanning the rows.
        if (!distinctCVs) {

            return compileCompare(
                predicate,
                (column, calcFunction) => {

                    const readers = buildIndexColumnValueReaders(
                        tabularData,
                        [column],
                        [calcFunction],
                        paras
                    );

                    return readers ? readers[0] : null;
                },
                (reader) => enumerateIndexColumnValues(tabularData, reader),
                paras
            ) ?? alwaysIncluded;
        }

        const compressed = tabularData.IsColumnCompressed[columnIndex];
        const dictionary = tabularData.CompressionDictionary;
        const columnCVs = tabularData.getColumnCV(columnIndex);

        // The calc function the predicate derives its tested value with, or null where it tests the
        // column's own values.  Applied once per distinct value, as the reader path applies it.
        const calcFunction = compileCompareCalcFunction(predicate, paras);

        // Decompress each distinct value once into its normalised (and, where the predicate names a
        // calc function, derived) string, keyed by compressed value.
        const valueByCompressed = new Map();

        for (let i = 0; i < distinctCVs.length; i++) {

            const cv = distinctCVs[i];
            const value = compressed ? dictionary.decompressValue(cv, columnIndex) : cv;
            valueByCompressed.set(cv, deriveValue(value, calcFunction));
        }

        // A ranking operator (top / bottom N) ranks the whole row population, so build its test
        // from every row's value, read from the map with no re-decompression.
        let test;

        if (compiled.needsScan) {

            const allValues = new Array(columnCVs.length);

            for (let rowIndex = 0; rowIndex < columnCVs.length; rowIndex++) {
                allValues[rowIndex] = valueByCompressed.get(columnCVs[rowIndex]) ?? "";
            }

            test = compiled.makeScanTest(allValues);
        }
        else {

            test = compiled.test;
        }

        // A dense Int32 dictionary column holds non-negative dictionary indexes, so each value's
        // verdict fits in a typed-array bitset indexed by the compressed value itself.
        if (columnCVs instanceof Int32Array) {

            let maxCompressed = 0;

            for (let i = 0; i < distinctCVs.length; i++) {
                if (distinctCVs[i] > maxCompressed) maxCompressed = distinctCVs[i];
            }

            const verdicts = new Uint8Array(maxCompressed + 1);

            for (let i = 0; i < distinctCVs.length; i++) {

                const cv = distinctCVs[i];
                verdicts[cv] = test(valueByCompressed.get(cv)) ? 1 : 0;
            }

            return (rowIndex) => verdicts[columnCVs[rowIndex]] === 1;
        }

        // Otherwise the compressed values are arbitrary (strings, floats, nulls): key each verdict
        // on the compressed value in a Map.
        const verdictByCompressed = new Map();

        for (let i = 0; i < distinctCVs.length; i++) {

            const cv = distinctCVs[i];
            verdictByCompressed.set(cv, !!test(valueByCompressed.get(cv)));
        }

        return (rowIndex) => verdictByCompressed.get(columnCVs[rowIndex]) === true;
    };

    // Compiles a combination predicate for the index-based grid path into (rowIndex) => isIncluded,
    // the fast path for the common case.  The generic compileCombination pays a map lookup and a
    // string build per column on every row before its verdict is known, which on a report of
    // several hundred thousand rows is most of the cost of a filter change.
    //
    // What makes it avoidable is that a row can only match a tuple when EVERY one of its columns
    // holds a value some tuple names, and a tuple list names only a handful of each column's
    // values.  So each column's values are numbered here - once per distinct value, into a typed
    // array indexed by the compressed value itself - with the number 0 reserved for "named by no
    // tuple".  A row is then read column by column and abandoned the moment it reads a 0, costing a
    // single typed-array read; only the few rows that could still match build a key and test it.
    //
    // Null where the predicate is unusable or the data is not in the shape this relies on (a
    // missing column, or a column not stored as a dense non-negative Int32 dictionary).
    const compileIndexCombination = (predicate, isInclude, tabularData, paras) => {

        const columns = predicate.columns;
        if (!Array.isArray(columns) || columns.length === 0) return null;

        const tuples = predicate.tuples ?? [];
        const lengths = tupleLengthsOf(tuples, columns.length);
        const { flags, maxLength } = tupleLengthFlagsOf(lengths);

        // Only the columns some tuple reaches are read; a tuple stopping short says nothing about
        // the rest, so they need no numbering and need not even resolve.
        const columnCount = maxLength;
        const columnCVArrays = new Array(columnCount);
        const codeTables = new Array(columnCount);

        // The number given to each value a tuple names, per column.  Built from the tuples first so
        // that numbering the column's distinct values below is a lookup rather than a search.
        const codeByValue = new Array(columnCount);

        for (let c = 0; c < columnCount; c++) {

            const valueCodes = new Map();

            for (let t = 0; t < tuples.length; t++) {

                if (lengths[t] <= c) continue;

                const value = normalise(tuples[t][c]);

                if (!valueCodes.has(value)) valueCodes.set(value, valueCodes.size + 1);
            }

            codeByValue[c] = valueCodes;
        }

        for (let c = 0; c < columnCount; c++) {

            const columnIndex = tabularData.columnResolver.getColumnIndex(columns[c]);
            if (columnIndex === null) return null;

            const columnCVs = tabularData.getColumnCV(columnIndex);
            const distinctCVs = tabularData.getDistinctColumnCV?.(columnIndex);

            // Dense non-negative dictionary indexes are what makes the per-row read a typed-array
            // lookup; anything else (strings, floats, nulls) is left to the generic path.
            if (!(columnCVs instanceof Int32Array) || !distinctCVs) return null;

            const compressed = tabularData.IsColumnCompressed[columnIndex];
            const calcFunction = compileValueCalcFunction(predicate.calcFunctions, c, paras);
            const valueCodes = codeByValue[c];

            let maxCompressed = 0;

            for (let i = 0; i < distinctCVs.length; i++) {

                if (distinctCVs[i] < 0) return null;

                if (distinctCVs[i] > maxCompressed) maxCompressed = distinctCVs[i];
            }

            const codes = new Int32Array(maxCompressed + 1);

            for (let i = 0; i < distinctCVs.length; i++) {

                const cv = distinctCVs[i];

                const value = compressed
                    ? tabularData.CompressionDictionary.decompressValue(cv, columnIndex)
                    : cv;

                codes[cv] = valueCodes.get(deriveValue(value, calcFunction)) ?? 0;
            }

            columnCVArrays[c] = columnCVs;
            codeTables[c] = codes;
        }

        // The tuples as keys of the numbers just assigned.  A tuple naming a value the data does
        // not hold keeps its key rather than being weeded out: no row can build that key, so it
        // matches nothing either way.
        const matchKeys = new Set();

        for (let t = 0; t < tuples.length; t++) {

            if (lengths[t] === 0) continue;

            let key = "";

            for (let c = 0; c < lengths[t]; c++) {
                key += (c ? TUPLE_SEPARATOR : "") + codeByValue[c].get(normalise(tuples[t][c]));
            }

            matchKeys.add(key);
        }

        return (rowIndex) => {

            let key = "";

            for (let c = 0; c < columnCount; c++) {

                const code = codeTables[c][columnCVArrays[c][rowIndex]];

                // No tuple reaching this column names its value in this row, and the tuples
                // stopping short of it have been tested already, so none can match it.
                if (code === 0) return !isInclude;

                key += (c ? TUPLE_SEPARATOR : "") + code;

                // Only where some tuple stops here; with all of them full length, once at the end.
                if (flags[c + 1] === 1 && matchKeys.has(key)) return isInclude;
            }

            return !isInclude;
        };
    };

    // Compiles a single predicate for the index-based grid path into (rowIndex) => isIncluded,
    // returning the shared alwaysIncluded no-op for an unknown or unbuildable predicate so one bad
    // predicate never hides every row.  Supports every predicate type.
    const compileIndexPredicate = (predicate, tabularData, paras) => {

        if (!predicate || !predicate.type) return alwaysIncluded;

        const buildReaders = (columns, calcFunctions) =>
            buildIndexColumnValueReaders(tabularData, columns, calcFunctions, paras);

        switch (predicate.type) {

            case "excludeCombinations":
                return compileIndexCombination(predicate, false, tabularData, paras)
                    ?? compileCombination(predicate, false, buildReaders)
                    ?? alwaysIncluded;

            case "includeCombinations":
                return compileIndexCombination(predicate, true, tabularData, paras)
                    ?? compileCombination(predicate, true, buildReaders)
                    ?? alwaysIncluded;

            case "function":
                return compileFunction(predicate, tabularData, paras) ?? alwaysIncluded;

            case "includeRowIndexes":
                return compileIncludeRowIndexes(predicate) ?? alwaysIncluded;

            case "compare":
                return compileIndexCompare(predicate, tabularData, paras);

            default:
                console.warn("[FilterPredicates] Unknown predicate type: " + predicate.type);
                return alwaysIncluded;
        }
    };

    // Compiles a single predicate for the row-object begotten-chart path into (dataRow) =>
    // isIncluded.  Combination and compare predicates only; a "function" predicate - and a compare
    // predicate's custom function operator, which is one in all but name - is a no-op here, needing
    // per-row index context a materialised row object lacks, and is left to the grid's filter.
    // rows is needed only by a ranking compare operator's whole-column scan.
    const compileRowObjectPredicate = (predicate, rows, paras) => {

        if (!predicate || !predicate.type) return alwaysIncluded;

        const buildReaders = (columns, calcFunctions) =>
            buildRowObjectColumnValueReaders(columns, calcFunctions, paras);

        switch (predicate.type) {

            case "excludeCombinations":
                return compileCombination(predicate, false, buildReaders) ?? alwaysIncluded;

            case "includeCombinations":
                return compileCombination(predicate, true, buildReaders) ?? alwaysIncluded;

            case "compare":
                return compileCompare(
                    predicate,
                    (column, calcFunction) =>
                        buildRowObjectColumnValueReaders([column], [calcFunction], paras)[0],
                    (reader) => enumerateRowObjectColumnValues(rows, reader),
                    paras
                ) ?? alwaysIncluded;

            case "function":
            case "includeRowIndexes":
                return alwaysIncluded;

            default:
                console.warn("[FilterPredicates] Unknown predicate type: " + predicate.type);
                return alwaysIncluded;
        }
    };

    // Compiles a compare predicate for the group-row path into (group) => isIncluded.  The custom
    // function operator tests the whole group row rather than one column's value, so it is run as a
    // function of the group; every other operator tests the column's value as the group holds it.
    const compileGroupCompare = (predicate, tabularData, groups, paras) => {

        const compiled = Ren.FilterCompareOperators.compile(predicate);
        if (!compiled) return alwaysIncluded;

        if (compiled.needsRow) {

            return compileGroupFunction(
                compiled.functionSpecification,
                tabularData,
                predicate.column,
                paras
            ) ?? alwaysIncluded;
        }

        return compileCompare(
            predicate,
            (column, calcFunction) => {

                const readers = buildGroupColumnValueReaders(
                    tabularData,
                    [column],
                    [calcFunction],
                    paras
                );

                return readers ? readers[0] : null;
            },
            (reader) => enumerateGroupColumnValues(groups, reader),
            paras
        ) ?? alwaysIncluded;
    };

    // Compiles a single predicate for the group-row path into (group) => isIncluded, falling back
    // to the shared alwaysIncluded no-op so one bad predicate never hides every group.  Every type
    // but "includeRowIndexes" applies: that one names data rows outright, and a group is not one of
    // them.  groups is needed only by a ranking operator's scan.
    const compileGroupPredicate = (predicate, tabularData, groups, paras) => {

        if (!predicate || !predicate.type) return alwaysIncluded;

        const buildReaders = (columns, calcFunctions) =>
            buildGroupColumnValueReaders(tabularData, columns, calcFunctions, paras);

        switch (predicate.type) {

            case "excludeCombinations":
                return compileCombination(predicate, false, buildReaders) ?? alwaysIncluded;

            case "includeCombinations":
                return compileCombination(predicate, true, buildReaders) ?? alwaysIncluded;

            case "compare":
                return compileGroupCompare(predicate, tabularData, groups, paras);

            case "function":
                return compileGroupFunction(predicate.spec, tabularData, null, paras)
                    ?? alwaysIncluded;

            case "includeRowIndexes":
                return alwaysIncluded;

            default:
                console.warn("[FilterPredicates] Unknown predicate type: " + predicate.type);
                return alwaysIncluded;
        }
    };

    // Combines a list of (rowToken) => isIncluded checks (already stripped of no-ops) into a single
    // (rowToken) => isExcluded, ANDing them.  Null where there is nothing to apply.
    const combineChecks = (checks) => {

        if (checks.length === 0) return null;

        if (checks.length === 1) {

            const only = checks[0];
            return (rowToken) => !only(rowToken);
        }

        return (rowToken) => {

            for (let i = 0; i < checks.length; i++) {
                if (!checks[i](rowToken)) return true;
            }

            return false;
        };
    };

    // Combines the checks of one OR group into a single (rowToken) => isIncluded: a row survives
    // the group when any one of its filters includes it.  A member that compiled to a no-op
    // includes every row, so the group does too.
    const combineOrChecks = (checks) => {

        if (checks.length === 1) return checks[0];

        for (let i = 0; i < checks.length; i++) {
            if (checks[i] === alwaysIncluded) return alwaysIncluded;
        }

        return (rowToken) => {

            for (let i = 0; i < checks.length; i++) {
                if (checks[i](rowToken)) return true;
            }

            return false;
        };
    };

    // The OR group a predicate belongs to, as a key unique to its column and the slot naming the
    // group, or null for a predicate that is never ORed with another.  Compare predicates alone can
    // be grouped, and a compare filter ORed with nothing keys on its own slot, a group of one.
    const orGroupKeyOf = (predicate) => {

        if (!predicate || predicate.type !== "compare") return null;

        return predicate.column + "|" + Ren.FilterCompareOperators.orGroupLeadOf(predicate);
    };

    // Compiles a whole predicate list into a single (rowToken) => isExcluded, using compileOne to
    // compile each predicate (this is what differs between the index and row-object paths).  The
    // filters of an OR group are combined into one check apiece before the ANDing, every other
    // predicate being a check of its own; the checks are ANDed in no particular order, which they
    // may be as each is a pure test of the row.  Null where nothing applies.
    const compilePredicateList = (predicates, compileOne) => {

        if (!predicates || predicates.length === 0) return null;

        const checks = [];
        const orGroups = new Map();

        for (let i = 0; i < predicates.length; i++) {

            const check = compileOne(predicates[i]);
            const orGroupKey = orGroupKeyOf(predicates[i]);

            if (orGroupKey === null) {

                if (check !== alwaysIncluded) checks.push(check);
                continue;
            }

            const group = orGroups.get(orGroupKey);

            if (group) {
                group.push(check);
            }
            else {

                orGroups.set(orGroupKey, [check]);
            }
        }

        orGroups.forEach((group) => {

            const check = combineOrChecks(group);

            if (check !== alwaysIncluded) checks.push(check);
        });

        return combineChecks(checks);
    };

    // Grid path: compile a predicate list into (rowIndex) => isExcluded, or null.
    const compilePredicates = (predicates, tabularData, paras) =>
        compilePredicateList(
            predicates,
            (predicate) => compileIndexPredicate(predicate, tabularData, paras)
        );

    // Splits a predicate list into the independent units its verdict is ANDed from, WITHOUT
    // compiling any of them: a predicate belonging to no OR group is a unit of its own, and each OR
    // group is a single unit covering its members, whose checks are combined among themselves
    // before the ANDing and so cannot be separated.  Each unit carries a signature of the
    // predicates behind it and a compile function yielding its (rowIndex) => isExcluded, or null
    // where it excludes nothing.  The signature is what lets the predicate mask cache in Ren.Filter
    // hold a unit's verdicts and reuse them across settings that differ elsewhere.
    const compilePredicateUnits = (predicates, tabularData, paras) => {

        if (!predicates || predicates.length === 0) return [];

        const units = [];
        const orGroups = new Map();

        const compileOne = (predicate) => {

            const check = compileIndexPredicate(predicate, tabularData, paras);
            return check === alwaysIncluded ? null : combineChecks([check]);
        };

        for (let i = 0; i < predicates.length; i++) {

            const predicate = predicates[i];
            const orGroupKey = orGroupKeyOf(predicate);

            if (orGroupKey === null) {

                units.push({
                    signature: JSON.stringify(predicate),
                    compile: () => compileOne(predicate)
                });

                continue;
            }

            const group = orGroups.get(orGroupKey);

            if (group) {
                group.push(predicate);
            }
            else {

                orGroups.set(orGroupKey, [predicate]);
            }
        }

        orGroups.forEach((group) => {

            const compileGroup = () => {

                const checks = [];

                for (let i = 0; i < group.length; i++) {
                    checks.push(compileIndexPredicate(group[i], tabularData, paras));
                }

                const check = combineOrChecks(checks);
                return check === alwaysIncluded ? null : combineChecks([check]);
            };

            units.push({ signature: JSON.stringify(group), compile: compileGroup });
        });

        return units;
    };

    // Begotten-chart path: compile a predicate list into (dataRow) => isExcluded, or null.  rows is
    // used only by a ranking compare operator's whole-column scan; omitting it makes such an
    // operator a no-op.
    const compileRowObjectPredicates = (predicates, rows, paras) =>
        compilePredicateList(
            predicates,
            (predicate) => compileRowObjectPredicate(predicate, rows, paras)
        );

    // Group-row path: compile a predicate list into (group) => isExcluded, or null.  groups is used
    // only by a ranking operator's scan; omitting it makes such an operator a no-op.
    const compileGroupPredicates = (predicates, tabularData, groups, paras) =>
        compilePredicateList(
            predicates,
            (predicate) => compileGroupPredicate(predicate, tabularData, groups, paras)
        );

    return {
        TUPLE_SEPARATOR,
        normalise,
        getPredicates,
        hasPredicates,
        compilePredicates,
        compilePredicateUnits,
        compileRowObjectPredicates,
        compileGroupPredicates
    };
})();
