using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json;
using Ren.Models;

namespace Ren.Json
{
    /// <summary>
    /// Writes a <see cref="TabularDataSetCollection"/> as the JSON the client reads.
    /// </summary>
    public class TabularDataJsonWriter
    {
        public const string CONTENT_TYPE = "application/json";

        private readonly JsonSerializerSettings jsonSettings = new JsonSerializerSettings
        {
            FloatFormatHandling = FloatFormatHandling.DefaultValue,
            Formatting = Formatting.None,
            Converters = new List<JsonConverter> { NullableDecimalArrayConverter.Instance }
        };

        /// <summary>
        /// Returns the JSON representation of the given collection.
        /// </summary>
        public string ToJson(TabularDataSetCollection collection)
        {
            return JsonConvert.SerializeObject(collection, this.jsonSettings);
        }

        /// <summary>
        /// Writes the JSON representation of the given collection to the given writer, without
        /// building it as a string first.
        /// </summary>
        public void Write(TabularDataSetCollection collection, TextWriter writer)
        {
            using (var jsonWriter = new JsonTextWriter(writer) { CloseOutput = false })
            {
                JsonSerializer.Create(this.jsonSettings).Serialize(jsonWriter, collection);
            }
        }
    }
}
