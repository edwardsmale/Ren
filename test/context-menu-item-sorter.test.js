/**
 * Sorting a root menu's items by section, with the host's cell menu sections placed after the
 * clicked module's own and before Search.
 */

const sectionsOf = (menuItems) => {

    const sections = [];

    for (let i = 0; i < menuItems.length; i++) {
        sections.push(menuItems[i].section);
    }

    return sections;
};

const itemsIn = (sections) => {

    const menuItems = [];

    for (let i = 0; i < sections.length; i++) {
        menuItems.push({ section: sections[i], text: sections[i] });
    }

    return menuItems;
};

test("sortMenuItems_NoCellMenuSections_SortsUnnamedSectionsFirst", () => {

    const menuItems = itemsIn(["Search", "Customer", "View settings"]);

    Ren.ContextMenuItemSorter().sortMenuItems(menuItems);

    expect(sectionsOf(menuItems)).toEqual(["Customer", "View settings", "Search"]);
});

test("sortMenuItems_CellMenuSections_PlacesThemInOrderBeforeSearch", () => {

    Ren.configure({ cellMenuSections: ["Order", "Customer"] });
    const menuItems = itemsIn(["Search", "Customer", "View settings", "Order"]);

    Ren.ContextMenuItemSorter().sortMenuItems(menuItems);

    expect(sectionsOf(menuItems)).toEqual(["View settings", "Order", "Customer", "Search"]);
});
