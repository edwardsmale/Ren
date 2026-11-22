namespace Ren.Models
{
    /// <summary>
    /// The format of a <see cref="TabularDataColumn"/>'s values, which decides how they are
    /// compressed, aggregated and shown.
    /// </summary>
    /// <remarks>
    /// Must match Ren.SpreadsheetColumnFormatEnum, in ren-spreadsheet-column-format-enum.js.
    /// </remarks>
    public enum TabularDataColumnFormatEnum
    {
        General = 0,
        Number = 1,
        Integer = 2,
        Currency = 3,
        Percentage = 4,
        Date = 5,
        DateTime = 6,
        Boolean = 7,
        Id = 8,
        Enum = 9,
        IndexedString = 10,
    }
}
