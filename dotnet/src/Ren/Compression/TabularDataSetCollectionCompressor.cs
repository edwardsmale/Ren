using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Ren.Models;

namespace Ren.Compression
{
    public class TabularDataSetCollectionCompressor
    {
        /// <summary>
        /// The number of rows below which a tabular data is processed on the calling thread.  For
        /// a small one the cost of handing the work to the thread pool is more than the work
        /// itself.
        /// </summary>
        private const int PARALLEL_ROW_THRESHOLD = 500;

        private const long MILLISECONDS_PER_DAY = 86400000;

        /// <summary>
        /// Mutates the passed model to compress the data.  Replaces string values with numbers
        /// that point to the string in a dictionary, and date values with milliseconds since
        /// 1970-01-01.  Places the dictionary in the model's CompressionDictionary property.
        /// Updates each tabular data's IsColumnCompressed array to contain true for each column
        /// that has been compressed, and its ColumnValueEncodings array to say which of the two
        /// each is.
        /// </summary>
        /// <remarks>
        /// Each value is hashed once, when it is first met: it is given a provisional index there
        /// and then, written straight into the row's compressed values.  Sorting the dictionary at
        /// the end moves the entries around, so a second pass replaces every provisional index with
        /// the sorted one - but that pass compares nothing and reads no strings, which is what
        /// makes it cheap.
        /// </remarks>
        public void Compress(TabularDataSetCollection model)
        {
            if (model.IsCompressed)
            {
                return;
            }

            var tabularDatas = model.GetAllTabularDatas();

            // The numeric and date columns and the row-value arrays themselves have nothing to do
            // with the dictionary, so they are done first, in parallel, leaving the pass that has
            // to be serial with nothing to do but hash the strings.
            var compressedColumnIndexes = this.ConvertNonCompressedValues(tabularDatas);

            var interner = new ValueInterner();

            this.IndexCompressedValues(tabularDatas, compressedColumnIndexes, interner);

            var dictionary = interner.GetSortedValues(out var provisionalToSorted);

            this.ReplaceProvisionalIndexes(
                tabularDatas, compressedColumnIndexes, provisionalToSorted
            );

            model.CompressionDictionary = dictionary;
        }

        /// <summary>
        /// Creates each row's compressed values array and fills in every column that is not
        /// dictionary-compressed, leaving the compressed columns for
        /// <see cref="IndexCompressedValues"/>.  Returns the indexes of the compressed columns of
        /// each tabular data.
        /// </summary>
        private List<int>[] ConvertNonCompressedValues(List<TabularData> tabularDatas)
        {
            var compressedColumnIndexes = new List<int>[tabularDatas.Count];

            for (var tabIndex = 0; tabIndex < tabularDatas.Count; tabIndex++)
            {
                compressedColumnIndexes[tabIndex] =
                    this.MarkColumnsToCompress(tabularDatas[tabIndex]);
            }

            Parallel.For(0, tabularDatas.Count, tabIndex =>
            {
                this.ConvertNonCompressedValues(
                    tabularDatas[tabIndex], compressedColumnIndexes[tabIndex]
                );
            });

            return compressedColumnIndexes;
        }

        private void ConvertNonCompressedValues(TabularData tabularData,
            List<int> compressedColumnIndexes)
        {
            var isColumnCompressed = tabularData.IsColumnCompressed;
            var valueEncodings = tabularData.ColumnValueEncodings;

            // Set, never cleared, by whichever row finds a value that is not a date, so the rows
            // racing to set one do no harm.
            var isUnparseable = new bool[valueEncodings.Length];

            this.ForEachRow(
                tabularData.RowModels,
                rowModel => this.ConvertNonCompressedValues(
                    rowModel, isColumnCompressed, valueEncodings, isUnparseable
                )
            );

            for (var c = 0; c < valueEncodings.Length; c++)
            {
                if (isUnparseable[c])
                {
                    // The client decodes a whole column one way, so a single value that is not a
                    // date sends the column to the dictionary, where its values are kept as the
                    // strings they are.
                    valueEncodings[c] = TabularData.VALUE_ENCODING_DICTIONARY;
                    compressedColumnIndexes.Add(c);
                }
            }
        }

