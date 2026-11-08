Ren.WordCloud_StyleUpdater = (() => {

    const getPaletteColours = (props, paletteId) => {

        const paletteDefinition = Ren.WordCloud_Palettes.getPaletteById(paletteId);
        let palette = paletteDefinition.colors;
        let backgroundColor = paletteDefinition.backgroundColor;

        const isThemeInverted = Ren.Theme.getValue("word-cloud-invert-colours", "0") === "1";

        // Inverting under a theme that inverts them already turns them back to how they were.
        if (isThemeInverted !== (props.wordCloudInvertColours === true)) {

            palette = palette.map(colour => Ren.Colours.invertHexColour(colour));
            backgroundColor = Ren.Colours.invertHexColour(backgroundColor);
        }

        return { palette, backgroundColor };
    };

    const generatePaletteRules = (palette, backgroundColor) => {

        let rules = `.ren-word-cloud-group {

    background-color: ${backgroundColor};
}

.ren-word-cloud-background {
    fill: ${backgroundColor};
}

.ren-word-cloud-word {

    font-family: Arial, sans-serif;
    font-weight: normal;
    letter-spacing: ${Ren.WordCloud_Layout.letterSpacing}px;
}\n`;

        // Generate color rules for each word index (0-9) with high specificity
        palette.forEach((color, index) => {

            rules += `.ren-word-cloud-word[data-word-index="${index}"] {
    fill: ${color};
}\n`;
        });

        return rules;
    };

    /**
     * Gets the visualisation element holding the word cloud's own element, which carries the
     * popup's padding.
     */
    const getVisualisationElement = (props) => props.svg.parentNode?.parentNode;

    /**
     * Applies the palette to the SVG, and its background to the visualisation element so that the
     * padding around the word cloud doesn't frame it in a different colour.
     */
    const applyPalette = (props) => {

        const paletteId = props.wordCloudColourPalette || Ren.WordCloud_Palettes.DEFAULT_PALETTE_ID;
        const colours = getPaletteColours(props, paletteId);

        props.svgStyle.textContent =
            generatePaletteRules(colours.palette, colours.backgroundColor);

        const visualisationElement = getVisualisationElement(props);

        if (visualisationElement) {

            visualisationElement.style.backgroundColor = colours.backgroundColor;
        }
    };

    const updateStylesheet = (props, width, height) => {

        if (!props.svgStyle) return;

        // Handle responsive scaling if dimensions are provided
        if (width !== undefined && height !== undefined && props.margin) {

            // The size given is the padded visualisation element's on a resize but the unpadded
            // word cloud element's on a redraw, so the visualisation element's content box is
            // measured instead.
            const visualisationElement = getVisualisationElement(props);

            if (visualisationElement && visualisationElement.clientWidth > 0) {

                const style = getComputedStyle(visualisationElement);

                width = visualisationElement.clientWidth
                    - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
                height = visualisationElement.clientHeight
                    - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
            }

            let availableWidth = width - props.margin.left - props.margin.right;
            let availableHeight = height - props.margin.top - props.margin.bottom;

            // Calculate scale factors based on container vs.  the SVG's current (potentially
            // dynamic) dimensions props.innerWidth and props.innerHeight represent the current
            // content area of the SVG
            const scaleX = availableWidth / props.innerWidth;
            const scaleY = availableHeight / props.innerHeight;

            applyPalette(props);

            // Scale the SVG element itself using inline CSS transform so its contents appear to
            // fill the popup
            if (props.svg) {

                props.svg.style.transformOrigin = "0 0";
                props.svg.style.transform = `scale(${scaleX}, ${scaleY})`;
            }

            // Keep background rectangle at its current dimensions since SVG is being scaled
            if (props.chartBackground) {

                Ren.Svg.setAttrs(props.chartBackground, {
                    "width": props.innerWidth,
                    "height": props.innerHeight
                });
            }
        }
        else {

            // Initial setup without resize data
            applyPalette(props);
        }
    };

    const updatePaletteStylesheet = (props, paletteId) => {

        if (!props.svgStyle) return;

        // A picked palette shows as picked.
        props.wordCloudColourPalette = paletteId;
        props.wordCloudInvertColours = false;
        applyPalette(props);
    };

    /**
     * Inverts the colours on screen, words and background together.
     */
    const invertColours = (props) => {

        props.wordCloudInvertColours = props.wordCloudInvertColours !== true;

        if (!props.svgStyle) return;

        applyPalette(props);
    };

    const handleThemeChange = (props) => {

        if (!props.svgStyle) return;

        applyPalette(props);
    };

    return {
        updateStylesheet,
        updatePaletteStylesheet,
        invertColours,
        handleThemeChange
    };
})();
