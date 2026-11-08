using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using Ren.Models;

namespace Ren.RenPack
{
    /// <summary>
    /// Writes a compressed <see cref="TabularDataSetCollection"/> as the binary "RENP" format
    /// described by <see cref="RenPackFormat"/>.
    /// </summary>
    /// <remarks>
    /// The point of it is that the rows never become text. Serialising them as JSON is the slowest
    /// part of answering a data source request, the resulting numbers are far larger on the wire
    /// than the values they stand for, and the client then has to parse every one of them back.
    /// Here each column is written at the narrowest width its values fit into - a dictionary index
    /// that fits in a byte occupies a byte - and the client reads the result as a typed array view
    /// over the bytes it was given.
    ///
    /// The cells are walked a chunk of rows at a time rather than a column at a time.  A chunk is
    /// sized to keep its rows' values in the level 2 cache while every column of them is read, so
    /// each cell is fetched from memory once for the two passes the format needs rather than once
    /// per pass; and the chunks, unlike the columns, are numerous enough to fill the thread pool
    /// whatever shape the report is.  A report with four columns and a million rows had four
    /// threads' worth of work to do here before that.
    /// </remarks>
    public class RenPackWriter
    {
        /// <summary>
        /// The largest response this will produce.  A collection whose binary form would be bigger
        /// than this is written as JSON instead, since the offsets in the format are 32-bit.
        /// </summary>
        private const long MAX_LENGTH = int.MaxValue;

        /// <summary>
        /// The number of bytes of cells a chunk of rows is sized to cover, chosen to sit inside a
        /// core's level 2 cache with room to spare for everything else the loop touches.
        /// </summary>
        private const int CHUNK_TARGET_BYTES = 512 * 1024;

        /// <summary>
        /// What one cell of a row occupies: a decimal and the flag saying whether it has a value,
        /// padded to the decimal's own alignment.
        /// </summary>
        private const int CELL_LENGTH = 24;

        private const int MINIMUM_CHUNK_ROWS = 256;

        private const int MAXIMUM_CHUNK_ROWS = 32768;

        /// <summary>
        /// The number of cells below which the columns are read on the calling thread, there being
        /// too few of them for handing the work to the thread pool to pay for itself.
        /// </summary>
        private const int PARALLEL_CELL_THRESHOLD = 50000;

        private static readonly UTF8Encoding MetadataEncoding = new UTF8Encoding(false);

        private static readonly JsonSerializerSettings MetadataJsonSettings =
            new JsonSerializerSettings
            {
                FloatFormatHandling = FloatFormatHandling.DefaultValue,
                Formatting = Formatting.None,
                ContractResolver = new MetadataContractResolver()
            };

        private readonly RenPackDecimalReader decimalReader = new RenPackDecimalReader();

        /// <summary>
        /// Returns the given collection written in the binary format, or null when it cannot be
        /// written in it and is to be served as JSON instead.
        /// </summary>
        public byte[] TryWrite(TabularDataSetCollection collection)
        {
            if (collection == null)
            {
                return null;
            }

            // A response saying which uploaded files are missing is recognised by the client as
            // text, before anything has decided what format it is in, so it stays JSON.
            if (collection.MissingUploadedFiles != null) return null;

            // Only a compressed collection has the numeric cell values this format is made of.
            if (!collection.IsCompressed) return null;

            var tabs = this.GetTabs(collection);

            if (tabs == null) return null;

            // The metadata and the dictionary have nothing to do with the cells, so the three are
            // measured at the same time; the columns' own work is parallel within itself.
            var metadataTask = Task.Run(() => this.SerialiseMetadata(collection));
            var dictionaryTask = Task.Run(
                () => new DictionaryPlan(collection.CompressionDictionary)
            );

            var tabPlans = this.PlanColumns(tabs);

            var metadataJson = metadataTask.Result;
            var dictionary = dictionaryTask.Result;

            if (tabPlans == null) return null;

            var plans = this.GetColumnPlans(tabPlans);

            var length = this.LayOut(metadataJson.Count, dictionary, plans, out var layout);

            if (length < 0) return null;

            var buffer = new byte[length];

            this.WriteHeader(buffer, metadataJson, layout, plans.Count, length);
            this.WriteDictionary(buffer, dictionary, layout);
            this.WriteDescriptors(buffer, plans, layout);
            this.WriteColumns(buffer, tabPlans);

            return buffer;
        }

        /// <summary>
        /// Returns every tabular data in the collection, in the order the metadata lists them, or
        /// null when the collection is not shaped the way the format expects.
        /// </summary>
        private List<TabularData> GetTabs(TabularDataSetCollection collection)
        {
            var tabs = collection.GetAllTabularDatas();

            for (var tabIndex = 0; tabIndex < tabs.Count; tabIndex++)
            {
                var tabularData = tabs[tabIndex];

                if (tabularData.RowModels == null || tabularData.ColumnModels == null)
                {
                    return null;
                }
            }

            return tabs;
        }

        /// <summary>
        /// Returns the collection as JSON, in UTF-8, without the rows or the dictionary that the
        /// binary blocks carry instead.
        /// </summary>
        /// <remarks>
        /// Written straight into a buffer of bytes rather than through
        /// <see cref="JsonConvert.SerializeObject(object)"/>, which would build the whole thing as
        /// a string - two bytes a character, on the large object heap for anything of any size -
        /// only for it to be encoded and copied again on its way into the response.
        /// </remarks>
        private ArraySegment<byte> SerialiseMetadata(TabularDataSetCollection collection)
        {
            var stream = new MemoryStream(1 << 16);

            using (var writer = new StreamWriter(stream, MetadataEncoding, 1 << 16, true))
            using (var jsonWriter = new JsonTextWriter(writer))
            {
                JsonSerializer.Create(MetadataJsonSettings).Serialize(jsonWriter, collection);
            }

            return new ArraySegment<byte>(stream.GetBuffer(), 0, (int)stream.Length);
        }

