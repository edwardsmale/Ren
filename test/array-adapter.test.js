/**
 * Ren.TabularDataAdapter_Array, which makes an object of each row, with a generated function per
 * column layout where the page lets it, and by assigning each cell where it doesn't.
 */
const { createTabularData } = require("./helpers/tabular-data");

/**
 * Gets the array of the specified tabular data while new Function throws, as it does on a page
 * whose content security policy doesn't allow eval.
 */
const getDataArrayWithoutEval = (tabularData) => {

    const originalFunction = global.Function;

    global.Function = function () {

        throw new EvalError("Refused to evaluate a string as JavaScript");
    };

    try {

        return Ren.TabularDataAdapter_Array.getDataArray(tabularData);
    }
    finally {

        global.Function = originalFunction;
    }
};

describe("getDataArray", () => {

    test("makes the same rows when eval isn't allowed", () => {

        // Each test has columns of its own, as the adapter keeps a builder for each layout.
        const columns = ["Region", "Product", "Sales"];
        const rows = [["North", "Pens", 10], ["South", "Ink", null]];

        const withEval =
            Ren.TabularDataAdapter_Array.getDataArray(createTabularData(columns, rows));
        const withoutEval = getDataArrayWithoutEval(
            createTabularData(columns.map(column => column + " 2"), rows)
        );

        const renamed = withEval.map(datum => Object.fromEntries(Object.entries(datum).map(
            ([key, value]) => [key === "__Count" ? key : key + " 2", value]
        )));

        expect(withoutEval).toEqual(renamed);
        expect(Object.keys(withoutEval[0])).toEqual(Object.keys(renamed[0]));
    });
});
