/**
 * Highlights tiles on a task board, by their element IDs, in the board's own dynamic stylesheets:
 * the tile gone to from a reference to it, until the next click, and the tiles named by the
 * reference or prerequisites list under the mouse.
 */
Ren.TaskBoardHighlights = (() => {

    const stylesheetsByName = new Map();

    const getStylesheet = (boardKey, name) => {

        const stylesheetName = "task-board-" + boardKey + "-" + name;

        if (!stylesheetsByName.has(stylesheetName)) {

            stylesheetsByName.set(
                stylesheetName,
                Ren.DynamicStylesheets.setupDynamicStylesheet(null, stylesheetName)
            );
        }

        return stylesheetsByName.get(stylesheetName);
    };

    const getSelector = (anchorIds) => anchorIds
        .map(anchorId => "#" + CSS.escape(anchorId))
        .join(", ");

    const clearTargeted = (boardKey) => getStylesheet(boardKey, "targeted").updateIfChanged([]);

    /**
     * Outlines the tile with the given element ID until the next click anywhere.
     */
    const showTargeted = (boardKey, anchorId) => {

        getStylesheet(boardKey, "targeted")
            .updateIfChanged([getSelector([anchorId]) + " { outline-color: #3046b8; }"]);

        // Added after this click has finished, so that it isn't the click that removes it.
        setTimeout(() => {

            document.addEventListener(
                "pointerdown",
                () => clearTargeted(boardKey),
                { capture: true, once: true }
            );
        });
    };

    /**
     * Highlights the tiles with the given element IDs, or none for an empty list.
     */
    const showHovered = (boardKey, anchorIds) => {

        const styles = anchorIds.length
            ? [getSelector(anchorIds) + " { background-color: #fff1a8; }"]
            : [];

        getStylesheet(boardKey, "hovered").updateIfChanged(styles);
    };

    return {
        showHovered,
        showTargeted
    };
})();
