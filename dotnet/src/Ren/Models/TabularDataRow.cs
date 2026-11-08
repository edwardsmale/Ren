using System.Collections.Generic;
using Newtonsoft.Json;

namespace Ren.Models
{
    [JsonObject(ItemNullValueHandling = NullValueHandling.Ignore)]
    public sealed class TabularDataRow
    {
        [JsonIgnore]
        public readonly string Hash;
        public List<string> RowValues;
        public decimal?[] CV;

        public TabularDataRow(List<string> rowValues, int numColumns, string hash)
        {
            this.RowValues = rowValues;

            for (var i = rowValues.Count; i < numColumns; i++)
            {
                this.RowValues.Add(null);
            }

            this.Hash = hash;
        }

        public TabularDataRow(List<string> rowValues)
        {
            this.RowValues = rowValues;
        }

        public TabularDataRow(decimal?[] compressedValues)
        {
            this.CV = compressedValues;
        }
    }
}
