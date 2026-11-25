/**
 * Measures the labels of a chart drawn as pies, and finds each a place inside its slice, or outside
 * the pie at the end of a short connector, where it runs into nothing else.
 */
Ren.DateValueChart_PieLabelGeometry = (() => {

    // An outside label's connector runs from just off the rim to where the label starts.
    const CONNECTOR_START_PX = 2;
    const OUTSIDE_LABEL_GAP_PX = 12;

    // How far a label is kept from its slice's edges, and from the other labels.
    const LABEL_PADDING_PX = 2;

    /** Measures a label, and the length of each of its lines. */
    const measure = (textNode) => {

        try {

            const box = textNode.getBBox();

            if (!box.width) return null;

            const lineWidths = [];

            for (let i = 0; i < textNode.children.length; i++) {
                lineWidths.push(textNode.children[i].getComputedTextLength());
            }

            return { width: box.width, height: box.height, lineWidths };
        }
        catch (error) {

            return null;
        }
    };

    /** Gets an angle, clockwise from 12 o'clock, from 0 to 2π, of an offset from a centre. */
    const getAngle = (dx, dy) => {

        const angle = Math.atan2(dx, -dy);

        return angle < 0 ? angle + Math.PI * 2 : angle;
    };

    const getBox = (centreX, centreY, size) => ({
        left: centreX - size.width / 2,
        right: centreX + size.width / 2,
        top: centreY - size.height / 2,
        bottom: centreY + size.height / 2
    });

    /** Gets the distance from a point to the nearest point of a box, 0 where it is inside it. */
    const getDistanceToBox = (x, y, box) => {

        const dx = Math.max(box.left - x, 0, x - box.right);
        const dy = Math.max(box.top - y, 0, y - box.bottom);

        return Math.sqrt(dx * dx + dy * dy);
    };

    /** Gets the distance from a point to the furthest corner of a box. */
    const getFurthestDistanceToBox = (x, y, box) => {

        const dx = Math.max(Math.abs(box.left - x), Math.abs(box.right - x));
        const dy = Math.max(Math.abs(box.top - y), Math.abs(box.bottom - y));

        return Math.sqrt(dx * dx + dy * dy);
    };

    /**
     * Gets a value indicating whether a box lies within a slice, clear of its edges: within the
     * pie's rim, outside its hole, and, for a slice short of the whole pie, with its corners and
     * the middles of its sides all between the slice's two straight edges.
     */
    const isBoxInSlice = (box, centre, slice, holePx, radiusPx) => {

        if (getFurthestDistanceToBox(centre.x, centre.y, box) > radiusPx - LABEL_PADDING_PX) {
            return false;
        }

        const isWhole = slice.endAngle - slice.startAngle >= Math.PI * 2 - 1e-9;
        const innerPx = holePx > 0 || !isWhole ? holePx + LABEL_PADDING_PX : 0;

        if (getDistanceToBox(centre.x, centre.y, box) < innerPx) return false;

        if (isWhole) return true;

        const middleX = (box.left + box.right) / 2;
        const middleY = (box.top + box.bottom) / 2;
        const points = [
            [box.left, box.top], [middleX, box.top], [box.right, box.top],
            [box.right, middleY], [box.right, box.bottom], [middleX, box.bottom],
            [box.left, box.bottom], [box.left, middleY]
        ];

        for (let i = 0; i < points.length; i++) {

            const angle = getAngle(points[i][0] - centre.x, points[i][1] - centre.y);

            if (angle < slice.startAngle || angle > slice.endAngle) return false;
        }

        return true;
    };

    /**
     * Gets the box a label fits in inside its slice, at the middle of the slice's angle, or null
     * where it fits nowhere tried.  A slice of a pie with no hole is tried a little further in
     * and further out too, unless the distances from the centre to try are given.
     */
    const findPlaceInside = (label, centre, holePx, radiusPx, distances) => {

        const slice = label.slice;
        const isWhole = slice.endAngle - slice.startAngle >= Math.PI * 2 - 1e-9;

        if (isWhole && holePx === 0) {

            const box = getBox(centre.x, centre.y, label.size);

            return isBoxInSlice(box, centre, slice, holePx, radiusPx) ? box : null;
        }

        const angle = (slice.startAngle + slice.endAngle) / 2;

        if (!distances) {

            distances = holePx > 0
                ? [(holePx + radiusPx) / 2]
                : [radiusPx * 0.6, radiusPx * 0.45, radiusPx * 0.72];
        }

        for (let i = 0; i < distances.length; i++) {

            const box = getBox(
                centre.x + Math.sin(angle) * distances[i],
                centre.y - Math.cos(angle) * distances[i],
                label.size
            );

            if (isBoxInSlice(box, centre, slice, holePx, radiusPx)) return box;
        }

        return null;
    };

    const boxesOverlap = (a, b) => a.left < b.right + LABEL_PADDING_PX
        && a.right > b.left - LABEL_PADDING_PX
        && a.top < b.bottom + LABEL_PADDING_PX
        && a.bottom > b.top - LABEL_PADDING_PX;

    /**
     * Gets the box a label fits in outside its pie, beyond the middle of its slice's rim, and
     * where its connector starts and ends, or null where it would leave the plot or run into a
     * pie or a label already placed.
     */
    const findPlaceOutside = (label, centre, centres, radiusPx, placedBoxes, plotWidthPx,
        plotHeightPx) => {

        const slice = label.slice;
        const angle = (slice.startAngle + slice.endAngle) / 2;
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        const endDistance = radiusPx + OUTSIDE_LABEL_GAP_PX;
        const endX = centre.x + sin * endDistance;
        const endY = centre.y - cos * endDistance;

        // Stood off from the connector's end on the side facing away from the pie.
        const box = getBox(
            endX + sin * label.size.width / 2,
            endY - cos * label.size.height / 2,
            label.size
        );

        if (box.left < 0 || box.right > plotWidthPx || box.top < 0 || box.bottom > plotHeightPx) {
            return null;
        }

        for (let i = 0; i < centres.length; i++) {

            const distance = getDistanceToBox(centres[i].x, centres[i].y, box);

            if (distance < radiusPx + LABEL_PADDING_PX) return null;
        }

        for (let i = 0; i < placedBoxes.length; i++) {

            if (boxesOverlap(box, placedBoxes[i])) return null;
        }

        return {
            box,
            startX: centre.x + sin * (radiusPx + CONNECTOR_START_PX),
            startY: centre.y - cos * (radiusPx + CONNECTOR_START_PX),
            endX,
            endY
        };
    };

    return {
        CONNECTOR_START_PX,
        OUTSIDE_LABEL_GAP_PX,
        LABEL_PADDING_PX,
        measure,
        getBox,
        getFurthestDistanceToBox,
        isBoxInSlice,
        findPlaceInside,
        findPlaceOutside
    };
})();
