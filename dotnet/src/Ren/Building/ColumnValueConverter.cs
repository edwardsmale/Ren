using System;
using System.Collections.Generic;
using System.Data.SqlTypes;
using System.Globalization;
using Ren.Compression;
using Ren.Models;

namespace Ren.Building
{
    /// <summary>
    /// Converts a column's source values to the strings a <see cref="TabularDataRow"/> holds,
    /// which are what the compressor reads.
    /// </summary>
    internal sealed class ColumnValueConverter
    {
        private const string HEX_DIGITS = "0123456789ABCDEF";

        private const string DATE_FORMAT = "yyyy-MM-dd";

        private const string DATE_TIME_FORMAT = "yyyy-MM-dd HH:mm:ss";

        private readonly string heading;
        private readonly TabularDataColumnFormatEnum columnFormat;
        private readonly Dictionary<int, string> enumValues;
        private readonly bool isNumeric;

        public ColumnValueConverter(TabularDataColumn column)
        {
            this.heading = column.Heading;
            this.columnFormat = column.ColumnFormat;
            this.enumValues = column.EnumValues;
            this.isNumeric =
                !TabularDataSetCollectionCompressor.HasCompressedColumnType(column.ColumnFormat);
        }

        public string Convert(object value)
        {
            if (value == null || value is DBNull ||
                (value is INullable nullable && nullable.IsNull))
            {
                return TabularData.NULL_SENTINEL;
            }

            if (this.enumValues != null)
            {
                return this.ConvertEnumValue(value);
            }

            switch (value)
            {
                case string stringValue:
                    return this.isNumeric ? this.CheckNumber(stringValue) : stringValue;
                case bool boolValue:
                    return boolValue ? "1" : "0";
                case SqlBoolean sqlBoolean:
                    return sqlBoolean.Value ? "1" : "0";
                case DateTime dateTime:
                    return this.ConvertDateTime(dateTime);
                case SqlDateTime sqlDateTime:
                    return this.ConvertDateTime(sqlDateTime.Value);
                case DateTimeOffset dateTimeOffset:
                    return this.ConvertDateTime(dateTimeOffset.DateTime);
                case double doubleValue:
                    return this.ConvertDouble(doubleValue);
                case float floatValue:
                    return this.ConvertDouble(floatValue);
                case byte[] bytes:
                    return this.ConvertBytes(bytes);
                case SqlBinary sqlBinary:
                    return this.ConvertBytes(sqlBinary.Value);
                case Enum enumValue:
                    return enumValue.ToString();
                case IFormattable formattable:
                    return formattable.ToString(null, CultureInfo.InvariantCulture);
                default:
                    return value.ToString();
            }
        }

        /// <summary>
        /// Returns the given string, having checked that a numeric column's value is a number.  The
        /// compressor parses them without checking, so anything else would be silently garbled.
        /// </summary>
        private string CheckNumber(string value)
        {
            if (value.Length == 0)
            {
                return value;
            }

            if (!decimal.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out _))
            {
                throw new FormatException(
                    "The " + this.columnFormat + " column \"" + this.heading + "\" holds \"" +
                    value + "\", which is not a number.  Change the column's format to General " +
                    "if it is not numeric."
                );
            }

            return value;
        }

        private string ConvertEnumValue(object value)
        {
            if (value is string stringValue)
            {
                return stringValue;
            }

            var intValue = System.Convert.ToInt32(value, CultureInfo.InvariantCulture);

            return this.enumValues.TryGetValue(intValue, out var name)
                ? name
                : intValue.ToString(CultureInfo.InvariantCulture);
        }

        private string ConvertDateTime(DateTime value)
        {
            var format = this.columnFormat == TabularDataColumnFormatEnum.Date
                ? DATE_FORMAT
                : DATE_TIME_FORMAT;

            return value.ToString(format, CultureInfo.InvariantCulture);
        }

        private string ConvertDouble(double value)
        {
            // Neither JSON nor a decimal has a NaN or an infinity, so they are taken as unknowns.
            if (double.IsNaN(value) || double.IsInfinity(value))
            {
                return TabularData.NULL_SENTINEL;
            }

            return value.ToString("R", CultureInfo.InvariantCulture);
        }

        /// <summary>
        /// Gets bytes as upper-case hexadecimal with no "0x" prefix, as SQL Server's
        /// CONVERT(VARCHAR(MAX), value, 2) writes them.
        /// </summary>
        private string ConvertBytes(byte[] bytes)
        {
            var hex = new char[bytes.Length * 2];

            for (var index = 0; index < bytes.Length; index++)
            {
                hex[index * 2] = HEX_DIGITS[bytes[index] >> 4];
                hex[index * 2 + 1] = HEX_DIGITS[bytes[index] & 0xF];
            }

            return new string(hex);
        }
    }
}
