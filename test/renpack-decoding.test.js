const { ENCODING, SCALE_CODE, writeRenPack } = require("./helpers/renpack-writer");

const MILLISECONDS_PER_DAY = 86400000;

/**
 * Gets the metadata of a collection with one tab per entry of columnCounts, each with that many
 * columns.
 */
const createMetadata = (columnCounts) => ({
    TabularDataSets: [{
        Title: "Sales",
        TabularDatas: columnCounts.map((columnCount, tabIndex) => ({
            Title: "Tab " + tabIndex,
            ColumnModels: new Array(columnCount).fill(null).map((_, columnIndex) => ({
                Heading: "Column " + columnIndex
            }))
        }))
    }]
});

/**
 * Decodes a renpack body and unpacks it as the page would, returning the collection.
 */
const decodeAndUnpack = (buffer) => {

    const collection = Ren.DataSourceDecoding.decodeRenPack(buffer).collection;

    Ren.DataSourceParseWorker.unpackCollection(collection);

    return collection;
};

/**
 * Gets a tab's rows as plain arrays, since a row without nulls is a Float64Array view.
 */
const readRows = (tabularData) => tabularData.RowModels.map((row) => Array.from(row.CV));

describe("DataSourceDecoding.decodeRenPack", () => {

    test("decodeRenPack_ASimpleTab_RebuildsTheRows", () => {

        const collection = decodeAndUnpack(writeRenPack(
            createMetadata([2]),
            ["East", "North"],
            [
                { encoding: ENCODING.UINT8, values: [1, 0, 1] },
                { encoding: ENCODING.FLOAT64, values: [1.5, -2, 1e10] }
            ]
        ));

        const tabularData = collection.TabularDataSets[0].TabularDatas[0];

        expect(collection.CompressionDictionary).toEqual(["East", "North"]);
        expect(tabularData.Title).toBe("Tab 0");
        expect(readRows(tabularData)).toEqual([[1, 1.5], [0, -2], [1, 1e10]]);
    });

    test("decodeRenPack_EachEncoding_ReadsItsValues", () => {

        const collection = decodeAndUnpack(writeRenPack(
            createMetadata([4]),
            [],
            [
                { encoding: ENCODING.UINT16, values: [65535, 0] },
                { encoding: ENCODING.UINT32, values: [4294967295, 1] },
                { encoding: ENCODING.INT32, values: [-2147483648, 7] },
                { encoding: ENCODING.FLOAT64, values: [0.1, Number.MAX_VALUE] }
            ]
        ));

        expect(readRows(collection.TabularDataSets[0].TabularDatas[0])).toEqual([
            [65535, 4294967295, -2147483648, 0.1],
            [0, 1, 7, Number.MAX_VALUE]
        ]);
    });

    test("decodeRenPack_Nulls_AreRestoredInPlace", () => {

        const values = [];

        // Enough rows for the null bitset to need more than one byte.
        for (let i = 0; i < 10; i++) {
            values.push(i === 2 || i === 9 ? null : i);
        }

        const collection = decodeAndUnpack(writeRenPack(
            createMetadata([2]),
            [],
            [
                { encoding: ENCODING.INT32, values },
                { encoding: ENCODING.UINT8, values: new Array(10).fill(3) }
            ]
        ));

        const rows = collection.TabularDataSets[0].TabularDatas[0].RowModels;

        expect(rows[2].CV).toEqual([null, 3]);
        expect(rows[9].CV).toEqual([null, 3]);
        expect(Array.from(rows[3].CV)).toEqual([3, 3]);
    });

    test("decodeRenPack_ScaledColumns_AreMultipliedBack", () => {

        const collection = decodeAndUnpack(writeRenPack(
            createMetadata([2]),
            [],
            [
                { encoding: ENCODING.INT32, scaleCode: SCALE_CODE.DAYS, values: [19782] },
                { encoding: ENCODING.UINT32, scaleCode: SCALE_CODE.SECONDS, values: [1709211845] }
            ]
        ));

        expect(readRows(collection.TabularDataSets[0].TabularDatas[0])).toEqual([
            [19782 * MILLISECONDS_PER_DAY, 1709211845000]
        ]);
    });

    test("decodeRenPack_SeveralTabs_TakeTheirOwnColumns", () => {

        const collection = decodeAndUnpack(writeRenPack(
            createMetadata([1, 2]),
            [],
            [
                { encoding: ENCODING.UINT8, values: [1, 2] },
                { encoding: ENCODING.UINT8, values: [3] },
                { encoding: ENCODING.UINT8, values: [4] }
            ]
        ));

        const tabularDatas = collection.TabularDataSets[0].TabularDatas;

        expect(readRows(tabularDatas[0])).toEqual([[1], [2]]);
        expect(readRows(tabularDatas[1])).toEqual([[3, 4]]);
    });

    test("decodeRenPack_ATabWithNoRows_GetsAnEmptyRowList", () => {

        const collection = decodeAndUnpack(writeRenPack(
            createMetadata([1]),
            [],
            [{ encoding: ENCODING.UINT8, values: [] }]
        ));

        expect(collection.TabularDataSets[0].TabularDatas[0].RowModels).toEqual([]);
    });

    test("decodeRenPack_NonAsciiAndNullStrings_AreSlicedOutCorrectly", () => {

        const dictionary = [null, "", "café", "日本", "😀 smile", "z"];

        const collection = decodeAndUnpack(writeRenPack(createMetadata([0]), dictionary, []));

        expect(collection.CompressionDictionary).toEqual(dictionary);
    });

    test("decodeRenPack_ALongString_WidensTheLengths", () => {

        const dictionary = ["a", "b".repeat(300), "c"];

        const collection = decodeAndUnpack(writeRenPack(createMetadata([0]), dictionary, []));

        expect(collection.CompressionDictionary).toEqual(dictionary);
    });

    test("decodeRenPack_AnUnsupportedVersion_Throws", () => {

        const buffer = writeRenPack(createMetadata([0]), [], [], 99);

        expect(() => Ren.DataSourceDecoding.decodeRenPack(buffer)).toThrow("Unsupported version");
    });

    test("decodeRenPack_TooFewDescriptors_Throws", () => {

        const buffer = writeRenPack(
            createMetadata([2]),
            [],
            [{ encoding: ENCODING.UINT8, values: [1] }]
        );

        expect(() => Ren.DataSourceDecoding.decodeRenPack(buffer)).toThrow();
    });
});
