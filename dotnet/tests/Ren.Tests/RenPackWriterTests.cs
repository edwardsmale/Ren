using System;
using System.Collections.Generic;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Ren.Compression;
using Ren.Models;
using Ren.RenPack;

namespace Ren.Tests
{
    [TestClass]
    public class RenPackWriterTests
    {
        private readonly TabularDataSetCollectionCompressor compressor;

        private readonly RenPackWriter writer;

        public RenPackWriterTests()
        {
            this.compressor = new TabularDataSetCollectionCompressor();
            this.writer = new RenPackWriter();
        }

        [TestMethod]
        public void TryWrite_DateColumn_WritesDaysAtUInt16()
        {
            var buffer = this.Write(
                TabularDataColumnFormatEnum.Date, "2024-01-15", "2024-01-16"
            );

            var descriptorOffset = this.GetDescriptorOffset(buffer, 0);
            var valuesOffset = BitConverter.ToInt32(buffer, descriptorOffset + 8);

            Assert.AreEqual(RenPackFormat.VERSION, BitConverter.ToInt32(buffer, 4));
            Assert.AreEqual(RenPackFormat.ENCODING_UINT16, buffer[descriptorOffset]);

            Assert.AreEqual(
                RenPackFormat.SCALE_CODE_DAYS,
                BitConverter.ToUInt16(buffer, descriptorOffset + 2)
            );

            Assert.AreEqual(19737, BitConverter.ToUInt16(buffer, valuesOffset));
            Assert.AreEqual(19738, BitConverter.ToUInt16(buffer, valuesOffset + 2));
        }

        [TestMethod]
        public void TryWrite_DateTimeColumn_WritesSecondsAtUInt32()
        {
            var buffer = this.Write(
                TabularDataColumnFormatEnum.DateTime, "2024-01-15 13:45:10"
            );

            var descriptorOffset = this.GetDescriptorOffset(buffer, 0);
            var valuesOffset = BitConverter.ToInt32(buffer, descriptorOffset + 8);

            Assert.AreEqual(RenPackFormat.ENCODING_UINT32, buffer[descriptorOffset]);

            Assert.AreEqual(
                RenPackFormat.SCALE_CODE_SECONDS,
                BitConverter.ToUInt16(buffer, descriptorOffset + 2)
            );

            Assert.AreEqual(1705326310u, BitConverter.ToUInt32(buffer, valuesOffset));
        }

        [TestMethod]
        public void TryWrite_DateBefore1970_WritesDaysAtInt32()
        {
            var buffer = this.Write(
                TabularDataColumnFormatEnum.Date, "1969-12-31", "2024-01-15"
            );

            var descriptorOffset = this.GetDescriptorOffset(buffer, 0);
            var valuesOffset = BitConverter.ToInt32(buffer, descriptorOffset + 8);

            Assert.AreEqual(RenPackFormat.ENCODING_INT32, buffer[descriptorOffset]);

            Assert.AreEqual(
                RenPackFormat.SCALE_CODE_DAYS,
                BitConverter.ToUInt16(buffer, descriptorOffset + 2)
            );

            Assert.AreEqual(-1, BitConverter.ToInt32(buffer, valuesOffset));
        }

        [TestMethod]
        public void TryWrite_NullDate_WritesNullBitAndKeepsScale()
        {
            var buffer = this.Write(
                TabularDataColumnFormatEnum.Date,
                TabularData.NULL_SENTINEL,
                "2024-01-15"
            );

            var descriptorOffset = this.GetDescriptorOffset(buffer, 0);
            var nullsOffset = BitConverter.ToInt32(buffer, descriptorOffset + 12);

            Assert.AreEqual(1, buffer[descriptorOffset + 1]);

            Assert.AreEqual(
                RenPackFormat.SCALE_CODE_DAYS,
                BitConverter.ToUInt16(buffer, descriptorOffset + 2)
            );

            Assert.AreEqual(1, buffer[nullsOffset] & 1);
        }

        [TestMethod]
        public void TryWrite_NumericColumn_WritesUnscaled()
        {
            var buffer = this.Write(TabularDataColumnFormatEnum.Integer, "1", "200");

            var descriptorOffset = this.GetDescriptorOffset(buffer, 0);

            Assert.AreEqual(RenPackFormat.ENCODING_UINT8, buffer[descriptorOffset]);

            Assert.AreEqual(
                RenPackFormat.SCALE_CODE_NONE,
                BitConverter.ToUInt16(buffer, descriptorOffset + 2)
            );
        }

        [TestMethod]
        public void TryWrite_UnparseableDateColumn_WritesDictionaryIndexesUnscaled()
        {
            var buffer = this.Write(TabularDataColumnFormatEnum.Date, "2024-01-15", "");

            var descriptorOffset = this.GetDescriptorOffset(buffer, 0);

            Assert.AreEqual(RenPackFormat.ENCODING_UINT8, buffer[descriptorOffset]);

            Assert.AreEqual(
                RenPackFormat.SCALE_CODE_NONE,
                BitConverter.ToUInt16(buffer, descriptorOffset + 2)
            );
        }

        /// <summary>
        /// Compresses a one-column collection of the given values and writes it.
        /// </summary>
        private byte[] Write(TabularDataColumnFormatEnum columnFormat, params string[] values)
        {
            var tabularData = new TabularData("Tab", null, values.Length);

            tabularData.ColumnModels.Add(new TabularDataColumn
            {
                Heading = "Column",
                ColumnFormat = columnFormat
            });

            tabularData.IsColumnCompressed = new List<bool> { false };

            for (var index = 0; index < values.Length; index++)
            {
                tabularData.RowModels.Add(new TabularDataRow(new List<string> { values[index] }));
            }

            var collection = new TabularDataSetCollection();

            collection.TabularDataSets.Add(new TabularDataSet("Set"));
            collection.TabularDataSets[0].TabularDatas.Add(tabularData);

            this.compressor.Compress(collection);

            var buffer = this.writer.TryWrite(collection);

            Assert.IsNotNull(buffer);

            return buffer;
        }

        private int GetDescriptorOffset(byte[] buffer, int columnIndex)
        {
            var descriptorsOffset = BitConverter.ToInt32(buffer, 16);

            return descriptorsOffset + (columnIndex * RenPackFormat.DESCRIPTOR_LENGTH);
        }
    }
}
