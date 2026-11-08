/**
 * Saves a date/value chart as an image, as an SVG file or a PNG one.  The image is a copy of the
 * chart's SVG standing on its own: the styles its stylesheets give it are written onto each
 * element, a white background goes behind it, and the legend, which on the page is HTML, is drawn
 * beneath it in SVG.
 *
 * Only what is drawn is copied, so a hover band or a selected bar shows as it does on the page,
 * but the chart's controls, such as its zoom buttons, are left out.
 */
Ren.DateValueChart_ImageExport = (() => {

    // The class of what is drawn on the chart to be clicked rather than seen, left out of an image.
    const LEAVE_OUT_CLASS = "ren-not-in-image";

    // The class of the elements an image shows, while the menu items making one are hovered.
    const IMAGE_AREA_CLASS = "ren-date-value-chart-image-area";
    const IMAGE_AREA_SELECTOR = ":scope > svg, :scope > .ren-chart-title, "
        + ":scope > .ren-chart-subtitle, :scope > .ren-date-value-chart-legend-html";

    // The properties the chart's stylesheets set that change how it looks.  The chart is drawn in
    // plot coordinates and scaled to its size by its stylesheets, so the scales and transforms are
    // copied too.
    const STYLE_PROPERTIES = [
        "fill",
        "fill-opacity",
        "stroke",
        "stroke-width",
        "stroke-dasharray",
        "stroke-opacity",
        "opacity",
        "font-family",
        "font-size",
        "font-weight",
        "font-style",
        "text-anchor",
        "dominant-baseline",
        "visibility",
        "display",
        "paint-order",
        "stroke-linejoin",
        "stroke-linecap",
        "vector-effect",
        "transform",
        "translate",
        "rotate",
        "scale",
        "transform-box",
        "transform-origin"
    ];

    const BACKGROUND = "#FFFFFF";
    const TITLE_HEIGHT = 30;
    const SUBTITLE_HEIGHT = 20;

    // A multi-chart chart's range label, as it sits on the page: 2px down with a 16px line height.
    const DATE_RANGE_FONT_SIZE = 14;
    const DATE_RANGE_BASELINE = 15;
    const LEGEND_FONT_SIZE = 12;
    const LEGEND_SWATCH_SIZE = 12;
    const LEGEND_ROW_HEIGHT = 20;
    const LEGEND_PADDING = 10;

    // An estimate of a character's width, as a detached copy has no layout to measure text by.
    const LEGEND_CHAR_WIDTH = LEGEND_FONT_SIZE * 0.6;

    const PNG_SCALE = 2;

    const INVALID_FILE_NAME_CHARACTERS = "\\/:*?\"<>|";

    /**
     * Writes the computed styles of each element of the original onto its copy, element for
     * element, as the copy is taken away from the stylesheets that styled it.
     */
    const inlineStyles = (original, copy) => {

        const originals = original.querySelectorAll("*");
        const copies = copy.querySelectorAll("*");

        for (let i = 0; i < originals.length && i < copies.length; i++) {

            const computed = window.getComputedStyle(originals[i]);
            let style = "";

            for (let j = 0; j < STYLE_PROPERTIES.length; j++) {

                const value = computed.getPropertyValue(STYLE_PROPERTIES[j]);

                if (value) style += `${STYLE_PROPERTIES[j]}:${value};`;
            }

            if (style) copies[i].setAttribute("style", style);
        }
    };

    /**
     * Gets the legend's entries: the name and colour of each series drawn.
     */
    const getLegendEntries = (props) => {

        const entries = [];

        for (let i = 0; i < props.seriesCount; i++) {

            const series = props.series[i];

            if (!series || series.isEnabled === false) continue;

            entries.push({ text: series.label || props.valueHeadings[i], colour: series.colour });
        }

        return entries;
    };

    /**
     * Lays the legend's entries out in rows across the given width, each a swatch then its name,
     * returning each entry's position and the height the rows take.
     */
    const layOutLegend = (entries, width) => {

        const positions = [];
        let x = LEGEND_PADDING;
        let y = LEGEND_PADDING;

        for (let i = 0; i < entries.length; i++) {

            const entryWidth = LEGEND_SWATCH_SIZE + 6
                + String(entries[i].text).length * LEGEND_CHAR_WIDTH + 16;

            if (x > LEGEND_PADDING && x + entryWidth > width - LEGEND_PADDING) {

                x = LEGEND_PADDING;
                y += LEGEND_ROW_HEIGHT;
            }

            positions.push({ x, y });
            x += entryWidth;
        }

        return {
            positions,
            height: entries.length === 0 ? 0 : y + LEGEND_ROW_HEIGHT + LEGEND_PADDING
        };
    };

    const appendLegend = (svg, entries, layout, top) => {

        const group = Ren.Svg.append(svg, "g", {
            "class": "ren-image-legend",
            "transform": `translate(0,${top})`
        });

        for (let i = 0; i < entries.length; i++) {

            const position = layout.positions[i];

            Ren.Svg.append(group, "rect", {
                "x": position.x,
                "y": position.y,
                "width": LEGEND_SWATCH_SIZE,
                "height": LEGEND_SWATCH_SIZE,
                "fill": entries[i].colour
            });

            const text = Ren.Svg.append(group, "text", {
                "x": position.x + LEGEND_SWATCH_SIZE + 6,
                "y": position.y + LEGEND_SWATCH_SIZE - 1,
                "font-family": "sans-serif",
                "font-size": LEGEND_FONT_SIZE,
                "fill": "#333333"
            });

            text.textContent = entries[i].text;
        }
    };

    /**
     * Gets the label naming a multi-chart chart's range, such as its year, or null where it has
     * none.  On the page it is HTML laid over the strip above the plot, beside the chart's
     * container rather than in it.
     */
    const getDateRangeLabel = (props) => {

        const item = props.multiChartRange ? props.svg?.parentNode?.parentNode : null;

        if (!item) return null;

        return item.querySelector(
            `:scope > .${Ren.DateValueChart_MultiChart.DATE_RANGE_CLASS_NAME}`
        );
    };

    const appendDateRangeLabel = (svg, props, label, width, top) => {

        const isCentred = !!props.showAsPies;

        const text = Ren.Svg.append(svg, "text", {
            "class": "ren-image-date-range",
            "x": isCentred ? width / 2 : (props.margin ? props.margin.left : 8),
            "y": top + DATE_RANGE_BASELINE,
            "text-anchor": isCentred ? "middle" : "start",
            "font-family": "sans-serif",
            "font-size": DATE_RANGE_FONT_SIZE,
            "font-weight": "bold",
            "fill": "#000000"
        });

        text.textContent = label.textContent;
    };

    /**
     * Gets the chart's size on the page, falling back on its own attributes where it has no
     * layout, as when detached.
     */
    const getSize = (svg) => {

        const rect = svg.getBoundingClientRect();

        return {
            width: Math.ceil(rect.width) || Number(svg.getAttribute("width")) || 800,
            height: Math.ceil(rect.height) || Number(svg.getAttribute("height")) || 400
        };
    };

    /**
     * Builds the image of the chart as an SVG element standing on its own, with its size.  Null
     * where the chart has not been drawn.
     */
    const buildImage = (props) => {

        if (!props.svg) return null;

        const size = getSize(props.svg);
        const copy = props.svg.cloneNode(true);

        copy.classList.remove(IMAGE_AREA_CLASS);
        inlineStyles(props.svg, copy);

        const leftOut = copy.querySelectorAll(`.${LEAVE_OUT_CLASS}`);

        for (let i = 0; i < leftOut.length; i++) leftOut[i].remove();

        const entries = getLegendEntries(props);
        const legend = layOutLegend(entries, size.width);
        const title = Ren.DateValueChart_Title.getTitle(props);
        const subtitleParts = Ren.DateValueChart_Title.getSubtitleParts(props);
        const subtitleHeight = subtitleParts.length ? SUBTITLE_HEIGHT : 0;
        const titleHeight = (title ? TITLE_HEIGHT : 0) + subtitleHeight;
        const height = titleHeight + size.height + legend.height;

        const image = document.createElementNS(Ren.Svg.NAMESPACE, "svg");

        image.setAttribute("xmlns", Ren.Svg.NAMESPACE);
        image.setAttribute("width", size.width);
        image.setAttribute("height", height);
        image.setAttribute("viewBox", `0 0 ${size.width} ${height}`);

        Ren.Svg.append(image, "rect", {
            "class": "ren-image-background",
            "width": size.width,
            "height": height,
            "fill": BACKGROUND
        });

        if (title) {

            const titleText = Ren.Svg.append(image, "text", {
                "class": "ren-image-title",
                "x": size.width / 2,
                "y": TITLE_HEIGHT - 9,
                "text-anchor": "middle",
                "font-family": "sans-serif",
                "font-size": 16,
                "font-weight": 600,
                "fill": "#222222"
            });

            titleText.textContent = title;
        }

        if (subtitleParts.length) {

            const subtitleText = Ren.Svg.append(image, "text", {
                "class": "ren-image-subtitle",
                "x": size.width / 2,
                "y": titleHeight - 6,
                "text-anchor": "middle",
                "font-family": "sans-serif",
                "font-size": 12,
                "fill": "#555555",
                "style": "white-space: pre"
            });

            for (let index = 0; index < subtitleParts.length; index++) {

                const part = subtitleParts[index];
                const span = Ren.Svg.append(subtitleText, "tspan", part.isValue
                    ? { "font-weight": "bold" }
                    : {});

                span.textContent = part.text;
            }
        }

        copy.setAttribute("x", 0);
        copy.setAttribute("y", titleHeight);
        copy.setAttribute("width", size.width);
        copy.setAttribute("height", size.height);
        image.appendChild(copy);

        const dateRangeLabel = getDateRangeLabel(props);

        if (dateRangeLabel) {

            appendDateRangeLabel(image, props, dateRangeLabel, size.width, titleHeight);
        }

        appendLegend(image, entries, legend, titleHeight + size.height);

        return { element: image, width: size.width, height };
    };

    /**
     * Gets the chart's image as SVG markup, or null where the chart has not been drawn.
     */
    const buildSvgString = (props) => {

        const image = buildImage(props);

        if (!image) return null;

        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
            + new XMLSerializer().serializeToString(image.element);
    };

    /**
     * Gets text as it can stand in a file name, without the characters a file name cannot hold.
     */
    const toFileNamePart = (text) => {

        let part = "";

        // A name broken over lines, as a long heading is, keeps a space where it was broken.
        for (let i = 0; i < text.length; i++) {

            if (text.charCodeAt(i) < 32) {
                part += " ";
            }
            else if (INVALID_FILE_NAME_CHARACTERS.indexOf(text[i]) === -1) {

                part += text[i];
            }
        }

        return part.split(" ").filter(word => word !== "").join(" ");
    };

    /**
     * Gets the file name the image is saved under, from the chart's title or the names of the
     * series drawn, followed by its range where it is one of a multi-chart's, such as its year.
     */
    const getFileName = (props, extension) => {

        const names = Ren.DateValueChart_Title.getTitle(props)
            || getLegendEntries(props).map(entry => entry.text).join(", ");
        const name = toFileNamePart(names).substring(0, 80) || "Chart";
        const dateRangeLabel = getDateRangeLabel(props);
        const range = dateRangeLabel ? toFileNamePart(dateRangeLabel.textContent) : "";

        return `${range ? `${name} ${range}` : name}.${extension}`;
    };

    const saveBlob = (blob, fileName) => {

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = fileName;
        link.click();

        setTimeout(() => URL.revokeObjectURL(url), 100);
    };

    const downloadSvg = (props) => {

        const markup = buildSvgString(props);

        if (!markup) return;

        saveBlob(
            new Blob([markup], { type: "image/svg+xml;charset=utf-8" }),
            getFileName(props, "svg")
        );
    };

    /**
     * Draws the chart's image onto a canvas, at twice its size so that it stays sharp on a high
     * resolution screen, and passes the canvas on, or null where it cannot be drawn.
     */
    const renderToCanvas = (props, callback) => {

        const image = buildImage(props);

        if (!image) {

            callback(null);
            return;
        }

        const markup = new XMLSerializer().serializeToString(image.element);
        const img = new Image();

        img.onload = () => {

            const canvas = document.createElement("canvas");

            canvas.width = image.width * PNG_SCALE;
            canvas.height = image.height * PNG_SCALE;

            const context = canvas.getContext("2d");

            context.scale(PNG_SCALE, PNG_SCALE);
            context.drawImage(img, 0, 0);

            callback(canvas);
        };

        img.onerror = () => callback(null);
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup);
    };

    const downloadPng = (props) => {

        renderToCanvas(props, canvas => {

            if (!canvas) return;

            canvas.toBlob(blob => {

                if (blob) saveBlob(blob, getFileName(props, "png"));
            }, "image/png");
        });
    };

    /**
     * Gets a value indicating whether the browser lets a page put an image on the clipboard.
     */
    const canCopyImage = () => typeof window.ClipboardItem === "function"
        && typeof navigator.clipboard?.write === "function";

    /**
     * Puts the chart on the clipboard as a PNG, for pasting into a document or an email.  The
     * clipboard is written to at once, with the image to follow, as the browser only allows it
     * straight after the click asking for it.
     */
    const copyPng = (props) => {

        const png = new Promise((resolve, reject) => renderToCanvas(props, canvas => {

            if (!canvas) {

                reject(new Error("The chart could not be drawn as an image."));
                return;
            }

            canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("No PNG made.")));
        }));

        return navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
    };

    /**
     * Shades or unshades what on the page an image shows, without moving anything.  The image's
     * title and legend are redrawn from the chart's, so the chart's stand for them, and anything
     * else in its container, such as a date slider, stays unshaded.
     */
    const setImageAreaShaded = (props, isShaded) => {

        const container = props.svg?.parentNode;

        if (!container) return;

        const elements = container.querySelectorAll(IMAGE_AREA_SELECTOR);

        for (let i = 0; i < elements.length; i++) {

            elements[i].classList.toggle(IMAGE_AREA_CLASS, isShaded);
        }

        getDateRangeLabel(props)?.classList.toggle(IMAGE_AREA_CLASS, isShaded);
    };

    return {
        LEAVE_OUT_CLASS,
        IMAGE_AREA_CLASS,
        setImageAreaShaded,
        buildImage,
        buildSvgString,
        getFileName,
        getLegendEntries,
        layOutLegend,
        renderToCanvas,
        saveBlob,
        downloadSvg,
        downloadPng,
        canCopyImage,
        copyPng
    };
})();
