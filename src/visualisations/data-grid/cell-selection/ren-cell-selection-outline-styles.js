/**
 * Builds the Excel-style decoration of a selection: a green border around each selected block of
 * cells, and darkened row and column headings, with a green edge, alongside the selected cells.
 */
Ren.DataGridCellSelection_OutlineStyles = (
    dataGroupingSettings,
    dataGridGuid,
    gridState,
    firstLastCell) => {

    const TOP = 1;
    const RIGHT = 2;
    const BOTTOM = 4;
    const LEFT = 8;

    const rectCalculator = Ren.DataGridCellSelection_RectCalculator(dataGroupingSettings);

    const cellSelector = (c, r) => `.${dataGridGuid} .ren-data-grid__cell.ren-c-${c}.ren-r-${r}`;
    const rowSelector = (r) => `.${dataGridGuid} .ren-data-grid__cell.ren-r-${r}`;
    const columnSelector = (c) => `.${dataGridGuid} .ren-data-grid__cell.ren-c-${c}`;
    const rowHeadingSelector = (r) => `.${dataGridGuid} .ren-data-grid__row-heading.ren-r-${r}`;
    const columnHeadingSelector = (c) =>
        `.${dataGridGuid} .ren-data-grid__column-heading.ren-c-${c}`;
    const allRowHeadingsSelector = `.${dataGridGuid} .ren-data-grid__row-heading`;
    const allColumnHeadingsSelector = `.${dataGridGuid} .ren-data-grid__column-heading`;

    const getColours = () => ({
        border: Ren.Theme.cssValue("cell-selection-border-colour", "#217346"),
        headingBackground: Ren.Theme.cssValue("cell-selection-heading-background", "#D2D2D2"),
        headingText: Ren.Theme.cssValue("cell-selection-heading-colour", "#217346")
    });

    /**
     * Gets the style colouring the given edges of a cell.  The edges are the grid lines themselves,
     * so the outline is no thicker than they are.  Cells have no right border, so a block's right
     * edge is the left border of the next column's cells, and its bottom edge the top border of the
     * next row's cells, whose top overlaps it.  Only a block at the grid's right edge has its right
     * edge drawn as an inset box shadow instead.
     */
    const getEdgesStyle = (mask, colour) => {

        let style = "";

        if (mask & TOP) style += `border-top-color:${colour}!important;`;
        if (mask & BOTTOM) style += `border-bottom-color:${colour}!important;`;
        if (mask & LEFT) style += `border-left-color:${colour}!important;`;
        if (mask & RIGHT) style += `box-shadow:inset -1px 0 0 ${colour}!important;`;

        return style;
    };

    /**
     * Sorts and merges the extents that line up and touch along the given axis, so that the rect
     * per row of a row selection (or per column of a column selection) is outlined as one block.
     */
    const mergeAlongAxis = (extents, isVertical) => {

        const alongMin = isVertical ? "minY" : "minX";
        const alongMax = isVertical ? "maxY" : "maxX";
        const acrossMin = isVertical ? "minX" : "minY";
        const acrossMax = isVertical ? "maxX" : "maxY";

        extents.sort((a, b) =>
            a[acrossMin] - b[acrossMin] ||
            a[acrossMax] - b[acrossMax] ||
            a[alongMin] - b[alongMin]);

        const merged = [];

        for (let i = 0; i < extents.length; i++) {

            const extent = extents[i];
            const last = merged.length > 0 ? merged[merged.length - 1] : null;

            if (last &&
                last[acrossMin] === extent[acrossMin] &&
                last[acrossMax] === extent[acrossMax] &&
                extent[alongMin] <= last[alongMax] + 1) {

                last[alongMax] = Math.max(last[alongMax], extent[alongMax]);
            }
            else {

                merged.push({
                    minX: extent.minX,
                    maxX: extent.maxX,
                    minY: extent.minY,
                    maxY: extent.maxY
                });
            }
        }

        return merged;
    };

    /**
     * Gets the SQL column index of the first visible column from the given display X position
     * towards the other, or null if none is visible, as a hidden column cannot show an edge.
     */
    const getVisibleColIndex = (fromX, toX) => {

        const step = fromX <= toX ? 1 : -1;

        for (let x = fromX; x !== toX + step; x += step) {

            const c = dataGroupingSettings.getColIndex(x);

            if (c !== undefined && gridState.isColumnVisible(c)) return c;
        }

        return null;
    };

    const addMask = (masks, key, mask) => {

        masks.set(key, (masks.get(key) || 0) | mask);
    };

    /**
     * Adds the border and heading styles for the given selection rects to the given array.  They
     * must come after the selection's own styles, which they override.
     */
    const addOutlineStyles = (styles, rects) => {

        if (rects.length === 0) return;

        const colours = getColours();

        const extents = mergeAlongAxis(
            mergeAlongAxis(rects.map(rect => rectCalculator.getRectExtent(rect)), true),
            false
        );

        const firstCell = firstLastCell.getFirstCell();
        const lastCell = firstLastCell.getLastCell();

        // Edges running the full height or width of the grid are drawn with a rule per column or
        // row, rather than one per cell, and the cells where they cross get a rule of their own.
        const rowMasks = new Map();
        const columnMasks = new Map();
        const cellMasks = new Map();

        const headingRowIndexes = new Set();
        const headingColIndexes = new Set();
        let areAllRowHeadingsSelected = false;
        let areAllColumnHeadingsSelected = false;

        for (let i = 0; i < extents.length; i++) {

            const extent = extents[i];

            const leftC = getVisibleColIndex(extent.minX, extent.maxX);

            if (leftC === null) continue;

            const rightC = getVisibleColIndex(extent.maxX, extent.minX);
            const topR = dataGroupingSettings.getRowIndex(extent.minY);
            const bottomR = dataGroupingSettings.getRowIndex(extent.maxY);

            const nextC = extent.maxX < lastCell.x
                ? getVisibleColIndex(extent.maxX + 1, lastCell.x)
                : null;

            const previousR = extent.minY > firstCell.y
                ? dataGroupingSettings.getRowIndex(extent.minY - 1)
                : null;

            const nextR = extent.maxY < lastCell.y
                ? dataGroupingSettings.getRowIndex(extent.maxY + 1)
                : null;

            // The right edge is the next column's left border, unless there is no next column.
            const rightEdgeC = nextC === null ? rightC : nextC;
            const rightEdgeMask = nextC === null ? RIGHT : LEFT;

            const isFullHeight = extent.minY <= firstCell.y && extent.maxY >= lastCell.y;
            const isFullWidth = extent.minX <= firstCell.x && extent.maxX >= lastCell.x;

            const rowIndexesIncHeadings = isFullHeight
                ? null
                : rectCalculator.getRectExtentRowIndexes(extent);

            if (isFullHeight) {

                addMask(columnMasks, leftC, LEFT);
                addMask(columnMasks, rightEdgeC, rightEdgeMask);
                areAllRowHeadingsSelected = true;
            }
            else {

                for (let j = 0; j < rowIndexesIncHeadings.length; j++) {

                    const r = rowIndexesIncHeadings[j];

                    addMask(cellMasks, leftC + "," + r, LEFT);
                    addMask(cellMasks, rightEdgeC + "," + r, rightEdgeMask);
                    headingRowIndexes.add(r);
                }
            }

            // The bottom cells' own bottom border is also coloured, as it shows where no row
            // directly follows, such as above a gap row. Likewise the previous row's bottom border,
            // as that row overlaps the top cells' top border when it comes later in the DOM, as a
            // group row above its first child row does.
            if (isFullWidth) {

                addMask(rowMasks, topR, TOP);
                addMask(rowMasks, bottomR, BOTTOM);
                if (previousR !== null) addMask(rowMasks, previousR, BOTTOM);
                if (nextR !== null) addMask(rowMasks, nextR, TOP);
                areAllColumnHeadingsSelected = true;
            }
            else {

                for (let x = extent.minX; x <= extent.maxX; x++) {

                    const c = dataGroupingSettings.getColIndex(x);

                    addMask(cellMasks, c + "," + topR, TOP);
                    addMask(cellMasks, c + "," + bottomR, BOTTOM);
                    if (previousR !== null) addMask(cellMasks, c + "," + previousR, BOTTOM);
                    if (nextR !== null) addMask(cellMasks, c + "," + nextR, TOP);
                    headingColIndexes.add(c);
                }
            }
        }

        rowMasks.forEach((rowMask, r) => {

            styles.push(rowSelector(r) + ` { ${getEdgesStyle(rowMask, colours.border)} }`);

            columnMasks.forEach((columnMask, c) => {

                addMask(cellMasks, c + "," + r, rowMask | columnMask);
            });
        });

        columnMasks.forEach((columnMask, c) => {

            styles.push(columnSelector(c) + ` { ${getEdgesStyle(columnMask, colours.border)} }`);
        });

        cellMasks.forEach((mask, key) => {

            const separatorIndex = key.indexOf(",");
            const c = +key.substring(0, separatorIndex);
            const r = +key.substring(separatorIndex + 1);
            const fullMask = mask | (rowMasks.get(r) || 0) | (columnMasks.get(c) || 0);

            styles.push(cellSelector(c, r) + ` { ${getEdgesStyle(fullMask, colours.border)} }`);
        });

        const headingStyle =
            `background-color:${colours.headingBackground}!important;` +
            `color:${colours.headingText}!important;`;

        const rowHeadingStyle = headingStyle + `border-right-color:${colours.border}!important;`;
        const columnHeadingStyle =
            headingStyle + `border-bottom-color:${colours.border}!important;`;

        if (areAllRowHeadingsSelected) {

            styles.push(allRowHeadingsSelector + ` { ${rowHeadingStyle} }`);
        }
        else {

            headingRowIndexes.forEach(r => {

                styles.push(rowHeadingSelector(r) + ` { ${rowHeadingStyle} }`);
            });
        }

        if (areAllColumnHeadingsSelected) {

            styles.push(allColumnHeadingsSelector + ` { ${columnHeadingStyle} }`);
        }
        else {

            headingColIndexes.forEach(c => {

                styles.push(columnHeadingSelector(c) + ` { ${columnHeadingStyle} }`);
            });
        }
    };

    return {
        addOutlineStyles
    };
};
