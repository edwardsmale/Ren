/**
 * SVG path data for the charts' lines and areas: straight
 * ("linear") or as a B-spline through the points ("basis"), with coordinates to 3 decimal places.
 *
 * Each takes runs of points, a run being a stretch of the line unbroken by a missing datum.
 */
Ren.ChartPaths = (() => {

    const LINEAR = "linear";
    const BASIS = "basis";

    const formatNumber = value => Math.round(value * 1000) / 1000;

    const formatPoint = (x, y) => formatNumber(x) + "," + formatNumber(y);

    /**
     * Gets a cubic Bézier segment of the B-spline through a, b and c.
     */
    const getBasisSegment = (a, b, c) =>
        "C" + formatPoint((2 * a[0] + b[0]) / 3, (2 * a[1] + b[1]) / 3) +
        "," + formatPoint((a[0] + 2 * b[0]) / 3, (a[1] + 2 * b[1]) / 3) +
        "," + formatPoint((a[0] + 4 * b[0] + c[0]) / 6, (a[1] + 4 * b[1] + c[1]) / 6);

    /**
     * Gets the path through a run, begun with a move, or with a line where it carries on from the
     * path before it.
     */
    const getRunPath = (points, curve, isContinuing) => {

        let path = (isContinuing ? "L" : "M") + formatPoint(points[0][0], points[0][1]);
        const count = points.length;

        if (curve !== BASIS || count === 2) {

            for (let i = 1; i < count; i++) {
                path += "L" + formatPoint(points[i][0], points[i][1]);
            }

            return path;
        }

        if (count < 2) return path;

        path += "L" + formatPoint(
            (5 * points[0][0] + points[1][0]) / 6,
            (5 * points[0][1] + points[1][1]) / 6
        );

        for (let i = 2; i < count; i++) {
            path += getBasisSegment(points[i - 2], points[i - 1], points[i]);
        }

        const last = points[count - 1];

        return path +
            getBasisSegment(points[count - 2], last, last) +
            "L" + formatPoint(last[0], last[1]);
    };

    /**
     * Gets a line's path, or null with no points.  A run of one point is closed.
     *
     * @param {Array} runs - The runs, each an array of [x, y].
     * @param {string} [curve] - LINEAR (the default) or BASIS.
     */
    const getLinePath = (runs, curve) => {

        let path = "";

        for (let i = 0; i < runs.length; i++) {

            path += getRunPath(runs[i], curve, false);

            if (runs[i].length === 1) path += "Z";
        }

        return path || null;
    };

    /**
     * Gets an area's path, along the top of each run and back along its base, or null with no
     * points.
     *
     * @param {Array} runs - The runs, each an array of [x, y, baseY].
     * @param {string} [curve] - LINEAR (the default) or BASIS.
     */
    const getAreaPath = (runs, curve) => {

        let path = "";

        for (let i = 0; i < runs.length; i++) {

            const run = runs[i];
            const base = new Array(run.length);

            for (let j = 0; j < run.length; j++) {

                const point = run[run.length - 1 - j];

                base[j] = [point[0], point[2]];
            }

            path += getRunPath(run, curve, false) + getRunPath(base, curve, true) + "Z";
        }

        return path || null;
    };

    return {
        LINEAR,
        BASIS,
        getLinePath,
        getAreaPath
    };
})();
