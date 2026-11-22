/**
 * Determines the best position to insert a new grouping into the existing array of groupings.
 * 'Best' is defined as resulting in the fewest groups in the outermost grouping.
 */
Ren.GroupingBestPositionFinder = (dataGroupingSettings, groupingsAdder) => {

    const findBestGroupingPosition = (columnIndexes) => {

        // If there is only one 'real' grouping then we don't need to do the analysis.
        if (dataGroupingSettings.groupings.entries.length < 2) return 0;

        let bestPosition;
        let bestScore;

        for (let i = 0; i < dataGroupingSettings.groupings.entries.length; i++) {

            const entries = dataGroupingSettings.groupings.entries.slice(); // Clone the array.

            // Adds the grouping to the 'actual' grouping entries array in dataGroupingSettings.
            groupingsAdder.addGrouping(columnIndexes, null, i);

            // The fewer groups in the outermost grouping, the better the position.
            const score = -dataGroupingSettings.groupings.firstGroupOfOutermostGrouping().containedGroups.size;

            if (score > bestScore || i === 0) {

                bestScore = score;
                bestPosition = i;
            }

            dataGroupingSettings.groupings.entries.length = 0;

            for (let j = 0; j < entries.length; j++) {

                dataGroupingSettings.groupings.entries.push(entries[j]);
            }
        }

        return bestPosition;
    };

    return {
        findBestGroupingPosition
    };
};
