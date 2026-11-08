const { createSalesTabularData } = require("./helpers/tabular-data");

const REGION_COLUMN_INDEX = 1;
const PRODUCT_COLUMN_INDEX = 2;
const SALES_COLUMN_INDEX = 3;
const ORDER_DATE_COLUMN_INDEX = 4;

describe("DerivedDataGroupingSettings", () => {

    const Grouping = Ren.DerivedDataGroupingSettings;

    let tabularData;

    beforeEach(() => {

        tabularData = createSalesTabularData();
    });

    const groupByRegion = (columns, totalColumns) => Grouping.create({
        tabularData,
        namePrefix: "test",
        entries: [{ groupByColumns: ["Region"], columns }],
        totalColumns: totalColumns || {}
    });

    test("create_SumByRegion_TotalsEachRegion", () => {

        const settings = groupByRegion({ Sales: { aggregationType: "Sum" } });

        const sales = Grouping.readAggregatedValuesByGroupValue(
            settings, tabularData, REGION_COLUMN_INDEX, SALES_COLUMN_INDEX
        );

        expect(sales.get("North")).toBe("17");
        expect(sales.get("South")).toBe("25");
        expect(sales.get("East")).toBe(Ren.NullSentinel);
    });

    test("create_AverageByRegion_IgnoresTheMissingFigure", () => {

        const settings = groupByRegion({ Sales: { aggregationType: "Average" } });

        const sales = Grouping.readAggregatedValuesByGroupValue(
            settings, tabularData, REGION_COLUMN_INDEX, SALES_COLUMN_INDEX
        );

        expect(sales.get("North")).toBe("8.5");
        expect(sales.get("East")).toBeNull();
    });

    test("create_CountDistinctByRegion_CountsEachProductOnce", () => {

        const settings = groupByRegion({ Product: { aggregationType: "CountDistinct" } });

        const products = Grouping.readAggregatedValuesByGroupValue(
            settings, tabularData, REGION_COLUMN_INDEX, PRODUCT_COLUMN_INDEX
        );

        expect(products.get("North")).toBe("2");
        expect(products.get("East")).toBe("1");
    });

    test("create_TotalColumns_TotalsEveryRow", () => {

        const settings = groupByRegion(
            { Sales: { aggregationType: "Sum" } },
            { Sales: { aggregationType: "Sum" } }
        );

        expect(Grouping.readTotalValue(settings, tabularData, SALES_COLUMN_INDEX)).toBe("42");
    });

    test("create_ACalcFunction_GroupsByMonth", () => {

        const settings = Grouping.create({
            tabularData,
            namePrefix: "test",
            entries: [{
                groupByColumns: ["OrderDate"],
                groupByCalcFunctions: [{ name: "date-month-start" }],
                columns: { Sales: { aggregationType: "Sum" } }
            }],
            totalColumns: {}
        });

        const sales = Grouping.readAggregatedValuesByGroupValue(
            settings, tabularData, ORDER_DATE_COLUMN_INDEX, SALES_COLUMN_INDEX
        );

        expect([...sales.values()]).toEqual(["17", "5", "20"]);
        expect(Grouping.getGroupByCalcFunctionName(Grouping.getInnermostGroupByEntry(settings)))
            .toBe("date-month-start");
    });
});