        /// <summary>
        /// Runs the given action for each of a tabular data's rows, on the calling thread where
        /// there are too few of them for handing the work to the thread pool to pay for itself.
        /// </summary>
        private void ForEachRow(List<TabularDataRow> rowModels, Action<TabularDataRow> action)
        {
            if (rowModels.Count < PARALLEL_ROW_THRESHOLD)
            {
                for (var rowIndex = 0; rowIndex < rowModels.Count; rowIndex++)
                {
                    action(rowModels[rowIndex]);
                }

                return;
            }

            Parallel.For(0, rowModels.Count, rowIndex =>
            {
                action(rowModels[rowIndex]);
            });
        }

        private void ConvertNonCompressedValues(TabularDataRow rowModel,
            List<bool> isColumnCompressed, int[] valueEncodings, bool[] isUnparseable)
        {
            var rowValues = rowModel.RowValues;
            var compressedValues = new decimal?[rowValues.Count];

            for (var i = 0; i < rowValues.Count; i++)
            {
                // Guard against out-of-range indexes to avoid exceptions on the Editor page
                // when user executes SELECT queries with different numbers of columns.
                if (i < isColumnCompressed.Count && isColumnCompressed[i])
                {
                    if (i < valueEncodings.Length
                        && valueEncodings[i] != TabularData.VALUE_ENCODING_DICTIONARY)
                    {
                        compressedValues[i] = this.ConvertDateValue(
                            rowValues[i], valueEncodings[i], i, isUnparseable
                        );
                    }

                    continue;
                }

                var rowValue = rowValues[i];

                if (rowValue == TabularData.NULL_SENTINEL)
                {
                    // For non-compressed (numeric) columns, store null directly in the CV.
                    // The JS pipeline treats null as the NULL marker; it is normalised back to
                    // the string NULL_SENTINEL at the boundaries that need to compare with the
                    // compressed-column representation (e.g. column filtering).
                    compressedValues[i] = null;
                }
                else if (!string.IsNullOrEmpty(rowValue))
                {
                    // If it's not a compressed column, then the column should only contain
                    // numbers and blanks.
                    compressedValues[i] = FastNumbers.ParseDecimal(rowValue);
                }
            }

            rowModel.CV = compressedValues;
        }

        /// <summary>
        /// Returns the milliseconds since 1970-01-01 of a date column's value, or null for a NULL,
        /// flagging the column as unparseable when the value is neither.
        /// </summary>
        private decimal? ConvertDateValue(string rowValue, int valueEncoding, int columnIndex,
            bool[] isUnparseable)
        {
            if (rowValue == TabularData.NULL_SENTINEL)
            {
                return null;
            }

            var hasTime = valueEncoding == TabularData.VALUE_ENCODING_DATE_TIME_EPOCH_MS;

            if (!this.TryParseEpochMilliseconds(rowValue, hasTime, out var epochMilliseconds))
            {
                isUnparseable[columnIndex] = true;
                return null;
            }

            return epochMilliseconds;
        }

        /// <summary>
        /// Parses a yyyy-MM-dd value, or a yyyy-MM-dd HH:mm:ss one where hasTime is true, to the
        /// milliseconds since 1970-01-01.  Nothing is read as being in any time zone, so no value
        /// can be moved by a clock change.
        /// </summary>
        /// <remarks>
        /// Read position by position rather than with DateTime.ParseExact, which is several
        /// times slower and is run here once for every date in the data.
        /// </remarks>
        private bool TryParseEpochMilliseconds(string value, bool hasTime,
            out long epochMilliseconds)
        {
            epochMilliseconds = 0;

            if (value == null || value.Length != (hasTime ? 19 : 10)
                || value[4] != '-' || value[7] != '-')
            {
                return false;
            }

            var year = this.ParseDigits(value, 0, 4);
            var month = this.ParseDigits(value, 5, 2);
            var day = this.ParseDigits(value, 8, 2);

            if (year < 1 || month < 1 || month > 12 || day < 1
                || day > DateTime.DaysInMonth(year, month))
            {
                return false;
            }

            var seconds = 0;

            if (hasTime)
            {
                if (value[10] != ' ' || value[13] != ':' || value[16] != ':')
                {
                    return false;
                }

                var hour = this.ParseDigits(value, 11, 2);
                var minute = this.ParseDigits(value, 14, 2);
                var second = this.ParseDigits(value, 17, 2);

                if (hour < 0 || hour > 23 || minute < 0 || minute > 59
                    || second < 0 || second > 59)
                {
                    return false;
                }

                seconds = (hour * 3600) + (minute * 60) + second;
            }

            epochMilliseconds =
                (this.DaysSinceEpoch(year, month, day) * MILLISECONDS_PER_DAY) + (seconds * 1000L);

            return true;
        }

