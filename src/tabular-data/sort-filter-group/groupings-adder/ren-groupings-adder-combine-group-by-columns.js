/**
 * Gets the columns each of a list of groupings, innermost first, actually groups by, along with the
 * calc function for each: a grouping also groups by every column of the groupings outside it.
 */
Ren.GroupingsAdder_combineGroupByColumns = (newGroupings) => {

    const groupCount = newGroupings.length;
    const combinedIndexesArr = new Array(groupCount);
    const combinedCalcFunctionsArr = new Array(groupCount);
    const seenColumnIndexes = new Set();
    const calcFunctionsByGroupingAndColumn = new Map();
    const sortNumeric = Ren.ArrayUtils.sortNumeric;

    for (let i = groupCount - 1; i >= 0; i--) {

        const groupByIndexes = newGroupings[i].groupByColumnIndexes;
        const groupByCalcFunctions = newGroupings[i].groupByCalcFunctions;

        const thisGroupingCalcFunctions = new Map();

        for (let j = 0, len = groupByIndexes.length; j < len; j++) {

            const columnIndex = groupByIndexes[j];
            seenColumnIndexes.add(columnIndex);

            if (groupByCalcFunctions && groupByCalcFunctions[j]) {
                thisGroupingCalcFunctions.set(columnIndex, groupByCalcFunctions[j]);
            }
        }

        calcFunctionsByGroupingAndColumn.set(i, thisGroupingCalcFunctions);

        if (seenColumnIndexes.size > 1) {

            const arr = Array.from(seenColumnIndexes);
            const sortedArr = sortNumeric(arr);
            combinedIndexesArr[i] = sortedArr;

            const ownColumnIndexes = new Set(groupByIndexes);

            combinedCalcFunctionsArr[i] = sortedArr.map(columnIndex => {

                // A column this grouping names is grouped exactly as it says, so that a grouping
                // by a column's raw value beneath a parent binning the same column does not
                // inherit the binning and collapse into it.  Only a column gained by cumulation
                // takes its calc function from the parent introducing it.
                if (ownColumnIndexes.has(columnIndex)) {
                    return thisGroupingCalcFunctions.get(columnIndex) ?? null;
                }

                for (let groupingIndex = i + 1; groupingIndex < groupCount; groupingIndex++) {

                    const groupingCalcFunctions = calcFunctionsByGroupingAndColumn.get(groupingIndex);

                    if (groupingCalcFunctions && groupingCalcFunctions.has(columnIndex)) {
                        return groupingCalcFunctions.get(columnIndex);
                    }
                }
                return null;
            });
        }
        else {

            combinedIndexesArr[i] = Array.from(seenColumnIndexes);
            combinedCalcFunctionsArr[i] = thisGroupingCalcFunctions.size > 0 ?
                Array.from(thisGroupingCalcFunctions.values()) : null;
        }
    }

    return { combinedIndexesArr, combinedCalcFunctionsArr };
};