        /// <summary>
        /// Works out how each column is to be encoded, or returns null when any of them holds
        /// something this format cannot carry.
        /// </summary>
        private List<TabPlan> PlanColumns(List<TabularData> tabs)
        {
            var tabPlans = new List<TabPlan>(tabs.Count);

            for (var tabIndex = 0; tabIndex < tabs.Count; tabIndex++)
            {
                tabPlans.Add(new TabPlan(tabs[tabIndex], this.GetChunkSize(tabs[tabIndex])));
            }

            this.RunChunks(tabPlans, (tabPlan, chunkIndex, cells) =>
                this.AnalyseChunk(tabPlan, chunkIndex, cells));

            for (var tabIndex = 0; tabIndex < tabPlans.Count; tabIndex++)
            {
                if (!this.MergeChunkStats(tabPlans[tabIndex])) return null;
            }

            return tabPlans;
        }

        /// <summary>
        /// Returns every column of every tab, in the order the metadata lists them, which is the
        /// order the descriptors are written in.
        /// </summary>
        private List<ColumnPlan> GetColumnPlans(List<TabPlan> tabPlans)
        {
            var plans = new List<ColumnPlan>();

            for (var tabIndex = 0; tabIndex < tabPlans.Count; tabIndex++)
            {
                var columns = tabPlans[tabIndex].Columns;

                for (var columnIndex = 0; columnIndex < columns.Length; columnIndex++)
                {
                    plans.Add(columns[columnIndex]);
                }
            }

            return plans;
        }

        /// <summary>
        /// Gets the number of rows a chunk of the given tab covers, so that the cells of a chunk
        /// stay in cache from the column that first reads them to the one that reads them last.
        /// </summary>
        /// <remarks>
        /// A multiple of eight, so that no two chunks share a byte of a column's null bitset and
        /// each can therefore be written without synchronising with the others.
        /// </remarks>
        private int GetChunkSize(TabularData tabularData)
        {
            var columnCount = Math.Max(tabularData.ColumnModels.Count, 1);
            var rows = CHUNK_TARGET_BYTES / (CELL_LENGTH * columnCount);

            if (rows < MINIMUM_CHUNK_ROWS) rows = MINIMUM_CHUNK_ROWS;
            if (rows > MAXIMUM_CHUNK_ROWS) rows = MAXIMUM_CHUNK_ROWS;

            return (rows + 7) & ~7;
        }

        /// <summary>
        /// Runs the given action for every chunk of every tab, on the thread pool where there are
        /// enough cells to read for that to pay for itself.
        /// </summary>
        private void RunChunks(List<TabPlan> tabPlans, Action<TabPlan, int, decimal?[][]> action)
        {
            var works = new List<ChunkWork>();
            var cellCount = 0L;
            var longestChunk = 0;

            for (var tabIndex = 0; tabIndex < tabPlans.Count; tabIndex++)
            {
                var tabPlan = tabPlans[tabIndex];

                cellCount += (long)tabPlan.RowCount * tabPlan.Columns.Length;

                if (tabPlan.ChunkSize > longestChunk) longestChunk = tabPlan.ChunkSize;

                for (var chunkIndex = 0; chunkIndex < tabPlan.ChunkCount; chunkIndex++)
                {
                    works.Add(new ChunkWork(tabPlan, chunkIndex));
                }
            }

            if (works.Count < 2 || cellCount < PARALLEL_CELL_THRESHOLD)
            {
                var cells = new decimal?[longestChunk][];

                for (var index = 0; index < works.Count; index++)
                {
                    action(works[index].TabPlan, works[index].ChunkIndex, cells);
                }

                return;
            }

            // One gathering buffer per thread rather than one per chunk.  The collection being
            // written is itself large and still live, so a pass that allocated its way through the
            // rows would leave the reading of them competing with a collection of the heap.
            Parallel.For(
                0,
                works.Count,
                () => new decimal?[longestChunk][],
                (index, state, cells) =>
                {
                    action(works[index].TabPlan, works[index].ChunkIndex, cells);

                    return cells;
                },
                cells => { }
            );
        }

        /// <summary>
        /// Reads one chunk of one tab's rows, recording for each of its columns the narrowest
        /// encoding that chunk's values would fit into.
        /// </summary>
        private void AnalyseChunk(TabPlan tabPlan, int chunkIndex, decimal?[][] cells)
        {
            var rowCount = tabPlan.GatherChunkCells(chunkIndex, cells);
            var columnCount = tabPlan.Columns.Length;
            var statsOffset = chunkIndex * columnCount;

            if (rowCount < 0)
            {
                // A row with no compressed values means the collection was never compressed after
                // all, whatever its dictionary says.  Every chunk that finds one writes the same
                // value here, so the chunks racing each other over it changes nothing.
                tabPlan.IsUnwritable = true;

                return;
            }

            for (var columnIndex = 0; columnIndex < columnCount; columnIndex++)
            {
                var scale = RenPackFormat.GetScale(tabPlan.Columns[columnIndex].ScaleCode);

                tabPlan.ChunkStats[statsOffset + columnIndex] = scale == 1
                    ? this.AnalyseChunkColumn(cells, rowCount, columnIndex)
                    : this.AnalyseScaledChunkColumn(cells, rowCount, columnIndex, scale);
            }
        }

