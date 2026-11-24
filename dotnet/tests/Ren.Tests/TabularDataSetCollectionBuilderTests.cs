using System;
using System.Collections.Generic;
using System.Data;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Ren.Building;
using Ren.Models;
using Ren.RenPack;

namespace Ren.Tests
{
    [TestClass]
    public class TabularDataSetCollectionBuilderTests
    {
        private readonly TabularDataSetCollectionBuilder builder;

        public TabularDataSetCollectionBuilderTests()
        {
            this.builder = new TabularDataSetCollectionBuilder();
        }

        [TestMethod]
        public void AddTab_DataTable_InfersFormatsFromColumnTypes()
        {
            var table = new DataTable();
            table.Columns.Add("Name", typeof(string));
            table.Columns.Add("Quantity", typeof(int));
            table.Columns.Add("Price", typeof(decimal));
            table.Columns.Add("IsActive", typeof(bool));
            table.Columns.Add("Created", typeof(DateTime));
            table.Rows.Add("Pen", 3, 1.5m, true, new DateTime(2024, 1, 15, 13, 45, 10));

            var columns = this.builder.AddTab("Products", table).Build()
                .TabularDataSets[0].TabularDatas[0].ColumnModels;

            Assert.AreEqual(TabularDataColumnFormatEnum.General, columns[1].ColumnFormat);
            Assert.AreEqual(TabularDataColumnFormatEnum.Integer, columns[2].ColumnFormat);
            Assert.AreEqual(TabularDataColumnFormatEnum.Number, columns[3].ColumnFormat);
            Assert.AreEqual(TabularDataColumnFormatEnum.Boolean, columns[4].ColumnFormat);
            Assert.AreEqual(TabularDataColumnFormatEnum.DateTime, columns[5].ColumnFormat);
        }

        [TestMethod]
        public void AddTab_DataReader_ConvertsEveryRow()
        {
            var table = new DataTable();
            table.Columns.Add("Name", typeof(string));
            table.Columns.Add("Quantity", typeof(int));
            table.Rows.Add("Pen", 3);
            table.Rows.Add("Pad", 7);

            using (var reader = table.CreateDataReader())
            {
                this.builder.AddTab("Products", reader);
            }

            var collection = this.builder.Build();
            var tabularData = collection.TabularDataSets[0].TabularDatas[0];

            Assert.AreEqual(2, tabularData.RowModels.Count);
            Assert.AreEqual("Pad", this.GetText(collection, tabularData.RowModels[1].CV[1]));
            Assert.AreEqual(7m, tabularData.RowModels[1].CV[2]);
        }

        [TestMethod]
        public void AddTab_Objects_ColumnsAreInDeclarationOrder()
        {
            var items = new List<OrderLine>
            {
                new OrderLine { Product = "Pen", Quantity = 3, OrderId = 1 }
            };

            var columns = this.builder.AddTab("Lines", items).Build()
                .TabularDataSets[0].TabularDatas[0].ColumnModels;

            Assert.AreEqual("Product", columns[1].Heading);
            Assert.AreEqual("Quantity", columns[2].Heading);
            Assert.AreEqual("OrderId", columns[3].Heading);
            Assert.AreEqual("Ordered", columns[4].Heading);
            Assert.AreEqual("Status", columns[5].Heading);
        }

        [TestMethod]
        public void AddTab_IdColumn_DefaultsToNoTotal()
        {
            var items = new List<OrderLine> { new OrderLine { OrderId = 1 } };

            var columns = this.builder.AddTab("Lines", items).Build()
                .TabularDataSets[0].TabularDatas[0].ColumnModels;

            Assert.AreEqual(AggregationTypeEnum.Sum, columns[2].AggregationType);
            Assert.AreEqual(AggregationTypeEnum.NoTotal, columns[3].AggregationType);
        }

        [TestMethod]
        public void AddTab_NullValues_AreNullsNotEmptyStrings()
        {
            var items = new List<OrderLine> { new OrderLine { Product = null, Ordered = null } };

            var collection = this.builder.AddTab("Lines", items).Build();
            var row = collection.TabularDataSets[0].TabularDatas[0].RowModels[0];

            Assert.AreEqual(TabularData.NULL_SENTINEL, this.GetText(collection, row.CV[1]));
            Assert.IsNull(row.CV[4]);
        }

        [TestMethod]
        public void AddTab_DateTimeColumn_CompressesToEpochMilliseconds()
        {
            var ordered = new DateTime(2024, 1, 15, 13, 45, 10);
            var items = new List<OrderLine> { new OrderLine { Ordered = ordered } };

            var row = this.builder.AddTab("Lines", items).Build()
                .TabularDataSets[0].TabularDatas[0].RowModels[0];

            Assert.AreEqual(this.GetEpochMilliseconds(ordered), row.CV[4]);
        }

