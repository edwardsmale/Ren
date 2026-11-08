/**
 * Functions for working with arrays.
 */
Ren.ArrayUtils = (() => {

    /**
     * Returns the result of appending `secondArray` to `firstArray`, skipping any duplicates.
     */
    const union = function () {

        if (arguments.length === 0) return [];
        if (arguments.length === 1) return arguments[0].slice();

        const seen = new Set(arguments[0]);
        const result = arguments[0].slice();

        for (let i = 1; i < arguments.length; i++) {

            const array = arguments[i];

            for (let j = 0; j < array.length; j++) {

                const sizeBeforeAdd = seen.size;

                seen.add(array[j]);

                if (seen.size !== sizeBeforeAdd) result.push(array[j]);
            }
        }

        return result;
    };

    /**
     * Returns an object where the keys are the elements from the array, and the values are how
     * many times the element occurs in the array.
     */
    const groupByCount = (array) => {

        const result = {};

        for (let i = 0; i < array.length; i++) {

            const elem = array[i];

            result[elem] = (result[elem] || 0) + 1;
        }

        return result;
    };

    /**
     * Returns a Map where the keys are the elements from the array, and the values are how
     * many times the element occurs in the array.
     */
    const groupByCountMap = (array) => {

        const result = new Map();

        for (let i = 0; i < array.length; i++) {

            const elem = array[i];

            result.set(elem, (result.get(elem) || 0) + 1);
        }

        return result;
    };

    /**
     * Takes an object, and swaps its keys with its values.
     */
    const swapKeysWithValues = (obj) => {

        const result = {};

        for (const key in obj) {

            result[obj[key]] = key;
        }

        return result;
    };

    /**
     * Returns the first element of an array.
     */
    const first = (array) => array[0];

    /**
     * Returns the last element of an array.
     */
    const last = (array) => array[array.length - 1];

    /**
     * Returns the second to last element of an array.
     */
    const secondToLast = (array) => array.length >= 2 ? array[array.length - 2] : undefined;

    /**
     * Gets an array with an entry for each of the array of values, giving the index of that value
     * in the array to search, or -1 if the value is not found.
     */
    const getIndexesOf = (arrayOfValues, arrayToSearch) => {

        const indexMap = new Map();

        for (let i = 0; i < arrayToSearch.length; i++) {

            if (!indexMap.has(arrayToSearch[i])) {
                indexMap.set(arrayToSearch[i], i);
            }
        }

        const result = new Array(arrayOfValues.length);

        for (let i = 0; i < arrayOfValues.length; i++) {

            const index = indexMap.get(arrayOfValues[i]);
            result[i] = index !== undefined ? index : -1;
        }

        return result;
    };

    /**
     * Returns an array containing only the distinct values from the input array.
     */
    const distinct = (array) => {

        // Fast path for small arrays where Set overhead might not be worth it
        if (array.length < 10) {

            const result = [];

            for (let i = 0; i < array.length; i++) {

                let found = false;

                for (let j = 0; j < result.length; j++) {

                    if (result[j] === array[i]) { found = true; break; }
                }

                if (!found) result.push(array[i]);
            }

            return result;
        }

        // For larger arrays, use Set for O(n) performance
        return Array.from(new Set(array));
    };

    /**
     * Returns a value indicating whether the array contains only numeric values (either of type
     * "number" or strings representing numbers), nulls, or empty strings.
     */
    const isAllNumeric = (array, selector) => {

        selector = selector || (a => a);

        let allNumber = true, allStringNumber = true;

        for (let i = 0; i < array.length; i++) {

            const a = selector(array[i]);
            if (!(a === null || typeof a === "number")) allNumber = false;

            if (!(a === null || a === "" || (!isNaN(parseFloat(a)) && isFinite(a)))) {
                allStringNumber = false;
            }
        }

        return allNumber || allStringNumber;
    };

    /**
     * Returns a value indicating whether the array contains only Date objects, nulls, or strings
     * that match common date or date-time formats.
     */
    const isAllDatesOrDateTimes = (array, selector) => {

        selector = selector || (a => a);

        let allDate = true;

        for (let i = 0; i < array.length; i++) {

            const a = selector(array[i]);

            if (!(a === null || a instanceof Date)) { allDate = false; break; }
        }

        if (allDate) return true;

        const re1 = /^\d{4}-\d{2}-\d{2}$/;
        const re2 = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
        const re3 = /^\d{2}\/\d{2}\/\d{4}$/;
        const re4 = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/;

        for (let i = 0; i < array.length; i++) {

            const a = selector(array[i]);
            if (a === null || a === "" || a instanceof Date) continue;
            if (!(re1.test(a) || re2.test(a) || re3.test(a) || re4.test(a))) return false;
        }

        return true;
    };

    const DAY_OF_WEEK_INDEXES = {
        monday: 0,
        mon: 0,
        tuesday: 1,
        tue: 1,
        tues: 1,
        wednesday: 2,
        wed: 2,
        thursday: 3,
        thu: 3,
        thur: 3,
        thurs: 3,
        friday: 4,
        fri: 4,
        saturday: 5,
        sat: 5,
        sunday: 6,
        sun: 6
    };

    /**
     * Gets a value's place in the week - 0 for Monday through to 6 for Sunday - or -1 where it is
     * not a day name.  Full names and their usual abbreviations are recognised, in any case.
     */
    const getDayOfWeekIndex = (value) => {

        if (typeof value !== "string") return -1;

        const index = DAY_OF_WEEK_INDEXES[value.trim().toLowerCase()];

        return index === undefined ? -1 : index;
    };

    /**
     * Gets a value indicating whether every value in the array is a day name, ignoring nulls and
     * empty strings.  An array holding no day name at all is not.
     */
    const isAllDaysOfWeek = (array, selector) => {

        selector = selector || (a => a);

        let foundDay = false;

        for (let i = 0; i < array.length; i++) {

            const value = selector(array[i]);

            if (value === null || value === "" || value === undefined) continue;

            if (getDayOfWeekIndex(value) === -1) return false;

            foundDay = true;
        }

        return foundDay;
    };

    /**
     * Sorts an array in place.  Does a numeric or alpha sort depending on the type of the elements.
     *
     * @param {Array} array The array to sort in place.
     * @param {Function} selector Optional function that returns the value to sort by.
     */
    const sortAuto = (array, selector, descending) => {

        selector = selector || (a => a);

        let allNumber = true;
        let allIndexedString = true;

        for (let i = 0; i < array.length; i++) {

            const a = selector(array[i]);

            if (!(a === null || typeof a === "number")) { allNumber = false; }

            if (!(a === null || Ren.IndexedStringUtils.isIndexedString(a))) { allIndexedString = false; }
        }

        if (allNumber) {
            sortNumeric(array, selector, descending);
        }
        else if (allIndexedString) {

            sortNumeric(array, a => Ren.IndexedStringUtils.getIndex(selector(a)) || 0, descending);
        }
        else {

            let allNumbers = true;

            for (let i = 0; i < array.length; i++) {

                const value = selector(array[i]);

                if (value === "" || value === null) continue;

                const parsed = parseFloat(value);

                if (isNaN(parsed) || !isFinite(value)) {

                    allNumbers = false;
                    break;
                }
            }

            if (allNumbers) {

                // Blanks sort as nulls do in an all-number column, rather than as NaN, which would
                // make the comparison inconsistent.
                sortNumeric(
                    array,
                    a => {

                        const value = selector(a);
                        return value === "" || value === null ? null : parseFloat(value);
                    },
                    descending
                );
            }
            else if (isAllDaysOfWeek(array, selector)) {

                // A column of day names reads as a week, so it sorts Monday first rather than
                // alphabetically.
                sortNumeric(array, a => getDayOfWeekIndex(selector(a)), descending);
            }
            else {

                // Values making up one of the config's custom sort orders sort in that order.
                const getIndex = Ren.CustomSortOrders.findIndexGetter(array, selector);

                if (getIndex) {
                    sortNumeric(array, a => getIndex(selector(a)), descending);
                }
                else {

                    sortAlpha(array, selector, descending);
                }
            }
        }
    };

    // The compare functions are passed the selected sort values themselves, not decorated wrappers
    // around them (see schwartzianSort).

    /**
     * Compares two values ordinally - by the code units of their string forms, as the < and >
     * operators compare strings.
     *
     * Ordinal is the order the server sorts a compression dictionary in, so a compressed column can
     * be sorted by its values' places in that dictionary.  It is case-sensitive: every capital
     * sorts ahead of every lower-case letter.
     */
    const compareOrdinal = (a, b) => {

        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    };

    const compareOrdinal_Descending = (a, b) => {

        return compareOrdinal(b, a);
    };

    /**
     * Shared implementation of the Schwartzian transform (decorate-sort-undecorate) pattern.
     * Applies the selector once per element, sorts using the given compare function, then writes
     * back to the original array in place.
     *
     * The decoration is held as two parallel arrays - the selected values, and a permutation of the
     * element positions - rather than as a wrapper object per element, which on the row-level sorts
     * was the largest single source of garbage in a re-render.  The sort is stable, which the
     * multi-level sorts rely on.
     */
    const schwartzianSort = (array, selector, compareFunction) => {

        const length = array.length;

        const values = new Array(length);
        const order = new Array(length);

        for (let i = 0; i < length; i++) {

            values[i] = selector(array[i]);
            order[i] = i;
        }

        order.sort((a, b) => compareFunction(values[a], values[b]));

        // order[i] is now the position the element that belongs at i came from, so gather the
        // elements in that order and write them back.
        const gathered = new Array(length);

        for (let i = 0; i < length; i++) {
            gathered[i] = array[order[i]];
        }

        for (let i = 0; i < length; i++) {
            array[i] = gathered[i];
        }
    };

    /**
     * Sorts an array in place numerically.  Also works for dates.
     *
     * @param {Array} array The array to sort in place.
     * @param {Function} selector Optional function that returns the value to sort by.
     * @param {boolean} descending Indicates whether to sort in descending order.
     * @return {Array} The sorted array (for convenience).
     */
    const sortNumeric = (array, selector, descending) => {

        selector = selector || (a => a);

        schwartzianSort(array, selector, (a, b) => !descending ? a - b : b - a);

        return array;
    };

    /**
     * Sorts an array in place alphabetically, comparing ordinally (see compareOrdinal).
     *
     * @param {Array} array The array to sort in place.
     * @param {Function} selector Optional function that returns the value to sort by.
     */
    const sortAlpha = (array, selector, descending) => {

        selector = selector || (a => a);

        schwartzianSort(array, selector, !descending ? compareOrdinal : compareOrdinal_Descending);
    };

    /**
     * Performs a binary search on a sorted array.  If the element is found, returns its index.
     * If the element is not found, returns the bitwise complement of the index at which the
     * element should be inserted to maintain the array's sorted order.
     *
     * startIndex and endIndex (exclusive) limit the search to part of the array, for one whose
     * leading or trailing entries are not in the order the rest of it is sorted in.
     */
    const binarySearch = (arr, element, startIndex, endIndex) => {

        let low = startIndex ?? 0;
        let high = (endIndex ?? arr.length) - 1;

        while (low <= high) {

            // Use bitwise shift for integer division by 2
            const mid = low + ((high - low) >> 1);
            const midVal = arr[mid];

            if (element > midVal) {
                low = mid + 1;
            }
            else if (element < midVal) {

                high = mid - 1;
            }
            else {

                return mid;
            }
        }
        return ~low;
    };

    /**
     * Converts a one-based index, or an array of them, to zero-based.  A number or numeric string
     * is decremented by 1, and an array is copied with each element decremented by 1.  Any other
     * value is returned unchanged.
     */
    const convertToZeroBased = (value) => {

        if (typeof value === "number") return value - 1;

        if (typeof value === "string") {

            const parsed = parseInt(value);
            return isNaN(parsed) ? value : parsed - 1;
        }

        if (Array.isArray(value)) {

            const result = new Array(value.length);
            for (let i = 0; i < value.length; i++) result[i] = value[i] - 1;
            return result;
        }
        return value;
    };

    /**
     * Appends every element of `items` to `array`, in order, and returns `array`, without building
     * a further array to throw away as spread and concat do.
     */
    const pushAll = (array, items) => {

        for (let i = 0; i < items.length; i++) {

            array.push(items[i]);
        }

        return array;
    };

    /**
     * Removes from the passed array the first occurrence that matches the predicate.
     */
    const removeElement = (array, predicate) => {

        for (let i = 0; i < array.length; i++) {

            if (predicate(array[i])) {

                array.splice(i, 1);
                break;
            }
        }
    };

    /**
     * If the passed argument is an array, returns the first element.  Otherwise, returns the
     * argument itself.
     */
    const singleValue = (possibleArray) => {

        return Array.isArray(possibleArray) ? possibleArray[0] : possibleArray;
    };

    /**
     * Returns the value as an array.  If the value is already an array, it is returned unchanged.
     * If the value is null or undefined, an empty array is returned.  If the value is a string,
     * an array containing that string is returned.  If the value is an iterable, it is converted
     * to an array.  Otherwise, an array containing the value is returned.
     */
    const ensureArray = (value) => {

        if (Array.isArray(value)) return value;
        if (value == null) return [];
        if (typeof value === "string") return [value];

        if (typeof value.length === "number" && value.length >= 0 && typeof value !== "function") {

            try {
                return Array.prototype.slice.call(value);
            }
            catch (e) {

            }
        }

        if (value[Symbol.iterator]) {

            const result = [];
            const iter = value[Symbol.iterator]();
            let next = iter.next();

            while (!next.done) { result.push(next.value); next = iter.next(); }
            return result;
        }

        return [value];
    };

    /**
     * Returns the first value wrapped in a single-element array, or null if no values exist.
     */
    const firstAsArrayOrNull = (value) => {

        const values = ensureArray(value);
        return values.length > 0 ? [values[0]] : null;
    };

    /**
     * Returns the largest of accessor's values for the array's elements, ignoring nulls and NaNs,
     * or undefined if there are none.
     */
    const max = (array, accessor) => {

        let result;

        for (let i = 0; i < array.length; i++) {

            const value = accessor(array[i], i);

            if (value != null && (result < value || (result === undefined && value >= value))) {
                result = value;
            }
        }

        return result;
    };

    /**
     * Returns [smallest, largest] of accessor's values for the array's elements, ignoring nulls
     * and NaNs, or [undefined, undefined] if there are none.
     */
    const extent = (array, accessor) => {

        let smallest;
        let largest;

        for (let i = 0; i < array.length; i++) {

            const value = accessor(array[i], i);

            if (value == null) continue;

            if (smallest === undefined) {

                if (value >= value) {

                    smallest = value;
                    largest = value;
                }
            }
            else {

                if (smallest > value) smallest = value;
                if (largest < value) largest = value;
            }
        }

        return [smallest, largest];
    };

    /**
     * Returns the maximum value in the array, ignoring nulls and undefined values.  If there are
     * no non-null values, returns 0.
     */
    const maxValue = (array) => {

        let max = null;

        for (let i = 0; i < array.length; i++) {
            if (array[i] != null && (max === null || array[i] > max)) max = array[i];
        }
        return max === null ? 0 : max;
    };

    /**
     * Returns the minimum value in the array, ignoring nulls and undefined values.  If there are
     * no non-null values, returns 0.
     */
    const minValue = (array) => {

        let min = null;

        for (let i = 0; i < array.length; i++) {
            if (array[i] != null && (min === null || array[i] < min)) min = array[i];
        }
        return min === null ? 0 : min;
    };

    /**
     * Returns a value indicating whether the array contains only strings that represent numeric
     * values.
     */
    const isArrayOfNumericStrings = (strArray) => {

        for (let i = 0; i < strArray.length; i++) {

            const value = strArray[i];
            if (!(typeof value === "string" && Ren.TextUtils.isStringNumeric(value))) return false;
        }
        return true;
    };

    /**
     * Returns a value indicating whether the array contains only entries of type "number".
     */
    const isArrayOfNumbers = (array) => {

        for (let i = 0; i < array.length; i++) {
            if (typeof array[i] !== "number") return false;
        }
        return true;
    };

    /**
     * Adds any missing keys to each object in the array to ensure that every object in the array
     * has all of the keys that are present in any of the objects in the array.
     */
    const makeObjectKeysConsistent = (arrayOfObjects) => {

        if (arrayOfObjects.length === 0) return;

        // Get all the keys of all the objects in the array.

        const allKeys = new Set();

        for (let i = 0; i < arrayOfObjects.length; i++) {

            const obj = arrayOfObjects[i];
            for (const key in obj) allKeys.add(key);
        }

        // Go through the objects again and add any missing keys with null values.
        const allKeysArr = Array.from(allKeys);

        for (let i = 0; i < arrayOfObjects.length; i++) {

            const obj = arrayOfObjects[i];

            for (let j = 0; j < allKeysArr.length; j++) {
                if (obj[allKeysArr[j]] === undefined) obj[allKeysArr[j]] = null;
            }
        }
    };

    /**
     * Returns true if the two arrays contain the same elements in the same order.
     */
    const areArraysEqual = (array1, array2) => {

        if (array1.length !== array2.length) return false;

        for (let i = 0; i < array1.length; i++) {
            if (array1[i] !== array2[i]) return false;
        }

        return true;
    };

    /**
     * Returns true if the two arrays contain the same elements, regardless of order.
     */
    const containsAllValues = (array1, array2) => {

        const set1 = new Set(array1);
        const set2 = new Set(array2);

        if (set1.size !== set2.size) return false;

        for (let i = 0; i < array1.length; i++) {
            if (!set2.has(array1[i])) return false;
        }

        return true;
    };

    /**
     * Flattens potentially nested arrays into a single-level array.
     */
    const flattenArray = (array) => {

        const result = [];

        for (let i = 0; i < array.length; i++) {

            const val = array[i];

            if (Array.isArray(val)) {

                const flat = flattenArray(val);
                for (let j = 0; j < flat.length; j++) result.push(flat[j]);
            }
            else {

                result.push(val);
            }
        }
        return result;
    };

    return {
        areArraysEqual,
        binarySearch,
        compareOrdinal,
        containsAllValues,
        convertToZeroBased,
        distinct,
        ensureArray,
        extent,
        firstAsArrayOrNull,
        first,
        flattenArray,
        getDayOfWeekIndex,
        getIndexesOf,
        groupByCount,
        groupByCountMap,
        isAllDatesOrDateTimes,
        isAllDaysOfWeek,
        isAllNumeric,
        isArrayOfNumbers,
        isArrayOfNumericStrings,
        last,
        makeObjectKeysConsistent,
        max,
        maxValue,
        minValue,
        pushAll,
        removeElement,
        secondToLast,
        singleValue,
        sortAlpha,
        sortAuto,
        sortNumeric,
        swapKeysWithValues,
        union
    };
})();
