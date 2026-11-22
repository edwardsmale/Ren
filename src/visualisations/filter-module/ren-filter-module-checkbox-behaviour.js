/**
 * Filter Module: how an option's checkbox responds to the mouse.  Shared by the flat and hierarchy
 * views, so the two cannot drift apart and stop behaving like the same control.
 */
Ren.FilterModule_CheckboxBehaviour = (() => {

    // Leaves the ticked state to the filter alone, the view's syncCheckboxes ticking the checkbox
    // once the change has been through the source filter and come back.
    const letFilterDriveCheckedState = (input, onToggled) => {

        input.addEventListener("click", (event) => {

            event.preventDefault();
            onToggled(event);
        });
    };

    // The menu is still a right-click away on the label text, the value and the gaps around them.
    const letRightClickFilterRatherThanOpenMenu = (input, onRightClicked) => {

        Ren.SuppressContextMenu(input);

        input.addEventListener("contextmenu", (event) => {

            if (event.ctrlKey) return;

            event.preventDefault();
            onRightClicked(event);
        });
    };

    return {
        letFilterDriveCheckedState,
        letRightClickFilterRatherThanOpenMenu
    };
})();
