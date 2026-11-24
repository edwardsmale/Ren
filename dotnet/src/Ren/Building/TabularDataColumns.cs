using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Ren.Models;

namespace Ren.Building
{
    /// <summary>
    /// The columns of a tab being built, handed to the callback that configures them before any of
    /// the tab's values are converted.
    /// </summary>
    public sealed class TabularDataColumns : IReadOnlyList<TabularDataColumn>
    {
        private readonly List<TabularDataColumn> columns;

        internal TabularDataColumns(List<TabularDataColumn> columns)
        {
            this.columns = columns;
        }

        public int Count => this.columns.Count;

        public TabularDataColumn this[int index] => this.columns[index];

        /// <summary>
        /// Gets the column with the given heading, which is the source column's name until the
        /// heading is changed.  A source column headed "Count" is found before the builder's count
        /// column, which has the same heading.
        /// </summary>
        public TabularDataColumn this[string heading]
        {
            get
            {
                var column =
                    this.columns.Find(c => c.Heading == heading && !IsCountColumn(c)) ??
                    this.columns.Find(c => c.Heading == heading);

                if (column == null)
                {
                    throw new ArgumentException(
                        "There is no column headed \"" + heading + "\".  The columns are: " +
                        string.Join(", ", this.columns.Select(c => c.Heading)) + ".",
                        nameof(heading)
                    );
                }

                return column;
            }
        }

        private static bool IsCountColumn(TabularDataColumn column)
        {
            return column.ColumnId == TabularDataSetCollectionBuilder.COUNT_COLUMN_ID;
        }

        public IEnumerator<TabularDataColumn> GetEnumerator()
        {
            return this.columns.GetEnumerator();
        }

        IEnumerator IEnumerable.GetEnumerator()
        {
            return this.GetEnumerator();
        }
    }
}
