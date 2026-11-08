using Microsoft.VisualStudio.TestTools.UnitTesting;
using Ren.Compression;

namespace Ren.Tests
{
    [TestClass]
    public class FastNumbersTests
    {
        [TestMethod]
        public void ParseDecimal_PlainDecimal_ReturnsValue()
        {
            var value = FastNumbers.ParseDecimal("-123.45");

            Assert.AreEqual(-123.45m, value);
        }

        [TestMethod]
        public void ParseDecimal_NegativeExponent_ReturnsValue()
        {
            var value = FastNumbers.ParseDecimal("1.5E-05");

            Assert.AreEqual(0.000015m, value);
        }

        [TestMethod]
        public void ParseDecimal_PositiveExponent_ReturnsValue()
        {
            var value = FastNumbers.ParseDecimal("-2.5E+20");

            Assert.AreEqual(-250000000000000000000m, value);
        }

        [TestMethod]
        public void ParseDecimal_LowercaseExponent_ReturnsValue()
        {
            var value = FastNumbers.ParseDecimal("4e3");

            Assert.AreEqual(4000m, value);
        }

        [TestMethod]
        public void ParseDecimal_ExponentTooSmallForDecimal_ReturnsZero()
        {
            var value = FastNumbers.ParseDecimal("1E-300");

            Assert.AreEqual(0m, value);
        }

        [TestMethod]
        public void ParseDecimal_ExponentTooLargeForDecimal_ReturnsMaxValue()
        {
            var value = FastNumbers.ParseDecimal("1E+300");

            Assert.AreEqual(decimal.MaxValue, value);
        }

        [TestMethod]
        public void ParseDecimal_NegativeExponentTooLargeForDecimal_ReturnsMinValue()
        {
            var value = FastNumbers.ParseDecimal("-1E+300");

            Assert.AreEqual(decimal.MinValue, value);
        }
    }
}
