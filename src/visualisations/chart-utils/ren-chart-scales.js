/**
 * The charts' scales, mapping values to pixels and back, whose domain and range are changed in
 * place, since one scale is shared by everything plotted against it.
 */
Ren.ChartScales = (() => {

    const DEFAULT_TICK_COUNT = 10;
    const MAX_NICE_ITERATIONS = 10;

    const E10 = Math.sqrt(50);
    const E5 = Math.sqrt(10);
    const E2 = Math.sqrt(2);

    /**
     * Gets [i1, i2, increment] for ticks from start to stop, the ticks being i1 to i2 times the
     * increment, or divided by its negation where it is negative (which keeps small steps exact).
     */
    const getTickSpec = (start, stop, count) => {

        const step = (stop - start) / Math.max(0, count);
        const power = Math.floor(Math.log10(step));
        const error = step / Math.pow(10, power);
        const factor = error >= E10 ? 10 : error >= E5 ? 5 : error >= E2 ? 2 : 1;

        let i1;
        let i2;
        let increment;

        if (power < 0) {

            increment = Math.pow(10, -power) / factor;
            i1 = Math.round(start * increment);
            i2 = Math.round(stop * increment);

            if (i1 / increment < start) ++i1;
            if (i2 / increment > stop) --i2;

            increment = -increment;
        }
        else {

            increment = Math.pow(10, power) * factor;
            i1 = Math.round(start / increment);
            i2 = Math.round(stop / increment);

            if (i1 * increment < start) ++i1;
            if (i2 * increment > stop) --i2;
        }

        if (i2 < i1 && 0.5 <= count && count < 2) return getTickSpec(start, stop, count * 2);

        return [i1, i2, increment];
    };

    const getTicks = (start, stop, count) => {

        if (!(count > 0)) return [];
        if (start === stop) return [start];

        const isReversed = stop < start;
        const spec = isReversed ? getTickSpec(stop, start, count) : getTickSpec(start, stop, count);
        const i1 = spec[0];
        const i2 = spec[1];
        const increment = spec[2];

        if (!(i2 >= i1)) return [];

        const tickCount = i2 - i1 + 1;
        const ticks = new Array(tickCount);

        for (let i = 0; i < tickCount; i++) {

            const multiple = isReversed ? i2 - i : i1 + i;

            ticks[i] = increment < 0 ? multiple / -increment : multiple * increment;
        }

        return ticks;
    };

    /**
     * Gets a domain widened to round values at either end.
     */
    const getNiceDomain = (domain, count) => {

        let startIndex = 0;
        let stopIndex = 1;
        let start = domain[0];
        let stop = domain[1];
        let previousStep;

        if (stop < start) {

            start = domain[1];
            stop = domain[0];
            startIndex = 1;
            stopIndex = 0;
        }

        for (let iteration = 0; iteration < MAX_NICE_ITERATIONS; iteration++) {

            const step = getTickSpec(start, stop, count)[2];

            if (step === previousStep) {

                const niceDomain = domain.slice();

                niceDomain[startIndex] = start;
                niceDomain[stopIndex] = stop;

                return niceDomain;
            }

            if (step > 0) {

                start = Math.floor(start / step) * step;
                stop = Math.ceil(stop / step) * step;
            }
            else if (step < 0) {

                start = Math.ceil(start * step) / step;
                stop = Math.floor(stop * step) / step;
            }
            else {

                break;
            }

            previousStep = step;
        }

        return domain;
    };

    /**
     * Gets a function mapping values in one span onto another, either of which may run backwards.
     * An empty span maps everything to the middle of the other.
     */
    const createMapping = (from, to) => {

        const isReversed = from[1] < from[0];
        const fromStart = isReversed ? from[1] : from[0];
        const span = (isReversed ? from[0] : from[1]) - fromStart;
        const toStart = isReversed ? to[1] : to[0];
        const toEnd = isReversed ? to[0] : to[1];

        if (!span) {

            const t = isNaN(span) ? NaN : 0.5;
            const middle = toStart * (1 - t) + toEnd * t;

            return () => middle;
        }

        return value => {

            const t = (value - fromStart) / span;

            return toStart * (1 - t) + toEnd * t;
        };
    };

    const createScale = (domain, range, isTime) => {

        let currentDomain;
        let currentRange;
        let toRange;
        let toDomain;

        const update = () => {

            toRange = createMapping(currentDomain, currentRange);
            toDomain = createMapping(currentRange, currentDomain);
        };

        /**
         * Gets the pixel a value is at, or undefined for a value that is not a number.
         */
        const getPixel = value =>
            value == null || isNaN(value = +value) ? undefined : toRange(value);

        /**
         * Gets the value at a pixel, as a date on a time scale.
         */
        const getValue = isTime
            ? pixel => new Date(toDomain(+pixel))
            : pixel => toDomain(+pixel);

        const getDomain = () => isTime
            ? [new Date(currentDomain[0]), new Date(currentDomain[1])]
            : currentDomain.slice();

        const setDomain = newDomain => {

            currentDomain = [+newDomain[0], +newDomain[1]];
            update();
        };

        const getRange = () => currentRange.slice();

        const setRange = newRange => {

            currentRange = [+newRange[0], +newRange[1]];
            update();
        };

        currentDomain = [+domain[0], +domain[1]];
        currentRange = [+range[0], +range[1]];
        update();

        return {
            getPixel,
            getValue,
            getDomain,
            setDomain,
            getRange,
            setRange
        };
    };

    /**
     * Creates a scale from numbers to pixels.
     *
     * @param {Array} domain - [start, end] of the values.
     * @param {Array} range - [start, end] of the pixels.
     * @param {object} [options] - { nice: true } widens the domain to round values at either end.
     */
    const createLinearScale = (domain, range, options) => {

        const scale = createScale(domain, range, false);

        if (options && options.nice) {
            scale.setDomain(getNiceDomain(scale.getDomain(), DEFAULT_TICK_COUNT));
        }

        /**
         * Gets round values across the domain, about count of them.
         */
        scale.getTicks = count => {

            const currentDomain = scale.getDomain();

            return getTicks(currentDomain[0], currentDomain[1], count ?? DEFAULT_TICK_COUNT);
        };

        return scale;
    };

    // The multiples of each power of ten a logarithmic scale ticks at, from fewest to most.
    const LOG_TICK_MULTIPLES = [[1], [1, 2, 5], [1, 2, 3, 4, 5, 6, 7, 8, 9]];

    const getPowerOfTen = power => power < 0 ? 1 / Math.pow(10, -power) : Math.pow(10, power);

    /**
     * Gets a value widened to a multiple of 1, 2 or 5 of a power of ten: up to one at or above it
     * for the top of a domain, and down to one at or below it for the bottom.
     */
    const getNiceLogBound = (value, isTop) => {

        const power = Math.floor(Math.log10(value));
        const unit = getPowerOfTen(power);
        const multiples = isTop ? [1, 2, 5, 10] : [5, 2, 1];
        const mantissa = value / unit;

        for (let i = 0; i < multiples.length; i++) {

            const isBound = isTop
                ? mantissa <= multiples[i] * (1 + 1e-9)
                : mantissa >= multiples[i] * (1 - 1e-9);

            if (isBound) return multiples[i] * unit;
        }

        return value;
    };

    /**
     * Gets the values a logarithmic scale ticks at: the most multiples of each power of ten that
     * keep to about count of them, every so many powers of ten where even one each is too many,
     * and round values as a linear scale has them across a domain too narrow for two.
     */
    const getLogTicks = (start, stop, count) => {

        const first = Math.floor(Math.log10(start));
        const last = Math.ceil(Math.log10(stop));
        let ticks = [];

        for (let i = 0; i < LOG_TICK_MULTIPLES.length; i++) {

            const candidates = [];

            for (let power = first; power <= last; power++) {

                const unit = getPowerOfTen(power);

                for (let j = 0; j < LOG_TICK_MULTIPLES[i].length; j++) {

                    const value = LOG_TICK_MULTIPLES[i][j] * unit;

                    if (value >= start * (1 - 1e-9) && value <= stop * (1 + 1e-9)) {
                        candidates.push(value);
                    }
                }
            }

            if (i > 0 && candidates.length > count) break;

            ticks = candidates;
        }

        if (ticks.length > count) {

            const every = Math.ceil(ticks.length / count);

            ticks = ticks.filter((value, index) => index % every === 0);
        }

        return ticks.length >= 2 ? ticks : getTicks(start, stop, Math.min(count, 5));
    };

    /**
     * Creates a scale from numbers above zero to pixels, each power of ten taking the same height.
     * A value of zero or below has no place on it, so is put at the bottom of the domain, as is
     * the bottom of a domain set to zero or below, which keeps the bottom it had.
     *
     * @param {Array} domain - [start, end] of the values, both above zero.
     * @param {Array} range - [start, end] of the pixels.
     * @param {object} [options] - { nice: true } widens the domain to a multiple of 1, 2 or 5 of a
     *     power of ten at either end.
     */
    const createLogScale = (domain, range, options) => {

        const logScale = createScale([0, 1], range, false);
        let currentDomain = [1, 10];

        const setDomain = newDomain => {

            const start = +newDomain[0] > 0 ? +newDomain[0] : currentDomain[0];
            const stop = +newDomain[1] > start ? +newDomain[1] : start * 10;

            currentDomain = [start, stop];
            logScale.setDomain([Math.log10(start), Math.log10(stop)]);
        };

        const getPixel = value => {

            if (value == null || isNaN(value = +value)) return undefined;

            return logScale.getPixel(Math.log10(value > 0 ? value : currentDomain[0]));
        };

        setDomain(options && options.nice && +domain[0] > 0 && +domain[1] > 0
            ? [getNiceLogBound(+domain[0], false), getNiceLogBound(+domain[1], true)]
            : domain);

        return {
            getPixel,
            getValue: pixel => Math.pow(10, logScale.getValue(pixel)),
            getDomain: () => currentDomain.slice(),
            setDomain,
            getRange: logScale.getRange,
            setRange: logScale.setRange,
            getTicks: count => getLogTicks(
                currentDomain[0],
                currentDomain[1],
                count ?? DEFAULT_TICK_COUNT
            )
        };
    };

    /**
     * Creates a scale from dates to pixels, whose domain is read back and inverted as dates.
     */
    const createTimeScale = (domain, range) => createScale(domain, range, true);

    return {
        createLinearScale,
        createLogScale,
        createTimeScale
    };
})();
