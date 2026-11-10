using System;
using System.Collections.Generic;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Ren.Compression;
using Ren.Models;

namespace Ren.Tests
{
    [TestClass]
    public class TabularDataSetCollectionCompressorTests
    {
        private readonly TabularDataSetCollectionCompressor compressor;

        public TabularDataSetCollectionCompressorTests()
        {
            this.compressor = new TabularDataSetCollectionCompressor();
        }

        [TestMethod]
        public void Compress_DateColumn_CompressedValuesAreEpochMilliseconds()
        {
            var collection = this.CreateCollection(
                TabularDataColumnFormatEnum.Date, "2024-01-15", "2024-02-29"
            );

            this.compressor.Compress(collection);

            var tabularData = collection.TabularDataSets[0].TabularDatas[0];

            Assert.AreEqual(
                TabularData.VALUE_ENCODING_DATE_EPOCH_MS,
                tabularData.ColumnValueEncodings[0]
            );

            Assert.IsTrue(tabularData.IsColumnCompressed[0]);
            
            Assert.AreEqual(
                this.GetEpochMilliseconds(new DateTime(2024, 1, 15)),
                tabularData.RowModels[0].CV[0]
            );

            Assert.AreEqual(
                this.GetEpochMilliseconds(new DateTime(2024, 2, 29)),
                tabularData.RowModels[1].CV[0]
            );
        }

        [TestMethod]
        public void Compress_DateTimeColumn_CompressedValuesAreEpochMilliseconds()
        {
            var collection = this.CreateCollection(
                TabularDataColumnFormatEnum.DateTime, "2024-01-15 13:45:10"
            );

            this.compressor.Compress(collection);

            var tabularData = collection.TabularDataSets[0].TabularDatas[0];

            Assert.AreEqual(TabularData.VALUE_ENCODING_DATE_TIME_EPOCH_MS,
                tabularData.ColumnValueEncodings[0]
            );

            Assert.AreEqual(
                this.GetEpochMilliseconds(new DateTime(2024, 1, 15, 13, 45, 10)),
                tabularData.RowModels[0].CV[0]
            );
        }

        [TestMethod]
        public void Compress_DateBefore1970_CompressedValueIsNegative()
        {
            var collection = this.CreateCollection(
                TabularDataColumnFormatEnum.Date,
                "1969-12-31",
                "1600-03-01"
            );

            this.compressor.Compress(collection);

            var rowModels = collection.TabularDataSets[0].TabularDatas[0].RowModels;

            Assert.AreEqual(-86400000m, rowModels[0].CV[0]);

            Assert.AreEqual(
                this.GetEpochMilliseconds(new DateTime(1600, 3, 1)),
                rowModels[1].CV[0]
            );
        }

        [TestMethod]
        public void Compress_NullDate_CompressedValueIsNull()
        {
            var collection = this.CreateCollection(
                TabularDataColumnFormatEnum.Date,
                TabularData.NULL_SENTINEL,
                "2024-01-15"
            );

            this.compressor.Compress(collection);

            var tabularData = collection.TabularDataSets[0].TabularDatas[0];

            Assert.AreEqual(
                TabularData.VALUE_ENCODING_DATE_EPOCH_MS,
                tabularData.ColumnValueEncodings[0]
            );

            Assert.IsNull(tabularData.RowModels[0].CV[0]);
        }

        [TestMethod]
        public void Compress_UnparseableDate_ColumnFallsBackToDictionary()
        {
            var collection = this.CreateCollection(
                TabularDataColumnFormatEnum.Date, "2024-01-15", "Not a date", "2024-02-30"
            );

            this.compressor.Compress(collection);

            var tabularData = collection.TabularDataSets[0].TabularDatas[0];
            var dictionary = collection.CompressionDictionary;

            Assert.AreEqual(
                TabularData.VALUE_ENCODING_DICTIONARY,
                tabularData.ColumnValueEncodings[0]
            );

            Assert.IsTrue(tabularData.IsColumnCompressed[0]);

            Assert.AreEqual(
                "2024-01-15",
                dictionary[(int)tabularData.RowModels[0].CV[0].GetValueOrDefault()]
            );

            Assert.AreEqual(
                "Not a date",
                dictionary[(int)tabularData.RowModels[1].CV[0].GetValueOrDefault()]
            );

            Assert.AreEqual(
                "2024-02-30",
                dictionary[(int)tabularData.RowModels[2].CV[0].GetValueOrDefault()]
            );
        }

        [TestMethod]
        public void Compress_DateAndStringColumns_DictionaryHoldsOnlyStrings()
        {
            var collection = new TabularDataSetCollection();
            var tabularData = this.CreateTabularData(
                new[] { TabularDataColumnFormatEnum.Date, TabularDataColumnFormatEnum.General },
                new[] { "2024-01-15", "Apples" },
                new[] { "2024-01-16", "Pears" }
            );

            collection.TabularDataSets.Add(new TabularDataSet("Set"));
            collection.TabularDataSets[0].TabularDatas.Add(tabularData);

            this.compressor.Compress(collection);

            CollectionAssert.AreEquivalent(
                new[] { "Apples", "Pears" },
                collection.CompressionDictionary
            );

            Assert.AreEqual(
                TabularData.VALUE_ENCODING_DICTIONARY,
                tabularData.ColumnValueEncodings[1]
            );
        }

        private TabularDataSetCollection CreateCollection(
            TabularDataColumnFormatEnum columnFormat,
            params string[] values)
        {
            var rows = new string[values.Length][];

            for (var index = 0; index < values.Length; index++)
            {
                rows[index] = new[] { values[index] };
            }

            var collection = new TabularDataSetCollection();

            collection.TabularDataSets.Add(new TabularDataSet("Set"));
            collection.TabularDataSets[0].TabularDatas.Add(
                this.CreateTabularData(new[] { columnFormat }, rows)
            );

            return collection;
        }

        private TabularData CreateTabularData(
            TabularDataColumnFormatEnum[] columnFormats,
            params string[][] rows)
        {
            var tabularData = new TabularData("Tab", null, rows.Length);

            for (var index = 0; index < columnFormats.Length; index++)
            {
                tabularData.ColumnModels.Add(new TabularDataColumn
                {
                    Heading = "Column" + index,
                    ColumnFormat = columnFormats[index]
                });
            }

            tabularData.IsColumnCompressed = new List<bool>(new bool[columnFormats.Length]);

            for (var index = 0; index < rows.Length; index++)
            {
                tabularData.RowModels.Add(new TabularDataRow(new List<string>(rows[index])));
            }

            return tabularData;
        }

        private decimal GetEpochMilliseconds(DateTime value)
        {
            return (decimal)(value - new DateTime(1970, 1, 1)).TotalMilliseconds;
        }
    }
}
