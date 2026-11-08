using System;
using Ren.Models;

namespace Ren.Building
{
    /// <summary>
    /// Creates a <see cref="TabularDataColumn"/> for a source column, inferring its format from
    /// the column's .NET type.
    /// </summary>
    internal sealed class TabularDataColumnFactory
    {
        public TabularDataColumn Create(string name, Type valueType)
        {
            var columnFormat = this.GetColumnFormat(valueType);

            return new TabularDataColumn
            {
                ColumnFormat = columnFormat,
                Heading = name,
                Visible = true,
                AggregationType = this.GetDefaultAggregationType(name, columnFormat)
            };
        }

        private TabularDataColumnFormatEnum GetColumnFormat(Type valueType)
        {
            var type = Nullable.GetUnderlyingType(valueType) ?? valueType;

            // An enum is written by name, as text.
            if (type.IsEnum)
            {
                return TabularDataColumnFormatEnum.General;
            }

            switch (Type.GetTypeCode(type))
            {
                case TypeCode.Boolean:
                    return TabularDataColumnFormatEnum.Boolean;
                case TypeCode.Byte:
                case TypeCode.SByte:
                case TypeCode.Int16:
                case TypeCode.UInt16:
                case TypeCode.Int32:
                case TypeCode.UInt32:
                case TypeCode.Int64:
                case TypeCode.UInt64:
                    return TabularDataColumnFormatEnum.Integer;
                case TypeCode.Single:
                case TypeCode.Double:
                case TypeCode.Decimal:
                    return TabularDataColumnFormatEnum.Number;
                case TypeCode.DateTime:
                    return TabularDataColumnFormatEnum.DateTime;
            }

            if (type == typeof(DateTimeOffset))
            {
                return TabularDataColumnFormatEnum.DateTime;
            }

            return TabularDataColumnFormatEnum.General;
        }

        private AggregationTypeEnum GetDefaultAggregationType(string name,
            TabularDataColumnFormatEnum columnFormat)
        {
            switch (columnFormat)
            {
                case TabularDataColumnFormatEnum.Integer:
                case TabularDataColumnFormatEnum.Number:
                    // It doesn't make sense to sum IDs.
                    return name != null && name.EndsWith("Id", StringComparison.Ordinal)
                        ? AggregationTypeEnum.NoTotal
                        : AggregationTypeEnum.Sum;
                case TabularDataColumnFormatEnum.Boolean:
                    return AggregationTypeEnum.Average;
                case TabularDataColumnFormatEnum.DateTime:
                    return AggregationTypeEnum.ExpandIcon;
                default:
                    return AggregationTypeEnum.SingleValuesOnly;
            }
        }
    }
}
