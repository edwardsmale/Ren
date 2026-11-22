using System;
using Newtonsoft.Json;

namespace Ren.Json
{
    /// <summary>
    /// Serialises decimal?[] without boxing each element — Newtonsoft's default path iterates
    /// via IEnumerable, boxing every Nullable&lt;Decimal&gt; to object.  This converter accesses
    /// array elements as value types directly, which is measurably faster on large row sets.
    /// </summary>
    internal sealed class NullableDecimalArrayConverter : JsonConverter
    {
        public static readonly NullableDecimalArrayConverter Instance = new NullableDecimalArrayConverter();

        public override bool CanConvert(Type objectType)
        {
            return objectType == typeof(decimal?[]);
        }

        public override void WriteJson(JsonWriter writer, object value, JsonSerializer serializer)
        {
            var array = (decimal?[])value;
            writer.WriteStartArray();
            for (var i = 0; i < array.Length; i++)
            {
                var item = array[i];
                if (item.HasValue)
                {
                    writer.WriteValue(item.GetValueOrDefault());
                }
                else
                {
                    writer.WriteNull();
                }
            }
            writer.WriteEndArray();
        }

        public override object ReadJson(JsonReader reader, Type objectType, object existingValue,
            JsonSerializer serializer)
        {
            throw new NotImplementedException();
        }
    }
}
