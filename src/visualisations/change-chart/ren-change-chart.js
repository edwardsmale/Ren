/**
 * Creates a change chart, which shows how a value moved between two times for each of a list of
 * things: a row per label, with an arrow from its before value to its after value.  Clicking a
 * label or an arrow can open a popup report about that row.
 */
Ren.CreateChangeChart = (() => {

    const POPUP_OPTION_NAMES = [
        "labelPopupReport",
        "labelPopupReportTitle",
        "changePopupReport",
        "changePopupReportTitle"
    ];

    /**
     * Sets up the value formats: the visualisation's format function where it has one, and
     * otherwise the before column's format.
     */
    const setValueFormats = (props, visualisation, dataGroupingSettings, tabularData,
        columnIndex) => {

        if (visualisation.valueFormatFunction) {

            const paras = Ren.ReportInputParameters.getInputParameters(
                visualisation.containingReport
            );

            props.valueFormat = Ren.SpreadsheetColumnFormatEnum.Number;
            props.valueFormatFunction = Ren.ArrayUtils
                .ensureArray(visualisation.valueFormatFunction)
                .map(spec => Ren.FormatFunctions.createFunction(spec, paras));

            return;
        }

        const columnFormats = Ren.VisualisationBuilderHelpers.getColumnFormats(
            columnIndex,
            dataGroupingSettings,
            tabularData
        );

        props.valueFormat = columnFormats.format;
        props.valueFormatFunction = columnFormats.formatFunction;
    };

    const detectColumns = (inputData, dataGroupingSettings, visualisation, props, tabularData,
        columnResolver) => {

        if (!inputData || inputData.length === 0) return "No data to display in change chart";
        if (!columnResolver) return "Column resolver not available";

        const detected = visualisation.labelHeading && visualisation.beforeHeading
            && visualisation.afterHeading
            ? {}
            : Ren.ChangeChart_ColumnDetector.detectColumns(
                inputData,
                visualisation,
                tabularData,
                columnResolver
            );

        props.labelHeading = visualisation.labelHeading || detected.labelHeading;
        props.beforeHeading = visualisation.beforeHeading || detected.beforeHeading;
        props.afterHeading = visualisation.afterHeading || detected.afterHeading;
        props.beforeLabel = visualisation.beforeLabel || props.beforeHeading;
        props.afterLabel = visualisation.afterLabel || props.afterHeading;

        if (!props.labelHeading) return "Could not find a column for labels";

        if (!props.beforeHeading || !props.afterHeading) {
            return "Could not find two numeric columns for the values before and after";
        }

        const labelColumnIndex = columnResolver.getColumnIndex(props.labelHeading);
        const beforeColumnIndex = columnResolver.getColumnIndex(props.beforeHeading);

        if (labelColumnIndex === null) return `No column "${props.labelHeading}"`;
        if (beforeColumnIndex === null) return `No column "${props.beforeHeading}"`;

        if (columnResolver.getColumnIndex(props.afterHeading) === null) {
            return `No column "${props.afterHeading}"`;
        }

        setValueFormats(props, visualisation, dataGroupingSettings, tabularData, beforeColumnIndex);

        props.labelAutoMenuName = tabularData
            ? Ren.AutoMenu.getMenuNameForColumn(tabularData.ColumnModels[labelColumnIndex])
            : null;

        for (let index = 0; index < POPUP_OPTION_NAMES.length; index++) {

            const name = POPUP_OPTION_NAMES[index];
            props[name] = visualisation[name] || null;
        }

        return null;
    };

    const getInitialisation = Ren.VisualisationBuilderHelpers.createInitialisationHandler({
        baseClassName: "ren-change-chart",
        guidPrefix: "ren-change-chart"
    });

    const getContextMenuItems = (tabularData, contextMenu, visualisation) => {

        const windowsMenuItems = Ren.ContextMenuItems_Windows(
            visualisation,
            tabularData.tabularDataGuid
        );

        return {
            addShowWindowsMenuItems: (element) => {

                contextMenu.addMenuItems(element, windowsMenuItems.getMenuItems());
            }
        };
    };

    const renderVisualisation = (props, data, tabularData, visualisation) => {

        Ren.ChangeChart_Render.renderChangeChart(props, data);

        if (props.isDrawnHidden && !props.isAwaitingTabShown) {

            props.isAwaitingTabShown = true;

            Ren.Messages.Events.tabbedModuleTabChanged.handle(() => {

                if (visualisation.isDestroyed) return false;

                const shownContainer = document.querySelector("." + props.guid);

                if (!shownContainer || shownContainer.clientWidth === 0) return;

                props.isAwaitingTabShown = false;
                props.redrawVisualisation();

                return false;
            });
        }

        const container = props.svg?.parentNode;

        // The container outlives a redraw, so its menu is set up once: setting it up again would
        // leave the old handler listening on the same element and open two menus on a right-click.
        if (container && props.contextMenuElement !== container) {

            props.contextMenuElement = container;

            getContextMenuItems(tabularData, Ren.SetUpContextMenu(), visualisation, props)
                .addShowWindowsMenuItems(container);
        }
    };

    /**
     * Draws the chart again when its container's width changes, as the rows are laid out across
     * the width they're drawn at.
     */
    const updateStylesheet = (props, width) => {

        if (!width || !props.svg) return;

        const container = document.querySelector("." + props.guid);

        if (container && Math.abs(container.clientWidth - props.renderedWidth) > 1) {
            props.redrawVisualisation();
        }
    };

    const getStyleUpdater = () => ({
        updateStylesheet
    });

    const validate = (props, data) => {

        if (!data || data.length === 0) {
            return "No rows have values both before and after";
        }

        return true;
    };

    const getValidator = () => ({
        validate
    });

    const getDataPreparer = () => Ren.ChangeChart_PrepareData;

    const getQAHelper = () => ({
        setQa: (props, inputData) => Ren.QA.ChangeChart.setQaChangeChart(props, inputData)
    });

    return Ren.BaseVisualisationCreator({
        visualisationName: "ChangeChart",
        handleContextMenusInRender: true,
        detectColumns,
        getInitialisation,
        renderVisualisation,
        getContextMenuItems,
        getStyleUpdater,
        getValidator,
        getDataPreparer,
        getQAHelper,
        shouldUseErrorElement: true
    });
})();
