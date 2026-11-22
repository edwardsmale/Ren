/**
 * The library's functions that sort values by length.
 */

const sortKey = (name, value) => Ren.FormatFunctions.createFunction({ name })(value, {});

describe("string-length-sort-desc", () => {

    test("puts longer values first", () => {

        expect(sortKey("string-length-sort-desc", "abcd") < sortKey("string-length-sort-desc", "ab"))
            .toBe(true);
    });

    test("treats a missing value as having no length", () => {

        expect(sortKey("string-length-sort-desc", null)).toBe("10000000000null");
        expect(sortKey("string-length-sort-desc", undefined)).toBe("10000000000undefined");
    });
});

describe("string-length-sort-asc", () => {

    test("puts shorter values first", () => {

        expect(sortKey("string-length-sort-asc", "ab") < sortKey("string-length-sort-asc", "abcd"))
            .toBe(true);
    });

    test("treats a missing value as having no length", () => {

        expect(sortKey("string-length-sort-asc", null)).toBe("0000000000null");
    });
});
