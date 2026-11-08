/**
 * Renders an "Edit" toggle switch in the report header that controls whether the report is in edit
 * mode.  When edit mode is active, popup windows render with a visible box shadow to make their
 * boundaries clear during editing, and certain action buttons also become visible.  Anything
 * inside an element carrying ALWAYS_EDIT_MODE_CLASS_NAME behaves as though edit mode were on.
 */
Ren.ReportEditModeModule = (() => {

    const editModeStylesheetName = "report-edit-mode";

    const ALWAYS_EDIT_MODE_CLASS_NAME = "ren-always-edit-mode";

    let editModeStylesheet = null;

    // Leaves anything in an always-edit-mode scope out of a rule that hides edit-only controls.
    const outsideAlwaysEditMode = (selectors) => selectors
        .split(",")
        .map((selector) => `${selector.trim()}:not(.${ALWAYS_EDIT_MODE_CLASS_NAME} *)`)
        .join(", ");

    const updateEditModeStylesheet = (isEditMode) => {

        const boxShadow = isEditMode
            ? "0 1px 9px 2px #5d5d5d75"
            : "0 1px 0 0 #EFEFFF";

        const styles = [
            `.ren-report-popup-window--popped-in { box-shadow: ${boxShadow}; }`
        ];

        if (isEditMode) {

            // Shows through below the rows, marking the extent of a grid set dragged taller than
            // them and where its resize handle is.
            styles.push(`.ren-grid-set--max-height-resizable .ren-grid-set__viewport { background-color: #F5F5F5; }`);
        }
        else {

            const convertToPopupButton = outsideAlwaysEditMode(
                ".ren-visualisation__convert-to-popup-button"
            );

            styles.push(`${convertToPopupButton} { opacity: 0; pointer-events: none; }`);

            const filterModuleEditControls = outsideAlwaysEditMode(
                ".ren-filter-module__item-include-when-saving, .ren-filter-module__item-remove"
            );

            styles.push(`${filterModuleEditControls} { opacity: 0; pointer-events: none; }`);

            styles.push(
                `${outsideAlwaysEditMode(".ren-filter-module__item-links")} { order: 1; }`
            );

            styles.push(`.ren-report-popup-window--popped-in .ren-report-popup-window__title-bar-drag-handle { opacity: 0; pointer-events: none; }`);
            styles.push(`.ren-report-popup-window--popped-in .ren-report-popup-window__resize-handle { opacity: 0; pointer-events: none; }`);
            styles.push(`.ren-report-popup-window--popped-in .ren-report-popup-window__title-bar { cursor: default; border: none; }`);

            // Selected through its container so this out-specifies the rule giving the window
            // buttons back their mouse events; hidden, the button must let them through to the
            // title bar's drag handle so it doesn't stop the window being dragged.
            styles.push(`.ren-report-popup-window__window-buttons > .ren-report-popup-window__add-to-report-button { opacity: 0; pointer-events: none; }`);
        }

        editModeStylesheet.updateIfChanged(styles);
    };

    let isEditMode = false;

    const initialise = () => {

        editModeStylesheet = Ren.DynamicStylesheets
            .setupDynamicStylesheet(null, editModeStylesheetName);

        const toggle = Ren.ToggleSwitch.create(false);

        updateEditModeStylesheet(false);

        const labelText = Ren.HtmlUtils.create("span")
            ._addClass("ren-report-edit-mode-module__label-text")
            ._text("Edit");

        const module = Ren.HtmlUtils.create("div")
            ._addClass(
                "ren-report-edit-mode-module",
                "js-ren-report-edit-mode-module"
            )
            ._append(labelText, toggle.element);

        module.addEventListener("click", () => {

            isEditMode = !isEditMode;
            toggle.setValue(isEditMode);
            updateEditModeStylesheet(isEditMode);
        });

        Ren.ReportHeaderModule.addItem(module);
    };

    /**
     * The Editor has no edit mode toggle, so edit-only controls stay visible there, other than the
     * 'convert to popup' buttons of the visualisations in popup reports.
     */
    const initialiseForEditorPage = () => {

        editModeStylesheet = Ren.DynamicStylesheets
            .setupDynamicStylesheet(null, editModeStylesheetName);

        editModeStylesheet.updateIfChanged([
            `.ren-report-popup-window--in-popup-report .ren-visualisation__convert-to-popup-button { opacity: 0; pointer-events: none; }`
        ]);
    };

    const remove = () => {

        Ren.HtmlUtils.removeElements(".js-ren-report-edit-mode-module");
    };

    const getIsEditMode = () => isEditMode;

    // Gets a value indicating whether an element is being edited, either because the report is in
    // edit mode or because the element sits in an always-edit-mode scope.
    const getIsEditModeFor = (element) =>
        isEditMode || !!element?.closest?.(`.${ALWAYS_EDIT_MODE_CLASS_NAME}`);

    return {
        ALWAYS_EDIT_MODE_CLASS_NAME,
        initialise,
        initialiseForEditorPage,
        remove,
        getIsEditMode,
        getIsEditModeFor
    };
})();
