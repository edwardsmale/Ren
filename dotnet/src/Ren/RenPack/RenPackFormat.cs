using System;

namespace Ren.RenPack
{
    /// <summary>
    /// The constants of the "RENP" wire format - a compact binary rendering of a
    /// <see cref="Models.TabularDataSetCollection"/>, written in place of the JSON
    /// one where the client says it can read it.
    /// </summary>
    /// <remarks>
    /// The layout, all little-endian:
    ///
    /// <code>
    /// Header, 32 bytes
    ///   0   "RENP"
    ///   4   uint32  version
    ///   8   uint32  metadata JSON length, in bytes
    ///   12  uint32  dictionary block offset
    ///   16  uint32  column descriptor table offset
    ///   20  uint32  column descriptor count
    ///   24  uint32  total length
    ///   28  uint32  reserved
    ///   32  the metadata JSON, UTF-8
    ///
    /// Dictionary block, 8-aligned
    ///   0   uint32  string count
    ///   4   uint32  flags (bit 0: the blob is entirely ASCII)
    ///   8   uint32  blob length, in bytes
    ///   12  uint32  length table width, in bytes: 1, 2 or 4
    ///   16          lengths[count], in bytes, one per string at that width (every bit set for a
    ///               null string)
    ///       the blob: every string's UTF-8 bytes, end to end
    ///
    /// Column descriptor table, 8-aligned, 16 bytes each
    ///   0   uint8   encoding
    ///   1   uint8   1 when the column has nulls
    ///   2   uint16  scale code: the number each stored value is multiplied by to give the value
    ///               itself (0: 1, 1: 1,000, 2: 86,400,000)
    ///   4   uint32  row count
    ///   8   uint32  values offset (absolute, 8-aligned)
    ///   12  uint32  null bitset offset (absolute; 0 when the column has no nulls)
    ///
    /// Then the columns' data, each column's values 8-aligned so that the client can read them as
    /// a typed array view without copying.  A null bitset holds one bit per row, least significant
    /// bit first, and the value slot of a null cell holds zero.
    /// </code>
    ///
    /// A scale is what lets a date column, held as milliseconds since 1970-01-01, be written as the
    /// days or seconds its values are all whole numbers of: a day in two bytes rather than eight.
    /// The reader multiplies it back out.  Version 1 had no scale, and wrote zero in its place.
    ///
    /// The length table is written at the narrowest width every one of its entries fits into, for
    /// the same reason a column's values are: a dictionary runs to hundreds of thousands of
    /// strings, nearly all of them short, so a fixed four bytes each would be mostly zeroes.
    ///
    /// The metadata JSON is the collection as it is serialised today, minus the two things the
    /// binary blocks carry instead: each tabular data's rows, and the compression dictionary.  The
    /// descriptors are in the order the metadata's tabs list their columns, so a reader walks the
    /// two together.
    /// </remarks>
    public static class RenPackFormat
    {
        /// <summary>
        /// The media type a response in this format is served as, and the one a client names in its
        /// Accept header to ask for it.
        /// </summary>
        public const string CONTENT_TYPE = "application/x-ren-tabular-v1";

        public const int VERSION = 2;

        public const int HEADER_LENGTH = 32;

        public const int DICTIONARY_HEADER_LENGTH = 16;

        public const int DESCRIPTOR_LENGTH = 16;

        /// <summary>
        /// Set in the dictionary block's flags when every byte of the blob is ASCII, which lets the
        /// client decode the whole blob in one go and slice the strings out of the result.
        /// </summary>
        public const uint DICTIONARY_FLAG_ASCII = 1;

        public const byte ENCODING_UINT8 = 0;
        public const byte ENCODING_UINT16 = 1;
        public const byte ENCODING_UINT32 = 2;
        public const byte ENCODING_INT32 = 3;
        public const byte ENCODING_FLOAT64 = 4;

        public const ushort SCALE_CODE_NONE = 0;
        public const ushort SCALE_CODE_SECONDS = 1;
        public const ushort SCALE_CODE_DAYS = 2;

        /// <summary>
        /// Gets the number a stored value of the given scale code is multiplied by.
        /// </summary>
        public static long GetScale(ushort scaleCode)
        {
            switch (scaleCode)
            {
                case SCALE_CODE_SECONDS: return 1000;
                case SCALE_CODE_DAYS: return 86400000;
                default: return 1;
            }
        }

        /// <summary>
        /// Gets a value indicating whether a request with the given Accept header can read this
        /// format.
        /// </summary>
        /// <remarks>
        /// Negotiated by the Accept header alone, with no query string equivalent: a query
        /// parameter on the data source endpoint is taken to be one of the report's own SQL
        /// parameters, so it would both bind into the query and change the cache key.
        /// </remarks>
        public static bool IsAcceptedBy(string accept)
        {
            return accept != null &&
                accept.IndexOf(CONTENT_TYPE, StringComparison.OrdinalIgnoreCase) != -1;
        }

        /// <summary>
        /// Gets the number of bytes one value of the given encoding occupies.
        /// </summary>
        public static int GetValueLength(byte encoding)
        {
            switch (encoding)
            {
                case ENCODING_UINT8: return 1;
                case ENCODING_UINT16: return 2;
                case ENCODING_UINT32: return 4;
                case ENCODING_INT32: return 4;
                default: return 8;
            }
        }

        /// <summary>
        /// Rounds the given offset up to the next 8-byte boundary.
        /// </summary>
        public static int Align8(int offset)
        {
            return (offset + 7) & ~7;
        }
    }
}
