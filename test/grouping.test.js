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

describe("Calc functions that change a column's kind of value", () => {

    const Grouping = Ren.DerivedDataGroupingSettings;
    const Format = Ren.SpreadsheetColumnFormatEnum;

    let tabularData;

    beforeEach(() => {

        tabularData = createSalesTabularData();
    });

    // Product's lengths: Pens 4, Paper 5, Ink 3.
    const groupProductLengthsByRegion = (aggregationType) => Grouping.create({
        tabularData,
        namePrefix: "test",
        prepare: (settings) =>
            settings.setDataRowsCalcFunction("Product", { name: "string-length" }),
        entries: [{ groupByColumns: ["Region"], columns: { Product: { aggregationType } } }],
        totalColumns: {}
    });

    const readProductLengthsByRegion = (settings) => Grouping.readAggregatedValuesByGroupValue(
        settings, tabularData, REGION_COLUMN_INDEX, PRODUCT_COLUMN_INDEX
    );

    test("create_SumOfStringLengthsByRegion_AddsTheLengths", () => {

        const lengths = readProductLengthsByRegion(groupProductLengthsByRegion("Sum"));

        expect(lengths.get("North")).toBe("9");
        expect(lengths.get("South")).toBe("7");
        expect(lengths.get("East")).toBe("5");
    });

    test("create_AverageOfStringLengthsByRegion_AveragesTheLengths", () => {

        const lengths = readProductLengthsByRegion(groupProductLengthsByRegion("Average"));

        expect(lengths.get("North")).toBe("4.5");
    });

    test("create_MaxOfStringLengthsByRegion_ComparesTheLengthsAsNumbers", () => {

        const lengths = readProductLengthsByRegion(groupProductLengthsByRegion("Max"));

        expect(String(lengths.get("South"))).toBe("4");
    });

    test("create_SumOfStringLengths_GivesTheGroupingAnIntegerFormat", () => {

        const settings = groupProductLengthsByRegion("Sum");
        const entry = Grouping.getInnermostGroupByEntry(settings);

        expect(entry.columns.Product.valueFormat).toBe(Format.Integer);
    });

    // The Region grouping's entry, as the format menu reads its formats.
    const getRegionEntry = (settings) => settings.groupings.entries.find((entry) =>
        entry.groupByColumnIndexes.length === 1 &&
        entry.groupByColumnIndexes[0] === REGION_COLUMN_INDEX);

    // A calc function on the grouping, as choosing one on a group row sets.
    const groupProductsByRegionCalculatingLengths = (aggregationType) => Grouping.create({
        tabularData,
        namePrefix: "test",
        entries: [{
            groupByColumns: ["Region"],
            columns: { Product: { aggregationType, calcFunction: [{ name: "string-length" }] } }
        }],
        totalColumns: {}
    });

    test("create_GroupingCalculatesLengthsAndSums_AddsTheLengths", () => {

        const lengths =
            readProductLengthsByRegion(groupProductsByRegionCalculatingLengths("Sum"));

        expect(String(lengths.get("North"))).toBe("9");
        expect(String(lengths.get("South"))).toBe("7");
        expect(String(lengths.get("East"))).toBe("5");
    });

    test("create_GroupingCalculatesLengthsAndTakesMax_ComparesTheLengths", () => {

        const lengths =
            readProductLengthsByRegion(groupProductsByRegionCalculatingLengths("Max"));

        expect(String(lengths.get("South"))).toBe("4");
    });

    // The function is about the products, and a count isn't one, so it is left out rather than
    // taking the count's length.
    test("create_GroupingCalculatesLengthsAndCounts_ShowsTheCounts", () => {

        const settings = groupProductsByRegionCalculatingLengths("Count");
        const counts = readProductLengthsByRegion(settings);

        expect(String(counts.get("North"))).toBe("2");
        expect(getRegionEntry(settings).columns.Product.valueFormat).toBe(Format.Integer);
    });

    test("create_GroupingCalculatesLengthsAndCountsDistinct_ShowsTheCounts", () => {

        const counts =
            readProductLengthsByRegion(groupProductsByRegionCalculatingLengths("CountDistinct"));

        expect(String(counts.get("North"))).toBe("2");
    });

    // Grouped by the lengths of the products within each region, as binning a grouping by string
    // length does, so the region rows aggregate the lengths too.
    test("create_GroupedByLengthsInsideRegionsSummed_AddsTheLengths", () => {

        const settings = Grouping.create({
            tabularData,
            namePrefix: "test",
            entries: [
                { groupByColumns: ["Product"], groupByCalcFunctions: [{ name: "string-length" }] },
                { groupByColumns: ["Region"], columns: { Product: { aggregationType: "Sum" } } }
            ],
            totalColumns: {}
        });

        const lengths = readProductLengthsByRegion(settings);

        expect(String(lengths.get("North"))).toBe("9");
        expect(String(lengths.get("South"))).toBe("7");
    });

    // The same with the calc function on the grouping's group-by column, which changes the value
    // each group shows, as choosing one on the group row sets; and with a grouping inside that one
    // also grouping by Product, without the function.
    test("create_GroupingShowsLengthsInsideRegionsSummed_AddsTheLengths", () => {

        const settings = Grouping.create({
            tabularData,
            namePrefix: "test",
            entries: [
                { groupByColumns: ["Region", "Product", "OrderDate"] },
                {
                    groupByColumns: ["Region", "Product"],
                    columns: { Product: { calcFunction: [{ name: "string-length" }] } }
                },
                { groupByColumns: ["Region"], columns: { Product: { aggregationType: "Sum" } } }
            ],
            totalColumns: {}
        });

        const lengths = readProductLengthsByRegion(settings);

        expect(String(lengths.get("North"))).toBe("9");
        expect(String(lengths.get("South"))).toBe("7");
    });

    test("create_GroupingCalculatesLengthsAndAverages_GivesANumberFormat", () => {

        const settings = groupProductsByRegionCalculatingLengths("Average");
        const productColumn = getRegionEntry(settings).columns.Product;

        // A whole number's format would show the averages without their decimals.
        expect(productColumn.valueFormat).toBe(Format.Number);
        expect(productColumn.aggregatedValueFormat).toBe(Format.General);
    });

    test("create_GroupingShowsLengthsInsideRegionsAveraged_GivesANumberFormat", () => {

        const settings = Grouping.create({
            tabularData,
            namePrefix: "test",
            entries: [
                {
                    groupByColumns: ["Region", "Product"],
                    columns: { Product: { calcFunction: [{ name: "string-length" }] } }
                },
                { groupByColumns: ["Region"], columns: { Product: { aggregationType: "Average" } } }
            ],
            totalColumns: {}
        });

        expect(getRegionEntry(settings).columns.Product.valueFormat).toBe(Format.Number);
    });

    test("getCalcFunctionsValueFormat_NamesTheFormatTheOutputLineGives", () => {

        const getFormat = Ren.FunctionTags.getCalcFunctionsValueFormat;

        expect(getFormat([{ name: "string-length" }], Format.General)).toBe(Format.Integer);
        expect(getFormat([{ name: "bin-10" }], Format.Number)).toBe(Format.General);
        expect(getFormat([{ name: "bin-date-month" }], Format.DateTime)).toBe(Format.DateTime);
        expect(getFormat([{ name: "first-letter" }], Format.General)).toBeNull();
        expect(getFormat(["return value.length;"], Format.General)).toBeNull();
    });
});
