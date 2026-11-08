(function (Ren) {

    Ren.GroupingsAdder_GroupMatchesOuterFilter = function (tabularData) {

        // negatedColumns names the filters whose values are the excluded ones rather than the
        // allowed ones (see Ren.FilterNegation); it is empty for the ordinary, positive case.
        // Compiled once per grouping, so each column's values are looked up rather than scanned.
        return function createGroupMatchesOuterFilter(filterColumns, negatedColumns) {

            const columnIndexes = [];
            const matchers = [];

            for (const columnIdOrHeading in filterColumns) {

                const filterValues = filterColumns[columnIdOrHeading];
                if (!Array.isArray(filterValues)) continue;
                const columnIndex = tabularData.columnResolver.getColumnIndex(columnIdOrHeading);
                if (columnIndex == null) continue;

                const isNegated = !!negatedColumns?.has(columnIdOrHeading);

                columnIndexes.push(columnIndex);
                matchers.push(Ren.FilterNegation.createValueMatcher(filterValues, isNegated));
            }

            return function groupMatchesOuterFilter(group) {

                for (let i = 0; i < columnIndexes.length; i++) {

                    const columnIndex = columnIndexes[i];

                    // A group's values are compressed where possible, so decompress to compare.
                    const groupValue = tabularData.CompressionDictionary.decompressValue(
                        group.groupValues.get(group.position, columnIndex),
                        columnIndex
                    );

                    const groupValueStr =
                        (groupValue == null || groupValue === "") ? "" : String(groupValue);

                    if (!matchers[i](groupValueStr)) {
                        return false;
                    }
                }
                return true;
            };
        };
    };
})(Ren || (Ren = {}));
