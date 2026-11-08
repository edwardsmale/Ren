using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;

namespace Ren.Models
{
    /// <summary>
    /// Represents data in rows and columns.  The data may be compressed.
    /// </summary>
    public class TabularData
    {
        public TabularData(string title, string dataTabGroup, int rowCount)
        {
            this.Title = title;
            this.dataTabGroup = dataTabGroup;
            this.ColumnModels = new List<TabularDataColumn>();
            this.RowModels = new List<TabularDataRow>(rowCount);
        }

        public readonly string Title;
        public readonly string dataTabGroup;

        public readonly List<TabularDataColumn> ColumnModels;
        public readonly List<TabularDataRow> RowModels;

        /// <summary>
        /// A column value encoding: the column's compressed values are indexes into the
        /// compression dictionary.
        /// </summary>
        public const int VALUE_ENCODING_DICTIONARY = 0;

        /// <summary>
        /// A column value encoding: the column's compressed values are dates, as milliseconds
        /// since 1970-01-01 (always a whole number of days).
        /// </summary>
        public const int VALUE_ENCODING_DATE_EPOCH_MS = 1;

        /// <summary>
        /// A column value encoding: the column's compressed values are date-times, as milliseconds
        /// since 1970-01-01 (always a whole number of seconds).
        /// </summary>
        public const int VALUE_ENCODING_DATE_TIME_EPOCH_MS = 2;

        /// <summary>
        /// The row value standing for a NULL, which keeps NULLs apart from empty strings.  It sorts
        /// first in the compression dictionary.  Once compressed, a numeric column holds a null in
        /// its place instead.
        /// </summary>
        public const string NULL_SENTINEL = "\x01";

        public List<bool> IsColumnCompressed; // Indicates whether each column is compressed.

        /// <summary>
        /// Gets or sets how each compressed column's values are encoded, as one of the
        /// VALUE_ENCODING constants.  Null until the data is compressed, and read by the client as
        /// all <see cref="VALUE_ENCODING_DICTIONARY"/> when absent.
        /// </summary>
        public int[] ColumnValueEncodings { get; set; }

        /// <summary>
        /// Gets or sets the embedding vector for the SQL query that generated this tabular data, as
        /// the whole-number count in each bucket.  Used for query similarity comparison on the
        /// Editor page (for mapping potentially-edited queries to gridState entries in the report
        /// settings), which saves it compacted into a Base64 string of signed bytes.
        /// </summary>
        public int[] QueryEmbedding { get; set; }

        [JsonIgnore]
        public int AlternateColumnIndex => this.ColumnModels.FindIndex(c => c.Alternate);

        public int FreezePanesColumnIndex
        {
            get
            {
                var freezeMarkerIndex = this.ColumnModels.FindIndex(c => c.FreezePanes);

                if (freezeMarkerIndex == -1)
                {
                    // No freeze column: freeze the row headings only, not any data columns.
                    return 0;
                }

                // The datagrid interprets this value as a count of frozen visible display columns,
                // so exclude any hidden columns (e.g. the auto-added __Count column) that precede
                // the marker.  Otherwise the frozen section is too wide and obscures the first
                // column's heading.
                return this.ColumnModels.Take(freezeMarkerIndex).Count(c => c.Visible);
            }
        }

        public bool HasSubheadings =>
            this.ColumnModels.Any(c => !string.IsNullOrEmpty(c.Subheading)) &&
            this.ColumnModels.Select(c => c.Subheading).Where(s => !string.IsNullOrWhiteSpace(s)).Distinct().Count() > 1;

        /// <summary>
        /// Gets a value indicating whether any columns have the Count or CountDistinct directives.
        /// </summary>
        public bool HasCounts => this.ColumnModels.Any(c => c.Count || c.CountDistinct);

        /// <summary>
        /// Gets a value indicating whether any columns have the Sum or Average directives.
        /// </summary>
        public bool HasTotals => this.ColumnModels.Any(c => c.Sum || c.MostCommon || c.Min || c.Max || c.Average);

        /// <summary>
        /// Gets or sets a value indicating whether this tab is to be shown by default when the 
        /// spreadsheet is first opened (applies to Excel output only).
        /// </summary>
        [JsonIgnore]
        public bool IsDefaultTab { get; set; }

        /// <summary>
        /// Gets the indexes of the columns marked <see cref="TabularDataColumn.GroupBy"/>.
        /// </summary>
        public int[] GroupByColumnIndexes
        {
            get
            {
                var result = new List<int>();
                for (var i = 0; i < this.ColumnModels.Count; i++)
                {
                    if (this.ColumnModels[i].GroupBy) result.Add(i);
                }
                return result.ToArray();
            }
        }
    }
}
