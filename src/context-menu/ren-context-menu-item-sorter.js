/**
 * Sorts context menu items by section, leaving the items of a section in the order they were
 * contributed.  Only root menus are sorted - submenus are rendered in the order they were written,
 * so their items need no section either.
 */
Ren.ContextMenuItemSorter = () => {

    const CELL_MENU_SECTIONS_SLOT = null;

    /**
     * Creates the section order from Ren's own, with the host's cellMenuSections in their slot.
     */
    const createSectionOrder = (ownSections) => {

        const cellMenuSections = Ren.Config.getConfig().cellMenuSections;
        const sectionOrder = [];

        for (let i = 0; i < ownSections.length; i++) {

            if (ownSections[i] === CELL_MENU_SECTIONS_SLOT) {
                Ren.ArrayUtils.pushAll(sectionOrder, cellMenuSections);
            }
            else {

                sectionOrder.push(ownSections[i]);
            }
        }

        return sectionOrder;
    };

    const insertSeparatorBeforeSection = (menuItems, sectionName) => {

        const index = menuItems.findIndex(item => item.section === sectionName);

        if (index !== -1) {
            menuItems.splice(index, 0, Ren.MENU_SEPARATOR);
        }
    };

    // Moves the items marked positionAtEndOfMenu below a separator at the end, whatever section
    // the others are in.
    const moveItemsToEndOfMenu = (menuItems) => {

        const lastItems = [];
        let writeIndex = 0;

        for (let i = 0; i < menuItems.length; i++) {

            if (menuItems[i].positionAtEndOfMenu) {
                lastItems.push(menuItems[i]);
            }
            else {

                menuItems[writeIndex++] = menuItems[i];
            }
        }

        if (!lastItems.length) return;

        menuItems.length = writeIndex;
        menuItems.push(Ren.MENU_SEPARATOR);
        Ren.ArrayUtils.pushAll(menuItems, lastItems);
    };

    /**
     * Sorts the menu items by section, keeping the items within a section in the order they were
     * contributed.  Array.prototype.sort is stable, so an item's place in its section is decided
     * by where it was written: within one contribution, by the order of the array it was written
     * in; between contributions, by the order they were collected in, which is outermost element
     * first.  An item that must trail its section whatever element contributed the others is
     * marked positionAtEndOfSection, since its place in the contribution order cannot guarantee
     * that.
     */
    const sortMenuItems = (menuItems) => {

        // Creating something from what is selected reads as part of the same thought as the
        // columns the selection is made of, so Create follows Columns rather than trailing the
        // menu.  Editing the tabbed module the click landed in stays at the end, after whatever
        // the clicked thing itself offers.
        //
        // The grid's sections and a chart's never meet - they are contributed by different
        // elements - so the runs below are one list only because there is one order to keep.
        // A chart's axes contribute their own sections on top of the chart's, and what was
        // clicked is what the menu should open with, so those lead: the axis first, then the
        // series clicked, then the chart around them.  A section not named here sorts
        // ahead of every one that is, alphabetically, so a menu that wants a say in where its
        // sections land names all of them here (or, for the host's, in cellMenuSections) rather
        // than choosing a name that sorts where it wants to land.
        const sectionOrder = createSectionOrder([
            // What the clicked module itself is: its own settings and content lead its menu,
            // above whatever the thing inside it that was clicked has to offer.
            "View settings", "Html content", "Uploaded files", "Key/Value Grid",
            "Group Controls", "Download Report", "Menu item", "Visualisations",
            // A filter module's column: what its items show, then how they read and group.
            "Values", "Total value", "Labels", "Grouping",
            // What the clicked cell holds: the kind of thing it is, in the host's cellMenuSections
            // (spliced in here), then the searches any value at all offers.  The reports it is
            // marked up for are unsectioned, so lead the menu.
            CELL_MENU_SECTIONS_SLOT, "Search", "Word Cloud",
            "Columns", "Create", "Data", "Sort", "Filter", "Group", "Aggregation",
            "Functions", "Layout",
            // A chart: the series clicked, then what it plots and which series it draws, then the
            // dates every series is drawn along, then how the whole of it looks.
            "Y-Axis", "X-Axis", "Axis Label", "Series", "Chart data", "Dates",
            "Chart appearance",
            "Tabbed Module", "Tab", "Arrange", "Other", "Tech"
        ]);

        menuItems.sort((a, b) => {

            // An item written without a section - a bare separator, say - stays with the others
            // like it rather than being compared against a name it hasn't got.
            const sectionA = a.section || "";
            const sectionB = b.section || "";

            const oa = sectionOrder.indexOf(sectionA);
            const ob = sectionOrder.indexOf(sectionB);

            if (oa !== ob) return oa - ob;

            if (sectionA === sectionB) {

                const endA = a.positionAtEndOfSection ? 1 : 0;
                const endB = b.positionAtEndOfSection ? 1 : 0;

                return endA - endB;
            }

            return sectionA < sectionB ? -1 : 1;
        });

        insertSeparatorBeforeSection(menuItems, "Data");
        moveItemsToEndOfMenu(menuItems);
    };

    return {
        sortMenuItems
    };
};