        [TestMethod]
        public void AddTab_ColumnConfiguredAsDate_DropsTheTime()
        {
            var items = new List<OrderLine>
            {
                new OrderLine { Ordered = new DateTime(2024, 1, 15, 13, 45, 10) }
            };

            var tabularData = this.builder
                .AddTab(
                    "Lines",
                    items,
                    columns => columns["Ordered"].ColumnFormat = TabularDataColumnFormatEnum.Date
                )
                .Build()
                .TabularDataSets[0].TabularDatas[0];

            Assert.AreEqual(
                TabularData.VALUE_ENCODING_DATE_EPOCH_MS,
                tabularData.ColumnValueEncodings[4]
            );

            Assert.AreEqual(
                this.GetEpochMilliseconds(new DateTime(2024, 1, 15)),
                tabularData.RowModels[0].CV[4]
            );
        }

        [TestMethod]
        public void AddTab_EnumProperty_WritesItsName()
        {
            var items = new List<OrderLine> { new OrderLine { Status = OrderStatus.Despatched } };

            var collection = this.builder.AddTab("Lines", items).Build();
            var row = collection.TabularDataSets[0].TabularDatas[0].RowModels[0];

            Assert.AreEqual("Despatched", this.GetText(collection, row.CV[5]));
        }

        [TestMethod]
        public void AddTab_EnumValuesOnIntegerColumn_WritesNamesAsGeneral()
        {
            var items = new List<OrderLine> { new OrderLine { Quantity = 2 } };

            var collection = this.builder
                .AddTab(
                    "Lines",
                    items,
                    columns => columns["Quantity"].EnumValues = new Dictionary<int, string>
                    {
                        { 2, "Pair" }
                    }
                )
                .Build();

            var tabularData = collection.TabularDataSets[0].TabularDatas[0];

            Assert.AreEqual(
                TabularDataColumnFormatEnum.General,
                tabularData.ColumnModels[2].ColumnFormat
            );

            Assert.AreEqual("Pair", this.GetText(collection, tabularData.RowModels[0].CV[2]));
        }

        [TestMethod]
        public void AddTab_UnknownHeading_ThrowsNamingTheColumns()
        {
            var items = new List<OrderLine>();

            var exception = Assert.ThrowsException<ArgumentException>(
                () => this.builder.AddTab(
                    "Lines", items, columns => columns["Missing"].Visible = false
                )
            );

            StringAssert.Contains(exception.Message, "Product, Quantity, OrderId");
        }

        [TestMethod]
        public void AddTab_TextInNumberColumn_Throws()
        {
            var table = new DataTable();
            table.Columns.Add("Price", typeof(string));
            table.Rows.Add("n/a");

            var exception = Assert.ThrowsException<FormatException>(
                () => this.builder.AddTab(
                    "Prices",
                    table,
                    columns => columns["Price"].ColumnFormat = TabularDataColumnFormatEnum.Number
                )
            );

            StringAssert.Contains(exception.Message, "\"Price\"");
        }

        [TestMethod]
        public void AddTab_NaN_IsNull()
        {
            var table = new DataTable();
            table.Columns.Add("Ratio", typeof(double));
            table.Rows.Add(double.NaN);
            table.Rows.Add(0.25);

            var rowModels = this.builder.AddTab("Ratios", table).Build()
                .TabularDataSets[0].TabularDatas[0].RowModels;

            Assert.IsNull(rowModels[0].CV[1]);
            Assert.AreEqual(0.25m, rowModels[1].CV[1]);
        }

        [TestMethod]
        public void AddTab_Bytes_WritesUpperCaseHex()
        {
            var table = new DataTable();
            table.Columns.Add("Hash", typeof(byte[]));
            table.Rows.Add(new byte[] { 0x0A, 0xFF });

            var collection = this.builder.AddTab("Hashes", table).Build();
            var row = collection.TabularDataSets[0].TabularDatas[0].RowModels[0];

            Assert.AreEqual("0AFF", this.GetText(collection, row.CV[1]));
        }

        [TestMethod]
        public void AddTab_BeforeAnySet_AddsASetNamedAfterTheTab()
        {
            var collection = this.builder
                .AddTab("Lines", new List<OrderLine>())
                .AddSet("Totals")
                .AddTab("By product", new List<OrderLine>())
                .AddTab("By customer", new List<OrderLine>())
                .Build();

            Assert.AreEqual(2, collection.TabularDataSets.Count);
            Assert.AreEqual("Lines", collection.TabularDataSets[0].Title);
            Assert.AreEqual(2, collection.TabularDataSets[1].TabularDatas.Count);
        }

