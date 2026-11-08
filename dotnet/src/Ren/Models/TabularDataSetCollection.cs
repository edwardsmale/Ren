using System.Collections.Generic;
using Newtonsoft.Json;

namespace Ren.Models
{
    /// <summary>
    /// Contains a collection of <see cref="TabularDataSet"/>s, along with their compression
    /// dictionary.
    /// </summary>
    /// <remarks>
    /// A host that sends the client more than this can subclass it.  Both the JSON and the
    /// renpack metadata are serialised from the instance's own type, so the extra properties
    /// reach the client either way.
    /// </remarks>
    public class TabularDataSetCollection
    {
        /// <summary>
        /// Gets or sets the filename of the SQL file that was used to generate the data.
        /// </summary>
        public string SqlFilename { get; set; }

        /// <summary>
        /// Gets or sets the URI that corresponds to data source for these data.
        /// </summary>
        public string DataSourceUri { get; set; }

        public bool NoResults { get; set; } = false;

        /// <summary>
        /// Gets or sets the uploaded file paths that could not be found on disk (or an empty array
        /// when a report that requires uploaded files was run without any).  When set, the report
        /// was not run; the client shows a prompt in the uploaded files module rather than an error
        /// popup, so the user can upload the file(s).  Left null - and omitted from the JSON - for
        /// every normal response.
        /// </summary>
        [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
        public string[] MissingUploadedFiles { get; set; }

        /// <summary>
        /// Gets or sets the uploaded files settings the report declares for itself.  The client
        /// sets the uploaded files group's defaults from these, so the module shows the format the
        /// report expects.  Left null - and omitted from the JSON - when it declares nothing.
        /// </summary>
        [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
        public UploadedFilesDefaultsModel UploadedFilesDefaults { get; set; }

        public List<TabularDataSet> TabularDataSets { get; } = new List<TabularDataSet>();

        /// <summary>
        /// Gets every tabular data in the collection, in the order the sets list them.
        /// </summary>
        /// <remarks>
        /// Which set a tab belongs to is of no interest to anything that works on the collection as
        /// a whole - adding automatic columns to it, compressing it, or writing it out - so they
        /// all walk it through here rather than nesting a loop of their own.
        /// </remarks>
        public List<TabularData> GetAllTabularDatas()
        {
            var tabularDatas = new List<TabularData>();

            for (var setIndex = 0; setIndex < this.TabularDataSets.Count; setIndex++)
            {
                var setTabularDatas = this.TabularDataSets[setIndex].TabularDatas;

                for (var tabIndex = 0; tabIndex < setTabularDatas.Count; tabIndex++)
                {
                    tabularDatas.Add(setTabularDatas[tabIndex]);
                }
            }

            return tabularDatas;
        }

        /// <summary>
        /// Gets or sets the dictionary of strings used to compress the report.  If the report is
        /// compressed, string and date values in the data are replaced with indexes into this
        /// dictionary.
        /// </summary>
        public string[] CompressionDictionary { get; set; }

        public bool IsCompressed => this.CompressionDictionary != null;

        /// <summary>
        /// The uploaded files settings a report's SQL declares for itself.  The property names match
        /// the keys the client's uploaded files group settings use, so that the client can set a
        /// group's defaults straight from this.
        /// </summary>
        public class UploadedFilesDefaultsModel
        {
            /// <summary>
            /// Gets or sets the declared files, comma-separated as they are in the group settings.
            /// </summary>
            [JsonProperty("uploadedFiles", NullValueHandling = NullValueHandling.Ignore)]
            public string UploadedFiles { get; set; }

            /// <summary>
            /// Gets or sets the declared delimiter, written as the client writes it (so a tab is
            /// the two characters '\' and 't').
            /// </summary>
            [JsonProperty("uploadedFilesDelimiter", NullValueHandling = NullValueHandling.Ignore)]
            public string UploadedFilesDelimiter { get; set; }

            /// <summary>
            /// Gets or sets whether the declared files carry header rows.
            /// </summary>
            [JsonProperty("uploadedFilesHaveHeaderRows", NullValueHandling = NullValueHandling.Ignore)]
            public bool? UploadedFilesHaveHeaderRows { get; set; }
        }
    }
}
