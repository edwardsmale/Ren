using System;
using System.IO;
using System.IO.Compression;

namespace Ren.RenPack
{
    /// <summary>
    /// Gzips a response, and reads one back.
    /// </summary>
    /// <remarks>
    /// A web server may do this itself, but often only for the media types it is configured with,
    /// which renpack's is not.  Doing it in the application also means a host that caches the
    /// response can cache the compressed bytes, so a hit is served without compressing anything,
    /// and the cached entry is a fraction of the size it would otherwise be.
    /// </remarks>
    public class RenPackCompressor
    {
        /// <summary>
        /// The value of the Content-Encoding header on a compressed response, and the token looked
        /// for in the request's Accept-Encoding.
        /// </summary>
        public const string CONTENT_ENCODING = "gzip";

        /// <summary>
        /// The compression level used.  Fastest rather than Optimal: this runs on the request that
        /// builds the report, so the seconds it would cost to squeeze out the last few percent are
        /// paid by the user waiting for it, and the bulk of the win is in the first pass anyway.
        /// </summary>
        private const CompressionLevel COMPRESSION_LEVEL = CompressionLevel.Fastest;

        /// <summary>
        /// Gets a value indicating whether a request with the given Accept-Encoding header can read
        /// a gzipped response.
        /// </summary>
        public bool IsAcceptedBy(string acceptEncoding)
        {
            return acceptEncoding != null &&
                acceptEncoding.IndexOf(CONTENT_ENCODING, StringComparison.OrdinalIgnoreCase) != -1;
        }

        /// <summary>
        /// Returns the given bytes gzipped.
        /// </summary>
        public byte[] Compress(byte[] bytes)
        {
            // The binary format compresses well - long runs of zeroes in the high bytes of every
            // wide column, and in the dictionary's length table - so a third of the input is a
            // conservative starting size for the buffer.
            using (var output = new MemoryStream(bytes.Length / 3))
            {
                using (var gzip = new GZipStream(output, COMPRESSION_LEVEL, true))
                {
                    gzip.Write(bytes, 0, bytes.Length);
                }

                return output.ToArray();
            }
        }

        /// <summary>
        /// Returns the given gzipped bytes decompressed: for serving bytes that were cached
        /// compressed to a client that does not accept gzip, which no browser is.
        /// </summary>
        public byte[] Decompress(byte[] bytes)
        {
            using (var input = new MemoryStream(bytes))
            using (var gzip = new GZipStream(input, CompressionMode.Decompress))
            using (var output = new MemoryStream())
            {
                gzip.CopyTo(output);

                return output.ToArray();
            }
        }
    }
}
