/**
 * Provides factories and utilities to reduce duplication in visualization creator implementations.
 */
Ren.VisualisationBuilderHelpers = (() => {

    /**
     * Extracts column format metadata from either dataGroupingSettings or tabularData.  Handles
     * both grouped and non-grouped data sources.
     */
    const getColumnFormats = (columnIndex, dataGroupingSettings, tabularData) => {

        if (dataGroupingSettings) {

            const groupingEntries = dataGroupingSettings.groupings.entries;
            const sourceColumns = groupingEntries.length > 1
                ? dataGroupingSettings.groupings.secondToLastGrouping().columns
                : dataGroupingSettings.dataRows.columns;

            const columnFormats = dataGroupingSettings.getColumnValueFormats(sourceColumns);
            return {
                format: columnFormats.columnValueFormats[columnIndex],
                formatFunction: columnFormats.columnFormatFunctions[columnIndex]
            };
        }

        return {
            format: tabularData ? tabularData.ColumnModelFormats[columnIndex] : null,
            formatFunction: null
        };
    };

    /**
     * Factory that creates a detectColumns handler function with common column detection and
     * format logic.  Handles both auto-detected and manually specified columns, and extracts
     * format information.  Invokes an optional callback for visualization-specific post-detection
     * logic.
     */
    const createDetectColumnsHandler = (options) => {

        const {
            columnDetector,
            columnNames,
            formatColumnNames,
            onColumnsDetected,
            requireColumnResolver = true
        } = options;

        return (inputData, dataGroupingSettings, visualisation, props, tabularData, columnResolver) => {

            const { heading1, heading2 } = columnNames;

            if (!visualisation[heading1] || !visualisation[heading2]) {

                const result = columnDetector(inputData, visualisation, tabularData, columnResolver);

                if (typeof result === "string") {
                    return result;
                }

                props[heading1] = result[heading1];
                props[heading2] = result[heading2];
            }
            else {

                props[heading1] = visualisation[heading1];
                props[heading2] = visualisation[heading2];
            }

            if (requireColumnResolver && !columnResolver) {
                return "Column resolver not available";
            }

            const columnIndex = columnResolver.getColumnIndex(props[heading2]);
            const columnFormats = getColumnFormats(columnIndex, dataGroupingSettings, tabularData);

            props[formatColumnNames.format] = columnFormats.format;
            props[formatColumnNames.formatFunction] = columnFormats.formatFunction;

            if (onColumnsDetected) {
                onColumnsDetected(inputData, visualisation, props, dataGroupingSettings);
            }

            return null;
        };
    };

    /**
     * Factory that creates a getInitialisation handler function with common initialization
     * patterns.  Sets up CSS classes, stylesheets, GUIDs, and the visualization container element.
     */
    const createInitialisationHandler = (options) => {

        const { baseClassName, guidPrefix } = options;

        return (props) => {

            props.cssClass = Ren.RandomUtils.generateRandomClassName(baseClassName);
            props.stylesheet = Ren.DynamicStylesheets.setupDynamicStylesheet(props.cssClass, "").getStylesheet();

            const guid = Ren.RandomUtils.generateRandomClassName(guidPrefix);
            props.guid = guid;

            const element = Ren.HtmlUtils.create("div")
                ._addClass(baseClassName)
                ._addClass(guid);

            return { element };
        };
    };

    return {
        getColumnFormats,
        createDetectColumnsHandler,
        createInitialisationHandler
    };
})();
