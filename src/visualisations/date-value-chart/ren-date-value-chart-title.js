/**
 * Shows a chart's title, where it has one, above its plot, and its subtitle beneath that.  They
 * take their room from the plot, which is scaled to what is left, as it is for the legend beneath.
 *
 * The title can name the columns the chart is showing: {value} stands for its value column and
 * {split} for the column its data is split by.  Where the data isn't split {split} is left out
 * along with the word before it, so "{value} by {split}" reads "Revenue".
 *
 * The subtitle can name the filters in effect on the chart's rows: {filters} stands for them.  A
 * subtitle naming them is hidden while nothing is filtered, keeping its room so the plot doesn't
 * move as filters come and go.  The cross filters set from other charts come first, each as a chip
 * that can clear it (see Ren.VisualisationCrossFilterIndicators), which the chart then doesn't show
 * in its corner.
 */
Ren.DateValueChart_Title = (() => {

    const CLASS_NAME = "ren-chart-title";
    const SUBTITLE_CLASS_NAME = "ren-chart-subtitle";
    const SUBTITLE_PLACEHOLDER_CLASS_NAME = SUBTITLE_CLASS_NAME + "--placeholder";
    const VALUE_TOKEN = /\{value\}/g;
    const SPLIT_TOKEN = /([^\s{}]+\s+)?\{split\}/g;
    const FILTERS_TOKEN = /\{filters\}/g;

    // The values a filter names in the subtitle shown, where its tooltip names them all.
    const SHOWN_FILTER_VALUE_COUNT = 6;

    const trimTemplate = (template) => (typeof template === "string" ? template.trim() : "");

    /**
     * Gets the chart's title as it was entered, without the space around it, or "" where it has
     * none.
     */
    const getTitleTemplate = (props) => trimTemplate(props.chartTitle);

    /**
     * Gets the chart's subtitle as it was entered, without the space around it, or "" where it has
     * none.
     */
    const getSubtitleTemplate = (props) => trimTemplate(props.chartSubtitle);

    /**
     * Gets the chart's title as it is shown, or "" where it has none.
     */
    const getTitle = (props) => {

        const splitColumn = props.seriesSplit?.columnHeading;
        const valueColumns = props.valueColumnHeadings;

        return getTitleTemplate(props)
            .replace(SPLIT_TOKEN, (match, wordBefore) => splitColumn
                ? (wordBefore ?? "") + splitColumn
                : "")
            .replace(VALUE_TOKEN, () => (valueColumns ? valueColumns.join(", ") : ""))
            .trim();
    };

    /**
     * Gets the filters in effect on the chart's rows in words, as Ren.FilterSummary's parts, each
     * headed as the filter module setting it heads its item.  Empty where none are in effect.  The
     * cross filters come first, each of their parts carrying the cross filter as crossFilter.
     */
    const getFilterSummaryParts = (props, maxValues) => {

        const visualisation = props.visualisation;

        if (!visualisation) return [];

        const tabularData = Ren.DataSources.getTabularData(
            visualisation.dataSourceUri,
            visualisation.dataTabIndex ?? 1,
            visualisation.dataTabGroup
        );

        if (!tabularData) return [];

        const settingsGroups = [visualisation.dataGroupingSettingsGroup];

        if (visualisation.filterGroup) settingsGroups.push(visualisation.filterGroup);

        const crossFilters = new Map(Ren.VisualisationCrossFilterIndicators
            .getCrossFilters(visualisation)
            .map(crossFilter => [crossFilter.filter.column, crossFilter]));

        const parts = Ren.FilterSummary.getParts(
            Ren.DateValueChart_DataPointGrid.getChartFilters(visualisation, tabularData),
            tabularData,
            maxValues,
            Ren.FilterSummary.getFilterModuleItemSettings(settingsGroups),
            new Set(crossFilters.keys())
        );

        return parts.map(part => part.column == null
            ? part
            : { text: part.text, isValue: part.isValue, crossFilter: crossFilters.get(part.column) });
    };

    /**
     * Gets the chart's subtitle as it is shown in parts, { text, isValue }, the values it names
     * flagged, and those naming a cross filter carrying it as crossFilter; empty where it has none.  Each filter it names names at most maxValues values, six
     * by default.
     */
    const getSubtitleParts = (props, maxValues = SHOWN_FILTER_VALUE_COUNT) => {

        const template = getSubtitleTemplate(props);

        if (!template) return [];

        if (template.search(FILTERS_TOKEN) === -1) return [{ text: template, isValue: false }];

        const summaryParts = getFilterSummaryParts(props, maxValues);

        if (!summaryParts.length) return [];

        const pieces = template.split(FILTERS_TOKEN);
        const parts = [];

        for (let index = 0; index < pieces.length; index++) {

            if (index) {

                for (let partIndex = 0; partIndex < summaryParts.length; partIndex++) {
                    parts.push(summaryParts[partIndex]);
                }
            }

            if (pieces[index]) parts.push({ text: pieces[index], isValue: false });
        }

        return parts;
    };

    /**
     * Gets the chart's subtitle as it is shown, or "" where it has none.
     */
    const getSubtitle = (props, maxValues) =>
        getSubtitleParts(props, maxValues).map(part => part.text).join("");

    const appendParts = (parent, parts) => {

        for (let index = 0; index < parts.length; index++) {

            const part = parts[index];

            if (part.isValue) {

                const valueElement = document.createElement("strong");

                valueElement.textContent = part.text;
                parent.appendChild(valueElement);
            }
            else {

                parent.appendChild(document.createTextNode(part.text));
            }
        }
    };

    // Takes the text in parts, { text, isValue, crossFilter }, its values in bold and each cross
    // filter's run of parts in a chip.
    const createHeading = (className, parts, tooltip, ariaLevel, textStyles) => {

        const element = document.createElement("div");

        element.className = className;
        element.setAttribute("role", "heading");
        element.setAttribute("aria-level", ariaLevel);
        element.title = tooltip;

        Ren.Svg.setStyles(element, Object.assign({
            "display": "flex",
            "flex": "0 0 auto",
            "font-family": "sans-serif"
        }, textStyles));

        // In an element of its own, as the text of a flex container can't be ellipsized.
        const textElement = document.createElement("span");

        textElement.className = className + "__text";

        for (let index = 0; index < parts.length;) {

            const crossFilter = parts[index].crossFilter;
            let end = index + 1;

            while (end < parts.length && parts[end].crossFilter === crossFilter) end++;

            if (crossFilter) {

                const content = document.createDocumentFragment();

                appendParts(content, parts.slice(index, end));
                textElement.appendChild(
                    Ren.VisualisationCrossFilterIndicators.createInlineChip(crossFilter, content)
                );
            }
            else {

                appendParts(textElement, parts.slice(index, end));
            }

            index = end;
        }

        Ren.Svg.setStyles(textElement, {
            "flex": "0 1 auto",
            "min-width": "0",
            "white-space": "nowrap",
            "overflow": "hidden",
            "text-overflow": "ellipsis"
        });

        element.appendChild(textElement);

        return element;
    };

    /**
     * Shows the chart's title and subtitle above its plot, or takes away those shown where it has
     * none.  The charts a multi-chart is drawn as are left untitled, the multi-chart's title
     * standing above them all.
     */
    const render = (props) => {

        // A multi-chart has no plot of its own, so its title heads its container.
        const container = props.svg
            ? props.svg.parentNode
            : document.querySelector("." + props.guid);

        if (!container) return;

        const existing = container.querySelectorAll(
            `:scope > .${CLASS_NAME}, :scope > .${SUBTITLE_CLASS_NAME}`
        );

        for (let index = 0; index < existing.length; index++) existing[index].remove();

        if (props.multiChartRange) return;

        const before = props.svg || container.firstChild;
        const title = getTitle(props);

        if (title) {

            const titleParts = [{ text: title, isValue: false }];

            const titleElement = createHeading(CLASS_NAME, titleParts, title, "2", {
                "font-size": "14px",
                "font-weight": "600",
                "color": "#222222"
            });

            container.insertBefore(titleElement, before);
        }

        const subtitleParts = getSubtitleParts(props);

        if (subtitleParts.length) {

            const subtitleElement = createHeading(
                SUBTITLE_CLASS_NAME,
                subtitleParts,
                getSubtitle(props, Infinity),
                "3",
                {
                    "font-size": "12px",
                    "font-weight": "400",
                    "color": "#555555"
                }
            );

            container.insertBefore(subtitleElement, before);
        }
        else if (getSubtitleTemplate(props).search(FILTERS_TOKEN) !== -1) {

            // A subtitle naming the filters keeps its room while nothing is filtered, so that the
            // plot doesn't jump as filters come and go.
            const placeholderElement = createHeading(
                SUBTITLE_CLASS_NAME,
                [{ text: " ", isValue: false }],
                "",
                "3",
                {
                    "font-size": "12px",
                    "visibility": "hidden"
                }
            );

            placeholderElement.classList.add(SUBTITLE_PLACEHOLDER_CLASS_NAME);
            placeholderElement.removeAttribute("role");
            placeholderElement.removeAttribute("aria-level");
            placeholderElement.removeAttribute("title");
            placeholderElement.setAttribute("aria-hidden", "true");

            container.insertBefore(placeholderElement, before);
        }
    };

    return {
        getSubtitle,
        getSubtitleParts,
        getSubtitleTemplate,
        getTitle,
        getTitleTemplate,
        render
    };
})();
