/**
 * The text of the labels of a chart drawn as pies, as the chart's settings choose: where the labels
 * go, and which of each slice's series name, value and share they show.
 */
Ren.DateValueChart_PieLabelContent = (() => {

    const PLACEMENTS = {
        Auto: "auto",
        Inside: "inside",
        Outside: "outside",
        Around: "around",
        Off: "off"
    };

    // Where a label's value goes: after its name, on a line of its own below it, or inside its
    // slice, apart from the rest of the label outside the pie.
    const VALUE_POSITIONS = {
        Inline: "inline",
        Below: "below",
        Inside: "inside"
    };

    const DEFAULT_FONT_SIZE_PX = 11;

    /** Gets the chart's chosen placement of its slices' labels, Outside where none is chosen. */
    const getPlacement = (props) => {

        const keys = Object.keys(PLACEMENTS);

        for (let i = 0; i < keys.length; i++) {

            if (PLACEMENTS[keys[i]] === props.pieLabels) return props.pieLabels;
        }

        return PLACEMENTS.Outside;
    };

    /** Gets the text of each slice's label: its series' name, its value and its share. */
    const getContent = (props) => ({
        names: props.pieLabelNames !== false,
        values: props.pieLabelValues === true,
        percentages: props.pieLabelPercentages !== false
    });

    /** Gets a value indicating whether the slices are labelled. */
    const areLabelsShown = (props) => {

        if (!Ren.DateValueChart_Pies.hasPies(props)) return false;
        if (getPlacement(props) === PLACEMENTS.Off) return false;

        const content = getContent(props);

        return content.names || content.values || content.percentages;
    };

    /** Gets a value indicating whether each pie's total is written in its hole. */
    const areTotalsShown = (props) => Ren.DateValueChart_Pies.hasPies(props)
        && props.pieHoleTotals !== false
        && Ren.DateValueChart_Pies.getHoleRadius(props) > 0;

    /**
     * Gets a value indicating whether the shares can be put inside the slices apart from the rest
     * of the labels, which is so where the labels are put outside the pies.
     */
    const canPutSharesInside = (props) => {

        const placement = getPlacement(props);

        return placement === PLACEMENTS.Outside || placement === PLACEMENTS.Around;
    };

    /**
     * Gets a value indicating whether each slice's share is written inside it, apart from the
     * rest of its label, outside the pie.
     */
    const areSharesInside = (props) => props.pieSharesInside !== false
        && canPutSharesInside(props)
        && areLabelsShown(props)
        && getContent(props).percentages;

    /**
     * Gets where each slice's value goes in its label, Inline where none is chosen, or where
     * Inside is chosen but the labels are inside the slices anyway.
     */
    const getValuePosition = (props) => {

        if (props.pieValuePosition === VALUE_POSITIONS.Below) return VALUE_POSITIONS.Below;

        if (props.pieValuePosition === VALUE_POSITIONS.Inside && canPutSharesInside(props)) {
            return VALUE_POSITIONS.Inside;
        }

        return VALUE_POSITIONS.Inline;
    };

    /**
     * Gets a value indicating whether each slice's value is written inside it, apart from the
     * rest of its label, outside the pie.
     */
    const areValuesInside = (props) => getValuePosition(props) === VALUE_POSITIONS.Inside
        && areLabelsShown(props)
        && getContent(props).values;

    /**
     * Gets a value indicating whether a placement stacks every label outside the pies either side
     * of them, shrinking the pies to make room, so that none is dropped for want of space.
     */
    const isStackedPlacement = (placement) =>
        placement === PLACEMENTS.Outside || placement === PLACEMENTS.Around;

    const getFontSizePx = (props) => props.pieLabelFontSize ?? DEFAULT_FONT_SIZE_PX;

    /** Gets a share, from 0 to 1, as a percentage, to a decimal place where it is under 10%. */
    const formatShare = (share) => {

        const percentage = share * 100;

        if (percentage >= 9.95) return Math.round(percentage) + "%";

        if (percentage < 0.05) return "<0.1%";

        return Math.round(percentage * 10) / 10 + "%";
    };

    /**
     * Gets a slice's value in its series' format, format function and all, as plain text, a
     * format function being able to give HTML.
     */
    const formatValue = (props, slice) => {

        const formatted = Ren.ValueFormatter.formatValue(
            slice.value,
            null,
            props.valueColumnFormats[slice.seriesIndex],
            props.valueColumnFormatFunctions?.[slice.seriesIndex]
        );

        if (formatted === null || formatted === undefined) return "";

        const text = String(formatted);

        return text.indexOf("<") === -1 && text.indexOf("&") === -1
            ? text
            : Ren.HtmlUtils.parseHTML(text).body.textContent;
    };

    /** Gets what a label says after its name: its value, then its share. */
    const getDetailText = (props, content, slice) => {

        const parts = [];

        if (content.values) parts.push(formatValue(props, slice));

        if (content.percentages) {

            const share = formatShare(slice.share);
            parts.push(content.values ? `(${share})` : share);
        }

        return parts.join(" ");
    };

    /**
     * Gives a label's group a tooltip of its slice's whole name, value and share, the label
     * itself perhaps being cut short or leaving some of them out.  An "Other" slice's tooltip
     * goes on to list the series it gathers.
     */
    const addTooltip = (groupNode, props, slice) => {

        const name = Ren.DateValueChart_Pies.getSeriesName(props, slice.seriesIndex);
        const value = formatValue(props, slice);
        const share = formatShare(slice.share);

        Ren.Svg.append(groupNode, "title").textContent =
            name + "\n" + (value ? `${value} (${share})` : share);

        Ren.DateValueChart_OtherSeries.addTooltip(groupNode, props, slice.seriesIndex);
    };

    const getLabelText = (props, content, slice) => {

        const detail = getDetailText(props, content, slice);

        if (!content.names) return detail;

        const name = Ren.DateValueChart_Pies.getSeriesName(props, slice.seriesIndex);

        return detail ? `${name}: ${detail}` : name;
    };

    /**
     * Gets the lines of a label: one, or where the value and share go below the name, the name
     * and then them.  None where the label says nothing.
     */
    const getLabelLines = (props, content, slice) => {

        if (content.names && getValuePosition(props) === VALUE_POSITIONS.Below) {

            const detail = getDetailText(props, content, slice);

            if (detail) {

                return [Ren.DateValueChart_Pies.getSeriesName(props, slice.seriesIndex), detail];
            }
        }

        const text = getLabelText(props, content, slice);

        return text ? [text] : [];
    };

    return {
        PLACEMENTS,
        VALUE_POSITIONS,
        DEFAULT_FONT_SIZE_PX,
        getPlacement,
        getContent,
        areLabelsShown,
        areTotalsShown,
        canPutSharesInside,
        areSharesInside,
        getValuePosition,
        areValuesInside,
        isStackedPlacement,
        getFontSizePx,
        formatShare,
        formatValue,
        addTooltip,
        getLabelText,
        getLabelLines
    };
})();
