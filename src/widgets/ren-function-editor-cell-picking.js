/**
 * Lets the cells of the data grid a function editor was opened from be clicked into its code while
 * the code box has the focus.  The grid works out what a clicked cell is to the function (see
 * Ren.DataGridCellSelection_FunctionEditorCellPicker), and the editor writes it in.
 */
Ren.FunctionEditorCellPicking = (() => {

    // The editors opened from a grid cell, keyed by their code boxes.
    const editors = new Map();

    /**
     * Registers an editor's code box, returning a function that unregisters it.  insertReference
     * ({ parameterName, columnKey, isSourceColumn, aggregationKey }) returns a value indicating
     * whether the editor wrote the reference in.
     */
    const register = (textarea, sourceCellElement, insertReference) => {

        // Held from the start, since the grid may stop rendering the cell while the editor is open.
        const sourceAncestors = [];

        for (let element = sourceCellElement.parentElement; element;
            element = element.parentElement) {

            sourceAncestors.push(element);
        }

        const isOpenedFrom = (element) => sourceAncestors.indexOf(element) !== -1;

        editors.set(textarea, {
            sourceCellElement,
            isOpenedFrom,
            insertReference
        });

        return () => editors.delete(textarea);
    };

    /**
     * Gets the editor whose code box has the focus, where it was opened from a grid cell, or null.
     */
    const getFocusedEditor = () => editors.get(document.activeElement) ?? null;

    return {
        register,
        getFocusedEditor
    };
})();
