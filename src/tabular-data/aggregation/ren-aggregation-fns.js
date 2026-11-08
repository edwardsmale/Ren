/**
 * Factory that returns aggregation functions keyed by AggregationTypeEnum value.
 *
 * Every aggregation function takes (values, columnIndex, startRowIndex, stopRowIndex,
 * groupRowIndex, isOutermostGrouping, orderKeys).  The last parameter carries the "with respect
 * to" column's value for each row, in the same positions as values, or null when there is no such
 * column; only the First, Last and Median aggregations read it.
 *
 * @param {Function|null} decompressValue - Converts a compressed column value back to its display
 * value.  Pass null when values are already decompressed, otherwise pass
 * tabularData.CompressionDictionary.decompressValue.
 * @param {number|Function} [dictionarySize] - The compression dictionary's size, or a function
 * returning it, which enables the tallying fast path the distinct-value aggregations use.  Omit it
 * when the values are not dictionary indexes.
 * @returns {{ aggFunc: Function }} Object exposing aggFunc(formatType, aggregationType), which
 * returns the appropriate aggregation function for the given types.
 */
Ren.AggregationFns = (decompressValue, dictionarySize) => {

    if (decompressValue == null) decompressValue = (v) => v;

    // The null checks run once per value of every aggregated group, so they are local functions the
    // engine can inline, reading the sentinel from a local rather than off the Ren global.
    const NULL_SENTINEL = Ren.NullSentinel;

    const isNull = (value) => value == null || value === NULL_SENTINEL;
    const isNullOrEmpty = (value) => value == null || value === "" || value === NULL_SENTINEL;

    // An aggregation over a column wider than this doesn't use the tallying fast path, so that a
    // report with a huge dictionary doesn't trade its memory for the speed-up.
    const MAX_TALLY_SIZE = 1000000;

    // Resolved the first time a tally is attempted rather than now, since interning a derived value
    // grows the dictionary.
    let tallySize = -1;

    const getTallySize = () => {

        if (tallySize < 0) {

            const size = typeof dictionarySize === "function" ? dictionarySize() : dictionarySize;

            tallySize = (typeof size === "number" && size > 0 && size <= MAX_TALLY_SIZE) ? size : 0;
        }

        return tallySize;
    };

    // Scratch state behind the tallying fast path, reused by every group and column: the epoch each
    // value was last stamped with, its count, and the distinct values in the order first seen.
    // Bumping the epoch logically clears the lot in O(1).
    let tallyEpochs = null;
    let tallyCounts = null;
    let tallyValues = null;
    let tallyEpoch = 0;

    // How many distinct values the last successful tally found, in tallyValues[0, tallyDistinct).
    let tallyDistinct = 0;

    /**
     * Counts the occurrences of each value in the range, keyed by the value itself.
     *
     * Compressed column values are dictionary indexes, so they can be counted by stamping a reused
     * array rather than by hashing into a fresh Map or Set per group.  Any value that isn't such an
     * index abandons the tally on the first one.
     *
     * @returns {boolean} True when the range was tallied, and the counts can be read with
     * tallyCountOf() over the distinct values in tallyValues[0, tallyDistinct).
     */
    const tally = (values, startRowIndex, stopRowIndex) => {

        if (getTallySize() === 0) return false;

        if (tallyEpochs === null) {

            tallyEpochs = new Int32Array(tallySize);
            tallyCounts = new Int32Array(tallySize);
            tallyValues = new Int32Array(tallySize);
        }

        // The epochs start at 0 and the array is zero-initialised, so the first epoch used (1)
        // never collides with an unstamped slot.  Wrapping round would, so the array is cleared on
        // the (vanishingly rare) occasion that the stamps run out.
        if (tallyEpoch === 2147483647) {

            tallyEpochs.fill(0);
            tallyEpoch = 0;
        }

        const epoch = ++tallyEpoch;
        let distinct = 0;

        for (let i = startRowIndex; i < stopRowIndex; i++) {

            const value = values[i];

            if (typeof value !== "number" || (value | 0) !== value ||
                value < 0 || value >= tallySize) {

                return false;
            }

            if (tallyEpochs[value] === epoch) {

                tallyCounts[value]++;
            }
            else {

                tallyEpochs[value] = epoch;
                tallyCounts[value] = 1;
                tallyValues[distinct++] = value;
            }
        }

        tallyDistinct = distinct;

        return true;
    };

    const tallyCountOf = (value) => tallyCounts[value];

    /**
     * Sorts the tallied distinct values into the order the "with counts" aggregations present them
     * in - most frequent first, and highest value first among equal counts - and returns them.
     */
    const sortTalliedValuesByCountDescending = () => {

        const sorted = tallyValues.subarray(0, tallyDistinct);

        sorted.sort((a, b) => (tallyCounts[b] - tallyCounts[a]) || (b - a));

        return sorted;
    };

    /**
     * Returns an array containing the values which appear most frequently in the specified range.
     */
    const mostCommonValues = (values, columnIndex, startRowIndex, stopRowIndex) => {

        const result = [];

        if (tally(values, startRowIndex, stopRowIndex)) {

            let maxTalliedCount = 0;

            for (let i = 0; i < tallyDistinct; i++) {

                const count = tallyCountOf(tallyValues[i]);
                if (count > maxTalliedCount) maxTalliedCount = count;
            }

            for (let i = 0; i < tallyDistinct; i++) {

                const value = tallyValues[i];

                if (tallyCountOf(value) === maxTalliedCount) {
                    result.push(decompressValue(value, columnIndex));
                }
            }

            return result;
        }

        const counts = new Map();
        let maxCount = 0;

        for (let i = startRowIndex; i < stopRowIndex; i++) {

            const value = values[i];
            const count = (counts.get(value) ?? 0) + 1;

            counts.set(value, count);

            if (count > maxCount) maxCount = count;
        }

        counts.forEach((count, value) => {

            if (count === maxCount) {
                result.push(value === null ? Ren.NullSentinel : decompressValue(value, columnIndex));
            }
        });

        return result;
    };

    /**
     * Returns the sum of the values in the specified range.  Returns the sum as a string to
     * prevent it being treated as a compressed value (compressed values are numbers).
     */
    const sum = (values, _columnIndex, startRowIndex, stopRowIndex) => {

        // Inlined sum function for performance.

        let result = 0;
        let hasValues = false;

        for (let i = startRowIndex; i < stopRowIndex; i++) {

            const value = values[i];

            if (value != null) {

                result += value;
                hasValues = true;
            }
        }

        if (!hasValues) return Ren.NullSentinel;

        return result.toString();
    };

    /**
     * Returns the mean of the values in the specified range.  Returns the mean as a string to
     * prevent it being treated as a compressed value (compressed values are numbers).  If there
     * are no non-blank values in the range, returns NULL.
     */
    const average = (values, _columnIndex, startRowIndex, stopRowIndex) => {

        // Single pass: accumulate sum and count together.
        let total = 0;
        let numValues = 0;

        for (let i = startRowIndex; i < stopRowIndex; i++) {

            const v = values[i];

            if (v !== "" && v != null) {

                total += v;
                numValues++;
            }
        }

        if (numValues === 0) return null;

        return (total / numValues).toString();
    };

    /**
     * Returns an array containing the values in the specified range.
     */
    const concatenate = (values, columnIndex, startRowIndex, stopRowIndex) => {

        // Single loop to avoid the four intermediate arrays that slice?filter?map?filter produced.
        const result = [];

        for (let i = startRowIndex; i < stopRowIndex; i++) {

            const v = values[i];

            if (v === "" || v == null) continue;

            const decompressed = decompressValue(v, columnIndex);

            if (decompressed !== NULL_SENTINEL) result.push(decompressed);
        }

        return result;
    };

    /**
     * Returns an array containing all values in the specified range, including empty and NULLs.
     */
    const concatenateIncludingEmpty = (values, columnIndex, startRowIndex, stopRowIndex) => {

        // Single loop to avoid the two intermediate arrays that slice?map produced.
        const result = [];

        for (let i = startRowIndex; i < stopRowIndex; i++) {

            const v = values[i];
            result.push(v === null ? NULL_SENTINEL : decompressValue(v, columnIndex));
        }

        return result;
    };

    /**
     * Returns an array containing the distinct, non-empty values.
     */
    const distinctValues = (values, columnIndex, startRowIndex, stopRowIndex) => {

        const result = [];

        // Dictionary indexes are never null or empty themselves, so the tallied values need only
        // the same post-decompression null check the general path applies.
        if (tally(values, startRowIndex, stopRowIndex)) {

            for (let i = 0; i < tallyDistinct; i++) {

                const decompressed = decompressValue(tallyValues[i], columnIndex);
                if (!isNull(decompressed)) result.push(decompressed);
            }

            return result;
        }

        const distinct = new Set();

        for (let i = startRowIndex; i < stopRowIndex; i++) {

            const v = values[i];
            if (isNullOrEmpty(v)) continue;
            distinct.add(v);
        }

        distinct.forEach((v) => {

            const decompressed = decompressValue(v, columnIndex);
            if (!isNull(decompressed)) result.push(decompressed);
        });

        return result;
    };

    /**
     * Returns an array containing the distinct values, including empty values.
     */
    const distinctValuesIncludingEmpty = (values, columnIndex, startRowIndex, stopRowIndex) => {

        const result = [];

        if (tally(values, startRowIndex, stopRowIndex)) {

            for (let i = 0; i < tallyDistinct; i++) {
                result.push(decompressValue(tallyValues[i], columnIndex));
            }

            return result;
        }

        const distinct = new Set();

        for (let i = startRowIndex; i < stopRowIndex; i++) {

            const v = values[i];
            distinct.add(v === null ? NULL_SENTINEL : v);
        }

        if (distinct.size === 1 && distinct.has(NULL_SENTINEL)) return NULL_SENTINEL;

        distinct.forEach((v) => {

            result.push(v === NULL_SENTINEL ? NULL_SENTINEL : decompressValue(v, columnIndex));
        });

        return result;
    };

    /**
     * Returns an array containing the distinct, non-empty values and how many times they appear
     * (as a string in the format "value ᵡ count").
     */
    const distinctValuesWithCounts = (values, columnIndex, startRowIndex, stopRowIndex) => {

        const result = [];

        if (tally(values, startRowIndex, stopRowIndex)) {

            const sorted = sortTalliedValuesByCountDescending();

            for (let i = 0; i < sorted.length; i++) {

                const value = sorted[i];
                const decompressed = decompressValue(value, columnIndex);

                if (!isNullOrEmpty(decompressed)) {
                    result.push(`${decompressed} ᵡ ${tallyCountOf(value)}`);
                }
            }

            return result;
        }

        const valueCounts = new Map();

        for (let i = startRowIndex; i < stopRowIndex; i++) {

            const v = values[i];
            if (isNullOrEmpty(v)) continue;
            valueCounts.set(v, (valueCounts.get(v) ?? 0) + 1);
        }

        const valueCountsArray = Array.from(valueCounts);

        valueCountsArray.sort((a, b) => (b[1] - a[1]) || (b[0] - a[0]));

        // Single loop to avoid the three intermediate arrays that map?filter?map produced.
        for (let i = 0; i < valueCountsArray.length; i++) {

            const decompressed = decompressValue(valueCountsArray[i][0], columnIndex);
            if (!isNullOrEmpty(decompressed)) result.push(`${decompressed} ᵡ ${valueCountsArray[i][1]}`);
        }

        return result;
    };

    /**
     * Returns an array containing the distinct values (including empty), and how many times they
     * appear (as a string in the format "value ᵡ count").
     */
    const distinctValuesIncludingEmptyWithCounts = (values, columnIndex, startRowIndex, stopRowIndex) => {

        const result = [];

        if (tally(values, startRowIndex, stopRowIndex)) {

            const sorted = sortTalliedValuesByCountDescending();

            for (let i = 0; i < sorted.length; i++) {

                const value = sorted[i];
                const decompressed = decompressValue(value, columnIndex);
                const display = isNull(decompressed) ? NULL_SENTINEL : decompressed;

                result.push(`${display} ᵡ ${tallyCountOf(value)}`);
            }

            return result;
        }

        const valueCounts = new Map();

        for (let i = startRowIndex; i < stopRowIndex; i++) {

            const v = values[i];
            const key = v == null ? NULL_SENTINEL : v;
            valueCounts.set(key, (valueCounts.get(key) ?? 0) + 1);
        }

        const valueCountsArray = Array.from(valueCounts);

        valueCountsArray.sort((a, b) => (b[1] - a[1]) || (b[0] - a[0]));

        // Single loop to avoid the intermediate array that the chained .map() produced.
        for (let i = 0; i < valueCountsArray.length; i++) {

            const val = valueCountsArray[i][0];
            const decompressed = val === NULL_SENTINEL
                ? NULL_SENTINEL
                : decompressValue(val, columnIndex);
            const display = isNull(decompressed) ? NULL_SENTINEL : decompressed;

            result.push(`${display} ᵡ ${valueCountsArray[i][1]}`);
        }

        return result;
    };

    /**
     * Returns the number of non-empty values in the specified range.  Returns the count as a
     * string to prevent it being treated as a compressed value (compressed values are numbers).
     */
    const count = (values, _columnIndex, startRowIndex, stopRowIndex) => {

        let numValues = 0;

        for (let i = startRowIndex; i < stopRowIndex; i++) {

            const v = values[i];
            if (v == null || v === "" || v === NULL_SENTINEL) continue;

            numValues++;
        }

        return numValues.toString();
    };

    /**
     * Returns the number of distinct, non-empty values in the specified range. Returns the count as
     * a string to prevent it being treated as a compressed value (compressed values are numbers).
     */
    const countDistinct = (values, _columnIndex, startRowIndex, stopRowIndex) => {

        // Dictionary indexes are never null or empty, so every tallied value counts.
        if (tally(values, startRowIndex, stopRowIndex)) return tallyDistinct.toString();

        const distinct = new Set();

        for (let i = startRowIndex; i < stopRowIndex; i++) {

            const v = values[i];
            if (isNullOrEmpty(v)) continue;
            distinct.add(v);
        }

        return distinct.size.toString();
    };

    /**
     * Returns the minimum value (either numeric or alphabetical) in the specified range.  Returns
     * the value decompressed.
     */
    const min = (values, columnIndex, startRowIndex, stopRowIndex) => {

        // A compressed column holds dictionary indexes rather than the values themselves, so a
        // NULL is the index of the sentinel - which sorts first - rather than the sentinel.
        const nullIsIndexZero = decompressValue(0, columnIndex) === NULL_SENTINEL;

        // Seeded from the first value rather than a sentinel, so that a range of zeroes, negative
        // numbers or text compares against a value of its own kind.
        let result = null;

        for (let i = startRowIndex; i < stopRowIndex; i++) {

            const v = values[i];

            if (v == null || v === "" || v === NULL_SENTINEL) continue;

            if (nullIsIndexZero && v === 0) continue;

            if (result === null || v < result) result = v;
        }

        if (result === null) return Ren.NullSentinel;

        return decompressValue(result, columnIndex);
    };

    /**
     * Returns the maximum value (either numeric or alphabetical) in the specified range.  Returns
     * the value decompressed.
     */
    const max = (values, columnIndex, startRowIndex, stopRowIndex) => {

        // A compressed column holds dictionary indexes rather than the values themselves, so a
        // NULL is the index of the sentinel - which sorts first - rather than the sentinel.
        const nullIsIndexZero = decompressValue(0, columnIndex) === NULL_SENTINEL;

        // Seeded from the first value, as min is above.
        let result = null;

        for (let i = startRowIndex; i < stopRowIndex; i++) {

            const v = values[i];

            if (v == null || v === "" || v === NULL_SENTINEL) continue;

            if (nullIsIndexZero && v === 0) continue;

            if (result === null || v > result) result = v;
        }

        if (result === null) return Ren.NullSentinel;

        return decompressValue(result, columnIndex);
    };

    /**
     * Returns the value of the row that comes first in the range's ordering, decompressed.
     *
     * The ordering is by orderKeys where given, otherwise by row order.  Order keys are compared as
     * they are stored, so a compressed column orders by its ordinally sorted dictionary indexes.
     * Null or empty values, and rows whose order key is null or empty, are skipped; the earlier row
     * wins a tie.
     */
    const first = (values, columnIndex, startRowIndex, stopRowIndex, _groupRowIndex, _isOutermostGrouping, orderKeys) => {

        let bestValue = null;
        let bestKey = null;

        for (let i = startRowIndex; i < stopRowIndex; i++) {

            const value = values[i];

            if (isNullOrEmpty(value)) continue;

            // With no order keys the first non-empty value in row order is the answer.
            if (orderKeys == null) {

                bestValue = value;
                break;
            }

            const key = orderKeys[i];

            if (isNullOrEmpty(key)) continue;

            if (bestKey === null || key < bestKey) {

                bestKey = key;
                bestValue = value;
            }
        }

        if (bestValue === null) return NULL_SENTINEL;

        return decompressValue(bestValue, columnIndex);
    };

    /**
     * Returns the value of the row that comes last in the range's ordering, decompressed.  The
     * ordering works exactly as it does for first (above), except that the later row wins a tie.
     */
    const last = (values, columnIndex, startRowIndex, stopRowIndex, _groupRowIndex, _isOutermostGrouping, orderKeys) => {

        let bestValue = null;
        let bestKey = null;

        for (let i = startRowIndex; i < stopRowIndex; i++) {

            const value = values[i];

            if (isNullOrEmpty(value)) continue;

            // With no order keys the last non-empty value in row order is the answer, so every
            // candidate replaces the one before it.
            if (orderKeys == null) {

                bestValue = value;
                continue;
            }

            const key = orderKeys[i];

            if (isNullOrEmpty(key)) continue;

            if (bestKey === null || key >= bestKey) {

                bestKey = key;
                bestValue = value;
            }
        }

        if (bestValue === null) return NULL_SENTINEL;

        return decompressValue(bestValue, columnIndex);
    };

    // Stored values and order keys are numbers, or strings in an uncompressed text column.
    const compareStoredValues = (a, b) => (a < b ? -1 : (a > b ? 1 : 0));

    // Gets a decompressed value as a number, or null where it is neither a number nor numeric text.
    const toMedianNumber = (value) => {

        if (typeof value === "number") return value;

        if (typeof value !== "string" || value.trim() === "") return null;

        const number = Number(value);

        return isFinite(number) ? number : null;
    };

    /**
     * Returns the value of the row in the middle of the range's ordering, decompressed.
     *
     * The ordering is by orderKeys where given, as for first (above), otherwise by the values
     * themselves.  Null or empty values, and rows whose order key is null or empty, are skipped.
     * With an even number of rows the two middle values are averaged where both are numbers (or
     * numeric text), and otherwise the earlier of the two is taken.
     */
    const median = (values, columnIndex, startRowIndex, stopRowIndex, _groupRowIndex, _isOutermostGrouping, orderKeys) => {

        const positions = [];

        for (let i = startRowIndex; i < stopRowIndex; i++) {

            if (isNullOrEmpty(values[i])) continue;
            if (orderKeys != null && isNullOrEmpty(orderKeys[i])) continue;

            positions.push(i);
        }

        const positionCount = positions.length;

        if (positionCount === 0) return NULL_SENTINEL;

        // The sort is stable, so the earlier row comes first among equal order keys.
        if (orderKeys != null) {
            positions.sort((a, b) => compareStoredValues(orderKeys[a], orderKeys[b]));
        }
        else {

            positions.sort((a, b) => compareStoredValues(values[a], values[b]));
        }

        const lower = decompressValue(values[positions[(positionCount - 1) >> 1]], columnIndex);

        if (positionCount % 2 === 1) return lower;

        const upper = decompressValue(values[positions[positionCount >> 1]], columnIndex);

        const lowerNumber = toMedianNumber(lower);
        const upperNumber = toMedianNumber(upper);

        if (lowerNumber === null || upperNumber === null) return lower;

        // A string, as average returns, so it isn't taken for a compressed value.
        return ((lowerNumber + upperNumber) / 2).toString();
    };

    /**
     * Returns NULL.
     */
    const noTotal = () => null;

    /**
     * Gets the decompressed values in the specified range, one per line.
     */
    const _getValuesOnePerLine = (values, columnIndex, startRowIndex, stopRowIndex) => {

        // Collected into an array of exactly the right length and joined.  Appending to a string
        // instead was measurably slower here, since it costs two concatenations per value.
        const decompressedValues = new Array(stopRowIndex - startRowIndex);

        for (let i = startRowIndex; i < stopRowIndex; i++) {

            decompressedValues[i - startRowIndex] = decompressValue(values[i], columnIndex);
        }

        return decompressedValues.join("\n");
    };

    /**
     * Gets the single value, or NULL if the range has multiple values.
     */
    const _getSingleNonBlankValue = (values, columnIndex, startRowIndex, stopRowIndex) => {

        if (startRowIndex >= stopRowIndex) return decompressValue(null, columnIndex);

        // The first value is read outside the loop, so every subsequent value is only compared with
        // it, and the first difference ends the scan.
        let v = values[startRowIndex] ?? "";

        for (let i = startRowIndex + 1; i < stopRowIndex; i++) {

            const value = values[i] ?? "";

            if (value !== v) return null;

            v = value;
        }

        return decompressValue(v, columnIndex);
    };

    /**
     * Returns the single value, or blank if the column has multiple values.  A group whose rows are
     * all NULL aggregates to blank rather than the null sentinel.
     */
    const singleValuesOnly = (values, columnIndex, startRowIndex, stopRowIndex) => {

        const singleValue = _getSingleNonBlankValue(values, columnIndex, startRowIndex, stopRowIndex);

        return isNull(singleValue) ? "" : singleValue;
    };

    /**
     * Gets the HTML for the placeholder used in the 'single value or placeholder' aggregation type.
     */
    const _singleValueOrPlaceholderPlaceholderHtml = (tooltip) => {

        return `<span style="opacity:0.5;font-style:italic" title="${tooltip}">multiple values</span>`;
    };

    /**
     * Returns the single value, or 'multiple values' if the column has multiple values.
     */
    const singleValueOrPlaceholder = (values, columnIndex, startRowIndex, stopRowIndex) => {

        const singleValue = _getSingleNonBlankValue(values, columnIndex, startRowIndex, stopRowIndex);

        if (singleValue !== null) return singleValue;

        const tooltip = _getValuesOnePerLine(values, columnIndex, startRowIndex, stopRowIndex);

        return _singleValueOrPlaceholderPlaceholderHtml(tooltip);
    };

    const expandCollapseButtonHtml = '<div class="ren-data-grid__group-expand-collapse-button"></div>';

    /**
     * Show an expand icon when the group is collapsed, if the group contains multiple values.
     */
    const expandIcon = (values, columnIndex, startRowIndex, stopRowIndex, _groupRowIndex, isOutermostGrouping) => {

        if (isOutermostGrouping) return null; // The outermost grouping should always stay expanded.

        const singleValue = _getSingleNonBlankValue(values, columnIndex, startRowIndex, stopRowIndex);

        if (singleValue !== null) return singleValue;

        return expandCollapseButtonHtml;
    };

    /**
     * Show an expand icon when the group is collapsed, even if the group contains only a single
     * value.
     */
    const expandIconAlways = (_values, _columnIndex, _startRowIndex, _stopRowIndex, _groupRowIndex, isOutermostGrouping) => {

        if (isOutermostGrouping) {

            return null; // The outermost grouping should always stay expanded.
        }
        else {

            return expandCollapseButtonHtml;
        }
    };

    let funcsObj = {

        [Ren.AggregationTypeEnum.Sum]: sum,
        [Ren.AggregationTypeEnum.Average]: average,
        [Ren.AggregationTypeEnum.Count]: count,
        [Ren.AggregationTypeEnum.CountDistinct]: countDistinct,
        [Ren.AggregationTypeEnum.Min]: min,
        [Ren.AggregationTypeEnum.Max]: max,
        [Ren.AggregationTypeEnum.First]: first,
        [Ren.AggregationTypeEnum.Last]: last,
        [Ren.AggregationTypeEnum.Median]: median,
        [Ren.AggregationTypeEnum.Concatenate]: concatenate,
        [Ren.AggregationTypeEnum.ConcatenateIncludingEmpty]: concatenateIncludingEmpty,
        [Ren.AggregationTypeEnum.MostCommon]: mostCommonValues,
        [Ren.AggregationTypeEnum.DistinctValues]: distinctValues,
        [Ren.AggregationTypeEnum.DistinctValuesIncludingEmpty]: distinctValuesIncludingEmpty,
        [Ren.AggregationTypeEnum.DistinctValuesWithCounts]: distinctValuesWithCounts,
        [Ren.AggregationTypeEnum.DistinctValuesIncludingEmptyWithCounts]: distinctValuesIncludingEmptyWithCounts,
        [Ren.AggregationTypeEnum.NoTotal]: noTotal,
        [Ren.AggregationTypeEnum.SingleValuesOnly]: singleValuesOnly,
        [Ren.AggregationTypeEnum.SingleValueOrPlaceholder]: singleValueOrPlaceholder,
        [Ren.AggregationTypeEnum.ExpandIcon]: expandIcon,
        [Ren.AggregationTypeEnum.ExpandIconAlways]: expandIconAlways
    };

    // Convert the object to an array for speedy lookups.
    const funcs = [];

    for (const key in funcsObj) {
        funcs[key] = funcsObj[key];
    }
    funcsObj = null;

    /**
     * Gets the aggregation function to use for the specified format type and aggregation type.
     */
    const aggFunc = (formatType, aggregationType) => {

        if (aggregationType !== null) return funcs[aggregationType];

        if (formatType === Ren.SpreadsheetColumnFormatEnum.Number) {
            aggregationType = Ren.AggregationTypeEnum.Sum;
        }
        else if (formatType === Ren.SpreadsheetColumnFormatEnum.Date) {

            aggregationType = Ren.AggregationTypeEnum.NoTotal;
        }
        else {

            aggregationType = Ren.AggregationTypeEnum.Concatenate;
        }

        return funcs[aggregationType];
    };

    return {
        aggFunc
    };
};
