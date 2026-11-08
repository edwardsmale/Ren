/**
 * Creates a word cloud visualisation.  Detects word and count columns, applies color palettes,
 * renders words with relative sizing, and provides context menu interactions for word-level
 * search and navigation.
 */
Ren.CreateWordCloud = (() => {

    const detectColumns = Ren.VisualisationBuilderHelpers.createDetectColumnsHandler({
        columnDetector: Ren.WordCloud_ColumnDetector.detectColumns,
        columnNames: { heading1: "wordHeading", heading2: "countHeading" },
        formatColumnNames: {
            format: "countColumnFormat",
            formatFunction: "countColumnFormatFunction"
        },
        onColumnsDetected: (inputData, visualisation, props) => {

            props.wordCloudColourPalette = visualisation.wordCloudColourPalette
                || Ren.WordCloud_Palettes.DEFAULT_PALETTE_ID;
            props.wordCloudIndividualWords = visualisation.wordCloudIndividualWords === true;
        }
    });

    const getInitialisation = (props, visualisation) => {

        const result = Ren.VisualisationBuilderHelpers.createInitialisationHandler({
            baseClassName: "ren-word-cloud",
            guidPrefix: "ren-word-cloud"
        })(props, visualisation);

        // On the visualisation element rather than the word cloud's own, as it has the palette's
        // background and the padding around the word cloud.
        visualisation.element?.classList.add(Ren.VisualisationEffects.EFFECTS_APPLY_CLASS_NAME);

        return result;
    };

    /**
     * Gets the name of the auto menu (e.g. "search-term") the word column's values are given, or
     * null.
     */
    const getWordColumnAutoMenuName = (tabularData, props) => {

        const columnIndex = Ren.DataGridColumnResolver(tabularData)
            .getColumnIndex(props.wordHeading);

        return columnIndex === null
            ? null
            : Ren.AutoMenu.getMenuNameForColumn(tabularData.ColumnModels[columnIndex]);
    };

    const renderVisualisation = (props, data, tabularData, visualisation) => {

        Ren.WordCloud_Render.renderWordCloud(props, data);

        const svgContainer = props.svg.parentNode;

        // The container outlives a redraw, so its menu is set up once: setting it up again would
        // leave the old handler listening on the same element and open two menus on a right-click.
        const isNewContextMenu = props.contextMenuElement !== svgContainer;

        if (isNewContextMenu) {

            props.contextMenuElement = svgContainer;
            props.contextMenu = Ren.SetUpContextMenu();
        }

        const contextMenu = props.contextMenu;

        const contextMenuItems = Ren.ContextMenuItems_WordCloud(
            tabularData,
            contextMenu,
            visualisation,
            props
        );

        const wordElements = document.querySelectorAll("." + props.guid + " .ren-word-cloud-word");

        // A word split out of a value isn't a value the auto menu's reports would find.
        const autoMenuName = props.wordCloudIndividualWords
            ? null
            : getWordColumnAutoMenuName(tabularData, props);

        wordElements.forEach(wordElement => {

            const word = wordElement.getAttribute('data-word');

            if (word) {

                const searchMenuItems = contextMenuItems.getSearchMenuItems(word);
                contextMenu.addMenuItems(wordElement, searchMenuItems);

                if (autoMenuName) Ren.AutoMenu.applyMenu(wordElement, autoMenuName, word);
            }
        });

        if (isNewContextMenu) contextMenuItems.addShowWindowsMenuItems(svgContainer);
    };

    const getContextMenuItems = (tabularData, contextMenu, visualisation, props) => {

        return Ren.ContextMenuItems_WordCloud(
            tabularData,
            contextMenu,
            visualisation,
            props
        );
    };

    const getStyleUpdater = () => ({
        updateStylesheet: (props, width, height) => Ren.WordCloud_StyleUpdater.updateStylesheet(props, width, height),
        handleThemeChange: (props) => Ren.WordCloud_StyleUpdater.handleThemeChange(props),
        rescaleAfterRedraw: true
    });

    const getValidator = () => ({
        validate: (props, data) => Ren.CreateWordCloud_DataValidator.validateWordCloudData(props, data)
    });

    const getDataPreparer = () => Ren.CreateWordCloud_PrepareData;

    const getQAHelper = () => ({
        setQa: (props, inputData) => Ren.QA.WordCloud.setQaWordCloud(props, inputData)
    });

    return Ren.BaseVisualisationCreator({
        visualisationName: "WordCloud",
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
