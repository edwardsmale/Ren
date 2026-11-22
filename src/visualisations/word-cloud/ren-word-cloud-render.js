Ren.WordCloud_Render = (() => {

      const setChartDimensions = props => {

         // Try to use container size if available, otherwise use default
         const container = document.querySelector("." + props.guid);
         let containerWidth = 800;
         let containerHeight = 600;

         if (container) {

             const parentWidth = container.parentNode ? container.parentNode.clientWidth : 0;
             const parentHeight = container.parentNode ? container.parentNode.clientHeight : 0;

             // Use parent container size if available and reasonable
             if (parentWidth > 400) containerWidth = Math.min(parentWidth, 1200);
             if (parentHeight > 300) containerHeight = Math.min(parentHeight, 900);
         }

         props.width = containerWidth;
         props.height = containerHeight;
         Ren.ChartProps.setMargin(props, { top: 0, right: 0, bottom: 0, left: 0 });
         props.innerWidth = props.width - props.margin.left - props.margin.right;
         props.innerHeight = props.height - props.margin.top - props.margin.bottom;
     };

    const setupSvgAndGroups = props => {

        const container = document.querySelector("." + props.guid);

        if (!container) {
            throw new Error(`Container with class '${props.guid}' not found`);
        }

        props.svg = Ren.Svg.append(container, "svg", { "width": "100%", "height": "100%" });

        // Create an internal style element within the SVG for color palette rules
        // This ensures CSS rules apply to the SVG content
        props.svgStyle = Ren.Svg.append(Ren.Svg.append(props.svg, "defs"), "style");

        props.chartGroup = Ren.Svg.append(props.svg, "g", {
            "class": "ren-word-cloud-group",
            "transform": `translate(${props.margin.left},${props.margin.top})`
        });

        // Add background rectangle to the chart group
        props.chartBackground = Ren.Svg.append(props.chartGroup, "rect", {
            "class": "ren-word-cloud-background",
            "width": props.innerWidth,
            "height": props.innerHeight,
            "fill": "#FFFFFF"
        });

        // Set up tooltip.
        const tooltipHeight = 28;
        const tooltipPadding = 8;

        props.tooltip = Ren.Svg.append(props.svg, "g", { "class": "ren-word-cloud-tooltip" });
        Ren.Svg.setStyles(props.tooltip, { "opacity": 0, "pointer-events": "none" });

        props.tooltipRect = Ren.Svg.append(props.tooltip, "rect", {
            "height": tooltipHeight,
            "fill": "#fffff0",
            "fill-opacity": 0.95
        });

        props.tooltipText = Ren.Svg.append(props.tooltip, "text", {
            "class": "ren-tooltip-text",
            "x": tooltipPadding,
            "y": 18,
            "font-size": "12px",
            "font-family": "Arial, sans-serif",
            "fill": "#000",
            "pointer-events": "none"
        });

        props.tooltipHeight = tooltipHeight;
        props.tooltipPadding = tooltipPadding;
        props.isTooltipVisible = false;
        props.showTooltipTimeout = null;
        props.hideTooltipTimeout = null;
    };

    /**
     * Fades the tooltip in or out over a number of milliseconds.
     */
    const fadeTooltip = (props, opacity, duration) => {

        props.tooltip.style.transition = `opacity ${duration}ms`;
        props.tooltip.style.opacity = opacity;
    };

    /**
     * Shows a word's tooltip by the mouse, after a pause, and hides it when the mouse leaves.
     */
    const attachTooltip = (props, wordElement, d) => {

        wordElement.addEventListener("mouseover", e => {

            if (props.showTooltipTimeout) clearTimeout(props.showTooltipTimeout);
            if (props.hideTooltipTimeout) clearTimeout(props.hideTooltipTimeout);

            props.showTooltipTimeout = setTimeout(() => {

                props.showTooltipTimeout = null;

                const tooltipText = `${d.word} (${d.count})`;
                props.tooltipText.textContent = tooltipText;

                // Calculate actual width based on rendered text.
                let actualWidth = 80; // minimum width

                try {

                    const bbox = props.tooltipText.getBBox();
                    actualWidth = bbox.width + props.tooltipPadding * 2;
                }
                catch (e) {

                    actualWidth = Math.max(tooltipText.length * 6.5 + props.tooltipPadding * 2, 80);
                }
                props.tooltipRect.setAttribute("width", actualWidth);

                const mouse = Ren.Svg.pointer(e, props.svg);

                const minX = 20;
                const maxX = props.width - actualWidth - 40;
                const x = Math.max(minX, Math.min(mouse[0] + 15, maxX));
                const y = Math.max(20, mouse[1] + 25);

                props.tooltip.setAttribute("transform", `translate(${x}, ${y})`);
                fadeTooltip(props, 1, 200);

                props.isTooltipVisible = true;
            }, 500);
        });

        wordElement.addEventListener("mouseout", () => {

            if (props.showTooltipTimeout) clearTimeout(props.showTooltipTimeout);
            if (props.hideTooltipTimeout) clearTimeout(props.hideTooltipTimeout);

            props.hideTooltipTimeout = setTimeout(() => {

                props.hideTooltipTimeout = null;
                fadeTooltip(props, 0, 300);
            }, 50);

            props.isTooltipVisible = false;
        });
    };

    /**
     * Renders the word cloud with words sized by count, left-to-right, not rotated.
     */
    const renderWordCloud = (props, data) => {

        try {

            setChartDimensions(props);
            setupSvgAndGroups(props);

            const baseFontScale = Ren.WordCloud_Layout.createFontScale(data, props);
            let layoutData = Ren.WordCloud_Layout.layoutWords(data, baseFontScale, props);

            // Instead of growing canvas, reduce font sizes if words don't fit
            let fontReductionAttempt = 0;
            const maxFontReductionAttempts = 5;
            const fontReductionFactor = 0.85; // Reduce font by 15% each attempt

            while (layoutData.length < data.length && fontReductionAttempt < maxFontReductionAttempts) {

                fontReductionAttempt++;

                const reduction = Math.pow(fontReductionFactor, fontReductionAttempt);
                const fontScale = count => baseFontScale(count) * reduction;

                layoutData = Ren.WordCloud_Layout.layoutWords(data, fontScale, props);
            }

            if (layoutData.length < data.length) {

                console.warn(`[WordCloud_Render] Could not place all words. Placed ${layoutData.length} of ${data.length}`);
            }

            let minLayoutY = Infinity;
            let maxLayoutY = 0;

            for (let i = 0; i < layoutData.length; i++) {

                minLayoutY = Math.min(minLayoutY, layoutData[i].y);
                maxLayoutY = Math.max(maxLayoutY, layoutData[i].y + layoutData[i].height);
            }

            // Words spiral out from the center, so trimming unused height keeps them centered.
            const layoutHeight = maxLayoutY - minLayoutY;
            const minHeightNeeded = layoutHeight + props.margin.top + props.margin.bottom + 40;

            if (layoutData.length > 0 && minHeightNeeded < props.height) {

                props.height = Math.max(minHeightNeeded, 300); // Minimum height of 300px
                props.innerHeight = props.height - props.margin.top - props.margin.bottom;

                const offsetY = minLayoutY - (props.innerHeight - layoutHeight) / 2;

                for (let i = 0; i < layoutData.length; i++) {
                    layoutData[i].y -= offsetY;
                }
            }

            Ren.Svg.setAttrs(props.svg, { "height": props.height, "width": props.width });

            // Update background rectangle dimensions
            Ren.Svg.setAttrs(props.chartBackground, {
                "width": props.innerWidth,
                "height": props.innerHeight
            });

            // Render words with colors
            for (let i = 0; i < layoutData.length; i++) {

                const d = layoutData[i];

                const wordElement = Ren.Svg.append(props.chartGroup, "text", {
                    "class": "ren-word-cloud-word",
                    "x": d.x,
                    "y": d.y + d.height,
                    "font-size": d.fontSize,
                    "text-anchor": "start",
                    "font-family": "Arial, sans-serif",
                    "alignment-baseline": "after-edge",
                    "style": "cursor: pointer;",
                    "data-word": d.word,
                    "data-count": d.count,
                    "data-word-index": i % 10
                });

                wordElement.textContent = d.word;
                attachTooltip(props, wordElement, d);
            }
        }
        catch (error) {

            Ren.GlobalErrorHandler.logError(`[WordCloud] Error rendering word cloud: ${error}`);
            throw error;
        }
    };

    return {
        renderWordCloud
    };
})();
