/**
 * Writes and moves the text of the labels of a chart drawn as pies, shortens a label too long for
 * its room, and shows a label and its connector once placed.
 */
Ren.DateValueChart_PieLabelDrawing = (() => {

    const INSIDE_CLASS = "ren-pie-label--inside";

    const ELLIPSIS = "…";

    const LINE_HEIGHT_EMS = 1.15;

    /**
     * Writes a label's lines into its text node, a tspan each, stacked so that the block of them
     * is centred on the text node's y.
     */
    const writeLines = (textNode, lines) => {

        textNode.textContent = "";

        const firstDy = -(lines.length - 1) / 2 * LINE_HEIGHT_EMS;

        for (let i = 0; i < lines.length; i++) {

            const lineNode = Ren.Svg.append(textNode, "tspan", {
                "dy": (i === 0 ? firstDy : LINE_HEIGHT_EMS) + "em"
            });

            lineNode.textContent = lines[i];
        }
    };

    /** Rewrites a label's first line, leaving any below it, as when it is shortened. */
    const setFirstLine = (textNode, text) => {

        textNode.firstElementChild.textContent = text;
    };

    /** Moves a label's text, every line of it, the x of each being its own. */
    const placeText = (textNode, x, y) => {

        textNode.setAttribute("x", x);
        textNode.setAttribute("y", y);

        for (let i = 0; i < textNode.children.length; i++) {
            textNode.children[i].setAttribute("x", x);
        }
    };

    const showLabel = (label, box, isInside) => {

        label.groupNode.style.display = "";
        placeText(label.textNode, (box.left + box.right) / 2, (box.top + box.bottom) / 2);
        label.textNode.style.textAnchor = "";
        label.textNode.classList.toggle(INSIDE_CLASS, isInside);
    };

    const showConnector = (label, points) => {

        label.connectorNode.style.display = "";
        label.connectorNode.setAttribute("points", points.map(point => point.join(",")).join(" "));
    };

    /**
     * Gets the text to show for a label in a width, shortened to end in an ellipsis where the
     * whole label is too long, or null where not even one character and an ellipsis fit.
     * prefixLengths[n] is the length of the first n characters and an ellipsis.
     */
    const fitText = (fullText, prefixLengths, availableWidthPx) => {

        if (prefixLengths[fullText.length] <= availableWidthPx) return fullText;

        for (let count = fullText.length - 1; count >= 1; count--) {

            if (prefixLengths[count] <= availableWidthPx) {

                return fullText.substring(0, count).replace(/\s+$/, "") + ELLIPSIS;
            }
        }

        return null;
    };

    /**
     * Measures a label drawn in full with an ellipsis after its first line, for that line to be
     * shortened by: its height, the length of each leading run of the first line's characters
     * with the ellipsis, as for fitText, and the length of the longest line below it, which is
     * never shortened.  Gets null where it is not shown.
     */
    const measureForShortening = (textNode, firstLine) => {

        try {

            const box = textNode.getBBox();

            if (!box.width) return null;

            const ellipsisLength = textNode.getSubStringLength(firstLine.length, 1);
            const prefixLengths = [];

            for (let i = 1; i < firstLine.length; i++) {

                prefixLengths[i] = textNode.getSubStringLength(0, i) + ellipsisLength;
            }

            prefixLengths[firstLine.length] =
                textNode.firstElementChild.getComputedTextLength() - ellipsisLength;

            let restWidth = 0;

            for (let i = 1; i < textNode.children.length; i++) {

                restWidth = Math.max(restWidth, textNode.children[i].getComputedTextLength());
            }

            return {
                width: Math.max(prefixLengths[firstLine.length], restWidth),
                height: box.height,
                prefixLengths,
                restWidth
            };
        }
        catch (error) {

            return null;
        }
    };

    return {
        INSIDE_CLASS,
        ELLIPSIS,
        LINE_HEIGHT_EMS,
        writeLines,
        setFirstLine,
        placeText,
        showLabel,
        showConnector,
        fitText,
        measureForShortening
    };
})();
