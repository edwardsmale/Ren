using System.Collections.Generic;

namespace Ren.Models
{
    /// <summary>
    /// Contains a list of <see cref="TabularData"/> instances.
    /// </summary>
    public class TabularDataSet
    {
        public TabularDataSet(string title)
        {
            this.Title = title;
            this.TabularDatas = new List<TabularData>();
        }

        public readonly string Title;
        public readonly List<TabularData> TabularDatas;
    }
}
