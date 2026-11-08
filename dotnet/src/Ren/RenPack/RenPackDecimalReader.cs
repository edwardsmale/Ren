using System;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

namespace Ren.RenPack
{
    /// <summary>
    /// Reads the parts a decimal is made of, so that <see cref="RenPackWriter"/> can measure and
    /// write a column of whole numbers with integer arithmetic.
    /// </summary>
    /// <remarks>
    /// Every arithmetic operation on a decimal - a comparison, a truncation, a conversion - is a
    /// call out of managed code, and the writer does several of them for each of the tens of
    /// millions of cells a large report holds.  Nearly all of those cells are dictionary indexes
    /// or small whole numbers, whose mantissa fits in the low 32 bits of the decimal, and this
    /// reads those with a handful of integer instructions instead.
    ///
    /// Anything wider than that - a mantissa of 2^32 or more - is left to the caller to handle
    /// with the decimal operations themselves, as is the case where the layout self-check below
    /// does not recognise the runtime's decimal.
    /// </remarks>
    public sealed class RenPackDecimalReader
    {
        /// <summary>
        /// A decimal's scale can be as high as 28, but a power of ten past this one is larger than
        /// any mantissa the fast path accepts, so it is handled without the table.
        /// </summary>
        private const uint MAXIMUM_TABULATED_SCALE = 9;

        private readonly uint[] powersOfTen =
        {
            1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000, 1000000000
        };

        private readonly bool layoutIsKnown;

        public RenPackDecimalReader()
        {
            this.layoutIsKnown = this.CheckLayout();
        }

        /// <summary>
        /// Gets the given decimal as a whole number, returning false when it is not one, is too
        /// wide to be read this way, or the runtime lays its decimals out unexpectedly.  A false
        /// return means "read this one with the decimal operations", not "this is not integral".
        /// </summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public bool TryGetIntegral(decimal value, out long integral)
        {
            uint magnitude;
            uint flags;

            if (!this.TryGetMagnitude(value, out magnitude, out flags))
            {
                integral = 0;

                return false;
            }

            var scale = (flags >> 16) & 0xFF;

            if (scale != 0)
            {
                if (scale > MAXIMUM_TABULATED_SCALE)
                {
                    // Every power of ten this large is bigger than the mantissa, so the only whole
                    // number that can be written at such a scale is zero itself.
                    if (magnitude != 0)
                    {
                        integral = 0;

                        return false;
                    }
                }
                else
                {
                    var power = this.powersOfTen[scale];

                    if (magnitude % power != 0)
                    {
                        integral = 0;

                        return false;
                    }

                    magnitude /= power;
                }
            }

            integral = IsNegative(flags) ? -(long)magnitude : magnitude;

            return true;
        }

        /// <summary>
        /// Gets the given decimal as a whole number where it is an unscaled one whose mantissa fits
        /// in 63 bits, returning false when the caller is to read it with the decimal operations.
        /// </summary>
        /// <remarks>
        /// For the milliseconds of a date, which are too wide for <see cref="TryGetIntegral"/>'s
        /// 32 bits and are always written unscaled.
        /// </remarks>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public bool TryGetInt64(decimal value, out long integral)
        {
            var parts = new Parts();

            parts.Value = value;

            if (!this.layoutIsKnown || parts.Hi != 0 || parts.Mid > int.MaxValue ||
                ((parts.Flags >> 16) & 0xFF) != 0)
            {
                integral = 0;

                return false;
            }

            var magnitude = ((long)parts.Mid << 32) | parts.Lo;

            integral = IsNegative(parts.Flags) ? -magnitude : magnitude;

            return true;
        }

        /// <summary>
        /// Gets the given decimal as a double where it can be converted to one exactly, returning
        /// false when the caller is to convert it itself.
        /// </summary>
        /// <remarks>
        /// Only an unscaled value is taken: dividing the mantissa by a power of ten in floating
        /// point can land a unit in the last place away from where converting the decimal itself
        /// would, and the point of the format is that the client sees the same numbers the JSON
        /// would have given it.
        /// </remarks>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public bool TryGetExactDouble(decimal value, out double result)
        {
            uint magnitude;
            uint flags;

            if (!this.TryGetMagnitude(value, out magnitude, out flags) ||
                ((flags >> 16) & 0xFF) != 0)
            {
                result = 0;

                return false;
            }

            result = IsNegative(flags) ? -(double)magnitude : magnitude;

            return true;
        }

        /// <summary>
        /// Gets the given decimal's mantissa and flags, returning false when the mantissa does not
        /// fit in the low 32 bits of it.
        /// </summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        private bool TryGetMagnitude(decimal value, out uint magnitude, out uint flags)
        {
            var parts = new Parts();

            parts.Value = value;

            magnitude = parts.Lo;
            flags = parts.Flags;

            return this.layoutIsKnown && (parts.Hi | parts.Mid) == 0;
        }

        private static bool IsNegative(uint flags)
        {
            return (flags & 0x80000000u) != 0;
        }

        /// <summary>
        /// Gets a value indicating whether the runtime lays a decimal out the way
        /// <see cref="Parts"/> expects, checked against the documented order of
        /// <see cref="decimal.GetBits"/>.
        /// </summary>
        /// <remarks>
        /// The layout has been the same since the framework's first version, and is fixed by the
        /// binary form a decimal serialises to, so this is a belt and braces check rather than a
        /// real expectation.  Every value below exercises a different part of it: the sign bit, a
        /// scale, and each of the three mantissa words.
        /// </remarks>
        private bool CheckLayout()
        {
            var samples = new[]
            {
                0m, 1m, -1m, 255m, 12.34m, -0.005m, 4294967296m, decimal.MaxValue
            };

            for (var index = 0; index < samples.Length; index++)
            {
                var parts = new Parts();

                parts.Value = samples[index];

                var bits = decimal.GetBits(samples[index]);

                if (parts.Lo != (uint)bits[0] ||
                    parts.Mid != (uint)bits[1] ||
                    parts.Hi != (uint)bits[2] ||
                    parts.Flags != (uint)bits[3])
                {
                    return false;
                }
            }

            return true;
        }

        /// <summary>
        /// A decimal overlaid with the four words it is made of, in the order the runtime declares
        /// them: the flags holding its sign and scale, then the high, low and middle words of its
        /// 96-bit mantissa.
        /// </summary>
        [StructLayout(LayoutKind.Explicit)]
        private struct Parts
        {
            [FieldOffset(0)]
            public decimal Value;

            [FieldOffset(0)]
            public uint Flags;

            [FieldOffset(4)]
            public uint Hi;

            [FieldOffset(8)]
            public uint Lo;

            [FieldOffset(12)]
            public uint Mid;
        }
    }
}
