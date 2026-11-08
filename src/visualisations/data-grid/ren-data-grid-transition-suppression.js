/**
 * Data Grid: turns the cells' and headings' CSS transitions off for the duration of a drag.
 *
 * Dragging a column to a new position, or dragging a column resize handle, moves every cell in the
 * grid at once.  Letting each of them animate to where it has moved to leaves the grid trailing
 * behind the mouse, so both drags turn the transitions off while they run and back on when they
 * finish.
 * They do it with one rule in a dynamic stylesheet scoped to the one grid, rather than with a class
 * on each element: a grid holds a cell for every row of every column, so putting a class on all of
 * them and taking it off again is work proportional to the size of the grid, spent at the moment
 * the drag most needs to keep up with the mouse, whereas the rule costs the same whatever the grid
 * holds.  Both drags sharing this module is also what keeps them suppressing the same elements as
 * each other.
 * One of these is made per grid and given to both drags, since a dynamic stylesheet is identified
 * by its grid and name and so cannot be set up twice.
 */
Ren.DataGridTransitionSuppression = (dataGridGuid) => {

    const suppressionStylesheet = Ren.DynamicStylesheets
        .setupDynamicStylesheet(dataGridGuid, "transition-suppression")
        .getStylesheet();

    const suppressionStyles =
        `.${dataGridGuid} .ren-data-grid__cell,` +
        `.${dataGridGuid} .ren-data-grid__column-heading,` +
        `.${dataGridGuid} .ren-data-grid__row-heading` +
        ` { transition: none !important; }`;

    const suppressTransitions = () => {

        suppressionStylesheet.textContent = suppressionStyles;
    };

    const restoreTransitions = () => {

        suppressionStylesheet.textContent = "";
    };

    return {
        suppressTransitions,
        restoreTransitions
    };
};