        /// <summary>
        /// Reads one column of one chunk's rows.
        /// </summary>
        private ColumnStats AnalyseChunkColumn(decimal?[][] cells, int rowCount, int columnIndex)
        {
            var hasNulls = false;
            var isIntegral = true;
            var hasFast = false;
            var minFast = 0L;
            var maxFast = 0L;
            var hasSlow = false;
            var minSlow = 0m;
            var maxSlow = 0m;

            for (var index = 0; index < rowCount; index++)
            {
                var compressedValues = cells[index];

                var value = columnIndex < compressedValues.Length
                    ? compressedValues[columnIndex]
                    : null;

                if (!value.HasValue)
                {
                    hasNulls = true;

                    // Nothing else about the column can change once its values are known not to
                    // fit an integer encoding, so there is no reason to read the rest of them.
                    if (!isIntegral) break;

                    continue;
                }

                if (!isIntegral) continue;

                var number = value.GetValueOrDefault();

                if (this.decimalReader.TryGetIntegral(number, out var integral))
                {
                    if (!hasFast)
                    {
                        minFast = integral;
                        maxFast = integral;
                        hasFast = true;
                    }
                    else if (integral < minFast) minFast = integral;
                    else if (integral > maxFast) maxFast = integral;
                }
                else if (decimal.Truncate(number) != number)
                {
                    isIntegral = false;
                }
                else if (!hasSlow)
                {
                    minSlow = number;
                    maxSlow = number;
                    hasSlow = true;
                }
                else if (number < minSlow) minSlow = number;
                else if (number > maxSlow) maxSlow = number;
            }

            var stats = new ColumnStats();

            stats.HasNulls = hasNulls;
            stats.IsIntegral = isIntegral;
            stats.HasFast = hasFast;
            stats.MinFast = minFast;
            stats.MaxFast = maxFast;
            stats.HasSlow = hasSlow;
            stats.MinSlow = minSlow;
            stats.MaxSlow = maxSlow;
            stats.IsScalable = true;

            return stats;
        }

        /// <summary>
        /// Reads one column of one chunk's rows, for a column whose values are meant to be whole
        /// multiples of the given scale.  The range recorded is of the values themselves, not of
        /// the multiples.
        /// </summary>
        private ColumnStats AnalyseScaledChunkColumn(
            decimal?[][] cells, int rowCount, int columnIndex, long scale)
        {
            var stats = new ColumnStats();

            stats.IsIntegral = true;
            stats.IsScalable = true;

            for (var index = 0; index < rowCount; index++)
            {
                var compressedValues = cells[index];

                var value = columnIndex < compressedValues.Length
                    ? compressedValues[columnIndex]
                    : null;

                if (!value.HasValue)
                {
                    stats.HasNulls = true;
                    continue;
                }

                if (!this.TryGetInt64(value.GetValueOrDefault(), out var integral))
                {
                    // Not a date after all, so the column is written as the numbers it holds.
                    stats.IsIntegral = false;
                    stats.IsScalable = false;
                    stats.HasFast = false;
                    stats.HasNulls = stats.HasNulls || this.HasNullAfter(
                        cells, rowCount, columnIndex, index
                    );

                    break;
                }

                if (integral % scale != 0) stats.IsScalable = false;

                if (!stats.HasFast)
                {
                    stats.MinFast = integral;
                    stats.MaxFast = integral;
                    stats.HasFast = true;
                }
                else if (integral < stats.MinFast)
                {
                    stats.MinFast = integral;
                }
                else if (integral > stats.MaxFast)
                {
                    stats.MaxFast = integral;
                }
            }

            return stats;
        }

