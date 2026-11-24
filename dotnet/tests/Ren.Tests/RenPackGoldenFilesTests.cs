using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Text;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Ren.Building;
using Ren.Json;
using Ren.Models;
using Ren.RenPack;

namespace Ren.Tests
{
    /// <summary>
    /// Checks the writer's output against the golden files in the repo's test/golden folder, which
    /// the client's Jest tests decode.  Between them, the writer and the reader can't drift apart
    /// without one side's tests failing.
    /// </summary>
    /// <remarks>
    /// After a deliberate change to the output, set REN_WRITE_GOLDEN_FILES=1 and run these tests to
    /// rewrite the files, then run the Jest tests against them.
    /// <br /><br />
    /// The builders leave out the count column, as these check the format, not the builder, and
    /// the Jest tests expect the source's columns only.
    /// </remarks>
    [TestClass]
    public class RenPackGoldenFilesTests
    {
        private const string GOLDEN_PATH = "test/golden";

        private const string WRITE_VARIABLE = "REN_WRITE_GOLDEN_FILES";

        private const int CHUNKED_COLUMN_COUNT = 100;

        private const int CHUNKED_ROW_COUNT = 520;

        private readonly string goldenDirectory;

        private readonly bool isWriting;

        public RenPackGoldenFilesTests()
        {
            this.goldenDirectory = Path.Combine(this.FindRepoRoot(), GOLDEN_PATH);
            this.isWriting = Environment.GetEnvironmentVariable(WRITE_VARIABLE) == "1";
        }

        [TestMethod]
        public void TryWrite_MixedColumns_MatchesTheGoldenFiles()
        {
            var lines = new List<SalesLine>
            {
                new SalesLine
                {
                    Region = "North", Product = "Pens", Quantity = 3, Stock = 60000,
                    Visits = 4000000000, Balance = -25, Price = 2.5m, IsActive = true,
                    Ordered = new DateTime(2024, 2, 29),
                    Updated = new DateTime(2024, 3, 1, 13, 45, 10)
                },
                new SalesLine
                {
                    Region = "Café", Product = "日本の紙", Quantity = 250, Stock = 0,
                    Visits = 1, Balance = 2147483647, Price = 0.1m, IsActive = false,
                    Ordered = new DateTime(1969, 12, 31), Updated = new DateTime(1970, 1, 1)
                },
                new SalesLine
                {
                    Region = "", Product = "😀 Smiley stickers", Quantity = null, Stock = null,
                    Visits = null, Balance = null, Price = null, IsActive = null,
                    Ordered = null, Updated = null
                },
                new SalesLine
                {
                    Region = null, Product = "Pens", Quantity = 0, Stock = 1, Visits = 0,
                    Balance = -2147483648, Price = 1234567.891m, IsActive = true,
                    Ordered = new DateTime(2099, 12, 31),
                    Updated = new DateTime(2000, 6, 15, 0, 0, 1)
                }
            };

            var collection = new TabularDataSetCollectionBuilder { AddCountColumn = false }
                .AddSet("Sales")
                .AddTab("Lines", lines, columns =>
                {
                    columns["Ordered"].ColumnFormat = TabularDataColumnFormatEnum.Date;
                    columns["Product"].ColumnId = "ProductName";
                })
                .Build();

            this.CheckGoldenFiles("mixed-columns", collection, true);
        }

        [TestMethod]
        public void TryWrite_SeveralSetsAndTabs_MatchesTheGoldenFiles()
        {
            var regions = new List<RegionTotal>
            {
                new RegionTotal { Region = "North", Total = 10 },
                new RegionTotal { Region = "South", Total = 20 }
            };

            var stock = new List<RegionTotal>
            {
                new RegionTotal { Region = "South", Total = 7 }
            };

            var collection = new TabularDataSetCollectionBuilder { AddCountColumn = false }
                .AddSet("Sales")
                .AddTab("By region", regions)
                .AddTab("Empty", new List<RegionTotal>())
                .AddSet("Stock")
                .AddTab("Levels", stock)
                .Build();

            this.CheckGoldenFiles("several-sets", collection, true);
        }

