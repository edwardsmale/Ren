/**
 * The settings window a date/value chart's cog opens (see DateValueChart_ColumnPickers), offering
 * what the chart's context menu offers as a form (see Ren.MenuSettingsWindow).  Its Chart tab has
 * the items that act on the chart as a whole, and leaves out those that act on its series, which
 * are known by their reading the series the menu acts on (see Ren.MenuItemProbe).  Those are on
 * the series tabs: All Series has them as the menu offers them away from every series, acting on
 * them all, and Individual Series as the chart's menu and the series' own menu offer them on the
 * series chosen there, as a series' colour, axis and so on are only on its own.  Where the data
 * are split, what a split series shares with the others split from its column, such as how it is
 * drawn and aggregated, is set apart there under a heading naming them all.  Where the data are
 * split from one column only, every series shares those, so they are on All Series instead.
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

    // What the series are drawn as and how they're labelled, which the chart's menu has with how
    // the chart looks unless opened on a series.  They're under Series on both series tabs, so
    // that All Series has them where Individual Series does, but not on the Chart tab, where
    // their chart-wide options stay with how the chart looks.
    const SERIES_SECTION_ITEM_IDS = new Set(["chart-type", "chart-labels"]);

    const inSeriesSection = (item) => {

        if (!SERIES_SECTION_ITEM_IDS.has(item.id)) return item;

        const copy = Object.defineProperties({}, Object.getOwnPropertyDescriptors(item));

        Object.defineProperty(copy, "section", {
            value: "Series",
            enumerable: true,
            configurable: true
        });

        return copy;
    };

    // The items only a series' own menu offers, as copied onto All Series (see markSeriesOnly),
    // and those of their submenus, so that only what every series shares is kept of them there.
    const seriesOnlyItems = new WeakSet();

    /**
     * Copies an item only a series' own menu offers, and the items of its submenu as they are
     * read, noting each copy as one.
     */
    const markSeriesOnly = (item) => {

        const copy = Object.defineProperties({}, Object.getOwnPropertyDescriptors(item));

        if ("submenu" in item) {

            Object.defineProperty(copy, "submenu", {
                get: () => {

                    const submenu = item.submenu;

                    return Array.isArray(submenu) ? submenu.map(markSeriesOnly) : submenu;
                },
                enumerable: true,
                configurable: true
            });
        }

        seriesOnlyItems.add(copy);

        return copy;
    };

    const getItemIds = (items) => new Set(items.map(item => item.id).filter(id => typeof id === "string"));

    /**
     * Gets the chart's menu items and, for a series, the series' own, which stand in for the
     * chart's of the same id as they do on the series' menu.  withSeriesOnly adds instead those
     * of the series' own the chart's menu lacks, marked as such (see markSeriesOnly).
     */
    const collectMenuItems = (visualisation, isSeriesTab, isForSeries, withSeriesOnly) => {

        let items = Ren.ContextMenuRegistry.collectItemsForElements(getMenuElements(visualisation));

        if (isSeriesTab) items = items.map(inSeriesSection);

        if (!isForSeries && !withSeriesOnly) return items;

        const seriesItems = latestPropsByVisualisation.get(visualisation)?.seriesMenuItems || [];

        if (isForSeries) {

            const seriesItemIds = getItemIds(seriesItems);

            return items.filter(item => !seriesItemIds.has(item.id)).concat(seriesItems);
        }

        const itemIds = getItemIds(items);

        return items.concat(seriesItems
            .filter(item => typeof item.id === "string" && !itemIds.has(item.id))
            .map(markSeriesOnly));
    };

    /**
     * Builds the settings of a tab from the chart's menu items, as the menu offers them when run
     * by runMenu, keeping those include picks.  options: { isSeriesTab, isForSeries,
     * withSeriesOnly, getScope } (see collectMenuItems and Ren.MenuSettingsModel).
     */
    const buildModel = (visualisation, runMenu, include, memory, options) => runMenu(() =>

        Ren.MenuSettingsModel.build(
            collectMenuItems(
                visualisation,
                !!options?.isSeriesTab,
                !!options?.isForSeries,
                !!options?.withSeriesOnly
            ),
            {
                include,
                getScope: options?.getScope || undefined,
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

    const sharesSourceColumn = (control) =>
        control.dependencies.has(Ren.ContextMenuItems_DateValueChart.SOURCE_COLUMN_DEPENDENCY);

    /**
     * Gets a value indicating whether the chart's data are split from one value column only, so
     * that what a split series shares with those split from its column, every series shares.
     */
    const isSplitFromOneColumn = (visualisation) => {

        const props = latestPropsByVisualisation.get(visualisation);
        const headings = props?.seriesSourceHeadings;

        return !!props?.seriesSplit && !!headings?.length &&
            headings.every(heading => heading === headings[0]);
    };

    // All Series has what only a series' own menu offers where every series shares it.
    const isForAllSeriesTab = (control) => isForSeriesTab(control) &&
        (!seriesOnlyItems.has(control.item) || sharesSourceColumn(control));

    // A series' own tab leaves out what All Series sets for every series alike.
    const isForSeriesOfOneColumn = (control) => isForSeriesTab(control) && !sharesSourceColumn(control);

    /**
     * Gets what a split series' control acts on beyond the series: every series split from its
     * column, where the menu notes it does, as for how they are drawn and aggregated.
     */
    const getSplitSeriesScope = (visualisation, seriesIndex) => (control) => {

        if (!sharesSourceColumn(control)) return null;

        const props = latestPropsByVisualisation.get(visualisation);
        const column = props?.seriesSourceHeadings?.[seriesIndex - 1];

        return column ? "Shared by all \"" + column + "\" series" : null;
    };

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

        const settingsWhenOpened = Ren.VisualisationOriginalSettings.snapshot(visualisation);

        Ren.MenuSettingsWindow.open({
            owner: visualisation,
            title: "Chart Settings",
            popupReuseId: "ren-date-value-chart-settings-" + visualisation.visualisationGuid,
            tabs: [
                {
                    title: "Chart",
                    buildModel: () => buildModel(
                        visualisation,
                        runAsChartMenu,
                        isForChart,
                        chartMemory
                    )
                },
                {
                    title: "All Series",
                    subjects: { label: "Series", text: "All" },
                    buildModel: () => {

                        const isOneColumn = isSplitFromOneColumn(visualisation);

                        return buildModel(
                            visualisation,
                            runAsChartMenu,
                            isOneColumn ? isForAllSeriesTab : isForSeriesTab,
                            allSeriesMemory,
                            { isSeriesTab: true, withSeriesOnly: isOneColumn }
                        );
                    }
                },
                {
                    title: "Individual Series",
                    subjects: {
                        label: "Series",
                        getOptions: () => getSeriesOptions(visualisation)
                    },
                    buildModel: (seriesKey) => {

                        const seriesIndex = Number(seriesKey);
                        const isOneColumn = isSplitFromOneColumn(visualisation);

                        return buildModel(
                            visualisation,
                            fn => runAsSeriesMenu(visualisation, seriesIndex, fn),
                            isOneColumn ? isForSeriesOfOneColumn : isForSeriesTab,
                            getSeriesMemory(seriesIndex),
                            {
                                isSeriesTab: true,
                                isForSeries: true,
                                getScope: isOneColumn ? null : getSplitSeriesScope(visualisation, seriesIndex)
                            }
                        );

                    },
                    runAction: (fn, seriesKey) => runAsSeriesMenu(visualisation, Number(seriesKey), fn)
                }
            ],
            runAction: runAsChartMenu,
            // Back to the chart as it was when the window was opened, undoing what was changed in
            // it, rather than to the report's own settings as the menu's Reset is.
            onReset: settingsWhenOpened
                ? () => Ren.VisualisationOriginalSettings.restore(visualisation, settingsWhenOpened)
                : null,
            resetTitle: "Puts the chart back as it was when this window was opened"
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
