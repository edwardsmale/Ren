using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Linq.Expressions;
using System.Reflection;
using Ren.Compression;
using Ren.Models;

namespace Ren.Building
{
    /// <summary>
    /// Builds a compressed <see cref="TabularDataSetCollection"/>, ready to be written as renpack
    /// or JSON, from data readers, data tables or lists of objects: one tab from each.
    /// </summary>
    /// <remarks>
    /// Each tab's columns are inferred from its source's types, then handed to the tab's configure
    /// callback, if it has one, to change before any value is read.  A reader's rows are converted
    /// as they are read, so they are never held twice.
    /// </remarks>
    public class TabularDataSetCollectionBuilder
    {
        private readonly TabularDataSetCollection collection;
        private readonly TabularDataColumnFactory columnFactory = new TabularDataColumnFactory();

        private readonly TabularDataSetCollectionCompressor compressor =
            new TabularDataSetCollectionCompressor();

        private TabularDataSet currentSet;
        private bool isBuilt;

        public TabularDataSetCollectionBuilder()
            : this(new TabularDataSetCollection())
        {
        }

        /// <summary>
        /// Creates a builder that adds to the given collection, which may be a host's subclass of
        /// <see cref="TabularDataSetCollection"/>.
        /// </summary>
        public TabularDataSetCollectionBuilder(TabularDataSetCollection collection)
        {
            this.collection = collection ?? throw new ArgumentNullException(nameof(collection));
        }

        /// <summary>
        /// Starts a new set, which the tabs added after it go into.  A tab added before any set
        /// goes into a set of its own, named after it.
        /// </summary>
        public TabularDataSetCollectionBuilder AddSet(string title)
        {
            this.CheckNotBuilt();

            this.currentSet = new TabularDataSet(title);
            this.collection.TabularDataSets.Add(this.currentSet);

            return this;
        }

        /// <summary>
        /// Adds a tab of the rows of the reader's current result set, reading it to its end.
        /// </summary>
        public TabularDataSetCollectionBuilder AddTab(string title, IDataReader reader,
            Action<TabularDataColumns> configure = null, string dataTabGroup = null)
        {
            if (reader == null)
            {
                throw new ArgumentNullException(nameof(reader));
            }

            var names = new string[reader.FieldCount];
            var types = new Type[reader.FieldCount];

            for (var index = 0; index < reader.FieldCount; index++)
            {
                names[index] = reader.GetName(index);
                types[index] = reader.GetFieldType(index);
            }

            var tab = this.CreateTab(title, dataTabGroup, 0, names, types, configure);
            var converters = this.CreateConverters(tab);
            var values = new object[reader.FieldCount];

            while (reader.Read())
            {
                reader.GetValues(values);
                tab.RowModels.Add(this.ConvertRow(values, converters));
            }

            return this;
        }

        /// <summary>
        /// Adds a tab of the table's rows.
        /// </summary>
        public TabularDataSetCollectionBuilder AddTab(string title, DataTable table,
            Action<TabularDataColumns> configure = null, string dataTabGroup = null)
        {
            if (table == null)
            {
                throw new ArgumentNullException(nameof(table));
            }

            using (var reader = table.CreateDataReader())
            {
                return this.AddTab(title, reader, configure, dataTabGroup);
            }
        }

        /// <summary>
        /// Adds a tab with a row for each item, and a column for each of the item type's public
        /// readable properties, in the order they are declared.
        /// </summary>
        public TabularDataSetCollectionBuilder AddTab<T>(string title, IEnumerable<T> items,
            Action<TabularDataColumns> configure = null, string dataTabGroup = null)
        {
            if (items == null)
            {
                throw new ArgumentNullException(nameof(items));
            }

            var properties = typeof(T)
                .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .Where(p => p.CanRead && p.GetIndexParameters().Length == 0)
                .OrderBy(p => p.MetadataToken)
                .ToArray();

            var getters = properties.Select(this.CreateGetter<T>).ToArray();
            var rowCount = items is ICollection<T> itemCollection ? itemCollection.Count : 0;

            var tab = this.CreateTab(
                title,
                dataTabGroup,
                rowCount,
                properties.Select(p => p.Name).ToArray(),
                properties.Select(p => p.PropertyType).ToArray(),
                configure
            );

            var converters = this.CreateConverters(tab);
            var values = new object[getters.Length];

            foreach (var item in items)
            {
                for (var index = 0; index < getters.Length; index++)
                {
                    values[index] = item == null ? null : getters[index](item);
                }

                tab.RowModels.Add(this.ConvertRow(values, converters));
            }

            return this;
        }

        /// <summary>
        /// Compresses the collection and returns it.  Nothing can be added after this.
        /// </summary>
        public TabularDataSetCollection Build()
        {
            if (!this.isBuilt)
            {
                this.collection.NoResults = this.collection.GetAllTabularDatas().Count == 0;
                this.compressor.Compress(this.collection);
                this.isBuilt = true;
            }

            return this.collection;
        }

        private TabularData CreateTab(string title, string dataTabGroup, int rowCount,
            string[] names, Type[] types, Action<TabularDataColumns> configure)
        {
            this.CheckNotBuilt();

            if (this.currentSet == null)
            {
                this.AddSet(title);
            }

            var tab = new TabularData(title, dataTabGroup, rowCount);

            for (var index = 0; index < names.Length; index++)
            {
                tab.ColumnModels.Add(this.columnFactory.Create(names[index], types[index]));
            }

            configure?.Invoke(new TabularDataColumns(tab.ColumnModels));

            for (var index = 0; index < tab.ColumnModels.Count; index++)
            {
                this.MakeEnumColumnText(tab.ColumnModels[index]);
            }

            tab.IsColumnCompressed = new bool[tab.ColumnModels.Count].ToList();
            this.currentSet.TabularDatas.Add(tab);

            return tab;
        }

        /// <summary>
        /// Gives a column whose values are mapped to names the General format, since a numeric
        /// one could not hold them.
        /// </summary>
        private void MakeEnumColumnText(TabularDataColumn column)
        {
            if (column.EnumValues == null ||
                TabularDataSetCollectionCompressor.HasCompressedColumnType(column.ColumnFormat))
            {
                return;
            }

            column.ColumnFormat = TabularDataColumnFormatEnum.General;

            if (column.AggregationType == AggregationTypeEnum.Sum ||
                column.AggregationType == AggregationTypeEnum.NoTotal)
            {
                column.AggregationType = AggregationTypeEnum.SingleValuesOnly;
            }
        }

        private ColumnValueConverter[] CreateConverters(TabularData tab)
        {
            return tab.ColumnModels.Select(c => new ColumnValueConverter(c)).ToArray();
        }

        private TabularDataRow ConvertRow(object[] values, ColumnValueConverter[] converters)
        {
            var rowValues = new List<string>(converters.Length);

            for (var index = 0; index < converters.Length; index++)
            {
                rowValues.Add(converters[index].Convert(values[index]));
            }

            return new TabularDataRow(rowValues);
        }

        /// <summary>
        /// Returns a compiled getter for the given property, which is many times quicker to call
        /// for every row than reading the property by reflection.
        /// </summary>
        private Func<T, object> CreateGetter<T>(PropertyInfo property)
        {
            var item = Expression.Parameter(typeof(T), "item");

            var body = Expression.Convert(
                Expression.Property(item, property), typeof(object)
            );

            return Expression.Lambda<Func<T, object>>(body, item).Compile();
        }

        private void CheckNotBuilt()
        {
            if (this.isBuilt)
            {
                throw new InvalidOperationException(
                    "The collection has been built, so nothing more can be added to it."
                );
            }
        }
    }
}
