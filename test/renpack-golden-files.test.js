const fs = require("fs");
const path = require("path");

// Written by RenPackGoldenFilesTests, in dotnet/tests/Ren.Tests.  Each .renpack has a .json of the
// same collection beside it, apart from many-cells.renpack, which is too big for that.
const GOLDEN_DIRECTORY = path.join(__dirname, "golden");

const MANY_CELLS_COLUMN_COUNT = 100;
const MANY_CELLS_ROW_COUNT = 520;

/**
 * Gets a golden file's bytes in an ArrayBuffer of this window's own.
 */
const readBuffer = (filename) => {

    const file = fs.readFileSync(path.join(GOLDEN_DIRECTORY, filename));
    const bytes = new Uint8Array(file.length);

    bytes.set(file);

    return bytes.buffer;
};

/**
 * Decodes a golden renpack and unpacks it as the page would, returning the collection.
 */
const decodeAndUnpack = (filename) => {

    const collection = Ren.DataSourceDecoding.decodeRenPack(readBuffer(filename)).collection;

    Ren.DataSourceParseWorker.unpackCollection(collection);

    return collection;
};

/**
 * Gets a tab's rows as plain arrays, since a row without nulls is a Float64Array view.
 */
const readRows = (tabularData) => tabularData.RowModels.map((row) => Array.from(row.CV));

/**
 * Gets a copy of the collection without its rows and dictionary, which are what the renpack
 * carries in binary rather than in its metadata.
 */
const readMetadata = (collection) => {

    const metadata = JSON.parse(JSON.stringify(collection));

    delete metadata.CompressionDictionary;

    for (let setIndex = 0; setIndex < metadata.TabularDataSets.length; setIndex++) {

        const tabularDatas = metadata.TabularDataSets[setIndex].TabularDatas;

        for (let tabIndex = 0; tabIndex < tabularDatas.length; tabIndex++) {
            delete tabularDatas[tabIndex].RowModels;
        }
    }

    return metadata;
};

/**
 * Decodes a golden renpack and reads the JSON of the same collection beside it.
 */
const readGoldenFile = (name) => ({
    decoded: decodeAndUnpack(name + ".renpack"),
    expected: JSON.parse(fs.readFileSync(path.join(GOLDEN_DIRECTORY, name + ".json"), "utf8"))
});

const expectTheJsonsDictionary = (goldenFile) => {

    expect(goldenFile.decoded.CompressionDictionary)
        .toEqual(goldenFile.expected.CompressionDictionary);
};

const expectTheJsonsMetadata = (goldenFile) => {

    expect(readMetadata(goldenFile.decoded)).toEqual(readMetadata(goldenFile.expected));
};

const expectTheJsonsRows = (goldenFile) => {

    const decodedSets = goldenFile.decoded.TabularDataSets;
    const expectedSets = goldenFile.expected.TabularDataSets;

    for (let setIndex = 0; setIndex < expectedSets.length; setIndex++) {

        const decodedTabs = decodedSets[setIndex].TabularDatas;
        const expectedTabs = expectedSets[setIndex].TabularDatas;

        for (let tabIndex = 0; tabIndex < expectedTabs.length; tabIndex++) {
            expect(readRows(decodedTabs[tabIndex]))
                .toEqual(expectedTabs[tabIndex].RowModels.map((row) => row.CV));
        }
    }
};

// Each file has its own describe, rather than a describe.each, so that editors listing the tests
// without running them can show the files' names.
describe("The mixed-columns golden file", () => {

    const goldenFile = readGoldenFile("mixed-columns");

    test("decodeRenPack_TheGoldenFile_HasTheJsonsDictionary", () => {
        expectTheJsonsDictionary(goldenFile);
    });

    test("decodeRenPack_TheGoldenFile_HasTheJsonsMetadata", () => {
        expectTheJsonsMetadata(goldenFile);
    });

    test("decodeRenPack_TheGoldenFile_HasTheJsonsRows", () => {
        expectTheJsonsRows(goldenFile);
    });
});

describe("The several-sets golden file", () => {

    const goldenFile = readGoldenFile("several-sets");

    test("decodeRenPack_TheGoldenFile_HasTheJsonsDictionary", () => {
        expectTheJsonsDictionary(goldenFile);
    });

    test("decodeRenPack_TheGoldenFile_HasTheJsonsMetadata", () => {
        expectTheJsonsMetadata(goldenFile);
    });

    test("decodeRenPack_TheGoldenFile_HasTheJsonsRows", () => {
        expectTheJsonsRows(goldenFile);
    });
});

describe("The big-dictionary golden file", () => {

    const goldenFile = readGoldenFile("big-dictionary");

    test("decodeRenPack_TheGoldenFile_HasTheJsonsDictionary", () => {
        expectTheJsonsDictionary(goldenFile);
    });

    test("decodeRenPack_TheGoldenFile_HasTheJsonsMetadata", () => {
        expectTheJsonsMetadata(goldenFile);
    });

    test("decodeRenPack_TheGoldenFile_HasTheJsonsRows", () => {
        expectTheJsonsRows(goldenFile);
    });
});

describe("The many-cells golden file", () => {

    test("decodeRenPack_RowsSpreadOverChunks_AreAllRead", () => {

        const collection = decodeAndUnpack("many-cells.renpack");
        const rows = readRows(collection.TabularDataSets[0].TabularDatas[0]);

        expect(rows.length).toBe(MANY_CELLS_ROW_COUNT);

        for (let row = 0; row < MANY_CELLS_ROW_COUNT; row++) {

            const expectedRow = new Array(MANY_CELLS_COLUMN_COUNT);

            for (let column = 0; column < MANY_CELLS_COLUMN_COUNT; column++) {
                expectedRow[column] = ((row * 7) + column) % 10;
            }

            expect(rows[row]).toEqual(expectedRow);
        }
    });
});
