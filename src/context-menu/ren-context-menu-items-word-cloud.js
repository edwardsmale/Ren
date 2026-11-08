/**
 * Functions to add word cloud menu items to the context menu.
 */
Ren.ContextMenuItems_WordCloud = (tabularData, contextMenu, visualisation, props) => {

    const windowsMenuItems = Ren.ContextMenuItems_Windows(visualisation, tabularData.tabularDataGuid);

    // Get palettes from centralized source
    const colourPalettes = Ren.WordCloud_Palettes.getPalettesAsArray();

    /**
     * Switches between counting whole phrases and counting the individual words within them.  The
     * words are worked out while the data is prepared, so the cloud has to be drawn again.
     */
    const toggleIndividualWords = () => {

        visualisation.wordCloudIndividualWords = !visualisation.wordCloudIndividualWords;
        props.redrawVisualisation?.();
    };

    // Only the colours on screen change; nothing is saved with the settings.
    const invertColours = () => {

        Ren.WordCloud_StyleUpdater.invertColours(props);
    };

    const getWordCloudMenuItems = () => {

        const selectedPaletteId = () =>
            Ren.WordCloud_Palettes.getPaletteById(visualisation.wordCloudColourPalette).id;

        const palettSubmenu = colourPalettes.map(palette => ({
            text: palette.name,
            ticked: () => selectedPaletteId() === palette.id,
            action: () => {

                visualisation.wordCloudColourPalette = palette.id;
                Ren.WordCloud_StyleUpdater.updatePaletteStylesheet(props, palette.id);
            }
        }));

        return [
            {
                section: "Word Cloud",
                text: "Individual words",
                id: "word-cloud-individual-word-counts",
                ticked: () => visualisation.wordCloudIndividualWords === true,
                action: () => toggleIndividualWords()
            },
            {
                section: "Word Cloud",
                text: "Colour palette",
                id: "word-cloud-colour-palette",
                submenu: palettSubmenu
            },
            {
                section: "Word Cloud",
                text: "Invert colours",
                id: "word-cloud-invert-colours",
                action: () => invertColours()
            }
        ];
    };

    /**
     * Gets the Search items for a word.  The host's own reports about it come from its auto menu
     * for the word column, which the word cloud applies alongside these.
     */
    const getSearchMenuItems = (word) =>
        Ren.ContextMenuItems_SemanticColumns.getStringSearchMenuItems(word);

    const addShowWindowsMenuItems = (element) => {

        const items = getWordCloudMenuItems();
        const windowItems = windowsMenuItems.getMenuItems();
        Ren.ArrayUtils.pushAll(items, windowItems);
        contextMenu.addMenuItems(element, items);
    };

    return {
        addShowWindowsMenuItems,
        getSearchMenuItems,
        colourPalettes
    };
};
