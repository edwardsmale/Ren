describe("Ren.DateValueChart_StyleUpdater previews", () => {

    const StyleUpdater = Ren.DateValueChart_StyleUpdater;
    const Render = Ren.DateValueChart_Render;

    let guidCount = 0;

    // Each with a guid of its own, as each chart's preview stylesheet is found by its guid.
    const createProps = () => ({
        guid: `preview-test-${++guidCount}`,
        valueHeadings: ["Sales"],
        series: [{ colour: "#3366cc" }],
        seriesCount: 1
    });

    const getPreviewCss = (props) => props.temporaryStylesheet.textContent;

    test("setPreviewLines_ThickDashedLine_LineAndLegendLineDrawnSo", () => {

        const props = createProps();
        const widthPx = Render.getStyledLineStrokeWidth("dashed", "thick");

        StyleUpdater.setPreviewLines(
            props,
            [{ seriesIndex: 1, lineStyle: "dashed", lineWidth: "thick" }]
        );

        const css = getPreviewCss(props);

        expect(css).toContain(
            `.${props.guid} svg .ren-chart-group > .ren-series-1 .ren-data-series__line-path `
                + `{ stroke-width: ${widthPx}px; stroke-dasharray: ${widthPx * 3} ${widthPx * 3} }`
        );
        expect(css).toContain(
            `.${props.guid} .ren-legend-item.ren-series-1 .ren-legend-colour-rect line `
                + `{ stroke-width: ${widthPx / 2}px;`
        );
    });

    test("setPreviewLines_SelectedSeries_LineDrawnThicker", () => {

        const props = createProps();
        const widthPx = Render.getStyledLineStrokeWidth("solid", "normal");

        Ren.DateValueChart_Legend.showSelection(props, [1]);

        StyleUpdater.setPreviewLines(
            props,
            [{ seriesIndex: 1, lineStyle: "solid", lineWidth: "normal" }]
        );

        expect(getPreviewCss(props)).toContain(`{ stroke-width: ${widthPx * 1.75}px;`);
    });

    test("setPreviewLines_AnotherPreview_ReplacesTheFirst", () => {

        const props = createProps();

        StyleUpdater.setPreviewLines(
            props,
            [{ seriesIndex: 1, lineStyle: "dashed", lineWidth: "thick" }]
        );
        StyleUpdater.setPreviewLines(
            props,
            [{ seriesIndex: 1, lineStyle: "solid", lineWidth: "thin" }]
        );

        const css = getPreviewCss(props);
        const widthPx = Render.getStyledLineStrokeWidth("solid", "thin");

        expect(css).toContain(`{ stroke-width: ${widthPx}px; stroke-dasharray: none }`);
        expect(css).not.toContain(
            `stroke-width: ${Render.getStyledLineStrokeWidth("dashed", "thick")}px`
        );
    });

    test("setPreviewDots_LargeDots_DotsAndTheirRingsSizedSo", () => {

        const props = createProps();
        const radius = Render.getStyledPointRadius("large");

        StyleUpdater.setPreviewDots(props, [{ seriesIndex: 1, dotSize: "large" }]);

        const css = getPreviewCss(props);
        const seriesSelector = `.${props.guid} svg .ren-chart-group > .ren-series-1`;

        expect(css).toContain(`${seriesSelector} .ren-data-series__point-dot, `
            + `${seriesSelector} circle.ren-data-series__point { r: ${radius}px }`);
        expect(css).toContain(`${seriesSelector} .ren-data-series__point-ring `
            + `{ r: ${radius + Render.SELECTED_POINT_RING_GAP}px }`);
    });
});
