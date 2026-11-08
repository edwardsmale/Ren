/**
 * The colour a date/value chart's series is given by default, by its index and the chart's colour
 * scheme (see Ren.DateValueChart_ColourSchemes).
 *
 * The first few come from the scheme's fixed palette, picked to be readable side by side.
 * Splitting the data produces a series per value of a column, which can be more series than the
 * palette holds, so beyond it each colour is the candidate furthest from every colour already
 * used.  Distances are measured in OKLab, where they track how different two colours look, so no
 * two series end up looking alike the way evenly spaced hues do (the greens alone span a third of
 * the hue wheel).
 */
Ren.DateValueChart_SeriesColours = (() => {

    const CANDIDATE_HUE_STEP_DEGREES = 10;

    // Allows for rounding when deciding whether a candidate lies within the sRGB gamut.
    const GAMUT_TOLERANCE = 0.0001;

    // Each scheme's colours handed out so far and its candidates, by scheme index, made as needed.
    const schemeStates = [];

    const toLinear = (channel) => channel <= 0.04045
        ? channel / 12.92
        : Math.pow((channel + 0.055) / 1.055, 2.4);

    const fromLinear = (channel) => channel <= 0.0031308
        ? channel * 12.92
        : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;

    const hexToOklab = (hex) => {

        const rgb = Ren.Colours.toRgb(hex);
        const red = toLinear(rgb.red / 255);
        const green = toLinear(rgb.green / 255);
        const blue = toLinear(rgb.blue / 255);

        const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
        const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
        const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);

        return [
            0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
        ];
    };

    /**
     * Converts an OKLCH colour to hex, or gives null when it lies outside the sRGB gamut.
     */
    const oklchToHex = (lightness, chroma, hueDegrees) => {

        const hue = hueDegrees * Math.PI / 180;
        const a = chroma * Math.cos(hue);
        const b = chroma * Math.sin(hue);

        const l = Math.pow(lightness + 0.3963377774 * a + 0.2158037573 * b, 3);
        const m = Math.pow(lightness - 0.1055613458 * a - 0.0638541728 * b, 3);
        const s = Math.pow(lightness - 0.0894841775 * a - 1.291485548 * b, 3);

        const linear = [
            4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
        ];

        let hex = "#";

        for (let index = 0; index < linear.length; index++) {

            if (linear[index] < -GAMUT_TOLERANCE || linear[index] > 1 + GAMUT_TOLERANCE) {
                return null;
            }

            hex += Ren.Colours.toHexComponent(fromLinear(linear[index]) * 255);
        }

        return hex;
    };

    const getDistance = (lab1, lab2) =>
        Math.hypot(lab1[0] - lab2[0], lab1[1] - lab2[1], lab1[2] - lab2[2]);

    /**
     * Gets the candidate colours of a scheme's grid, each with its distance to the nearest colour
     * already used.
     */
    const createCandidates = (scheme, colours) => {

        const candidates = [];

        scheme.candidateLightnesses.forEach(lightness => {

            scheme.candidateChromas.forEach(chroma => {

                for (let hue = 0; hue < 360; hue += CANDIDATE_HUE_STEP_DEGREES) {

                    const hex = oklchToHex(lightness, chroma, hue);

                    if (hex) {
                        candidates.push({ hex, lab: hexToOklab(hex), nearestDistance: Infinity });
                    }
                }
            });
        });

        colours.forEach(colour => updateNearestDistances(candidates, hexToOklab(colour)));

        return candidates;
    };

    const updateNearestDistances = (candidates, lab) => {

        candidates.forEach(candidate => {

            candidate.nearestDistance = Math.min(
                candidate.nearestDistance,
                getDistance(candidate.lab, lab)
            );
        });
    };

    const addFurthestCandidate = (state) => {

        state.candidates ??= createCandidates(state.scheme, state.colours);

        const available = state.candidates;
        let furthest = available[0];

        for (let index = 1; index < available.length; index++) {

            if (available[index].nearestDistance > furthest.nearestDistance) {
                furthest = available[index];
            }
        }

        state.colours.push(furthest.hex);
        updateNearestDistances(available, furthest.lab);
    };

    /**
     * Gets the index of the scheme a chart's colourScheme setting names, scheme 0 where it names
     * none.
     */
    const getSchemeIndex = (colourScheme) => {

        const index = Math.round(Number(colourScheme));

        return index >= 0 && index < Ren.DateValueChart_ColourSchemes.length ? index : 0;
    };

    const getSchemeState = (schemeIndex) => {

        if (!schemeStates[schemeIndex]) {

            const scheme = Ren.DateValueChart_ColourSchemes[schemeIndex];

            schemeStates[schemeIndex] = {
                scheme,
                colours: scheme.palette.slice(),
                candidates: null
            };
        }

        return schemeStates[schemeIndex];
    };

    /**
     * Gets a series' default colour.
     *
     * @param {number} seriesIndex - The 0-based index of the series.
     * @param {number} [colourScheme] - The chart's colourScheme setting, scheme 0 where unset.
     */
    const getDefaultColour = (seriesIndex, colourScheme) => {

        const state = getSchemeState(getSchemeIndex(colourScheme));

        while (state.colours.length <= seriesIndex) {
            addFurthestCandidate(state);
        }

        return state.colours[seriesIndex];
    };

    return {
        getSchemeIndex,
        getDefaultColour
    };
})();
