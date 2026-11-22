/**
 * Makes a date/value chart readable to a screen reader and usable from the keyboard.  The chart's
 * SVG is named after the series it shows, and the legend's entries are buttons that Tab reaches:
 * Enter or Space shows or hides an entry's series, and the arrow keys, Home and End move between
 * the entries.
 */
Ren.DateValueChart_Accessibility = (() => {

    const NEXT_KEYS = ["ArrowRight", "ArrowDown"];
    const PREVIOUS_KEYS = ["ArrowLeft", "ArrowUp"];

    /**
     * Gets the name a screen reader gives the chart: the series it shows, over its dates.
     */
    const getChartLabel = (props) => {

        const names = [];

        for (let i = 0; i < (props.seriesCount || 0); i++) {

            const series = props.series?.[i];

            if (series?.isEnabled === false) continue;

            const name = series?.label || props.valueHeadings?.[i];

            if (name) names.push(String(name));
        }

        const title = Ren.DateValueChart_Title.getTitle(props);

        if (names.length === 0) return title || "Chart";

        let label = "Chart of " + names.join(", ");

        if (props.dateHeading) label += ` by ${props.dateHeading}`;

        return title ? `${title}: ${label}` : label;
    };

    /**
     * Gets the entry a key moves the focus to from the given one, or null where the key moves it
     * nowhere.  The arrows stop at the ends rather than wrapping round.
     */
    const getAdjacentEntry = (entries, current, key) => {

        const index = entries.indexOf(current);

        if (index === -1 || entries.length === 0) return null;

        let target = -1;

        if (NEXT_KEYS.indexOf(key) !== -1) {
            target = Math.min(index + 1, entries.length - 1);
        }
        else if (PREVIOUS_KEYS.indexOf(key) !== -1) {

            target = Math.max(index - 1, 0);
        }
        else if (key === "Home") {

            target = 0;
        }
        else if (key === "End") {

            target = entries.length - 1;
        }

        return target === -1 ? null : entries[target];
    };

    /**
     * Names the chart's SVG as an image of its series.
     */
    const labelChart = (props) => {

        if (!props.svg) return;

        props.svg.setAttribute("role", "img");
        props.svg.setAttribute("aria-label", getChartLabel(props));
    };

    /**
     * Makes a legend entry a button pressed while its series is shown.
     */
    const makeLegendEntryButton = (entry, isShown) => {

        entry.setAttribute("tabindex", "0");
        entry.setAttribute("role", "button");
        entry.setAttribute("aria-pressed", isShown ? "true" : "false");
    };

    return {
        getChartLabel,
        getAdjacentEntry,
        labelChart,
        makeLegendEntryButton
    };
})();
