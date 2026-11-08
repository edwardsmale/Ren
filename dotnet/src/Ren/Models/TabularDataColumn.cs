using System.Collections.Generic;

namespace Ren.Models
{
    public class TabularDataColumn
    {
        public TabularDataColumnFormatEnum ColumnFormat { get; set; }
        public string ColumnType => GetColumnType(this.ColumnFormat);

        public string Heading;
        public string Subheading;

        /// <summary>
        /// An ID for the column, which the client refers to it by in place of its heading.
        /// </summary>
        public string ColumnId;

        public string ColumnIdOrHeading => this.ColumnId ?? this.Heading;

        public bool HideDuplicates;
        public bool Alternate;
        public bool Visible;

        /// <summary>
        /// Gets the heading of the column to aggregate with respect to, if any. It is assumed that
        /// in the data, the column with this setting will contain the same value whenever the
        /// 'aggregate with respect to' column has the same value.  e.g. because the data repeats 
        /// the same values multiple times because of a JOIN.  This is then used to prevent double
        /// counting when calculating aggregates like sums and counts.
        /// </summary>
        public string AggregateWithRespectTo;

        public bool GroupBy;
        public AggregationTypeEnum AggregationType;

        public bool Sum;
        public bool Average;
        public bool Count;
        public bool CountDistinct;
        public bool Min;
        public bool Max;
        public bool Concatenate;
        public bool MostCommon;
        public bool DistinctValuesWithCounts;
        public bool DistinctValues;
        public bool NoTotal;
        public bool SingleValuesOnly;
        public bool SingleValueOrPlaceholder;
        public bool ExpandIcon;

        public bool HasAnyTotalsOrCounts =>
            this.Sum || this.MostCommon || this.Count || this.CountDistinct ||
            this.Min || this.Max || this.Average || this.Concatenate ||
            this.DistinctValues || this.DistinctValuesWithCounts;

        public bool Csv;
        public bool FreezePanes;

        /// <summary>
        /// Gets the source SQL table name for this column, resolved from the table alias in the
        /// SELECT clause.  Null for calculated columns or columns without a table alias.
        /// </summary>
        public string SourceTableName { get; set; }

        /// <summary>
        /// Gets or sets the integer-to-name mapping for an enum column (e.g. 0 → "CreditCard"), or
        /// null if the column is not one.  The client offers the names when filtering the column.
        /// </summary>
        public Dictionary<int, string> EnumValues { get; set; }

        private static string GetColumnType(TabularDataColumnFormatEnum columnFormat)
        {
            switch (columnFormat)
            {
                case TabularDataColumnFormatEnum.General:
                    return "String";
                case TabularDataColumnFormatEnum.Number:
                case TabularDataColumnFormatEnum.Integer:
                    return "Number";
                case TabularDataColumnFormatEnum.Currency:
                    return "Currency";
                case TabularDataColumnFormatEnum.Percentage:
                    return "Percentage";
                case TabularDataColumnFormatEnum.Date:
                    return "Date";
                case TabularDataColumnFormatEnum.DateTime:
                    return "Date/Time";
                case TabularDataColumnFormatEnum.IndexedString:
                    return "IndexedString";
                default:
                    return "Other";
            }
        }
    }
}
