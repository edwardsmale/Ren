(function (Ren) {

    Ren.GroupingsAdder_CreateGrouping = function (groupingFactory) {

        return function createGrouping(
            groupByColumnIndexes,
            newGrouping,
            groupingIndex,
            groupLevel,
            previousGrouping,
            startGroupRowIndex,
            startGroupId,
            structureSlot
        ) {

            if (!previousGrouping) {

                return groupingFactory.createGroupingBasedOnDataRows(
                    groupingIndex,
                    groupByColumnIndexes,
                    groupLevel,
                    startGroupRowIndex,
                    startGroupId,
                    newGrouping.columns,
                    newGrouping.groupByCalcFunctions,
                    newGrouping.filterSet,
                    structureSlot
                );

            }
            else {

                return groupingFactory.createGroupingBasedOnGrouping(
                    groupingIndex,
                    previousGrouping,
                    groupByColumnIndexes,
                    groupLevel,
                    startGroupRowIndex,
                    startGroupId,
                    newGrouping.columns,
                    newGrouping.groupByCalcFunctions,
                    newGrouping.filterSet,
                    structureSlot
                );
            }
        };
    };
})(Ren || (Ren = {}));
