const { createTabularData } = require("./helpers/tabular-data");

const REGION_COLUMN_INDEX = 1;

describe("Grouping sort orders", () => {

    let tabularData;

    beforeEach(() => {

        tabularData = createTabularData(
            ["Region", "Manager", "Sales"],
            [
                ["North", "Bea", 10],
                ["South", "Al", 30],
                ["East", "Al", 10],
                ["West", "Cy", 5],
                ["North", "Bea", 5]
            ]
        );
    });

    /**
     * Groups by region with the given sort order, and gets the regions in the order they'd be
     * shown.  The sort only shows in the rows' display positions, which derived settings don't
     * track, so these are settings that would be rendered.
     */
    const createSettings = (sortOrder) => {

        const settings = Ren.DataGroupingSettingsFactory.createDataGroupingSettings(
            tabularData,
            { dataGroupingSettingsGroup: "test" },
            new Set(),
            true
        );

        settings.sortFilterGroup.applyGroupings({
            entries: [{
                groupByColumns: ["Region"],
                columns: {
                    Manager: { aggregationType: "First" },
                    Sales: { aggregationType: "Sum" }
                },
                sortOrder
            }]
        });

        return settings;
    };

    /**
     * Gets the regions in the order the given settings show them.
     */
    const readShownRegionOrder = (settings) => {

        const decompressValue = tabularData.CompressionDictionary.decompressValue;
        const shownGroups = [];

        settings.groupings.secondToLastGrouping().groups().forEach((group) => {

            shownGroups.push({
                region: decompressValue(
                    group.groupValues.get(group.position, REGION_COLUMN_INDEX),
                    REGION_COLUMN_INDEX
                ),
                y: settings.rowYs[group.groupRowIndex + tabularData.HeadingCount]
            });
        });

        shownGroups.sort((a, b) => a.y - b.y);

        return shownGroups.map((shownGroup) => shownGroup.region);
    };

    const readRegionOrder = (sortOrder) => readShownRegionOrder(createSettings(sortOrder));

    test("sortOrder_ByTheGroupColumn_SortsAlphabetically", () => {

        expect(readRegionOrder({ column: "Region", isDescending: false }))
            .toEqual(["East", "North", "South", "West"]);
    });

    test("sortOrder_Descending_ReversesTheOrder", () => {

        expect(readRegionOrder({ column: "Region", isDescending: true }))
            .toEqual(["West", "South", "North", "East"]);
    });

    test("sortOrder_ByAnAggregate_SortsNumerically", () => {

        // North's 15 would sort after South's 30 as text.
        expect(readRegionOrder({ column: "Sales", isDescending: true }))
            .toEqual(["South", "North", "East", "West"]);
    });

    test("sortOrder_ThenBy_BreaksTies", () => {

        // South and East share Al, so their sales decide between them.
        expect(readRegionOrder({
            column: "Manager",
            isDescending: false,
            thenBy: [{ column: "Sales", isDescending: false }]
        })).toEqual(["East", "South", "North", "West"]);
    });

    test("sortOrder_ThenByDescending_BreaksTiesTheOtherWay", () => {

        expect(readRegionOrder({
            column: "Manager",
            isDescending: false,
            thenBy: [{ column: "Sales", isDescending: true }]
        })).toEqual(["South", "East", "North", "West"]);
    });

    test("sortOrder_AfterAGroupCalcFunctionIsSet_IsKept", () => {

        const settings = createSettings({ column: "Sales", isDescending: true });
        const regionGrouping = settings.groupings.secondToLastGrouping();

        // Setting a calc function rebuilds the groupings, and expanding a group lays them out
        // again: the order shown must still be the sort's rather than the groups' natural one.
        settings.setCalcFunction(
            tabularData.findColumnIndex("Manager"),
            regionGrouping.firstGroup().groupRowIndex,
            { name: "string-length" }
        );
        settings.sortFilterGroup.expandGroup(settings.groupings.secondToLastGrouping().firstGroup());

        expect(readShownRegionOrder(settings)).toEqual(["South", "North", "East", "West"]);
    });
});
