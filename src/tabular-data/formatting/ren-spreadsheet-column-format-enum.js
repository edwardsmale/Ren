/**
 * Basic column format types, supported in Excel output.  Column format types are set automatically
 * by sever-side code, based on column data types and column headings.  This gives the basic type
 * for the column as a whole.  When groupings are created, the client-side code converts the format
 * type depending on the type of aggregation (for example, if a General column is aggregated using
 * the Count aggregation, the format of the aggregated values will be Number).
 *
 * Further formatting can be applied using format functions, which are configured at the grouping
 * level.
 *
 * Must match SpreadsheetColumnFormatEnum.cs.
 */
Ren.SpreadsheetColumnFormatEnum = Ren.DefineEnum({
    General: 0,
    Number: 1,
    Integer: 2,
    Currency: 3,
    Percentage: 4,
    Date: 5,
    DateTime: 6,
    Boolean: 7,
    Id: 8,
    Enum: 9,
    IndexedString: 10
}, {

    // The formats aggregation can do arithmetic on, and so the ones a Sum or an Average of a column
    // is meaningful for.
    IsArithmetic: (value) => {

        return value === Ren.SpreadsheetColumnFormatEnum.Number
            || value === Ren.SpreadsheetColumnFormatEnum.Integer
            || value === Ren.SpreadsheetColumnFormatEnum.Currency
            || value === Ren.SpreadsheetColumnFormatEnum.Percentage
            || value === Ren.SpreadsheetColumnFormatEnum.Boolean;
    },

    // The formats whose values are numbers: the arithmetic ones, plus IDs, which are numbers to
    // compare and sort by but not to do arithmetic on.
    IsNumeric: (value) => {

        return Ren.SpreadsheetColumnFormatEnum.IsArithmetic(value)
            || value === Ren.SpreadsheetColumnFormatEnum.Id;
    },

    IsDate: (value) => {

        return value === Ren.SpreadsheetColumnFormatEnum.Date
            || value === Ren.SpreadsheetColumnFormatEnum.DateTime;
    }
});
