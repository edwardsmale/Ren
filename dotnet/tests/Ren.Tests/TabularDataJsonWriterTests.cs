using System.Collections.Generic;
using System.IO;
using System.Text;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Newtonsoft.Json.Linq;
using Ren.Building;
using Ren.Json;
using Ren.Models;
using Ren.RenPack;

namespace Ren.Tests
{
    [TestClass]
    public class TabularDataJsonWriterTests
    {
        private readonly TabularDataJsonWriter writer;

        public TabularDataJsonWriterTests()
        {
            this.writer = new TabularDataJsonWriter();
        }

        [TestMethod]
        public void ToJson_Collection_WritesSetsTabsAndDictionary()
        {
            var json = JObject.Parse(
                this.writer.ToJson(this.Build(new TabularDataSetCollection()))
            );

            var set = json["TabularDataSets"][0];

            Assert.AreEqual("Lines", (string)set["Title"]);
            Assert.AreEqual(
                "Product",
                (string)set["TabularDatas"][0]["ColumnModels"][1]["Heading"]
            );
            Assert.IsNotNull(json["CompressionDictionary"]);
        }

        [TestMethod]
        public void Write_Collection_MatchesToJson()
        {
            var collection = this.Build(new TabularDataSetCollection());
            var output = new StringWriter();

            this.writer.Write(collection, output);

            Assert.AreEqual(this.writer.ToJson(collection), output.ToString());
        }

        [TestMethod]
        public void ToJson_Subclass_WritesItsOwnProperties()
        {
            var json = JObject.Parse(
                this.writer.ToJson(this.Build(new HostCollection { Title = "Sales" }))
            );

            Assert.AreEqual("Sales", (string)json["Title"]);
        }

        [TestMethod]
        public void TryWrite_Subclass_WritesItsOwnPropertiesInTheMetadata()
        {
            var buffer = new RenPackWriter().TryWrite(
                this.Build(new HostCollection { Title = "Sales" })
            );

            StringAssert.Contains(Encoding.UTF8.GetString(buffer), "\"Title\":\"Sales\"");
        }

        private TabularDataSetCollection Build(TabularDataSetCollection collection)
        {
            var items = new List<Line> { new Line { Product = "Pen", Quantity = 3 } };

            return new TabularDataSetCollectionBuilder(collection).AddTab("Lines", items).Build();
        }

        public class Line
        {
            public string Product { get; set; }

            public int Quantity { get; set; }
        }

        public class HostCollection : TabularDataSetCollection
        {
            public string Title { get; set; }
        }
    }
}
