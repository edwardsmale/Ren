Ren.CompressionDictionary = (() => {

    /**
     * The state a compression dictionary carries beyond the dictionary array itself, held per array
     * rather than per wrapper, so that an appended value keeps its index across fresh wrappers.
     */
    const statesByDictionary = new WeakMap();

    /**
     * The most values that may be appended to a dictionary, since derived values are interned for
     * the life of the report.  Once the cap is reached derived values are left as literals.
     */
    const MAX_APPENDED_VALUES = 200000;

    /**
     * A column's value encodings, from TabularData.ColumnValueEncodings:
     *   - a dictionary column holds dictionary indexes;
     *   - a date column holds the milliseconds since 1970-01-01 of its dates;
     *   - a datetime column holds the same, always a whole number of seconds.
     * A NULL in a date or datetime column is null.
     */
    const VALUE_ENCODING_DICTIONARY = 0;
    const VALUE_ENCODING_DATE_TIME_EPOCH_MS = 2;

    const MILLISECONDS_PER_DAY = 86400000;

    const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
    const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

    const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    const createState = (sortedLength) => {

        return {
            indexByValue: new Map(),
            indexByNonStringValue: new Map(),
            sortedLength: sortedLength,
            dateStringByEpoch: new Map(),
            dateTimeStringByEpoch: new Map()
        };
    };

    /**
     * Gets the shared state of the given dictionary, creating it the first time the dictionary is
     * seen.  The dictionary arrives sorted, so the sorted part is always the first sortedLength
     * entries.  A dictionary that is not an array gets state that nothing reads.
     */
    const getState = (dict) => {

        if (!Array.isArray(dict)) return createState(0);

        let state = statesByDictionary.get(dict);

        if (state === undefined) {

            state = createState(dict.length);
            statesByDictionary.set(dict, state);
        }

        return state;
    };

    /**
     * Gets the number of days from 1970-01-01 to the given date in the proleptic Gregorian
     * calendar, the same way the server counts them (Hinnant's days_from_civil).
     */
    const daysSinceEpoch = (year, month, day) => {

        const marchYear = month <= 2 ? year - 1 : year;
        const era = Math.floor(marchYear / 400);
        const yearOfEra = marchYear - era * 400;
        const marchMonth = month > 2 ? month - 3 : month + 9;
        const dayOfYear = Math.floor((153 * marchMonth + 2) / 5) + day - 1;
        const dayOfEra =
            yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;

        return era * 146097 + dayOfEra - 719468;
    };

    /**
     * Gets the milliseconds since 1970-01-01 of a "yyyy-MM-dd" string, or of a
     * "yyyy-MM-dd HH:mm:ss" one for a datetime column, or null where the string is not one.
     */
    const parseEpochMilliseconds = (value, encoding) => {

        const hasTime = encoding === VALUE_ENCODING_DATE_TIME_EPOCH_MS;
        const match = (hasTime ? DATE_TIME_PATTERN : DATE_PATTERN).exec(value);

        if (match === null) return null;

        const year = +match[1];
        const month = +match[2];
        const day = +match[3];

        if (year < 1 || month < 1 || month > 12 || day < 1) return null;

        const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
        const daysInMonth = month === 2 && isLeapYear ? 29 : DAYS_IN_MONTH[month - 1];

        if (day > daysInMonth) return null;

        let seconds = 0;

        if (hasTime) {

            const hours = +match[4];
            const minutes = +match[5];
            const secondsPart = +match[6];

            if (hours > 23 || minutes > 59 || secondsPart > 59) return null;

            seconds = hours * 3600 + minutes * 60 + secondsPart;
        }

        return daysSinceEpoch(year, month, day) * MILLISECONDS_PER_DAY + seconds * 1000;
    };

    return (dict, isCompressed, valueEncodings) => {

        const isArray = Array.isArray(dict);
        const state = getState(dict);

        // The dictionary is sorted with the NULL sentinel first, which is not where an ordinal sort
        // would put it when the column holds an empty string too.  Everything from this index on is
        // in ordinal order, so that is the part searched; the sentinel is answered from dict[0].
        const firstOrdinalIndex = isArray && dict[0] === Ren.NullSentinel ? 1 : 0;

        let hasEpochColumns = false;

        if (valueEncodings != null) {

            for (let i = 0; i < valueEncodings.length; i++) {

                if (valueEncodings[i] !== VALUE_ENCODING_DICTIONARY) {

                    hasEpochColumns = true;
                    break;
                }
            }
        }

        /**
         * Gets a value indicating whether the given column's compressed values are dates as
         * milliseconds since 1970-01-01 rather than dictionary indexes.
         */
        const isEpochColumn = (i) => {

            return hasEpochColumns &&
                !!isCompressed[i] &&
                (valueEncodings[i] | 0) !== VALUE_ENCODING_DICTIONARY;
        };

        /**
         * Gets the "yyyy-MM-dd" or "yyyy-MM-dd HH:mm:ss" string of a date's milliseconds, built
         * once per distinct date and kept for the life of the dictionary.
         */
        const formatEpochMilliseconds = (v, encoding) => {

            const hasTime = encoding === VALUE_ENCODING_DATE_TIME_EPOCH_MS;
            const stringByEpoch = hasTime ? state.dateTimeStringByEpoch : state.dateStringByEpoch;

            let result = stringByEpoch.get(v);

            if (result === undefined) {

                const date = new Date(v);

                // A number that is not a date, such as the NaN a summary stat parses a NULL to, is
                // treated as a NULL, as toISOString would throw on it.
                if (isNaN(date.getTime())) {

                    result = Ren.NullSentinel;
                }
                else {

                    const isoString = date.toISOString();

                    result = hasTime
                        ? isoString.slice(0, 10) + " " + isoString.slice(11, 19)
                        : isoString.slice(0, 10);
                }

                stringByEpoch.set(v, result);
            }

            return result;
        };

        /**
         * Appends a value that is in neither part of the dictionary and returns its index, or -1
         * once the dictionary holds as many appended values as it may.
         */
        const appendValue = (value) => {

            if (dict.length - state.sortedLength >= MAX_APPENDED_VALUES) return -1;

            const index = dict.length;

            dict.push(value);
            state.indexByValue.set(value, index);

            return index;
        };

        /**
         * Compresses a string into a date column:
         *   - the NULL sentinel is compressed to null;
         *   - a date string is compressed to its milliseconds;
         *   - anything else is left as it is, which no value in the column matches.
         */
        const compressEpochValue = (v, i) => {

            if (v === Ren.NullSentinel) return null;

            const milliseconds = parseEpochMilliseconds(v, valueEncodings[i]);

            return milliseconds === null ? v : milliseconds;
        };

        const compressValue = (v, i) => {

            // Only strings are looked up in the dictionary.  Anything else is returned unchanged:
            //   - a number is a compressed value already;
            //   - null and undefined must not reach binarySearch, which would return a bogus but
            //     valid index.
            if (!isCompressed[i] || typeof v !== "string") return v;

            if (hasEpochColumns && isEpochColumn(i)) return compressEpochValue(v, i);

            // The sentinel is answered from dict[0] rather than searched for; see
            // firstOrdinalIndex.  It can still have been interned as a derived value where the
            // dictionary did not arrive with one, which the cache below answers.
            if (v === Ren.NullSentinel && dict[0] === v) return 0;

            const cached = state.indexByValue.get(v);
            if (cached !== undefined) return cached;

            // Searched directly rather than through a helper: the appended part of the dictionary
            // is reached through indexByValue, which the cache above has already missed.
            const index = v === Ren.NullSentinel
                ? -1
                : Ren.ArrayUtils.binarySearch(dict, v, firstOrdinalIndex, state.sortedLength);

            const result = index < 0 ? v : index;

            state.indexByValue.set(v, result);
            return result;
        };

        /**
         * Returns the compressed value of a value derived into a date column:
         *   - the NULL sentinel is compressed to null;
         *   - a date string is compressed to its milliseconds;
         *   - anything else is kept as its string form, a literal, and the column is marked
         *     appended so that nothing orders it as a date.
         * A number is never kept as it is, since it would read as a date - the Count of a date
         * column is a count, not a day in 1970.
         */
        const internDerivedEpochValue = (value, columnIndex, appendedColumns) => {

            const key = typeof value === "string" ? value : String(value);

            if (key === Ren.NullSentinel) return null;

            const milliseconds = parseEpochMilliseconds(key, valueEncodings[columnIndex]);

            if (milliseconds !== null) return milliseconds;

            appendedColumns[columnIndex] = true;

            return key;
        };

        /**
         * Returns the compressed value of a value the client derived rather than read from the data
         * - an aggregated value, or the result of a calc function - interning it in the dictionary
         * where it is not there already.  An appended value is out of the dictionary's sorted
         * order, so appendedColumns is required.  A non-string is interned by its string form, so
         * that a number is not mistaken for a dictionary index.
         *
         * @param {*} value - The derived value.
         * @param {number} columnIndex - The index of the column the value belongs to.
         * @param {Array} appendedColumns - Per-column flags, marked true for a column an
         *   out-of-order value was appended for.
         */
        const internDerivedValue = (value, columnIndex, appendedColumns) => {

            // A column that is not compressed holds its values as they are (numbers, and the nulls
            // standing for SQL NULL), and nothing about it is a dictionary index.
            if (!isCompressed[columnIndex] || !isArray) return value;

            // A null or undefined is the absence of a value, and is left as it is so that a reader
            // still sees an absence rather than a value.  In a date column null is a NULL read
            // from the data, so there an absent value is stored as undefined.
            if (value == null) {

                return hasEpochColumns && isEpochColumn(columnIndex) ? undefined : value;
            }

            if (hasEpochColumns && isEpochColumn(columnIndex)) {
                return internDerivedEpochValue(value, columnIndex, appendedColumns);
            }

            const isString = typeof value === "string";

            // A value that is not a string is cached by the value itself as well as by its string
            // form, so that a repeated one - the number a Count over a compressed column gives
            // every group - does not build that string again to look itself up.
            if (!isString) {

                const cachedIndex = state.indexByNonStringValue.get(value);

                if (cachedIndex !== undefined) {

                    if (cachedIndex >= state.sortedLength) {
                        appendedColumns[columnIndex] = true;
                    }

                    return cachedIndex;
                }
            }

            const key = isString ? value : String(value);

            if (key === Ren.NullSentinel && dict[0] === key) return 0;

            let index = state.indexByValue.get(key);

            // A value looked up before it was interned is cached as the literal it was then (see
            // compressValue), so anything that is not a number is a miss rather than an index.
            if (typeof index !== "number") {

                // Searched directly rather than through a helper: the appended part of the
                // dictionary is reached through indexByValue, which has already been missed.
                index = key === Ren.NullSentinel
                    ? -1
                    : Ren.ArrayUtils.binarySearch(dict, key, firstOrdinalIndex, state.sortedLength);

                if (index < 0) {
                    index = appendValue(key);
                }
                else {

                    // Cached like a value compressValue looked up, so that the search is paid once
                    // rather than once per group that derives the same value.
                    state.indexByValue.set(key, index);
                }

                // Left as the literal it was when the dictionary is full, which is what a
                // compressed column's derived values were before they were interned at all.
                if (index < 0) return key;
            }

            if (!isString) {
                state.indexByNonStringValue.set(value, index);
            }

            if (index >= state.sortedLength) appendedColumns[columnIndex] = true;

            return index;
        };

        /**
         * Records, for a value that is already compressed, whether it is one appended out of the
         * dictionary's sorted order, and returns it unchanged.
         *
         * @param {*} value - The compressed value.
         * @param {number} columnIndex - The index of the column the value belongs to.
         * @param {Array} appendedColumns - Per-column flags, marked true for a column an
         *   out-of-order value was appended for.
         */
        const markIfAppended = (value, columnIndex, appendedColumns) => {

            // A date column's numbers are dates, which order themselves, and any string in it is a
            // literal that does not.
            if (hasEpochColumns && isEpochColumn(columnIndex)) {

                if (typeof value === "string") appendedColumns[columnIndex] = true;

                return value;
            }

            if (typeof value === "number" && value >= state.sortedLength) {
                appendedColumns[columnIndex] = true;
            }

            return value;
        };

        /**
         * Decompresses a value where no column is a date column: a number in a compressed column
         * is a dictionary index, and anything else is returned unchanged.  Kept separate from
         * decompressValueWithEpochColumns so that this common case does not pay for the date
         * column checks on every value.
         */
        const decompressDictionaryValue = (v, i) => {

            if (!isCompressed[i] || typeof v !== "number") return v;
            return dict[v];
        };

        /**
         * Decompresses a value where any column is a date column.  In a date column:
         *   - a number is a date, and decompresses to its date string;
         *   - null is a SQL NULL, and decompresses to the NULL sentinel;
         *   - undefined is a derived value that is absent (see internDerivedValue), and
         *     decompresses to null.
         * These are the same results a dictionary column gives for a date, a NULL and an absent
         * value.
         */
        const decompressValueWithEpochColumns = (v, i) => {

            if (!isCompressed[i]) return v;

            const encoding = valueEncodings[i] | 0;

            if (encoding === VALUE_ENCODING_DICTIONARY) {
                return typeof v === "number" ? dict[v] : v;
            }

            if (typeof v === "number") return formatEpochMilliseconds(v, encoding);

            if (v === null) return Ren.NullSentinel;

            return v === undefined ? null : v;
        };

        const decompressValue = hasEpochColumns
            ? decompressValueWithEpochColumns
            : decompressDictionaryValue;

        /**
         * Gets the compressed values of all null/whitespace/sentinel entries in the dictionary.
         */
        const compressedValuesThatAreNullOrWhitespace = (columnIndex) => {

            // A date column's NULLs are null, and it holds no blank strings.
            if (hasEpochColumns && isEpochColumn(columnIndex)) return [];

            // The compressed values are the values' indexes in the dictionary.  The NULL sentinel
            // stands for SQL NULL, and is treated the same as null or whitespace for the purposes
            // of the column summary window.  A dictionary entry is not always a string, and
            // anything that is not a string is never blank.  Only the values the data arrived with
            // are considered.
            const compressedValues = [];

            for (let index = 0; index < state.sortedLength; index++) {

                const value = dict[index];

                if (value == null ||
                    value === Ren.NullSentinel ||
                    (typeof value === "string" && value.trim() === "")) {

                    compressedValues.push(index);
                }
            }

            return compressedValues;
        };

        /**
         * Gets a value indicating whether the given value is one of the values the data arrived
         * with, rather than one interned since:
         *   - null, undefined and a blank string always are;
         *   - in a date column, the NULL sentinel and any date the column could hold are;
         *   - in a dictionary column, a string in the sorted part of the dictionary is;
         *   - any other non-string is not.
         */
        const valueIsInDictionary = (v, columnIndex) => {

            if (v == null) return true;

            // Numbers are already-compressed indexes, and any other non-string is not a dictionary
            // entry, so neither is looked up.
            if (typeof v !== "string") return false;

            if (v.trim() === "") return true;

            if (hasEpochColumns && isEpochColumn(columnIndex)) {

                return v === Ren.NullSentinel ||
                    parseEpochMilliseconds(v, valueEncodings[columnIndex]) !== null;
            }

            // Answered without searching, for the reason given at firstOrdinalIndex.
            if (v === Ren.NullSentinel) return dict[0] === v;

            return Ren.ArrayUtils.binarySearch(
                dict,
                v,
                firstOrdinalIndex,
                state.sortedLength
            ) >= 0;
        };

        const updateTabularData = (newTabularData) => {

            return Ren.CompressionDictionary(
                dict,
                newTabularData.IsColumnCompressed,
                newTabularData.ColumnValueEncodings
            );
        };

        return {
            compressValue,
            internDerivedValue,
            markIfAppended,
            decompressValue,
            compressedValuesThatAreNullOrWhitespace,
            valueIsInDictionary,
            isEpochColumn,
            updateTabularData,

            // Gets the number of entries in the dictionary.  Compressed values are indexes in
            // [0, dictionarySize).  Read through a getter because interning a derived value grows
            // the dictionary.
            get dictionarySize() { return isArray ? dict.length : 0; },

            // Gets the number of entries that are in the dictionary's sorted order - those the
            // data arrived with.  Two compressed values below this can be compared with each other
            // to order them ordinally; one at or above it is a derived value appended out of
            // order.
            get sortedDictionarySize() { return state.sortedLength; }
        };
    };
})();