        /// <summary>
        /// Gets a value indicating whether any of a chunk's cells in the given column after the
        /// given row is null.
        /// </summary>
        private bool HasNullAfter(decimal?[][] cells, int rowCount, int columnIndex, int index)
        {
            for (var laterIndex = index + 1; laterIndex < rowCount; laterIndex++)
            {
                var compressedValues = cells[laterIndex];

                if (columnIndex >= compressedValues.Length ||
                    !compressedValues[columnIndex].HasValue)
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>
        /// Gets the given value as a 64-bit whole number, returning false when it isn't a whole
        /// number or is outside the range of a 64-bit signed integer.
        /// </summary>
        private bool TryGetInt64(decimal value, out long integral)
        {
            if (this.decimalReader.TryGetInt64(value, out integral)) return true;

            if (decimal.Truncate(value) != value || value < long.MinValue || value > long.MaxValue)
            {
                integral = 0;

                return false;
            }

            integral = (long)value;

            return true;
        }

        /// <summary>
        /// Folds every chunk's reading of a tab into its columns, returning false when any of them
        /// held something this format cannot carry.
        /// </summary>
        private bool MergeChunkStats(TabPlan tabPlan)
        {
            if (tabPlan.IsUnwritable) return false;

            var columnCount = tabPlan.Columns.Length;

            for (var columnIndex = 0; columnIndex < columnCount; columnIndex++)
            {
                var merged = new ColumnStats();

                merged.IsIntegral = true;
                merged.IsScalable = true;

                for (var chunkIndex = 0; chunkIndex < tabPlan.ChunkCount; chunkIndex++)
                {
                    this.Merge(
                        ref merged, tabPlan.ChunkStats[(chunkIndex * columnCount) + columnIndex]
                    );
                }

                var plan = tabPlan.Columns[columnIndex];

                if (plan.ScaleCode != RenPackFormat.SCALE_CODE_NONE)
                {
                    if (merged.IsIntegral && merged.IsScalable)
                    {
                        // Every value is a whole multiple, so dividing the range is the same as
                        // dividing each value and measuring the result.
                        var scale = RenPackFormat.GetScale(plan.ScaleCode);

                        merged.MinFast /= scale;
                        merged.MaxFast /= scale;
                    }
                    else
                    {
                        plan.ScaleCode = RenPackFormat.SCALE_CODE_NONE;
                    }
                }

                plan.HasNulls = merged.HasNulls;
                plan.Encoding = this.ChooseEncoding(merged);
            }

            return true;
        }

        private void Merge(ref ColumnStats merged, ColumnStats stats)
        {
            if (stats.HasNulls) merged.HasNulls = true;
            if (!stats.IsIntegral) merged.IsIntegral = false;
            if (!stats.IsScalable) merged.IsScalable = false;

            if (stats.HasFast)
            {
                if (!merged.HasFast)
                {
                    merged.MinFast = stats.MinFast;
                    merged.MaxFast = stats.MaxFast;
                    merged.HasFast = true;
                }
                else
                {
                    if (stats.MinFast < merged.MinFast) merged.MinFast = stats.MinFast;
                    if (stats.MaxFast > merged.MaxFast) merged.MaxFast = stats.MaxFast;
                }
            }

            if (!stats.HasSlow) return;

            if (!merged.HasSlow)
            {
                merged.MinSlow = stats.MinSlow;
                merged.MaxSlow = stats.MaxSlow;
                merged.HasSlow = true;
            }
            else
            {
                if (stats.MinSlow < merged.MinSlow) merged.MinSlow = stats.MinSlow;
                if (stats.MaxSlow > merged.MaxSlow) merged.MaxSlow = stats.MaxSlow;
            }
        }

        private byte ChooseEncoding(ColumnStats stats)
        {
            if (!stats.IsIntegral) return RenPackFormat.ENCODING_FLOAT64;

            var minimum = 0m;
            var maximum = 0m;

            if (stats.HasFast)
            {
                minimum = stats.MinFast;
                maximum = stats.MaxFast;
            }

            if (stats.HasSlow)
            {
                if (!stats.HasFast)
                {
                    minimum = stats.MinSlow;
                    maximum = stats.MaxSlow;
                }
                else
                {
                    if (stats.MinSlow < minimum) minimum = stats.MinSlow;
                    if (stats.MaxSlow > maximum) maximum = stats.MaxSlow;
                }
            }

            if (minimum >= 0m)
            {
                if (maximum <= byte.MaxValue) return RenPackFormat.ENCODING_UINT8;
                if (maximum <= ushort.MaxValue) return RenPackFormat.ENCODING_UINT16;
                if (maximum <= uint.MaxValue) return RenPackFormat.ENCODING_UINT32;
            }
            else if (minimum >= int.MinValue && maximum <= int.MaxValue)
            {
                return RenPackFormat.ENCODING_INT32;
            }

            return RenPackFormat.ENCODING_FLOAT64;
        }

        /// <summary>
        /// Places every block in the response and returns its total length, or -1 when that length
        /// would be more than the format's offsets can address.
        /// </summary>
        private long LayOut(
            int metadataJsonLength,
            DictionaryPlan dictionary,
            List<ColumnPlan> plans,
            out Layout layout)
        {
            layout = new Layout();

            layout.DictionaryOffset = RenPackFormat.Align8(
                RenPackFormat.HEADER_LENGTH + metadataJsonLength
            );

            var dictionaryLength =
                (long)RenPackFormat.DICTIONARY_HEADER_LENGTH +
                ((long)dictionary.LengthWidth * dictionary.Count) +
                dictionary.BlobLength;

            var cursor = layout.DictionaryOffset + dictionaryLength;

            if (cursor > MAX_LENGTH) return -1;

            layout.DescriptorsOffset = RenPackFormat.Align8((int)cursor);

            cursor = layout.DescriptorsOffset +
                ((long)RenPackFormat.DESCRIPTOR_LENGTH * plans.Count);

            for (var index = 0; index < plans.Count; index++)
            {
                var plan = plans[index];

                if (cursor > MAX_LENGTH) return -1;

                cursor = RenPackFormat.Align8((int)cursor);

                plan.ValuesOffset = (int)cursor;

                cursor += (long)plan.RowCount * RenPackFormat.GetValueLength(plan.Encoding);

                if (cursor > MAX_LENGTH) return -1;

                if (plan.HasNulls)
                {
                    plan.NullsOffset = (int)cursor;

                    cursor += (plan.RowCount + 7) / 8;

                    if (cursor > MAX_LENGTH) return -1;
                }
            }

            return cursor;
        }

        private void WriteHeader(
            byte[] buffer,
            ArraySegment<byte> metadataJson,
            Layout layout,
            int columnCount,
            long length)
        {
            buffer[0] = (byte)'R';
            buffer[1] = (byte)'E';
            buffer[2] = (byte)'N';
            buffer[3] = (byte)'P';

            WriteUInt32(buffer, 4, RenPackFormat.VERSION);
            WriteUInt32(buffer, 8, (uint)metadataJson.Count);
            WriteUInt32(buffer, 12, (uint)layout.DictionaryOffset);
            WriteUInt32(buffer, 16, (uint)layout.DescriptorsOffset);
            WriteUInt32(buffer, 20, (uint)columnCount);
            WriteUInt32(buffer, 24, (uint)length);
            WriteUInt32(buffer, 28, 0);

            Buffer.BlockCopy(
                metadataJson.Array,
                metadataJson.Offset,
                buffer,
                RenPackFormat.HEADER_LENGTH,
                metadataJson.Count
            );
        }

        private void WriteDictionary(byte[] buffer, DictionaryPlan dictionary, Layout layout)
        {
            dictionary.Write(buffer, layout.DictionaryOffset);
        }

        private void WriteDescriptors(byte[] buffer, List<ColumnPlan> plans, Layout layout)
        {
            for (var index = 0; index < plans.Count; index++)
            {
                var plan = plans[index];
                var offset = layout.DescriptorsOffset + (index * RenPackFormat.DESCRIPTOR_LENGTH);

                buffer[offset] = plan.Encoding;
                buffer[offset + 1] = (byte)(plan.HasNulls ? 1 : 0);
                buffer[offset + 2] = (byte)plan.ScaleCode;
                buffer[offset + 3] = (byte)(plan.ScaleCode >> 8);

                WriteUInt32(buffer, offset + 4, (uint)plan.RowCount);
                WriteUInt32(buffer, offset + 8, (uint)plan.ValuesOffset);
                WriteUInt32(buffer, offset + 12, (uint)plan.NullsOffset);
            }
        }

        /// <summary>
        /// Writes every column's values, a chunk of rows at a time and in parallel: no two chunks
        /// share a byte of the buffer, the null bitsets included.
        /// </summary>
        private void WriteColumns(byte[] buffer, List<TabPlan> tabPlans)
        {
            this.RunChunks(tabPlans, (tabPlan, chunkIndex, cells) =>
                this.WriteChunk(buffer, tabPlan, chunkIndex, cells));
        }

        private void WriteChunk(
            byte[] buffer, TabPlan tabPlan, int chunkIndex, decimal?[][] cells)
        {
            var rowCount = tabPlan.GatherChunkCells(chunkIndex, cells);

            if (rowCount < 0) return;

            var start = chunkIndex * tabPlan.ChunkSize;

            for (var columnIndex = 0; columnIndex < tabPlan.Columns.Length; columnIndex++)
            {
                this.WriteChunkColumn(
                    buffer, cells, rowCount, tabPlan.Columns[columnIndex], columnIndex, start
                );
            }
        }

        /// <summary>
        /// Writes one column of one chunk's rows, and the bits marking which of its cells are
        /// null.
        /// </summary>
        /// <remarks>
        /// A loop of its own for each encoding, rather than one loop deciding what to write as it
        /// goes.  Deciding once a column costs nothing; deciding once a cell puts a branch and a
        /// call, neither of which the compiler can see past, between every value and the buffer.
        /// </remarks>
        private void WriteChunkColumn(
            byte[] buffer,
            decimal?[][] cells,
            int rowCount,
            ColumnPlan plan,
            int columnIndex,
            int start)
        {
            var encoding = plan.Encoding;
            var valuesOffset = plan.ValuesOffset +
                (start * RenPackFormat.GetValueLength(encoding));

            // The value slot of a null cell is left at zero, which is what the client reads for a
            // cell the bitset marks as null.
            var nullsOffset = plan.NullsOffset + (start >> 3);

            if (plan.ScaleCode != RenPackFormat.SCALE_CODE_NONE)
            {
                this.WriteScaledColumn(
                    buffer,
                    cells,
                    rowCount,
                    columnIndex,
                    encoding,
                    RenPackFormat.GetScale(plan.ScaleCode),
                    valuesOffset,
                    nullsOffset
                );

                return;
            }

            if (encoding == RenPackFormat.ENCODING_FLOAT64)
            {
                this.WriteFloat64Column(
                    buffer, cells, rowCount, columnIndex, valuesOffset, nullsOffset
                );

                return;
            }

            if (encoding == RenPackFormat.ENCODING_UINT8)
            {
                this.WriteUInt8Column(
                    buffer, cells, rowCount, columnIndex, valuesOffset, nullsOffset
                );

                return;
            }

            if (encoding == RenPackFormat.ENCODING_UINT16)
            {
                this.WriteUInt16Column(
                    buffer, cells, rowCount, columnIndex, valuesOffset, nullsOffset
                );

                return;
            }

            // The signed and unsigned four-byte encodings differ only in how the client reads
            // them back: both are the low word of the value as it stands.
            this.WriteWordColumn(
                buffer, cells, rowCount, columnIndex, valuesOffset, nullsOffset
            );
        }

        private void WriteUInt8Column(
            byte[] buffer,
            decimal?[][] cells,
            int rowCount,
            int columnIndex,
            int valuesOffset,
            int nullsOffset)
        {
            for (var index = 0; index < rowCount; index++)
            {
                var compressedValues = cells[index];

                var value = columnIndex < compressedValues.Length
                    ? compressedValues[columnIndex]
                    : null;

                if (!value.HasValue)
                {
                    buffer[nullsOffset + (index >> 3)] |= (byte)(1 << (index & 7));
                    continue;
                }

                buffer[valuesOffset + index] =
                    (byte)this.GetIntegral(value.GetValueOrDefault());
            }
        }

        private void WriteUInt16Column(
            byte[] buffer,
            decimal?[][] cells,
            int rowCount,
            int columnIndex,
            int valuesOffset,
            int nullsOffset)
        {
            for (var index = 0; index < rowCount; index++)
            {
                var compressedValues = cells[index];

                var value = columnIndex < compressedValues.Length
                    ? compressedValues[columnIndex]
                    : null;

                if (!value.HasValue)
                {
                    buffer[nullsOffset + (index >> 3)] |= (byte)(1 << (index & 7));
                    continue;
                }

                var integral = (ulong)this.GetIntegral(value.GetValueOrDefault());
                var offset = valuesOffset + (2 * index);

                buffer[offset] = (byte)integral;
                buffer[offset + 1] = (byte)(integral >> 8);
            }
        }

        private void WriteWordColumn(
            byte[] buffer,
            decimal?[][] cells,
            int rowCount,
            int columnIndex,
            int valuesOffset,
            int nullsOffset)
        {
            for (var index = 0; index < rowCount; index++)
            {
                var compressedValues = cells[index];

                var value = columnIndex < compressedValues.Length
                    ? compressedValues[columnIndex]
                    : null;

                if (!value.HasValue)
                {
                    buffer[nullsOffset + (index >> 3)] |= (byte)(1 << (index & 7));
                    continue;
                }

                WriteUInt32(
                    buffer,
                    valuesOffset + (4 * index),
                    unchecked((uint)this.GetIntegral(value.GetValueOrDefault()))
                );
            }
        }

        private void WriteFloat64Column(
            byte[] buffer,
            decimal?[][] cells,
            int rowCount,
            int columnIndex,
            int valuesOffset,
            int nullsOffset)
        {
            for (var index = 0; index < rowCount; index++)
            {
                var compressedValues = cells[index];

                var value = columnIndex < compressedValues.Length
                    ? compressedValues[columnIndex]
                    : null;

                if (!value.HasValue)
                {
                    buffer[nullsOffset + (index >> 3)] |= (byte)(1 << (index & 7));
                    continue;
                }

                var number = value.GetValueOrDefault();

                if (!this.decimalReader.TryGetExactDouble(number, out var asDouble))
                {
                    asDouble = (double)number;
                }

                WriteInt64(
                    buffer, valuesOffset + (8 * index), BitConverter.DoubleToInt64Bits(asDouble)
                );
            }
        }

        /// <summary>
        /// Writes one chunk of a column whose values were measured to be whole multiples of the
        /// given scale, as those multiples.
        /// </summary>
        /// <remarks>
        /// One loop for every encoding, deciding which as it goes: only a date column is scaled,
        /// and a report has few enough of them that a loop apiece would be more code than it saved
        /// time.
        /// </remarks>
        private void WriteScaledColumn(
            byte[] buffer,
            decimal?[][] cells,
            int rowCount,
            int columnIndex,
            byte encoding,
            long scale,
            int valuesOffset,
            int nullsOffset)
        {
            var valueLength = RenPackFormat.GetValueLength(encoding);

            for (var index = 0; index < rowCount; index++)
            {
                var compressedValues = cells[index];

                var value = columnIndex < compressedValues.Length
                    ? compressedValues[columnIndex]
                    : null;

                if (!value.HasValue)
                {
                    buffer[nullsOffset + (index >> 3)] |= (byte)(1 << (index & 7));
                    continue;
                }

                this.TryGetInt64(value.GetValueOrDefault(), out var integral);

                var scaled = integral / scale;
                var offset = valuesOffset + (valueLength * index);

                switch (encoding)
                {
                    case RenPackFormat.ENCODING_UINT8:
                        buffer[offset] = (byte)scaled;
                        break;

                    case RenPackFormat.ENCODING_UINT16:
                        buffer[offset] = (byte)scaled;
                        buffer[offset + 1] = (byte)(scaled >> 8);
                        break;

                    case RenPackFormat.ENCODING_FLOAT64:
                        WriteInt64(buffer, offset, BitConverter.DoubleToInt64Bits(scaled));
                        break;

                    default:
                        WriteUInt32(buffer, offset, unchecked((uint)scaled));
                        break;
                }
            }
        }

        /// <summary>
        /// Gets the given value as a whole number, for a column that was measured to hold nothing
        /// else.
        /// </summary>
        /// <remarks>
        /// Only a mantissa of 2^32 or more is left for the decimal operations, and a column of
        /// those is wider than any of the integer encodings anyway - bar one whose values run
        /// right up to the top of the unsigned range at a scale, which is rare enough to be worth
        /// reading the slow way.
        /// </remarks>
        private long GetIntegral(decimal value)
        {
            return this.decimalReader.TryGetIntegral(value, out var integral)
                ? integral
                : (long)decimal.Truncate(value);
        }

        private static void WriteUInt32(byte[] buffer, int offset, uint value)
        {
            buffer[offset] = (byte)value;
            buffer[offset + 1] = (byte)(value >> 8);
            buffer[offset + 2] = (byte)(value >> 16);
            buffer[offset + 3] = (byte)(value >> 24);
        }

        private static void WriteInt64(byte[] buffer, int offset, long value)
        {
            buffer[offset] = (byte)value;
            buffer[offset + 1] = (byte)(value >> 8);
            buffer[offset + 2] = (byte)(value >> 16);
            buffer[offset + 3] = (byte)(value >> 24);
            buffer[offset + 4] = (byte)(value >> 32);
            buffer[offset + 5] = (byte)(value >> 40);
            buffer[offset + 6] = (byte)(value >> 48);
            buffer[offset + 7] = (byte)(value >> 56);
        }

        /// <summary>
        /// Where each block of the response begins.
        /// </summary>
        private class Layout
        {
            public int DictionaryOffset;
            public int DescriptorsOffset;
        }

        /// <summary>
        /// One chunk of one tab's rows: the unit of work both passes over the cells are divided
        /// into.
        /// </summary>
        private struct ChunkWork
        {
            public ChunkWork(TabPlan tabPlan, int chunkIndex)
            {
                this.TabPlan = tabPlan;
                this.ChunkIndex = chunkIndex;
            }

            public TabPlan TabPlan { get; }

            public int ChunkIndex { get; }
        }

        /// <summary>
        /// What each chunk of rows read of one of its columns.  Whole numbers small enough to have
        /// been read as integers are held apart from the rest, so that the common column costs no
        /// decimal arithmetic at all.
        /// </summary>
        private struct ColumnStats
        {
            public bool HasNulls;
            public bool IsIntegral;

            public bool HasFast;
            public long MinFast;
            public long MaxFast;

            public bool HasSlow;
            public decimal MinSlow;
            public decimal MaxSlow;

            /// <summary>
            /// Whether every value is a whole multiple of the column's scale, for a scaled column.
            /// </summary>
            public bool IsScalable;
        }

        /// <summary>
        /// One tab, divided into the chunks of rows its columns are read in.
        /// </summary>
        private class TabPlan
        {
            private readonly TabularData tabularData;

            public TabPlan(TabularData tabularData, int chunkSize)
            {
                this.tabularData = tabularData;
                this.RowCount = tabularData.RowModels.Count;
                this.ChunkSize = chunkSize;
                this.ChunkCount = (this.RowCount + chunkSize - 1) / chunkSize;

                var columnCount = tabularData.ColumnModels.Count;
                var valueEncodings = tabularData.ColumnValueEncodings;

                this.Columns = new ColumnPlan[columnCount];

                for (var columnIndex = 0; columnIndex < columnCount; columnIndex++)
                {
                    var plan = new ColumnPlan(this.RowCount);

                    if (valueEncodings != null && columnIndex < valueEncodings.Length)
                    {
                        plan.ScaleCode = this.GetScaleCode(valueEncodings[columnIndex]);
                    }

                    this.Columns[columnIndex] = plan;
                }

                this.ChunkStats = new ColumnStats[this.ChunkCount * columnCount];
            }

            public ColumnPlan[] Columns { get; }

            public int RowCount { get; }

            public int ChunkSize { get; }

            public int ChunkCount { get; }

            public ColumnStats[] ChunkStats { get; }

            /// <summary>
            /// Gets the scale a column of the given value encoding is to be tried at: a date's
            /// milliseconds are a whole number of days, and a date-time's of seconds.
            /// </summary>
            private ushort GetScaleCode(int valueEncoding)
            {
                switch (valueEncoding)
                {
                    case TabularData.VALUE_ENCODING_DATE_EPOCH_MS:
                        return RenPackFormat.SCALE_CODE_DAYS;

                    case TabularData.VALUE_ENCODING_DATE_TIME_EPOCH_MS:
                        return RenPackFormat.SCALE_CODE_SECONDS;

                    default:
                        return RenPackFormat.SCALE_CODE_NONE;
                }
            }

            /// <summary>
            /// Gets or sets a value indicating whether a chunk found a row this format cannot
            /// carry, which leaves the whole collection to be written as JSON.
            /// </summary>
            public bool IsUnwritable { get; set; }

            /// <summary>
            /// Gathers the compressed values of the rows in the given chunk into the given buffer
            /// and returns how many of them there are, or -1 when one of the rows has none.
            /// </summary>
            /// <remarks>
            /// Gathered once so that the columns read them through a plain array rather than
            /// following the row objects again for each of them.
            /// </remarks>
            public int GatherChunkCells(int chunkIndex, decimal?[][] cells)
            {
                var rowModels = this.tabularData.RowModels;
                var start = chunkIndex * this.ChunkSize;
                var end = Math.Min(start + this.ChunkSize, this.RowCount);

                for (var rowIndex = start; rowIndex < end; rowIndex++)
                {
                    var compressedValues = rowModels[rowIndex].CV;

                    if (compressedValues == null) return -1;

                    cells[rowIndex - start] = compressedValues;
                }

                return end - start;
            }
        }

        /// <summary>
        /// One column of one tabular data: how its values are to be encoded, and where they go.
        /// </summary>
        private class ColumnPlan
        {
            public ColumnPlan(int rowCount)
            {
                this.RowCount = rowCount;
            }

            public int RowCount { get; }

            public byte Encoding { get; set; }

            /// <summary>
            /// Gets or sets the scale code the column's values are written at, one of the
            /// RenPackFormat SCALE_CODE constants.
            /// </summary>
            public ushort ScaleCode { get; set; }

            public bool HasNulls { get; set; }

            public int ValuesOffset { get; set; }

            public int NullsOffset { get; set; }
        }

        /// <summary>
        /// The compression dictionary, measured so that it can be laid out, and then written
        /// straight into the response buffer without an intermediate copy of every string.
        /// </summary>
        private class DictionaryPlan
        {
            /// <summary>
            /// The number of strings measured and written by one unit of work.  A dictionary runs
            /// to hundreds of thousands of them, and both passes over it are a good deal of the
            /// time this class costs, so they are shared out rather than run on one thread.
            /// </summary>
            private const int CHUNK_SIZE = 4096;

            /// <summary>
            /// The number of strings below which both passes are run on the calling thread.
            /// </summary>
            private const int PARALLEL_THRESHOLD = 8192;

            private readonly string[] strings;
            private readonly uint[] lengths;
            private readonly long[] chunkBlobStarts;
            private readonly int chunkCount;

            public DictionaryPlan(string[] compressionDictionary)
            {
                this.strings = compressionDictionary ?? new string[0];
                this.lengths = new uint[this.strings.Length];
                this.chunkCount = (this.strings.Length + CHUNK_SIZE - 1) / CHUNK_SIZE;
                this.chunkBlobStarts = new long[this.chunkCount];

                var chunkBlobLengths = new long[this.chunkCount];
                var isAscii = new bool[this.chunkCount];
                var longest = new uint[this.chunkCount];

                this.RunChunks(
                    chunkIndex => this.Measure(chunkIndex, chunkBlobLengths, isAscii, longest)
                );

                var blobLength = 0L;
                var isAsciiThroughout = true;
                var longestOfAll = 0u;

                for (var chunkIndex = 0; chunkIndex < this.chunkCount; chunkIndex++)
                {
                    this.chunkBlobStarts[chunkIndex] = blobLength;

                    blobLength += chunkBlobLengths[chunkIndex];

                    if (!isAscii[chunkIndex]) isAsciiThroughout = false;
                    if (longest[chunkIndex] > longestOfAll) longestOfAll = longest[chunkIndex];
                }

                this.BlobLength = blobLength;
                this.IsAscii = isAsciiThroughout;

                // A width can only be used if the value that says "null" at it - all of its bits
                // set - is longer than every string, so that no real length can be mistaken for
                // one.  Nearly every dictionary a report produces fits in a single byte per
                // string, which is a quarter of what a fixed-width table would take.
                this.LengthWidth = longestOfAll < byte.MaxValue
                    ? 1
                    : longestOfAll < ushort.MaxValue ? 2 : 4;
            }

            public int Count => this.strings.Length;

            public long BlobLength { get; }

            public bool IsAscii { get; }

            /// <summary>
            /// Gets the number of bytes each entry of the length table is written at.
            /// </summary>
            public int LengthWidth { get; }

            public void Write(byte[] buffer, int offset)
            {
                WriteUInt32(buffer, offset, (uint)this.Count);

                WriteUInt32(
                    buffer,
                    offset + 4,
                    this.IsAscii ? RenPackFormat.DICTIONARY_FLAG_ASCII : 0
                );

                WriteUInt32(buffer, offset + 8, (uint)this.BlobLength);
                WriteUInt32(buffer, offset + 12, (uint)this.LengthWidth);

                var lengthsOffset = offset + RenPackFormat.DICTIONARY_HEADER_LENGTH;
                var blobOffset = lengthsOffset + (this.LengthWidth * this.Count);

                this.RunChunks(chunkIndex =>
                    this.WriteChunk(buffer, chunkIndex, lengthsOffset, blobOffset));
            }

            private void RunChunks(Action<int> action)
            {
                if (this.strings.Length < PARALLEL_THRESHOLD)
                {
                    for (var chunkIndex = 0; chunkIndex < this.chunkCount; chunkIndex++)
                    {
                        action(chunkIndex);
                    }

                    return;
                }

                Parallel.For(0, this.chunkCount, chunkIndex => action(chunkIndex));
            }

            /// <summary>
            /// Measures one chunk of the dictionary's strings, which the constructor turns into
            /// the offset each chunk's bytes start at.
            /// </summary>
            private void Measure(
                int chunkIndex, long[] chunkBlobLengths, bool[] isAscii, uint[] longest)
            {
                var start = chunkIndex * CHUNK_SIZE;
                var end = Math.Min(start + CHUNK_SIZE, this.strings.Length);

                var blobLength = 0L;
                var isAsciiThroughout = true;
                var longestOfChunk = 0u;

                for (var index = start; index < end; index++)
                {
                    var value = this.strings[index];

                    if (value == null)
                    {
                        // Distinguished from an empty string, which the client would otherwise
                        // have no way to tell it from.
                        this.lengths[index] = uint.MaxValue;
                        continue;
                    }

                    // A string's UTF-8 length matches its character count only when every one of
                    // its characters is ASCII, which is what lets the client decode the whole blob
                    // in one call and slice the strings out of the result by byte offset.  Nearly
                    // every string in a dictionary is one, and this finds that out and measures it
                    // in the same pass rather than calling the encoder for each of them.
                    var byteLength = value.Length;

                    for (var characterIndex = 0; characterIndex < value.Length; characterIndex++)
                    {
                        if (value[characterIndex] > 127)
                        {
                            byteLength = Encoding.UTF8.GetByteCount(value);
                            isAsciiThroughout = false;
                            break;
                        }
                    }

                    this.lengths[index] = (uint)byteLength;

                    blobLength += byteLength;

                    if (byteLength > longestOfChunk) longestOfChunk = (uint)byteLength;
                }

                chunkBlobLengths[chunkIndex] = blobLength;

                isAscii[chunkIndex] = isAsciiThroughout;
                longest[chunkIndex] = longestOfChunk;
            }

            /// <summary>
            /// Writes one chunk's lengths and its strings' bytes.
            /// </summary>
            private void WriteChunk(
                byte[] buffer, int chunkIndex, int lengthsOffset, int blobOffset)
            {
                var start = chunkIndex * CHUNK_SIZE;
                var end = Math.Min(start + CHUNK_SIZE, this.strings.Length);

                this.WriteLengths(buffer, lengthsOffset, start, end);

                var offset = blobOffset + (int)this.chunkBlobStarts[chunkIndex];

                for (var index = start; index < end; index++)
                {
                    var value = this.strings[index];

                    if (value == null) continue;

                    if (this.IsAscii)
                    {
                        for (var characterIndex = 0;
                            characterIndex < value.Length;
                            characterIndex++)
                        {
                            buffer[offset + characterIndex] = (byte)value[characterIndex];
                        }

                        offset += value.Length;
                    }
                    else
                    {
                        offset += Encoding.UTF8.GetBytes(
                            value, 0, value.Length, buffer, offset
                        );
                    }
                }
            }

            /// <summary>
            /// Writes a run of the length table at the width the strings were measured to fit
            /// into.
            /// </summary>
            /// <remarks>
            /// A null string's length is held here as every bit of a uint set, so keeping the low
            /// bytes of it gives the value that says "null" at any of the three widths.
            /// </remarks>
            private void WriteLengths(byte[] buffer, int offset, int start, int end)
            {
                if (this.LengthWidth == 4)
                {
                    for (var index = start; index < end; index++)
                    {
                        WriteUInt32(buffer, offset + (4 * index), this.lengths[index]);
                    }

                    return;
                }

                if (this.LengthWidth == 2)
                {
                    for (var index = start; index < end; index++)
                    {
                        var length = this.lengths[index];

                        buffer[offset + (2 * index)] = (byte)length;
                        buffer[offset + (2 * index) + 1] = (byte)(length >> 8);
                    }

                    return;
                }

                for (var index = start; index < end; index++)
                {
                    buffer[offset + index] = (byte)this.lengths[index];
                }
            }
        }

        /// <summary>
        /// Leaves out of the metadata JSON the two things the binary blocks carry instead: the rows
        /// of each tabular data, and the compression dictionary.
        /// </summary>
        private class MetadataContractResolver : DefaultContractResolver
        {
            protected override JsonProperty CreateProperty(
                MemberInfo member, MemberSerialization memberSerialization)
            {
                var property = base.CreateProperty(member, memberSerialization);

                var isRows =
                    property.DeclaringType == typeof(TabularData) &&
                    property.PropertyName == nameof(TabularData.RowModels);

                var isDictionary =
                    property.DeclaringType == typeof(TabularDataSetCollection) &&
                    property.PropertyName ==
                        nameof(TabularDataSetCollection.CompressionDictionary);

                if (isRows || isDictionary) property.ShouldSerialize = instance => false;

                return property;
            }
        }
    }
}