        /// <summary>
        /// Returns the number written in the given digits of the value, or -1 if any of them is
        /// not a digit.
        /// </summary>
        private int ParseDigits(string value, int start, int length)
        {
            var result = 0;

            for (var index = start; index < start + length; index++)
            {
                var digit = value[index] - '0';

                if (digit < 0 || digit > 9)
                {
                    return -1;
                }

                result = (result * 10) + digit;
            }

            return result;
        }

        /// <summary>
        /// Returns the number of days from 1970-01-01 to the given date in the proleptic Gregorian
        /// calendar, negative for a date before it.
        /// </summary>
        private long DaysSinceEpoch(int year, int month, int day)
        {
            // Counted in years that begin in March, which puts the leap day at the end of the
            // year, where it moves no other day.  Hinnant's days_from_civil.
            var marchYear = month <= 2 ? year - 1 : year;
            var era = (marchYear >= 0 ? marchYear : marchYear - 399) / 400;
            var yearOfEra = marchYear - (era * 400);
            var dayOfYear = (((153 * (month > 2 ? month - 3 : month + 9)) + 2) / 5) + day - 1;
            var dayOfEra = (yearOfEra * 365) + (yearOfEra / 4) - (yearOfEra / 100) + dayOfYear;

            return (era * 146097L) + dayOfEra - 719468;
        }

        /// <summary>
        /// Writes each compressed cell's provisional dictionary index into the row's compressed
        /// values, adding the value to the dictionary the first time it is met.  This is the one
        /// pass that hashes the strings, and the one that cannot be shared out between threads:
        /// every value has to be looked up in the same dictionary.
        /// </summary>
        private void IndexCompressedValues(List<TabularData> tabularDatas,
            List<int>[] compressedColumnIndexes, ValueInterner interner)
        {
            for (var tabIndex = 0; tabIndex < tabularDatas.Count; tabIndex++)
            {
                var rowModels = tabularDatas[tabIndex].RowModels;
                var columnIndexes = compressedColumnIndexes[tabIndex];

                for (var rowIndex = 0; rowIndex < rowModels.Count; rowIndex++)
                {
                    var rowModel = rowModels[rowIndex];
                    var rowValues = rowModel.RowValues;
                    var compressedValues = rowModel.CV;

                    for (var c = 0; c < columnIndexes.Count; c++)
                    {
                        var columnIndex = columnIndexes[c];

                        // Guard against out-of-range indexes to avoid exceptions on the Editor
                        // page when user executes SELECT queries with different column counts.
                        if (columnIndex >= rowValues.Count)
                        {
                            continue;
                        }

                        compressedValues[columnIndex] = interner.GetOrAdd(rowValues[columnIndex]);
                    }

                    // The strings have all been read; nothing downstream of here wants them, and
                    // they are much the largest thing the response is holding on to.
                    rowModel.RowValues = null;
                }
            }
        }

        /// <summary>
        /// Replaces every provisional index with the position the value ended up at once the
        /// dictionary was sorted.
        /// </summary>
        private void ReplaceProvisionalIndexes(List<TabularData> tabularDatas,
            List<int>[] compressedColumnIndexes, int[] provisionalToSorted)
        {
            Parallel.For(0, tabularDatas.Count, tabIndex =>
            {
                var columnIndexes = compressedColumnIndexes[tabIndex];

                this.ForEachRow(
                    tabularDatas[tabIndex].RowModels,
                    rowModel => this.ReplaceProvisionalIndexes(
                        rowModel, columnIndexes, provisionalToSorted
                    )
                );
            });
        }

        private void ReplaceProvisionalIndexes(TabularDataRow rowModel,
            List<int> columnIndexes, int[] provisionalToSorted)
        {
            var compressedValues = rowModel.CV;

            for (var c = 0; c < columnIndexes.Count; c++)
            {
                var columnIndex = columnIndexes[c];

                if (columnIndex >= compressedValues.Length)
                {
                    continue;
                }

                var provisional = compressedValues[columnIndex];

                if (provisional.HasValue)
                {
                    compressedValues[columnIndex] =
                        provisionalToSorted[decimal.ToInt32(provisional.GetValueOrDefault())];
                }
            }
        }

