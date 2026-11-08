const DICTIONARY_ENCODING = 0;
const DATE_ENCODING = 1;
const DATE_TIME_ENCODING = 2;

describe("CompressionDictionary", () => {

    // Column 0 isn't compressed, column 1 holds dictionary indexes, and columns 2 and 3 hold
    // milliseconds since 1970.
    const createDictionary = () => Ren.CompressionDictionary(
        [Ren.NullSentinel, "", "Ink", "Paper", "Pens"],
        [false, true, true, true],
        [DICTIONARY_ENCODING, DICTIONARY_ENCODING, DATE_ENCODING, DATE_TIME_ENCODING]
    );

    test("compressValue_AStringInTheDictionary_ReturnsItsIndex", () => {

        expect(createDictionary().compressValue("Paper", 1)).toBe(3);
    });

    test("compressValue_AStringNotInTheDictionary_ReturnsTheString", () => {

        expect(createDictionary().compressValue("Staples", 1)).toBe("Staples");
    });

    test("compressValue_TheNullSentinel_ReturnsIndexZero", () => {

        expect(createDictionary().compressValue(Ren.NullSentinel, 1)).toBe(0);
    });

    test("compressValue_TheEmptyString_ReturnsItsIndex", () => {

        expect(createDictionary().compressValue("", 1)).toBe(1);
    });

    // Index 0 holds a real value here, so the sentinel mustn't be answered with it.
    test("compressValue_TheNullSentinelWithNoneInTheDictionary_ReturnsTheSentinel", () => {

        const dictionary = Ren.CompressionDictionary(["Boxing Day", "Christmas Day"], [true]);

        expect(dictionary.compressValue(Ren.NullSentinel, 0)).toBe(Ren.NullSentinel);
    });

    test("compressValue_AnUncompressedColumn_ReturnsTheValue", () => {

        expect(createDictionary().compressValue("Paper", 0)).toBe("Paper");
    });

    test("compressValue_ADate_ReturnsItsMilliseconds", () => {

        expect(createDictionary().compressValue("2024-02-29", 2)).toBe(Date.UTC(2024, 1, 29));
    });

    test("compressValue_ADateAndTime_ReturnsItsMilliseconds", () => {

        expect(createDictionary().compressValue("2024-02-29 13:04:05", 3))
            .toBe(Date.UTC(2024, 1, 29, 13, 4, 5));
    });

    test("compressValue_TheNullSentinelInADateColumn_ReturnsNull", () => {

        expect(createDictionary().compressValue(Ren.NullSentinel, 2)).toBeNull();
    });

    test("compressValue_AnImpossibleDate_ReturnsTheString", () => {

        expect(createDictionary().compressValue("2023-02-29", 2)).toBe("2023-02-29");
    });

    test("decompressValue_AnIndex_ReturnsItsString", () => {

        expect(createDictionary().decompressValue(4, 1)).toBe("Pens");
    });

    test("decompressValue_MillisecondsInADateColumn_ReturnsTheDate", () => {

        expect(createDictionary().decompressValue(Date.UTC(2024, 1, 29), 2)).toBe("2024-02-29");
    });

    test("decompressValue_MillisecondsInADateTimeColumn_ReturnsTheDateAndTime", () => {

        expect(createDictionary().decompressValue(Date.UTC(2024, 1, 29, 13, 4, 5), 3))
            .toBe("2024-02-29 13:04:05");
    });

    test("decompressValue_MillisecondsBefore1970_ReturnsTheDate", () => {

        expect(createDictionary().decompressValue(-86400000, 2)).toBe("1969-12-31");
    });

    test("decompressValue_NullInADateColumn_ReturnsTheNullSentinel", () => {

        expect(createDictionary().decompressValue(null, 2)).toBe(Ren.NullSentinel);
    });

    test("internDerivedValue_ANewValue_AppendsItAndMarksTheColumn", () => {

        const dictionary = createDictionary();
        const appendedColumns = [];

        const index = dictionary.internDerivedValue("Staples", 1, appendedColumns);

        expect(index).toBe(5);
        expect(dictionary.decompressValue(index, 1)).toBe("Staples");
        expect(appendedColumns[1]).toBe(true);
    });

    test("internDerivedValue_AnExistingValue_ReturnsItsIndex", () => {

        const appendedColumns = [];

        expect(createDictionary().internDerivedValue("Ink", 1, appendedColumns)).toBe(2);
        expect(appendedColumns[1]).toBeUndefined();
    });

    test("internDerivedValue_ANumber_IsInternedAsAString", () => {

        const dictionary = createDictionary();

        const index = dictionary.internDerivedValue(42, 1, []);

        expect(dictionary.decompressValue(index, 1)).toBe("42");
    });

    // A count over a date column lands in it, and mustn't be read back as a date.
    test("internDerivedValue_ANumberInADateColumn_DecompressesAsTheNumber", () => {

        const dictionary = createDictionary();

        const value = dictionary.internDerivedValue(3, 2, []);

        expect(dictionary.decompressValue(value, 2)).toBe("3");
    });

    test("internDerivedValue_ADateInADateColumn_ReturnsItsMilliseconds", () => {

        expect(createDictionary().internDerivedValue("2024-02-29", 2, []))
            .toBe(Date.UTC(2024, 1, 29));
    });

    test("valueIsInDictionary_ADateColumn_IsTrueOnlyForADate", () => {

        const dictionary = createDictionary();

        expect(dictionary.valueIsInDictionary("2024-02-29", 2)).toBe(true);
        expect(dictionary.valueIsInDictionary("Soon", 2)).toBe(false);
    });

    test("valueIsInDictionary_AnInternedValue_ReturnsFalse", () => {

        const dictionary = createDictionary();

        dictionary.internDerivedValue("Staples", 1, []);

        expect(dictionary.valueIsInDictionary("Ink", 1)).toBe(true);
        expect(dictionary.valueIsInDictionary("Staples", 1)).toBe(false);
    });

    test("compressedValuesThatAreNullOrWhitespace_ADictionaryColumn_ReturnsTheBlankIndexes", () => {

        expect(createDictionary().compressedValuesThatAreNullOrWhitespace(1)).toEqual([0, 1]);
    });

    test("isEpochColumn_ADateColumn_ReturnsTrue", () => {

        const dictionary = createDictionary();

        expect(dictionary.isEpochColumn(1)).toBe(false);
        expect(dictionary.isEpochColumn(2)).toBe(true);
    });
});
