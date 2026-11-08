Ren.DataGridCellSelection_RectCalculator = (dataGroupingSettings) => {

    /**
     * Gets the minimum and maximum x and y values of the rect.
     */
    const getRectExtent = (rect) => {

        if (!Array.isArray(rect)) rect = [rect];

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        for (let i = 0; i < rect.length; i++) {

            const { startCell, endCell } = rect[i];

            const x1 = startCell.x, x2 = endCell.x;
            const y1 = startCell.y, y2 = endCell.y;

            const rectMinX = Math.min(x1, x2);
            const rectMaxX = Math.max(x1, x2);
            const rectMinY = Math.min(y1, y2);
            const rectMaxY = Math.max(y1, y2);

            if (rectMinX < minX) minX = rectMinX;
            if (rectMaxX > maxX) maxX = rectMaxX;
            if (rectMinY < minY) minY = rectMinY;
            if (rectMaxY > maxY) maxY = rectMaxY;
        }

        return { minX, maxX, minY, maxY };
    };

    /**
     * Gets the minimum and maximum x and y values of the cells.
     */
    const getRectExtentFromCells = (cells) => {

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        for (let i = 0; i < cells.length; i++) {

            const { x, y } = cells[i];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }

        return { minX, maxX, minY, maxY };
    };

    /**
     * Gets the row indexes (including headings), that are included in the given rect.
     */
    const getRectExtentRowIndexes = (rect) =>
        Array.from(
            { length: rect.maxY - rect.minY + 1 },
            (_, i) => dataGroupingSettings.getRowIndex(rect.minY + i)
        );

    /**
     * Gets the SQL column indexes that are included in the given rect.
     * rect.minX/maxX are display X positions; this converts them to SQL column indexes.
     */
    const getRectExtentColumnIndexes = (rect) =>
        Array.from(
            { length: rect.maxX - rect.minX + 1 },
            (_, i) => dataGroupingSettings.getColIndex(rect.minX + i)
        );

    return {
        getRectExtent,
        getRectExtentFromCells,
        getRectExtentRowIndexes,
        getRectExtentColumnIndexes
    };
};
