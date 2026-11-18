/**
 * The settings window a date/value chart's cog opens (see DateValueChart_ColumnPickers), offering
 * what the chart's context menu offers as a form (see Ren.MenuSettingsWindow).  Its Chart tab has
 * the items that act on the chart as a whole, and leaves out those that act on its series, which
 * are known by their reading the series the menu acts on (see Ren.MenuItemProbe).  Those are on
 * the series tabs: All Series has them as the menu offers them away from every series, acting on
 * them all, and Individual Series as the chart's menu and the series' own menu offer them on the
 * series chosen there, as a series' colour, axis and so on are only on its own.
 */
Ren.DateValueChart_SettingsWindow = (() => {

    // The props each chart was last drawn with, whose element its menu items are contributed to.
    const latestPropsByVisualisation = new WeakMap();

    // The charts whose open window is to be built afresh once their menus have been.
    const pendingRefreshes = new Set();

    /**
     * Gets the elements the chart's menu items are contributed to, innermost first: the chart's
     * own, and the visualisation's, which every visualisation's standing items go to.
     */
    const getMenuElements = (visualisation) => {

        const props = latestPropsByVisualisation.get(visualisation);
        const elements = [props?.svg?.parentNode, visualisation.element];

        return elements.filter((element, index) => element && elements.indexOf(element) === index);
    };

    /**
     * Runs a function as if the chart's menu had been opened away from every series.
     */
    const runAsMenu = (visualisation, fn) =>
        Ren.ContextMenuRegistry.withOpener(getMenuElements(visualisation)[0], fn);

    /**
     * Runs a function as if the chart's menu had been opened on one of its series.  The menu
     * reads the series from the nearest element marked with it, so one is put in the chart for
     * the while, which stands for the series whether or not it's drawn.
     */
    const runAsSeriesMenu = (visualisation, seriesIndex, fn) => {

        const props = latestPropsByVisualisation.get(visualisation);
        const parent = props?.svg || getMenuElements(visualisation)[0];
        const marker = document.createElementNS(Ren.Svg.NAMESPACE, "g");

        marker.setAttribute("data-series", seriesIndex);
        parent.appendChild(marker);

        try {
            return Ren.ContextMenuRegistry.withOpener(marker, fn);
        }
        finally {
            marker.remove();
        }
    };

    /**
     * Gets the chart's series to choose from, [{ key, label }], keyed by their number.
     */
    const getSeriesOptions = (visualisation) => {

        const props = latestPropsByVisualisation.get(visualisation);
        const options = [];

        for (let seriesIndex = 1; seriesIndex <= (props?.seriesCount || 0); seriesIndex++) {

            const label = props.series?.[seriesIndex - 1]?.label ||
                props.valueHeadings?.[seriesIndex - 1] ||
                "Series " + seriesIndex;

            options.push({ key: seriesIndex, label });
        }

        return options;
    };

    /**
     * Gets the chart's menu items and, for a series, the series' own, which stand in for the
     * chart's of the same id as they do on the series' menu.
     */
    const collectMenuItems = (visualisation, isForSeries) => {

        const items = Ren.ContextMenuRegistry.collectItemsForElements(getMenuElements(visualisation));

        if (!isForSeries) return items;

        const seriesItems = latestPropsByVisualisation.get(visualisation)?.seriesMenuItems || [];
        const seriesItemIds = new Set(seriesItems.map(item => item.id).filter(id => typeof id === "string"));

        return items.filter(item => !seriesItemIds.has(item.id)).concat(seriesItems);
    };

    /**
     * Builds the settings of a tab from the chart's menu items, as the menu offers them when run
     * by runMenu, keeping those include picks.
     */
    const buildModel = (visualisation, runMenu, include, memory, isForSeries) => runMenu(() =>

        Ren.MenuSettingsModel.build(
            collectMenuItems(visualisation, isForSeries),
            {
                include,
                isTechMode: Ren.UrlContext.onEditorPage(),
                // So that controls a change hides are greyed out where they are, not taken away.
                includeHidden: true,
                // So that controls keep their kind as what is ticked changes.
                memory
            }
        )
    );

    const actsOnSeries = (control) => control.dependencies.has("series");

    // The last period estimate's items, which are set for the chart as a whole in all but name:
    // the series it leaves out still take it up from the rest, and its other options are the
    // chart's.  So they are offered with the chart's dates on the Chart tab.
    const CHART_WIDE_SERIES_ITEM_IDS = ["chart-estimate-last-period", "chart-show-incomplete-last-period"];

    const isChartWideSeriesItem = (control) => {

        const id = typeof control.item.id === "string" ? control.item.id : "";

        return CHART_WIDE_SERIES_ITEM_IDS.some(prefix => id.startsWith(prefix));
    };

    const isForChart = (control) => !actsOnSeries(control) || isChartWideSeriesItem(control);

    const isForSeriesTab = (control) => actsOnSeries(control) && !isChartWideSeriesItem(control);

    const open = (visualisation) => {

        if (!getMenuElements(visualisation).length) return;

        const chartMemory = new Map();
        const allSeriesMemory = new Map();

        // Each series' own, by series number, as what is ticked differs between them.
        const seriesMemories = new Map();

        const getSeriesMemory = (seriesIndex) => {

            if (!seriesMemories.has(seriesIndex)) seriesMemories.set(seriesIndex, new Map());

            return seriesMemories.get(seriesIndex);
        };

        const runAsChartMenu = fn => runAsMenu(visualisation, fn);

        Ren.MenuSettingsWindow.open({
            owner: visualisation,
            title: "Chart Settings",
            popupReuseId: "ren-date-value-chart-settings-" + visualisation.visualisationGuid,
            tabs: [
                {
                    title: "Chart",
                    buildModel: () => buildModel(
                        visualisation, runAsChartMenu, isForChart, chartMemory
                    )
                },
                {
                    title: "All Series",
                    buildModel: () => buildModel(visualisation, runAsChartMenu, isForSeriesTab, allSeriesMemory)
                },
                {
                    title: "Individual Series",
                    subjects: { label: "Series", getOptions: () => getSeriesOptions(visualisation) },
                    buildModel: (seriesKey) => {

                        const seriesIndex = Number(seriesKey);

                        return buildModel(
                            visualisation,
                            fn => runAsSeriesMenu(visualisation, seriesIndex, fn),
                            isForSeriesTab,
                            getSeriesMemory(seriesIndex),
                            true
                        );
                    },
                    runAction: (fn, seriesKey) => runAsSeriesMenu(visualisation, Number(seriesKey), fn)
                }
            ],
            runAction: runAsChartMenu
        });
    };

    /**
     * Notes the props the chart has been drawn with, and builds its open window afresh to match,
     * once the chart has finished contributing its menus.
     */
    const update = (visualisation, props) => {

        latestPropsByVisualisation.set(visualisation, props);

        if (!Ren.MenuSettingsWindow.isOpen(visualisation) || pendingRefreshes.has(visualisation)) return;

        pendingRefreshes.add(visualisation);

        setTimeout(() => {

            pendingRefreshes.delete(visualisation);
            Ren.MenuSettingsWindow.refresh(visualisation);
        });
    };

    return {
        open,
        update
    };
})();