        [TestMethod]
        public void TryWrite_ABigDictionary_MatchesTheGoldenFiles()
        {
            var names = new List<RegionTotal>();

            // Enough strings to need 16-bit indexes, and one long enough to need 16-bit lengths.
            for (var index = 0; index < 300; index++)
            {
                names.Add(
                    new RegionTotal { Region = "Name " + index.ToString("D3"), Total = index }
                );
            }

            names.Add(new RegionTotal { Region = new string('x', 300), Total = 300 });

            var collection = new TabularDataSetCollectionBuilder { AddCountColumn = false }
                .AddTab("Names", names)
                .Build();

            this.CheckGoldenFiles("big-dictionary", collection, true);
        }

        /// <summary>
        /// Checks a collection with enough cells to be split into chunks of rows and read in
        /// parallel.  Its JSON would be too big to keep, so the Jest test works out each value
        /// instead: (row * 7 + column) % 10.
        /// </summary>
        [TestMethod]
        public void TryWrite_ManyCells_MatchesTheGoldenFile()
        {
            var table = new DataTable();

            for (var column = 0; column < CHUNKED_COLUMN_COUNT; column++)
            {
                table.Columns.Add("C" + column, typeof(int));
            }

            for (var row = 0; row < CHUNKED_ROW_COUNT; row++)
            {
                var values = new object[CHUNKED_COLUMN_COUNT];

                for (var column = 0; column < CHUNKED_COLUMN_COUNT; column++)
                {
                    values[column] = ((row * 7) + column) % 10;
                }

                table.Rows.Add(values);
            }

            var collection = new TabularDataSetCollectionBuilder { AddCountColumn = false }
                .AddTab("Cells", table)
                .Build();

            this.CheckGoldenFiles("many-cells", collection, false);
        }

        private void CheckGoldenFiles(
            string name, TabularDataSetCollection collection, bool withJson)
        {
            var renPack = new RenPackWriter().TryWrite(collection);

            Assert.IsNotNull(renPack, "The collection could not be written as renpack.");

            this.CheckGoldenFile(name + ".renpack", renPack);

            if (withJson)
            {
                var json = new TabularDataJsonWriter().ToJson(collection);

                this.CheckGoldenFile(name + ".json", new UTF8Encoding(false).GetBytes(json));
            }
        }

        private void CheckGoldenFile(string filename, byte[] actual)
        {
            var path = Path.Combine(this.goldenDirectory, filename);

            if (this.isWriting)
            {
                Directory.CreateDirectory(this.goldenDirectory);
                File.WriteAllBytes(path, actual);

                return;
            }

            if (!File.Exists(path))
            {
                Assert.Fail(
                    filename + " is missing.  Set " + WRITE_VARIABLE + "=1 and run the tests to " +
                    "write it."
                );
            }

            CollectionAssert.AreEqual(
                File.ReadAllBytes(path), actual,
                filename + " differs from the writer's output.  If that's deliberate, set " +
                WRITE_VARIABLE + "=1 and run the tests to rewrite it."
            );
        }

        private string FindRepoRoot()
        {
            var directory = new DirectoryInfo(AppDomain.CurrentDomain.BaseDirectory);

            while (directory != null &&
                !File.Exists(Path.Combine(directory.FullName, "VERSION")))
            {
                directory = directory.Parent;
            }

            if (directory == null)
            {
                throw new InvalidOperationException(
                    "The Ren repo's root was not found above the test assembly."
                );
            }

            return directory.FullName;
        }

        public class SalesLine
        {
            public string Region { get; set; }

            public string Product { get; set; }

            public byte? Quantity { get; set; }

            public int? Stock { get; set; }

            public long? Visits { get; set; }

            public int? Balance { get; set; }

            public decimal? Price { get; set; }

            public bool? IsActive { get; set; }

            public DateTime? Ordered { get; set; }

            public DateTime? Updated { get; set; }
        }

        public class RegionTotal
        {
            public string Region { get; set; }

            public int Total { get; set; }
        }
    }
}
