/**
 * The date/value chart's context menu items for how it looks.  None of these change what the chart
 * plots, so where restyling what is already drawn is cheaper than a redraw, that is what they do.
 */
Ren.ContextMenuItems_DateValueChart_Appearance = (chart) => {

    const { visualisation, props } = chart;

    const {
        getTargetSeriesIndexes,
        getTargetSeriesIndex,
        getSeriesPropertyAt,
        getSharingSeriesIndexes,
        setSeriesPropertyOn,
        getSeriesProperty,
        setSeriesProperty,
        setSeriesProperties,
        toggleSeriesProperty,
        buildSeriesOptionItems,
        targetSeriesHeadingMenuItem,
        chartHeadingMenuItem,
        subdivisionLabelsMenuItem
    } = chart;

    const seriesColours = [
        { name: "Red", hex: "#b20000" },
        { name: "Orange", hex: "#b73e00" },
        { name: "Gold", hex: "#c79100" },
        { name: "Olive", hex: "#6b7a12" },
        { name: "Green", hex: "#216521" },
        { name: "Teal", hex: "#00796b" },
        { name: "Light blue", hex: "#0288d1" },
        { name: "Blue", hex: "#2222c2", isDefault: true },
        { name: "Navy", hex: "#14205e" },
        { name: "Purple", hex: "#6a1b9a" },
        { name: "Pink", hex: "#EB4297" },
        { name: "Maroon", hex: "#7b1f3a" },
        { name: "Brown", hex: "#6d4c41" },
        { name: "Grey", hex: "#757575" },
        { name: "Black", hex: "#000000" }
    ];

    // Used to preview a colour variant against a series that has no colour of its own.
    const DEFAULT_SERIES_COLOUR = "#3046b8";

    const colourVariantOptions = [
        { name: "Normal", filter: null },
        { name: "Vibrant", filter: "saturate(2) brightness(1.1) contrast(1.2)" },
        { name: "Dark", filter: "brightness(0.5) contrast(1.4)" },
        { name: "Grayish", filter: "saturate(0.5) contrast(0.5)" }
    ];

    // Not offered for several series, as giving them all the one label would leave them unreadable.
    const seriesLabelMenuItem = {
        section: "Series",
        text: "Edit series label...",
        id: "edit-series-label",
        visible: () => getTargetSeriesIndexes().length === 1,
        action: () => {

            const seriesIndex = getTargetSeriesIndex();
            if (!seriesIndex) return;

            const currentLabel =
                getSeriesProperty("label", null) || props.valueHeadings[seriesIndex - 1] || "";

            Ren.CreateTextEditorPopupWindow(
                "Edit Series Label",
                currentLabel,
                newLabel => setSeriesProperty("label", newLabel.trim() || null),
                { width: 320, height: 110 }
            );
        }
    };

    const setFilterVariant = (variantName) => {

        const variant = colourVariantOptions.find(option => option.name === variantName);

        setSeriesProperty("colourFilter", variant ? variant.filter : null);
    };

    // Gets the name of the variant the series' colour filter corresponds to, or null where the
    // series differ.
    const getFilterVariant = () => {

        const currentFilter = getSeriesProperty("colourFilter", null);

        if (currentFilter === undefined) return null;

        return colourVariantOptions.find(option => option.filter === currentFilter)?.name
            ?? "Normal";
    };

    // Previews an option on the chart while the pointer rests over it, restoring the series' real
    // appearance on the way out.  A preview is built for each series the option would set
    // propertyName on and the lot shown together.
    const addPreviewHandlers = (menuItem, buildPreview, showPreviews, propertyName) => {

        menuItem.onmouseenter = () => {

            const seriesIndexes = getSharingSeriesIndexes(getTargetSeriesIndexes(), propertyName);
            const previews = [];

            for (let i = 0; i < seriesIndexes.length; i++) {

                previews.push(buildPreview(seriesIndexes[i]));
            }

            showPreviews(props, previews);
        };

        menuItem.onmouseleave = () => {

            Ren.DateValueChart_StyleUpdater.clearPreview(props);
        };

        return menuItem;
    };

    // The colour and filter are got for each series previewed.
    const addColourPreviewHandlers = (menuItem, getPreviewColour, getPreviewFilter) =>
        addPreviewHandlers(
            menuItem,
            seriesIndex => ({
                seriesIndex,
                colour: getPreviewColour(seriesIndex),
                filter: getPreviewFilter(seriesIndex)
            }),
            Ren.DateValueChart_StyleUpdater.setPreviewColours
        );

    // Builds the items for a per-series setting, each previewed while the pointer rests over it.
    // The preview for a series is built from the option's value.
    const buildPreviewedOptionItems = (
        propertyName,
        defaultValue,
        options,
        buildPreview,
        showPreviews
    ) => {

        const menuItems = buildSeriesOptionItems(propertyName, defaultValue, options);

        for (let i = 0; i < menuItems.length; i++) {

            const value = options[i].value;

            addPreviewHandlers(
                menuItems[i],
                seriesIndex => buildPreview(seriesIndex, value),
                showPreviews,
                propertyName
            );
        }

        return menuItems;
    };

    // Builds the items for a line style or width, each previewed with the series' other setting.
    const buildLineOptionItems = (propertyName, defaultValue, options) =>
        buildPreviewedOptionItems(
            propertyName,
            defaultValue,
            options,
            (seriesIndex, value) => {

                const preview = {
                    seriesIndex,
                    lineStyle: getSeriesPropertyAt(seriesIndex, "lineStyle", "solid"),
                    lineWidth: getSeriesPropertyAt(seriesIndex, "lineWidth", "normal")
                };

                preview[propertyName] = value;
                return preview;
            },
            Ren.DateValueChart_StyleUpdater.setPreviewLines
        );

    const filterVariantMenuItems = colourVariantOptions.map(variantOption => {

        const menuItem = {
            text: variantOption.name,
            action: () => setFilterVariant(variantOption.name),
            visible: () => !!getTargetSeriesIndex(),
            ticked: () => getFilterVariant() === variantOption.name
        };

        return addColourPreviewHandlers(
            menuItem,
            seriesIndex => getSeriesPropertyAt(seriesIndex, "colour", null)
                || DEFAULT_SERIES_COLOUR,
            () => variantOption.filter
        );
    });

    // Picking a named colour gives up any standard colour, which would otherwise outrank it.
    const seriesColourMenuItems = seriesColours.map(colour => {

        const menuItem = {
            text: colour.name,
            visible: () => !!getTargetSeriesIndex(),
            action: () => setSeriesProperties(
                { colour: colour.hex, standardColour: null },
                seriesIndex => Ren.DateValueChart_StyleUpdater.updateSeriesColour(
                    props,
                    colour.hex,
                    seriesIndex
                )
            ),
            ticked: () => getSeriesProperty("standardColour", null) === null
                && getSeriesProperty("colour", null) === colour.hex
        };

        return addColourPreviewHandlers(
            menuItem,
            () => colour.hex,
            seriesIndex => getSeriesPropertyAt(seriesIndex, "colourFilter", null)
        );
    });

    // A standard colour is the series' whole look, so any colour variant is dropped with it.
    const standardColourMenuItems = Ren.StandardColoursConfig.getKeys().map(key => {

        const menuItem = {
            text: Ren.StandardColoursConfig.getName(key),
            visible: () => !!getTargetSeriesIndex(),
            action: () => setSeriesProperties(
                { standardColour: key, colourFilter: null },
                seriesIndex => Ren.DateValueChart_StyleUpdater.updateSeriesColour(
                    props,
                    Ren.StandardColoursConfig.getColour(key),
                    seriesIndex
                )
            ),
            ticked: () => getSeriesProperty("standardColour", null) === key
        };

        return addColourPreviewHandlers(
            menuItem,
            () => Ren.StandardColoursConfig.getColour(key),
            () => null
        );
    });

    /**
     * Opens the function editor on the series' colour function, starting a series without one
     * from an example.  The series are fixed on opening, the menu's target going with the menu.
     */
    const editSeriesColourFunction = () => {

        const seriesIndexes = getTargetSeriesIndexes();

        if (seriesIndexes.length === 0) return;

        const originalFunctions = [];

        for (let i = 0; i < seriesIndexes.length; i++) {

            originalFunctions.push(getSeriesPropertyAt(seriesIndexes[i], "colourFunction", null));
        }

        const getFunction = () => originalFunctions[0]
            || Ren.DateValueChart_SeriesColourFunction.NEW_FUNCTION_TEMPLATE;

        const setFunction = (code) =>
            setSeriesPropertyOn(seriesIndexes, "colourFunction", (code ?? "").trim() || null);

        // Series sharing an original function are set back together.
        const restoreFunction = () => {

            const restored = [];

            for (let i = 0; i < seriesIndexes.length; i++) {

                if (restored.indexOf(i) !== -1) continue;

                const sameIndexes = [];

                for (let j = i; j < seriesIndexes.length; j++) {

                    if (originalFunctions[j] === originalFunctions[i]) {

                        sameIndexes.push(seriesIndexes[j]);
                        restored.push(j);
                    }
                }

                setSeriesPropertyOn(sameIndexes, "colourFunction", originalFunctions[i]);
            }
        };

        Ren.Messages.Requests.functionEditorWindow.notify(
            getFunction,
            setFunction,
            null,
            null,
            {
                centred: true,
                parameterSet: "colour",
                title: "Edit Series Colour",
                restoreFunction
            }
        );
    };

    const hasSeriesColourFunction = () => {

        const seriesIndexes = getTargetSeriesIndexes();

        for (let i = 0; i < seriesIndexes.length; i++) {

            if (getSeriesPropertyAt(seriesIndexes[i], "colourFunction", null)) return true;
        }

        return false;
    };

    const seriesColourFunctionMenuItem = {
        text: "Colour function...",
        id: "series-colour-function",
        title: "A function giving each bar, line point or dot a colour from its value and row, "
            + "or null for the series' own colour",
        visible: () => !!getTargetSeriesIndex(),
        ticked: hasSeriesColourFunction,
        action: editSeriesColourFunction
    };

    const removeSeriesColourFunctionMenuItem = {
        text: "Remove colour function",
        id: "series-remove-colour-function",
        visible: hasSeriesColourFunction,
        action: () => setSeriesProperty("colourFunction", null)
    };

    const seriesColourMenuItem = {
        section: "Series",
        text: "Colour",
        id: "series-colour",
        visible: () => !!getTargetSeriesIndex(),
        submenu: [
            {
                text: "Variants",
                id: "series-colour-variants",
                visible: () => !!getTargetSeriesIndex(),
                submenu: filterVariantMenuItems
            },
            {
                text: "Standardised",
                id: "series-colour-standardised",
                visible: () => !!getTargetSeriesIndex() && standardColourMenuItems.length > 0,
                submenu: standardColourMenuItems
            },
            Ren.MENU_SEPARATOR
        ].concat(seriesColourMenuItems, [
            Ren.MENU_SEPARATOR,
            seriesColourFunctionMenuItem,
            removeSeriesColourFunctionMenuItem
        ])
    };

    const seriesLineStyleMenuItem = {
        text: "Line style",
        id: "series-line-style",
        // Offered where any of the series is drawn as a line; the others keep the style for if
        // they are made lines.
        visible: () => getTargetSeriesIndexes().some(
            seriesIndex => getSeriesPropertyAt(seriesIndex, "chartType", null)
                === Ren.SeriesChartTypeEnum.Line
        ),
        submenu: buildLineOptionItems("lineStyle", "solid", [
            { text: "Solid", value: "solid" },
            { text: "Dashed", value: "dashed" },
            { text: "Dotted", value: "dotted" }
        ]).concat(
            [Ren.MENU_SEPARATOR],
            buildLineOptionItems("lineWidth", "normal", [
                { text: "Thin", value: "thin" },
                { text: "Normal", value: "normal" },
                { text: "Thick", value: "thick" }
            ]),
            [Ren.MENU_SEPARATOR],
            buildSeriesOptionItems("lineShape", "straight", [
                { text: "Straight", value: "straight" },
                { text: "Curved", value: "curved" },
                { text: "Stepped", value: "stepped" }
            ])
        )
    };

    const seriesDotSizeMenuItem = {
        text: "Dot size",
        id: "series-dot-size",
        // Offered where any of the series is drawn as dots; the others keep the size for if they
        // are made dots.
        visible: () => getTargetSeriesIndexes().some(
            seriesIndex => getSeriesPropertyAt(seriesIndex, "chartType", null)
                === Ren.SeriesChartTypeEnum.Dot
        ),
        submenu: buildPreviewedOptionItems(
            "dotSize",
            "medium",
            [
                { text: "Small", value: "small" },
                { text: "Medium", value: "medium" },
                { text: "Large", value: "large" }
            ],
            (seriesIndex, value) => ({ seriesIndex, dotSize: value }),
            Ren.DateValueChart_StyleUpdater.setPreviewDots
        )
    };

    const seriesValueLabelsMenuItem = {
        text: "Value labels",
        id: "series-value-labels",
        visible: () => !!getTargetSeriesIndex(),
        ticked: () => getSeriesProperty("showValueLabels", true),
        action: () => toggleSeriesProperty(
            "showValueLabels",
            true,
            (value, seriesIndex) => Ren.DateValueChart_StyleUpdater.updateShowValueLabels(
                props,
                value,
                seriesIndex
            )
        )
    };

    // Offered where any of the series is drawn as bars, as for the line style.  The names are drawn
    // with the bars, so the chart is redrawn.
    const seriesNameInBarsMenuItem = {
        text: "Names in bars",
        id: "series-name-in-bars",
        // Left out of the settings window, rather than greyed out, where there are no bars.
        omitWhenHidden: true,
        title: "Writes the series' name up each of its bars, shortened where a bar is too short",
        visible: () => getTargetSeriesIndexes().some(
            seriesIndex => getSeriesPropertyAt(seriesIndex, "chartType", null)
                === Ren.SeriesChartTypeEnum.Bar
        ),
        ticked: () => getSeriesProperty("showNameInBars", false) === true,
        action: () => toggleSeriesProperty("showNameInBars", false)
    };

    // Sets one of the chart's properties on the visualisation too, so it is saved.
    const setChartProperty = (propertyName, value, onCommitted) => {

        props[propertyName] = value;

        if (visualisation) {
            visualisation[propertyName] = value;
        }

        Ren.VisualisationSettingsSynchroniser.commitChange(visualisation, onCommitted);
    };

    const setBarLayout = (layout) => setChartProperty("barLayout", layout, props.redrawChart);

    const getBarLayout = () => Ren.DateValueChartCalculator.getBarLayout(props);

    const buildBarLayoutOption = (text, layout) => ({
        text: text,
        action: () => setBarLayout(layout),
        ticked: () => getBarLayout() === layout
    });

    // Offered where the series are split from several value columns, as only then does a split
    // value have more than one series to lay out together.
    const buildPerSplitBarLayoutOption = (text, layout) => Object.assign(
        buildBarLayoutOption(text, layout),
        { visible: () => Ren.DateValueChartCalculator.isSplitFromSeveralColumns(props) }
    );

    const barLayoutMenuItem = {
        text: "Bar layout",
        id: "bar-layout",
        // Left out of the settings window, rather than greyed out, where there are no bars.
        omitWhenHidden: true,
        // Offered whenever any series is drawn as bars, not only the target series, but not on a
        // single-series chart, whose bars have nothing to be laid out against.
        visible: () => {

            if (!props.series || Ren.DateValueChartCalculator.getSeriesCount(props) < 2) {
                return false;
            }

            if (Ren.DateValueChart_Pies.isShown(props)) return false;

            for (let i = 0; i < props.series.length; i++) {

                const chartType = props.series[i].chartType ?? Ren.SeriesChartTypeEnum.Bar;
                if (chartType === Ren.SeriesChartTypeEnum.Bar) return true;
            }

            return false;
        },
        submenu: [
            buildBarLayoutOption("Side-by-side", Ren.BarLayoutEnum.SideBySide),
            buildBarLayoutOption("Overlayed", Ren.BarLayoutEnum.Overlayed),
            buildBarLayoutOption("Stacked", Ren.BarLayoutEnum.Stacked),
            Ren.MENU_SEPARATOR,
            buildPerSplitBarLayoutOption(
                "Overlayed (per split)",
                Ren.BarLayoutEnum.OverlayedPerSplit
            ),
            buildPerSplitBarLayoutOption("Stacked (per split)", Ren.BarLayoutEnum.StackedPerSplit)
        ]
    };

    /**
     * The size is a rule in the chart's stylesheet, so rewriting the sheet shows it far more
     * cheaply than a redraw.
     */
    const setLabelFontSize = (propertyName, fontSize) => setChartProperty(
        propertyName,
        fontSize,
        () => Ren.DateValueChart_StyleUpdater.updateStylesheet(props)
    );

    /**
     * Builds the menu item for one of the chart's label font sizes.  The labels' backgrounds are
     * only fitted to their text on a draw, so the chart is redrawn when the window is closed.
     */
    const buildLabelFontSize = (text, id, title, propertyName, defaultFontSize) => {

        return {
            text: text,
            id: id,
            action: () => {

                const currentFontSize = Math.round(props[propertyName] ?? defaultFontSize);

                // Centred on the right-click, so the size being set is under the pointer.
                const clickPosition = Ren.LastRightClickPosition;

                Ren.CreateNumberEditorPopupWindow(
                    title,
                    currentFontSize,
                    fontSize => setLabelFontSize(propertyName, fontSize),
                    {
                        label: "Size (px)",
                        min: 4,
                        max: 40,
                        width: 160,
                        height: 60,
                        centredOnPoint: clickPosition,
                        closeWhenFocusLost: true,
                        onClose: () => Ren.VisualisationSettingsSynchroniser.commitChange(
                            visualisation,
                            props.redrawChart
                        )
                    }
                );
            }
        };
    };

    const valueLabelFontSizeMenuItem = buildLabelFontSize(
        "Value label size...",
        "value-label-font-size",
        "Value Label Size",
        "valueLabelFontSize",
        Ren.DateValueChart_StyleUpdater.defaultLabelFontSizes.valueLabel
    );

    // Pies' labels have a size of their own.
    valueLabelFontSizeMenuItem.visible = () => !Ren.DateValueChart_Pies.isShown(props);

    const axisLabelFontSizeMenuItem = buildLabelFontSize(
        "Axis label size...",
        "axis-label-font-size",
        "Axis Label Size",
        "axisLabelFontSize",
        Ren.DateValueChart_StyleUpdater.defaultLabelFontSizes.axisLabel
    );

    /**
     * Builds the menu item toggling one of the chart's boolean properties.  Pass config.redraws
     * false where the property is read off the props as the chart is used, and config.onChanged
     * to restyle the chart as drawn.
     */
    const buildPropertyToggle = (config) => {

        const isTurnedOn = () => config.defaultValue
            ? props[config.propertyName] !== false
            : props[config.propertyName] === true;

        const menuItem = {
            text: config.text,
            id: config.id,
            ticked: () => isTurnedOn(),
            action: () => setChartProperty(
                config.propertyName,
                !isTurnedOn(),
                config.redraws ? props.redrawChart : config.onChanged
            )
        };

        if (config.section) menuItem.section = config.section;

        if (config.visible) menuItem.visible = config.visible;

        if (config.title) menuItem.title = config.title;

        return menuItem;
    };

    const legendMenuItem = buildPropertyToggle({
        section: "Appearance",
        text: "Show legend",
        id: "show-legend",
        propertyName: "showLegend",
        defaultValue: true,
        redraws: true
    });

    // Restyled rather than redrawn, as the labels are always drawn and only shown or not.
    const showValueLabelsWhenHighlightedMenuItem = buildPropertyToggle({
        text: "Show value labels when highlighted",
        id: "show-value-labels-when-highlighted",
        propertyName: "showValueLabelsWhenHighlighted",
        defaultValue: false,
        redraws: false,
        onChanged: () => Ren.DateValueChart_StyleUpdater.updateHighlightedValueLabels(props),
        visible: () => !Ren.DateValueChart_Pies.isShown(props)
    });

    // Shown at once, as the title takes its room from the plot, which is scaled to what is left.
    const showTitles = () => {

        Ren.DateValueChart_Title.render(props);
        Ren.DateValueChart_Accessibility.labelChart(props);
        Ren.DateValueChart_StyleUpdater.updateStylesheet(props);
    };

    const setTitle = (text) => setChartProperty("chartTitle", text.trim(), showTitles);

    const setSubtitle = (text) => setChartProperty("chartSubtitle", text.trim(), showTitles);

    const titleMenuItem = {
        section: "Appearance",
        text: "Title...",
        id: "chart-title",
        title: "{value} in the title stands for the value column, and {split} for the column the"
            + " data is split by.",
        action: () => Ren.CreateTextEditorPopupWindow(
            "Chart Title",
            Ren.DateValueChart_Title.getTitleTemplate(props),
            setTitle,
            { width: 320, height: 110 }
        )
    };

    const subtitleMenuItem = {
        section: "Appearance",
        text: "Subtitle...",
        id: "chart-subtitle",
        title: "{filters} in the subtitle stands for the filters on the chart's data, and is left"
            + " out with the rest of the subtitle while there are none.",
        action: () => Ren.CreateTextEditorPopupWindow(
            "Chart Subtitle",
            Ren.DateValueChart_Title.getSubtitleTemplate(props),
            setSubtitle,
            { width: 320, height: 110 }
        )
    };

    const getLineSeriesCount = () => {

        let count = 0;

        for (let i = 0; i < props.seriesCount; i++) {

            if (props.series[i].chartType === Ren.SeriesChartTypeEnum.Line) count++;
        }

        return count;
    };

    const setLineLayout = (layout) => setChartProperty("lineLayout", layout, props.redrawChart);

    const buildLineLayoutOption = (text, layout) => ({
        text: text,
        action: () => setLineLayout(layout),
        ticked: () => Ren.DateValueChartCalculator.getLineLayout(props) === layout
    });

    // Redrawn, as the fill is drawn with the lines.
    const shadeLinesMenuItem = buildPropertyToggle({
        text: "Shaded",
        id: "shade-lines",
        title: "Fills beneath each line, down to the line below where they are stacked",
        propertyName: "shadeLines",
        defaultValue: false,
        redraws: true
    });

    // The opacity is a rule in the chart's stylesheet, so is shown by rewriting the sheet.
    const lineShadingOpacityMenuItem = {
        text: "Shading opacity...",
        id: "line-shading-opacity",
        visible: () => props.shadeLines === true,
        action: () => {

            const opacity = props.lineShadingOpacity
                ?? Ren.DateValueChart_StyleUpdater.DEFAULT_LINE_SHADING_OPACITY;

            Ren.CreateNumberEditorPopupWindow(
                "Line Shading Opacity",
                Math.round(opacity * 100),
                percentage => setChartProperty(
                    "lineShadingOpacity",
                    percentage / 100,
                    () => Ren.DateValueChart_StyleUpdater.updateStylesheet(props)
                ),
                {
                    label: "Opacity (%)",
                    min: 0,
                    max: 100,
                    step: 5,
                    width: 180,
                    height: 90,
                    showSlider: true,
                    centredOnPoint: Ren.LastRightClickPosition,
                    closeWhenFocusLost: true
                }
            );
        }
    };

    // Offered whenever any series is drawn as a line, as for the bar layout, and on a chart of a
    // single line too, which can still be shaded.
    const lineLayoutMenuItem = {
        text: "Line layout",
        id: "line-layout",
        visible: () => !!props.series
            && getLineSeriesCount() > 0
            && !Ren.DateValueChart_Pies.isShown(props),
        submenu: [
            buildLineLayoutOption("Overlayed", Ren.LineLayoutEnum.Overlayed),
            buildLineLayoutOption("Stacked", Ren.LineLayoutEnum.Stacked),
            Ren.MENU_SEPARATOR,
            shadeLinesMenuItem,
            lineShadingOpacityMenuItem
        ]
    };

    // Holes are drawn at 40% of the pie's radius until sized otherwise.
    const DEFAULT_PIE_HOLE_RADIUS = 0.4;

    const hasPieHoles = () => Ren.DateValueChart_Pies.getHoleRadius(props) > 0;

    const pieHolesMenuItem = {
        text: "Holes",
        id: "pie-holes",
        title: "Draws each pie with a hole in the middle",
        ticked: hasPieHoles,
        action: () => setChartProperty(
            "pieHoleRadius",
            hasPieHoles() ? 0 : DEFAULT_PIE_HOLE_RADIUS,
            props.redrawChart
        )
    };

    const pieHoleSizeMenuItem = {
        text: "Hole size...",
        id: "pie-hole-size",
        visible: hasPieHoles,
        action: () => {

            Ren.CreateNumberEditorPopupWindow(
                "Pie Hole Size",
                Math.round(Ren.DateValueChart_Pies.getHoleRadius(props) * 100),
                percentage => setChartProperty(
                    "pieHoleRadius",
                    percentage / 100,
                    props.redrawChart
                ),
                {
                    label: "Radius (% of pie)",
                    min: 0,
                    max: Math.round(Ren.DateValueChart_Pies.MAX_HOLE_RADIUS * 100),
                    step: 5,
                    width: 200,
                    height: 90,
                    showSlider: true,
                    centredOnPoint: Ren.LastRightClickPosition,
                    closeWhenFocusLost: true
                }
            );
        }
    };

    // Redrawn, as the totals are drawn with the pies.
    const pieHoleTotalsMenuItem = buildPropertyToggle({
        text: "Totals in holes",
        id: "pie-hole-totals",
        title: "Writes each pie's total in its hole, where it fits",
        propertyName: "pieHoleTotals",
        defaultValue: true,
        redraws: true,
        visible: () => Ren.DateValueChart_Pies.getHoleRadius(props) > 0
    });

    const isPieTotalShown = () => Ren.DateValueChart_Pies.getHoleRadius(props) > 0
        && props.pieHoleTotals !== false;

    // Redrawn, as the totals are formatted as the pies are drawn.
    const setPieTotalFormatFunction = (valueFormatFunction) => setChartProperty(
        "pieTotalFormatFunction",
        valueFormatFunction ? Ren.ArrayUtils.ensureArray(valueFormatFunction) : undefined,
        props.redrawChart
    );

    const getPieTotalFormatFunction = () => visualisation?.pieTotalFormatFunction;

    const openCustomPieTotalFormatEditor = () => {

        Ren.Messages.Requests.functionEditorWindow.notify(
            () => Ren.FormatFunctionUtils.getCustomCode(getPieTotalFormatFunction()),
            (customCode) => setPieTotalFormatFunction(customCode),
            null,
            null,
            { centred: true }
        );
    };

    // The submenu is built as the menu opens, so the formats offered are those of the slices.
    const pieTotalFormatMenuItem = {
        text: "Total format",
        id: "pie-total-format",
        visible: isPieTotalShown,
        get submenu() {

            const slicesFormat = props.valueColumnFormats?.[0];

            const items = Ren.ContextMenuItems_Formatting(
                (_columnIndex, _rowIndex, valueFormatFunction) =>
                    setPieTotalFormatFunction(valueFormatFunction),
                {
                    summaryStatsAvailable: false,
                    gridContext: false,
                    columnHasNulls: () => false,
                    getFormatFunction: getPieTotalFormatFunction
                }
            ).getMenuItems(null, null, null, slicesFormat);

            return [
                {
                    text: "Same as slices",
                    id: "pie-total-format-slices",
                    action: () => setPieTotalFormatFunction(null),
                    ticked: () => !getPieTotalFormatFunction()
                },
                Ren.MENU_SEPARATOR
            ].concat(items[0]?.submenu || []).concat([
                Ren.MENU_SEPARATOR,
                {
                    text: "Custom...",
                    id: "pie-total-format-custom",
                    ticked: () => !!Ren.FormatFunctionUtils.getCustomCode(
                        getPieTotalFormatFunction()
                    ),
                    action: () => openCustomPieTotalFormatEditor()
                }
            ]);
        }
    };

    const pieLayoutMenuItem = {
        text: "Pie layout",
        id: "pie-layout",
        // Left out of the settings window, rather than greyed out, where there are no pies.
        omitWhenHidden: true,
        visible: () => Ren.DateValueChart_Pies.hasPies(props),
        submenu: [
            pieHolesMenuItem,
            pieHoleSizeMenuItem,
            Ren.MENU_SEPARATOR,
            pieHoleTotalsMenuItem,
            pieTotalFormatMenuItem
        ]
    };

    const buildSeriesChartTypeOption = (text, id, chartType, title) => ({
        text: text,
        id: id,
        title: title,
        visible: () => !!getTargetSeriesIndex(),
        action: () => setSeriesProperty("chartType", chartType),
        ticked: () => getSeriesProperty("chartType", Ren.SeriesChartTypeEnum.Bar) === chartType
    });

    // What the series are drawn as - the kinds, together so that the settings window shows them as
    // one choice, then the line style and dot size - then how the chart lays out each kind.  On a series' menu the kinds, line style and dot size
    // are that series', and the layouts follow under the whole chart's heading.  Where the series
    // are drawn as a mixture, none of the kinds is ticked.  The series drawn as pies share a pie
    // per period, drawn over the plot's top half where other series are drawn as bars, lines or
    // dots.
    const chartTypeMenuItem = {
        section: "Appearance",
        text: "Draw as",
        id: "chart-type",
        submenu: [
            targetSeriesHeadingMenuItem,
            buildSeriesChartTypeOption("Bars", "chart-type-bars", Ren.SeriesChartTypeEnum.Bar),
            buildSeriesChartTypeOption("Lines", "chart-type-lines", Ren.SeriesChartTypeEnum.Line),
            buildSeriesChartTypeOption("Dots", "chart-type-dots", Ren.SeriesChartTypeEnum.Dot),
            buildSeriesChartTypeOption(
                "Pies",
                "chart-type-pies",
                Ren.SeriesChartTypeEnum.Pie,
                "Draws a pie for each period, each series drawn as pies a slice of it"
            ),
            seriesLineStyleMenuItem,
            seriesDotSizeMenuItem,
            Ren.MENU_SEPARATOR,
            chartHeadingMenuItem,
            barLayoutMenuItem,
            lineLayoutMenuItem,
            pieLayoutMenuItem
        ]
    };

    // Redrawn, as what a label says is written as the pies are drawn.
    const setPieLabels = (placement) => setChartProperty("pieLabels", placement, props.redrawChart);

    const pieLabelPlacements = Ren.DateValueChart_PieLabels.PLACEMENTS;

    const buildPieLabelContentToggle = (text, id, propertyName, defaultValue) =>
        buildPropertyToggle({
            text,
            id,
            propertyName,
            defaultValue,
            redraws: true,
            visible: () =>
                Ren.DateValueChart_PieLabels.getPlacement(props) !== pieLabelPlacements.Off
        });

    const pieValuePositions = Ren.DateValueChart_PieLabels.VALUE_POSITIONS;

    const pieValuePositionMenuItem = {
        text: "Value position",
        id: "pie-value-position",
        visible: () => Ren.DateValueChart_PieLabels.getPlacement(props) !== pieLabelPlacements.Off
            && props.pieLabelValues === true,
        submenu: [
            { text: "After names", position: pieValuePositions.Inline },
            {
                text: "Below names",
                position: pieValuePositions.Below,
                title: "Writes the value and percentage on a line of their own below the name"
            },
            {
                text: "Inside slices",
                position: pieValuePositions.Inside,
                title: "Writes each slice's value inside it, and the rest of its label outside",
                visible: () => Ren.DateValueChart_PieLabels.canPutSharesInside(props)
            }
        ].map(option => ({
            text: option.text,
            title: option.title,
            visible: option.visible,
            action: () => setChartProperty("pieValuePosition", option.position, props.redrawChart),
            ticked: () => Ren.DateValueChart_PieLabels.getValuePosition(props) === option.position
        }))
    };

    const pieLabelsMenuItem = {
        text: "Pie labels",
        id: "pie-labels",
        title: "Labels each slice with its series' name, value or share of the pie",
        visible: () => Ren.DateValueChart_Pies.hasPies(props),
        submenu: [
            { text: "Automatic", placement: pieLabelPlacements.Auto },
            { text: "Inside slices", placement: pieLabelPlacements.Inside },
            { text: "Outside pies", placement: pieLabelPlacements.Outside },
            {
                text: "Around pies",
                placement: pieLabelPlacements.Around,
                title: "Lists the labels either side of each pie, with lines to their slices"
            },
            { text: "Off", placement: pieLabelPlacements.Off }
        ].map(option => ({
            text: option.text,
            title: option.title,
            action: () => setPieLabels(option.placement),
            ticked: () => Ren.DateValueChart_PieLabels.getPlacement(props) === option.placement
        })).concat([
            Ren.MENU_SEPARATOR,
            buildPieLabelContentToggle("Series names", "pie-label-names", "pieLabelNames", true),
            buildPieLabelContentToggle("Values", "pie-label-values", "pieLabelValues", false),
            pieValuePositionMenuItem,
            buildPieLabelContentToggle(
                "Percentages",
                "pie-label-percentages",
                "pieLabelPercentages",
                true
            ),
            buildPropertyToggle({
                text: "Percentages inside slices",
                id: "pie-shares-inside",
                title: "Writes each slice's share inside it, and the rest of its label outside",
                propertyName: "pieSharesInside",
                defaultValue: true,
                redraws: true,
                visible: () => Ren.DateValueChart_PieLabels.canPutSharesInside(props)
                    && props.pieLabelPercentages !== false
            })
        ])
    };

    const pieLabelFontSizeMenuItem = buildLabelFontSize(
        "Pie label size...",
        "pie-label-font-size",
        "Pie Label Size",
        "pieLabelFontSize",
        Ren.DateValueChart_StyleUpdater.defaultLabelFontSizes.pieLabels
    );

    pieLabelFontSizeMenuItem.visible = () => Ren.DateValueChart_PieLabels.areLabelsShown(props)
        || Ren.DateValueChart_PieLabels.areTotalsShown(props)
        || (Ren.DateValueChart_Pies.hasPies(props)
            && Ren.DateValueChart_SeriesSubdivisions.isActive(props)
            && Ren.DateValueChart_SeriesSubdivisions.getLabelContent(props)
                !== Ren.DateValueChart_SeriesSubdivisions.LABEL_CONTENTS.None);

    const hasBarSeries = () => {

        for (let i = 0; i < props.seriesCount; i++) {

            const chartType = props.series[i].chartType;

            if (!chartType || chartType === Ren.SeriesChartTypeEnum.Bar) return true;
        }

        return false;
    };

    // The labels are placed by the style updater, so restyling places them afresh.
    const setBarValueLabelLayout = (layout) => setChartProperty(
        "barValueLabelLayout",
        layout,
        () => Ren.DateValueChart_StyleUpdater.updateStylesheet(props)
    );

    const barValueLabelLayouts = Ren.DateValueChart_BarValueLabelLayout.LAYOUTS;

    const barValueLabelLayoutMenuItem = {
        text: "Bar value labels",
        id: "bar-value-label-layout",
        visible: () => hasBarSeries() && !Ren.DateValueChart_Pies.isShown(props),
        submenu: [
            { text: "Automatic", layout: barValueLabelLayouts.Auto },
            { text: "Horizontal", layout: barValueLabelLayouts.Horizontal },
            { text: "Above bars", layout: barValueLabelLayouts.Above },
            { text: "Vertical", layout: barValueLabelLayouts.Vertical },
            { text: "Diagonal", layout: barValueLabelLayouts.Diagonal }
        ].map(option => ({
            text: option.text,
            action: () => setBarValueLabelLayout(option.layout),
            ticked: () => Ren.DateValueChart_BarValueLabelLayout.getLayout(props) === option.layout
        }))
    };

    const seriesNamesInBarsFontSizeMenuItem = buildLabelFontSize(
        "Names in bars size...",
        "series-names-in-bars-font-size",
        "Names In Bars Size",
        "seriesNamesInBarsFontSize",
        Ren.DateValueChart_StyleUpdater.defaultLabelFontSizes.seriesNamesInBars
    );

    // Left out of the settings window, rather than greyed out, as "Names in bars" is.
    seriesNamesInBarsFontSizeMenuItem.omitWhenHidden = true;

    // Offered where any bar series shows its name, or the bars' subdivisions are labelled.
    seriesNamesInBarsFontSizeMenuItem.visible = () => {

        if (Ren.DateValueChart_Pies.isShown(props)) return false;

        const subdivisions = Ren.DateValueChart_SeriesSubdivisions;

        if (subdivisions.isActive(props)
            && subdivisions.getLabelContent(props) !== subdivisions.LABEL_CONTENTS.None) {

            return true;
        }

        for (let i = 0; i < props.seriesCount; i++) {

            const series = props.series[i];
            const chartType = series.chartType;

            if (series.showNameInBars === true
                && (!chartType || chartType === Ren.SeriesChartTypeEnum.Bar)) {

                return true;
            }
        }

        return false;
    };

    // Redrawn, as names at the lines' ends take room from the plot.
    const setLineNames = (layout) => setChartProperty("lineNames", layout, props.redrawChart);

    const lineNameLayouts = Ren.DateValueChart_LineNames.LAYOUTS;

    const lineNamesMenuItem = {
        text: "Line names",
        id: "line-names",
        title: "Names each line on the chart, so the legend need not be read",
        visible: () => !!props.series
            && getLineSeriesCount() > 0
            && !Ren.DateValueChart_Pies.isShown(props),
        submenu: [
            { text: "Automatic", layout: lineNameLayouts.Auto },
            { text: "At line ends", layout: lineNameLayouts.AtEnds },
            { text: "Along lines", layout: lineNameLayouts.AlongLines },
            { text: "Off", layout: lineNameLayouts.Off }
        ].map(option => ({
            text: option.text,
            action: () => setLineNames(option.layout),
            ticked: () => Ren.DateValueChart_LineNames.getLayout(props) === option.layout
        }))
    };

    const lineNamesFontSizeMenuItem = buildLabelFontSize(
        "Line name size...",
        "line-names-font-size",
        "Line Name Size",
        "lineNamesFontSize",
        Ren.DateValueChart_StyleUpdater.defaultLabelFontSizes.lineNames
    );

    lineNamesFontSizeMenuItem.visible = () =>
        Ren.DateValueChart_LineNames.getEffectiveLayout(props)
            !== Ren.DateValueChart_LineNames.LAYOUTS.Off;

    // The hint is drawn as the chart renders, so cannot be restyled onto one already drawn.
    const showHoverDateLineMenuItem = buildPropertyToggle({
        text: "Show hovered date",
        id: "show-hover-date-line",
        propertyName: "showHoverDateLine",
        defaultValue: false,
        redraws: true
    });

    // Independent of the hint, so the hovered period can be shaded without the date printed below.
    // Redrawn, as a chart showing neither has no hover band attached to extend.
    const hoverDateLineFullHeightMenuItem = buildPropertyToggle({
        text: "Highlight hovered date",
        id: "hover-date-line-full-height",
        propertyName: "hoverDateLineFullHeight",
        defaultValue: false,
        redraws: true
    });

    // Listing the values takes room beneath the axis, so the chart is drawn again rather than
    // restyled.
    const showHoverValuesMenuItem = buildPropertyToggle({
        text: "Show hovered values",
        id: "show-hover-values",
        propertyName: "showHoverValues",
        defaultValue: false,
        redraws: true
    });

    // The change is worked out as the pointer moves, so nothing needs drawing again.
    const showHoverChangeMenuItem = buildPropertyToggle({
        text: "Show change on period before",
        id: "show-hover-change",
        propertyName: "showHoverChange",
        defaultValue: false,
        onChanged: () => {},
        visible: () => props.showHoverValues === true
            && !Ren.DateValueChart_ValueTransforms.isShareOfTotal(props)
            && !Ren.DateValueChart_ValueTransforms.isAnyChange(props),
        title: "Follows each hovered value with its change on the period before, as a percentage"
    });

    const gridlinesMenuItem = buildPropertyToggle({
        text: "Gridlines",
        id: "show-gridlines",
        propertyName: "showGridlines",
        defaultValue: false,
        onChanged: () => Ren.DateValueChart_Gridlines.render(props),
        visible: () => !Ren.DateValueChart_Pies.isShown(props)
    });

    const hoverMenuItem = {
        section: "Appearance",
        text: "Hover",
        id: "chart-hover",
        submenu: [
            showHoverDateLineMenuItem,
            hoverDateLineFullHeightMenuItem,
            showHoverValuesMenuItem,
            showHoverChangeMenuItem
        ]
    };

    // Which labels the series show, which on a series' menu is that series', then how the chart
    // places and shows them, then how big each kind is drawn.
    const labelsMenuItem = {
        section: "Appearance",
        text: "Labels",
        id: "chart-labels",
        submenu: [
            targetSeriesHeadingMenuItem,
            seriesValueLabelsMenuItem,
            seriesNameInBarsMenuItem,
            Ren.MENU_SEPARATOR,
            chartHeadingMenuItem,
            showValueLabelsWhenHighlightedMenuItem,
            barValueLabelLayoutMenuItem,
            lineNamesMenuItem,
            pieLabelsMenuItem,
            subdivisionLabelsMenuItem,
            Ren.MENU_SEPARATOR,
            valueLabelFontSizeMenuItem,
            seriesNamesInBarsFontSizeMenuItem,
            lineNamesFontSizeMenuItem,
            pieLabelFontSizeMenuItem
        ]
    };

    const hasRightAxis = () => Ren.DateValueChart_YScales.hasRightAxis(props);

    // Each redraws, so that the room a hidden axis leaves is given to the plot.
    const buildAxisVisibilityToggle = (text, id, propertyName, visible) => buildPropertyToggle({
        text,
        id,
        propertyName,
        defaultValue: true,
        redraws: true,
        visible
    });

    const axisVisibilityMenuItem = {
        section: "Appearance",
        text: "Axes",
        id: "axis-visibility",
        submenu: [
            buildAxisVisibilityToggle("Left axis", "show-left-axis", "showLeftAxis"),
            buildAxisVisibilityToggle(
                "Right axis",
                "show-right-axis",
                "showRightAxis",
                hasRightAxis
            ),
            buildAxisVisibilityToggle("Date axis", "show-date-axis", "showDateAxis"),
            Ren.MENU_SEPARATOR,
            buildAxisVisibilityToggle(
                "Left axis heading",
                "show-left-axis-heading",
                "showLeftAxisHeading"
            ),
            buildAxisVisibilityToggle(
                "Right axis heading",
                "show-right-axis-heading",
                "showRightAxisHeading",
                hasRightAxis
            ),
            Ren.MENU_SEPARATOR,
            gridlinesMenuItem,
            axisLabelFontSizeMenuItem
        ]
    };

    return {
        seriesLabelMenuItem,
        seriesColourMenuItem,
        chartTypeMenuItem,
        labelsMenuItem,
        titleMenuItem,
        subtitleMenuItem,
        legendMenuItem,
        axisVisibilityMenuItem,
        hoverMenuItem
    };
};