        /// <summary>
        /// Sets the IsColumnCompressed array to true for each column that will be compressed, and
        /// the ColumnValueEncodings array to the encoding each is to be tried with.  Returns the
        /// indexes of the columns that are to go into the dictionary; a date column joins them
        /// later only if its values turn out not all to be dates.
        /// </summary>
        private List<int> MarkColumnsToCompress(TabularData tabularData)
        {
            var compressedColumnIndexes = new List<int>();
            var valueEncodings = new int[tabularData.ColumnModels.Count];

            for (var c = 0; c < tabularData.ColumnModels.Count; c++)
            {
                var columnFormat = tabularData.ColumnModels[c].ColumnFormat;

                var isCompressed = HasCompressedColumnType(columnFormat);

                tabularData.IsColumnCompressed[c] = isCompressed;

                if (columnFormat == TabularDataColumnFormatEnum.Date)
                {
                    valueEncodings[c] = TabularData.VALUE_ENCODING_DATE_EPOCH_MS;
                }
                else if (columnFormat == TabularDataColumnFormatEnum.DateTime)
                {
                    valueEncodings[c] = TabularData.VALUE_ENCODING_DATE_TIME_EPOCH_MS;
                }
                else if (isCompressed)
                {
                    compressedColumnIndexes.Add(c);
                }
            }

            tabularData.ColumnValueEncodings = valueEncodings;

            return compressedColumnIndexes;
        }

        // Note: numeric columns with NULLs store a literal null in the CV array
        // (decimal?[]). The JS pipeline treats null as the unified NULL marker for
        // non-compressed columns.

        /// <summary>
        /// Returns a value indicating whether the column type is eligible for compression.
        /// </summary>
        public static bool HasCompressedColumnType(TabularDataColumnFormatEnum columnFormat)
        {
            return
                columnFormat == TabularDataColumnFormatEnum.General ||
                columnFormat == TabularDataColumnFormatEnum.DateTime ||
                columnFormat == TabularDataColumnFormatEnum.Date ||
                columnFormat == TabularDataColumnFormatEnum.IndexedString;
        }

        /// <summary>
        /// The compression dictionary as it is being built: every distinct value, in the order the
        /// data happened to present them, and the index each was given.
        /// </summary>
        private sealed class ValueInterner
        {
            private readonly Dictionary<string, int> indexes =
                new Dictionary<string, int>(StringComparer.Ordinal);

            private readonly List<string> values = new List<string>();

            private readonly DictionaryComparer comparer = new DictionaryComparer();

            /// <summary>
            /// A null value cannot be a key of the lookup, so it is held on its own.  Rows padded
            /// out to the width of a horizontal report are the only source of one.
            /// </summary>
            private int nullIndex = -1;

            /// <summary>
            /// Returns the index of the given value, adding it to the dictionary if this is the
            /// first time it has been seen.
            /// </summary>
            public int GetOrAdd(string value)
            {
                if (value == null)
                {
                    if (this.nullIndex < 0)
                    {
                        this.nullIndex = this.values.Count;
                        this.values.Add(null);
                    }

                    return this.nullIndex;
                }

                if (this.indexes.TryGetValue(value, out var index))
                {
                    return index;
                }

                index = this.values.Count;

                this.values.Add(value);
                this.indexes.Add(value, index);

                return index;
            }

            /// <summary>
            /// Returns the dictionary sorted as the client expects it - sentinel first, then empty
            /// string, then alphabetical - together with the mapping from the provisional index
            /// each value was given to its position in the sorted result.
            /// </summary>
            public string[] GetSortedValues(out int[] provisionalToSorted)
            {
                var sorted = this.values.ToArray();
                var provisionalIndexes = new int[sorted.Length];

                for (var index = 0; index < provisionalIndexes.Length; index++)
                {
                    provisionalIndexes[index] = index;
                }

                Array.Sort(sorted, provisionalIndexes, this.comparer);

                provisionalToSorted = new int[sorted.Length];

                for (var index = 0; index < sorted.Length; index++)
                {
                    provisionalToSorted[provisionalIndexes[index]] = index;
                }

                return sorted;
            }
        }

        /// <summary>
        /// Orders the compression dictionary: sentinel first, then empty string, then alphabetical.
        /// </summary>
        private sealed class DictionaryComparer : IComparer<string>
        {
            public int Compare(string a, string b)
            {
                var aSentinel = a == TabularData.NULL_SENTINEL;
                var bSentinel = b == TabularData.NULL_SENTINEL;

                if (aSentinel && bSentinel)
                {
                    return 0;
                }

                if (aSentinel)
                {
                    return -1;
                }

                if (bSentinel)
                {
                    return 1;
                }

                return StringComparer.Ordinal.Compare(a, b);
            }
        }
    }
}
