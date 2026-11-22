/**
 * Checks that data grouping settings make sense given the tabular data.
 */
Ren.DataGroupingSettingsValidator = (() => {

    /**
     * Returns true if any groupByColumn in the grouping does not exist in tabularData.
     * @param {Object} tabularData - The tabular data object.
     * @param {Object} grouping - The grouping to check.
     * @returns {boolean} True if any column does not exist.
     */
    const groupingHasNonexistentColumns = (tabularData, grouping) => {

        if (grouping.isOutermostGrouping) return false;

        const groupByColumnIndexes = tabularData.columnResolver.getColumnIndexes(
            grouping.groupByColumns
        );

        for (let i = 0, len = groupByColumnIndexes.length; i < len; i++) {
            if (groupByColumnIndexes[i] === null) return true;
        }

        return false;
    };

    /**
     * Checks that data grouping settings make sense given the tabular data.  Returns an array of
     * errors if the settings are invalid, or true if they are valid.
     * @param {Object} dataGroupingSettings - The settings to validate.
     * @param {Object} tabularData - The tabular data object.
     * @returns {true|string[]} True if valid, or an array of error messages.
     */
    const validateDataGroupingSettings = (dataGroupingSettings, tabularData) => {

        const errors = [];

        // Settings may omit the groupings block entirely (e.g. hand-authored test fixtures).
        // Normalise a missing block to an empty one so it behaves like empty entries rather
        // than crashing, which would leave the loading spinner showing forever.
        if (!dataGroupingSettings.groupings) {

            dataGroupingSettings.groupings = { entries: [] };
        }
        else if (!dataGroupingSettings.groupings.entries) {

            dataGroupingSettings.groupings.entries = [];
        }

        const groupings = dataGroupingSettings.groupings.entries;
        const resolver = tabularData.columnResolver;

        if (groupings.length === 0) {

            groupings.push({
                groupByColumns: [],
                isOutermostGrouping: true
            });
        }

        if (dataGroupingSettings.tabularData) {

            if (dataGroupingSettings.tabularData !== tabularData) {
                errors.push("Data grouping settings do not belong to the specified tabular data.");
            }

            for (let groupingIndex = 0, glen = groupings.length; groupingIndex < glen; groupingIndex++) {

                const grouping = groupings[groupingIndex];

                if (groupingHasNonexistentColumns(tabularData, grouping)) {

                    errors.push(
                        "Grouping at index " + groupingIndex +
                        " contains group-by columns that do not exist in the tabular data: " +
                        JSON.stringify(grouping.groupByColumns) + " \n" +
                        "Tabular data columns: " + JSON.stringify(resolver.getColumnIdsOrHeadings())
                    );
                }
            }
        }

        return errors.length > 0 ? errors : true;
    };

    return {
        validateDataGroupingSettings
    };
})();
