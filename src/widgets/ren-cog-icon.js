/**
 * The cog drawn on the buttons that open a settings window, such as a date/value chart's and a
 * filter module item's.
 */
Ren.CogIcon = (() => {

    /**
     * Gets the outline of a cog of eight teeth with a hole through its middle, in a 24-unit square,
     * filled even-odd so that the hole is left empty.
     */
    const getCogPath = () => {

        const TEETH = 8;
        const CENTRE = 12;
        const TIP_RADIUS = 11.5;
        const ROOT_RADIUS = 8.4;
        const HOLE_RADIUS = 3.9;

        // Half the width of a tooth, the same at its tip as at its root, so that it is square.
        const HALF_TOOTH_WIDTH = 2.4;

        const point = (radius, angle) =>
            (CENTRE + radius * Math.sin(angle)).toFixed(2) + " " +
            (CENTRE - radius * Math.cos(angle)).toFixed(2);

        const commands = [];

        for (let tooth = 0; tooth < TEETH; tooth++) {

            const angle = tooth * 2 * Math.PI / TEETH;
            const rootHalfAngle = Math.asin(HALF_TOOTH_WIDTH / ROOT_RADIUS);
            const tipHalfAngle = Math.asin(HALF_TOOTH_WIDTH / TIP_RADIUS);

            commands.push(
                (tooth ? "A " + ROOT_RADIUS + " " + ROOT_RADIUS + " 0 0 1 " : "M ") +
                    point(ROOT_RADIUS, angle - rootHalfAngle),
                "L " + point(TIP_RADIUS, angle - tipHalfAngle),
                "A " + TIP_RADIUS + " " + TIP_RADIUS + " 0 0 1 " + point(TIP_RADIUS, angle + tipHalfAngle),
                "L " + point(ROOT_RADIUS, angle + rootHalfAngle)
            );
        }

        commands.push(
            "A " + ROOT_RADIUS + " " + ROOT_RADIUS + " 0 0 1 " +
                point(ROOT_RADIUS, -Math.asin(HALF_TOOTH_WIDTH / ROOT_RADIUS)),
            "Z",
            "M " + point(HOLE_RADIUS, 0),
            "A " + HOLE_RADIUS + " " + HOLE_RADIUS + " 0 1 0 " + point(HOLE_RADIUS, Math.PI),
            "A " + HOLE_RADIUS + " " + HOLE_RADIUS + " 0 1 0 " + point(HOLE_RADIUS, 0),
            "Z"
        );

        return commands.join(" ");
    };

    const COG_PATH = getCogPath();

    /**
     * Creates a cog icon of the given size in pixels, with the given class.
     */
    const create = (className, sizePx) => {

        const icon = document.createElementNS(Ren.Svg.NAMESPACE, "svg");
        const path = document.createElementNS(Ren.Svg.NAMESPACE, "path");
        const size = String(sizePx || 14);

        // Sized here as well as in its style, as an icon with only a viewBox shrinks to nothing in
        // a button sized to its content.
        icon.setAttribute("viewBox", "0 0 24 24");
        icon.setAttribute("width", size);
        icon.setAttribute("height", size);
        icon.setAttribute("aria-hidden", "true");
        icon.classList.add(className);

        path.setAttribute("d", COG_PATH);
        path.setAttribute("fill-rule", "evenodd");

        icon.appendChild(path);

        return icon;
    };

    return {
        create
    };
})();
