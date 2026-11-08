/**
 * The colour schemes a date/value chart's series take their default colours from, chosen by the
 * chart's colourScheme, the index of one of these.  Scheme 0 is the default.
 *
 * Each scheme's palette colours the first series, in order.  A chart with more series than that
 * carries on with colours drawn from an OKLCH grid of the scheme's candidate lightnesses and
 * chromas (see Ren.DateValueChart_SeriesColours), so the extra series keep the scheme's feel.
 * Lightness stops short of the extremes so that every colour shows against the chart's white
 * background and its own value labels.
 */
Ren.DateValueChart_ColourSchemes = [
    {
        name: "Standard",
        palette: ["#3046b8", "#ED7014", "#4CAF50", "#FFC107", "#9C27B0", "#00BCD4"],
        candidateLightnesses: [0.42, 0.52, 0.62, 0.72, 0.8],
        candidateChromas: [0.09, 0.14, 0.19]
    },
    {
        name: "Ocean",
        palette: ["#03045e", "#0077b6", "#2a9d8f", "#00b4d8", "#52b788", "#90e0ef"],
        candidateLightnesses: [0.35, 0.5, 0.65, 0.8],
        candidateChromas: [0.06, 0.1, 0.14]
    },
    {
        name: "Sunset",
        palette: ["#d62828", "#f77f00", "#7b2cbf", "#fcbf49", "#ff6392", "#3d348b"],
        candidateLightnesses: [0.45, 0.58, 0.7, 0.8],
        candidateChromas: [0.14, 0.19]
    },
    {
        name: "Retro",
        palette: ["#335c81", "#e09f3e", "#2a7f62", "#c4512a", "#9e2a2b", "#7a9e7e"],
        candidateLightnesses: [0.45, 0.55, 0.65, 0.75],
        candidateChromas: [0.08, 0.12, 0.15]
    },
    {
        name: "Earth",
        palette: ["#6f4e37", "#c08a3e", "#5a7d3a", "#a0522d", "#4a6d7c", "#b8a07e"],
        candidateLightnesses: [0.4, 0.5, 0.6, 0.7],
        candidateChromas: [0.04, 0.07, 0.1]
    },
    {
        name: "Neon",
        palette: ["#ff006e", "#3a86ff", "#ffbe0b", "#8338ec", "#06d6a0", "#fb5607"],
        candidateLightnesses: [0.55, 0.65, 0.75, 0.85],
        candidateChromas: [0.17, 0.22, 0.27]
    },
    {
        name: "Slate",
        palette: ["#08306b", "#2171b5", "#6baed6", "#4d4d4d", "#9ecae1", "#969696"],
        candidateLightnesses: [0.35, 0.47, 0.59, 0.71, 0.8],
        candidateChromas: [0.02, 0.05, 0.08]
    },
    {
        name: "Jewel",
        palette: ["#1d4e89", "#0b6e4f", "#a4161a", "#7b2d8e", "#c9a227", "#00798c"],
        candidateLightnesses: [0.38, 0.48, 0.58, 0.68],
        candidateChromas: [0.1, 0.14, 0.18]
    }
];
