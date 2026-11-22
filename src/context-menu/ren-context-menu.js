/**
 * Functions for the context menu system.
 *
 * A host says what menu items it has to offer: Ren.ContextMenuRegistry collects the items a
 * right-click should show, and Ren.ContextMenuRenderer draws them.
 */

/**
 * Adds menu items shown when an element - or anything inside it - is right-clicked.  menuItems is
 * either the items themselves or a function returning them.
 */
Ren.AddContextMenuItems = (element, menuItems) => {

    Ren.SetUpContextMenu().addMenuItems(element, menuItems);
};

/**
 * Adds menu items shown when an element - or anything inside it - is right-clicked, which the
 * element's other menus, however often rebuilt, leave in place.  Adding under the same key again
 * replaces them.
 */
Ren.AddStandingContextMenuItems = (element, key, menuItems) => {

    Ren.ContextMenuRegistry.contributeStanding(element, key, menuItems);
};

/**
 * Marks an element as answering right-clicks itself: no context menu - neither Ren's nor the
 * browser's - is shown over it or anything inside it, leaving its own "contextmenu" listener to say
 * what a right-click there does. Ctrl+right-click still falls through to the browser's own menu, as
 * it does everywhere else.
 */
Ren.SuppressContextMenu = (element) => {

    element.classList.add(Ren.ContextMenuRegistry.SUPPRESSED_CLASS_NAME);
};

/**
 * Marks an element as having a menu of its own: a right-click on it or anything inside it shows the
 * items contributed there, and none of those contributed by the elements around it.
 */
Ren.IsolateContextMenu = (element) => {

    element.classList.add(Ren.ContextMenuRegistry.ISOLATED_CLASS_NAME);
};

/**
 * Adds menu items shown when a button is clicked.  A button's menu is its own: it says what the
 * button does, so it takes nothing from the elements around it and is not shown on right-clicks.
 */
Ren.AddButtonMenuItems = (button, menuItems) => {

    // So that the click which opens the menu isn't also read as a click outside it.
    button.classList.add("js-ren-context-menu-button");

    button.addEventListener("contextmenu", (e) => { e.preventDefault(); }, true);

    button.onclick = (e) => Ren.ContextMenuRegistry.openButtonMenu(button, e);

    Ren.ContextMenuRegistry.contributeToButton(button, menuItems);
};

/**
 * Starts a menu that is built up over several addMenuItems calls - which may be on several
 * elements, as a data grid's are.  Everything added through the one contributor stands or falls
 * together: a host that sets a menu up again over an element it has already contributed to means to
 * replace what it said, since visualisations rebuild their menus on every render over items that
 * close over what was just drawn.
 */
Ren.SetUpContextMenu = () => {

    const contributorId = Ren.ContextMenuRegistry.createContributorId();

    const addMenuItems = (element, menuItems) => {

        Ren.ContextMenuRegistry.contribute(element, contributorId, menuItems);
    };

    return {
        addMenuItems
    };
};
