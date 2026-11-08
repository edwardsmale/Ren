using System;
using System.IO;
using System.Text.RegularExpressions;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Ren.RenPack;

namespace Ren.Tests
{
    /// <summary>
    /// Checks the format's version against the client's reader, which lives in the same repo, so
    /// that neither can be changed without the other.
    /// </summary>
    [TestClass]
    public class RenPackFormatTests
    {
        private const string DECODING_PATH = "src/data-sources/ren-data-source-decoding.js";

        private const string ADAPTER_PATH =
            "src/data-sources/data-source-adapters/ren-data-source-format-renpack.js";

        private readonly string repoRoot;

        public RenPackFormatTests()
        {
            this.repoRoot = this.FindRepoRoot();
        }

        [TestMethod]
        public void Version_ClientReader_ReadsUpToThisVersion()
        {
            var source = File.ReadAllText(Path.Combine(this.repoRoot, DECODING_PATH));

            Assert.AreEqual(RenPackFormat.VERSION, this.GetConstant(source, "RENPACK_VERSION"));
        }

        [TestMethod]
        public void Version_ClientReader_MinimumIsNoLaterThanThisVersion()
        {
            var source = File.ReadAllText(Path.Combine(this.repoRoot, DECODING_PATH));

            Assert.IsTrue(
                this.GetConstant(source, "RENPACK_MINIMUM_VERSION") <= RenPackFormat.VERSION
            );
        }

        [TestMethod]
        public void ContentType_ClientAdapter_AcceptsIt()
        {
            var source = File.ReadAllText(Path.Combine(this.repoRoot, ADAPTER_PATH));

            StringAssert.Contains(source, "\"" + RenPackFormat.CONTENT_TYPE + "\"");
        }

        private int GetConstant(string source, string name)
        {
            var match = Regex.Match(source, @"const " + name + @" = (\d+);");

            Assert.IsTrue(match.Success, name + " was not found.");

            return int.Parse(match.Groups[1].Value);
        }

        private string FindRepoRoot()
        {
            var directory = new DirectoryInfo(AppDomain.CurrentDomain.BaseDirectory);

            while (directory != null &&
                !File.Exists(Path.Combine(directory.FullName, DECODING_PATH)))
            {
                directory = directory.Parent;
            }

            if (directory == null)
            {
                throw new InvalidOperationException(
                    "The Ren repo's root was not found above the test assembly."
                );
            }

            return directory.FullName;
        }
    }
}