        [TestMethod]
        public void AddTab_AfterBuild_Throws()
        {
            this.builder.AddTab("Lines", new List<OrderLine>()).Build();

            Assert.ThrowsException<InvalidOperationException>(
                () => this.builder.AddTab("More", new List<OrderLine>())
            );
        }

        [TestMethod]
        public void AddTab_ByDefault_StartsWithAHiddenCountColumnOfOnes()
        {
            var table = new DataTable();
            table.Columns.Add("Name", typeof(string));
            table.Rows.Add("Pen");
            table.Rows.Add("Pad");

            var tabularData = this.builder.AddTab("Products", table).Build()
                .TabularDataSets[0].TabularDatas[0];

            var countColumn = tabularData.ColumnModels[0];

            Assert.AreEqual(TabularDataSetCollectionBuilder.COUNT_COLUMN_ID, countColumn.ColumnId);
            Assert.AreEqual("Count", countColumn.Heading);
            Assert.IsFalse(countColumn.Visible);
            Assert.AreEqual(AggregationTypeEnum.Count, countColumn.AggregationType);
            Assert.AreEqual(2, tabularData.ColumnModels.Count);
            Assert.AreEqual(1m, tabularData.RowModels[0].CV[0]);
            Assert.AreEqual(1m, tabularData.RowModels[1].CV[0]);
        }

        [TestMethod]
        public void AddTab_CountColumnTurnedOff_HasOnlyTheSourceColumns()
        {
            var items = new List<OrderLine> { new OrderLine { Product = "Pen" } };

            var collection = new TabularDataSetCollectionBuilder { AddCountColumn = false }
                .AddTab("Lines", items)
                .Build();

            var tabularData = collection.TabularDataSets[0].TabularDatas[0];

            Assert.AreEqual(5, tabularData.ColumnModels.Count);
            Assert.AreEqual("Product", tabularData.ColumnModels[0].Heading);
            Assert.AreEqual("Pen", this.GetText(collection, tabularData.RowModels[0].CV[0]));
        }

        [TestMethod]
        public void AddTab_SourceHasACountColumn_DoesNotAddAnother()
        {
            var table = new DataTable();
            table.Columns.Add(TabularDataSetCollectionBuilder.COUNT_COLUMN_ID, typeof(int));
            table.Columns.Add("Name", typeof(string));
            table.Rows.Add(1, "Pen");

            var tabularData = this.builder.AddTab("Products", table).Build()
                .TabularDataSets[0].TabularDatas[0];

            Assert.AreEqual(2, tabularData.ColumnModels.Count);
            Assert.AreEqual(1m, tabularData.RowModels[0].CV[0]);
        }

        [TestMethod]
        public void AddTab_SourceColumnHeadedCount_IsFoundBeforeTheCountColumn()
        {
            var table = new DataTable();
            table.Columns.Add("Count", typeof(int));
            table.Rows.Add(5);

            var columns = this.builder
                .AddTab("Stock", table, c => c["Count"].Heading = "In stock")
                .Build()
                .TabularDataSets[0].TabularDatas[0].ColumnModels;

            Assert.AreEqual("Count", columns[0].Heading);
            Assert.AreEqual("In stock", columns[1].Heading);
        }

        [TestMethod]
        public void Build_NoTabs_IsNoResults()
        {
            Assert.IsTrue(this.builder.Build().NoResults);
        }

        [TestMethod]
        public void Build_Collection_CanBeWrittenAsRenPack()
        {
            var items = new List<OrderLine>
            {
                new OrderLine
                {
                    Product = "Pen",
                    Quantity = 3,
                    OrderId = 1,
                    Ordered = new DateTime(2024, 1, 15)
                }
            };

            var collection = this.builder.AddTab("Lines", items).Build();

            Assert.IsNotNull(new RenPackWriter().TryWrite(collection));
        }

        private string GetText(TabularDataSetCollection collection, decimal? compressedValue)
        {
            return collection.CompressionDictionary[(int)compressedValue.Value];
        }

        private decimal GetEpochMilliseconds(DateTime value)
        {
            return (decimal)(value - new DateTime(1970, 1, 1)).TotalMilliseconds;
        }

        public enum OrderStatus
        {
            Placed = 0,
            Despatched = 1
        }

        public class OrderLine
        {
            public string Product { get; set; }

            public int Quantity { get; set; }

            public int OrderId { get; set; }

            public DateTime? Ordered { get; set; }

            public OrderStatus Status { get; set; }
        }
    }
}
