/**
 * Draws the one context menu that can be open at a time, holding what is open as a model rather
 * than re-deriving it from the DOM.
 */
Ren.ContextMenuRenderer = (() => {

    // One entry per menu on screen, outermost first.
    const openMenus = [];

    // Set by Shift being held on the right-click that opened the root menu, and kept for its
    // submenus and rebuilds, so techOnly items show throughout that one menu.  Always on in the
    // editor.
    let isTechMode = false;

    // Rebuilds the root menu's items from their source, where it can, for a reopen to show.
    let rebuildRootMenuItems = null;

    // The item under the pointer that has an onmouseleave, which a menu removed from under the
    // pointer would otherwise never call.
    let hoveredMenuItem = null;

    const resolve = (value) => typeof value === "function" ? value() : value;

    const isOpen = () => openMenus.length > 0;

    const leaveHoveredMenuItem = () => {

        if (!hoveredMenuItem) return;

        const menuItem = hoveredMenuItem;
        hoveredMenuItem = null;

        menuItem.onmouseleave();
    };

    const close = () => {

        leaveHoveredMenuItem();
        Ren.HtmlUtils.removeElements(".ren-context-menu");
        openMenus.length = 0;
    };

    /**
     * Closes every menu opened beneath the given one.
     */
    const closeMenusBelow = (menu) => {

        while (openMenus.length && Ren.ArrayUtils.last(openMenus) !== menu) {

            openMenus.pop().element.remove();
        }

        if (menu.openSubmenuItemElement) {

            menu.openSubmenuItemElement._removeClass("ren-is-submenu-open");
            menu.openSubmenuItemElement = null;
        }
    };

    /**
     * Runs a menu item's action, if it has one.  An action needing what the menu was opened on
     * reads Ren.LastRightClickTarget.
     */
    const invokeAction = (menuItem, menuItemElement) => {

        if (!menuItem.action) return;

        menuItem.action.apply(menuItemElement, menuItem.actionParameters ?? []);
    };

    /**
     * Settles what the menu will show before any of it is built, so that no heading or separator is
     * stranded above hidden items.  Returns { kind: "heading" | "separator" | "item" } entries.
     */
    const prepareEntries = (menuItems) => {

        const isVisible = (menuItem) =>
            (!menuItem.techOnly || isTechMode) && (!menuItem.visible || menuItem.visible());

        // Separators and headings are dropped when they have no item to sit beside.
        const isVisibleItem = (menuItem) =>
            menuItem.text !== "-" && !menuItem.heading && isVisible(menuItem);

        const visibleItems = [];

        for (let i = 0; i < menuItems.length; i++) {

            const menuItem = menuItems[i];

            if (!isVisible(menuItem)) continue;

            // An item whose submenu is all hidden has nothing to open.
            if (menuItem.submenu && !menuItem.submenu.some(isVisibleItem)) continue;

            visibleItems.push({ menuItem, itemIndex: i });
        }

        const sections = new Set();

        for (let i = 0; i < visibleItems.length; i++) {

            const menuItem = visibleItems[i].menuItem;

            // An item kept at the end of the menu sits apart from the sections, so doesn't count.
            if (menuItem.text !== "-" && !menuItem.heading && !menuItem.positionAtEndOfMenu) {
                sections.add(menuItem.section);
            }
        }

        const showSectionHeadings = sections.size > 1;

        const entries = [];
        const seenSections = new Set();

        const lastEntryIsItem = () =>
            entries.length > 0 && Ren.ArrayUtils.last(entries).kind === "item";

        for (let i = 0; i < visibleItems.length; i++) {

            const menuItem = visibleItems[i].menuItem;

            // A standalone heading titles the whole menu, however many sections there are.
            if (menuItem.heading) {

                entries.push({ kind: "heading", text: menuItem.heading });
                continue;
            }

            // A separator needs an item on both sides of it.
            if (menuItem.text === "-") {

                if (lastEntryIsItem()) entries.push({ kind: "separator" });
                continue;
            }

            if (menuItem.section && !seenSections.has(menuItem.section)) {

                seenSections.add(menuItem.section);

                if (lastEntryIsItem()) entries.push({ kind: "separator" });

                // A section whose heading is hidden is set apart by the separator alone.
                if (showSectionHeadings && !menuItem.hideSectionHeading) {

                    entries.push({ kind: "heading", text: menuItem.section });
                }
            }

            entries.push({
                kind: "item",
                menuItem: menuItem,
                itemIndex: visibleItems[i].itemIndex
            });
        }

        // Trailing punctuation has nothing beneath it.
        while (entries.length && Ren.ArrayUtils.last(entries).kind !== "item") entries.pop();

        return entries;
    };

    /**
     * Moves a menu so that it is not off the bottom or the right-hand side of the window.
     */
    const ensureMenuNotOffScreen = (menuElement, parentMenuElement, viewportSize) => {

        // Everything is measured up front and the moves worked out arithmetically, so that they
        // cost a single layout rather than one per step.
        const menuSize = Ren.HtmlUtils.getOuterSize(menuElement);
        const menuRect = menuElement.getBoundingClientRect();
        const menuTop = menuElement.offsetTop;
        const menuLeft = menuElement.offsetLeft;
        const parentMenuLeft = parentMenuElement ? parentMenuElement.offsetLeft : 0;

        const menuHeight = menuSize.height;
        const menuWidth = menuSize.width;
        const windowHeight = viewportSize.height;
        const windowWidth = viewportSize.width;
        // A margin of 8 (0.5rem) is kept between the menu and the bottom edge, but no further up
        // than the window's top, as a menu too tall to fit is better off running past the bottom
        // edge.
        const bottomOverhang = menuRect.top + menuHeight + 8 - windowHeight;

        if (bottomOverhang > 0) {

            const upBy = Math.min(bottomOverhang, menuRect.top);
            menuElement.style.top = (menuTop - upBy) + "px";
        }

        // Moving up leaves the left edge where it was, so the rectangle read above still holds.
        if (parentMenuElement) {

            if (menuRect.left + menuWidth >= windowWidth) {

                menuElement.style.left = (parentMenuLeft - menuWidth) + "px";
            }
        }
        else {

            // A margin of 10 is kept between the menu and the right-hand edge.
            const rightOverhang = menuRect.left + menuWidth + 10 - windowWidth;

            if (rightOverhang > 0) {

                menuElement.style.left = (menuLeft - rightOverhang) + "px";
            }
        }
    };

    /**
     * Makes a menu draggable by its title bar.
     */
    const makeDraggable = (menuElement) => {

        menuElement.onmousedown = (e) => {

            // Reaching the window would clear the focused visualisation.  The capture-phase
            // windowMouseDown listener has already run, so popup window close logic is unaffected.
            e.stopPropagation();

            const draggedElement = e.target.closest(".ren-context-menu");

            Ren.Messages.Events.dragStarted.notify();

            const menuOffset = draggedElement.getBoundingClientRect();
            const innerX = e.clientX - menuOffset.left;
            const innerY = e.clientY - menuOffset.top;

            const mouseMoveHandler = (e) => {

                draggedElement.style.left = (e.clientX - innerX + window.scrollX) + "px";
                draggedElement.style.top = (e.clientY - innerY + window.scrollY) + "px";

                return false;
            };

            const mouseUpHandler = () => {

                document.removeEventListener("mousemove", mouseMoveHandler);
                document.removeEventListener("mouseup", mouseUpHandler);

                Ren.Messages.Events.dragEnded.notify();
            };

            document.addEventListener("mousemove", mouseMoveHandler);
            document.addEventListener("mouseup", mouseUpHandler);
        };
    };

    /**
     * Opens a submenu alongside the item that owns it, recording which item that was so the menu
     * can be rebuilt as it stands.
     */
    const openSubmenu = (parentMenu, menuItemElement, submenuItems, itemIndex) => {

        const menuItemRect = menuItemElement.getBoundingClientRect();

        // With the +10/+32 renderMenu adds to an inexact position, these offsets put the submenu's
        // first item alongside its opener.
        const position = {
            x: menuItemRect.left + window.scrollX + parentMenu.element.offsetWidth - 12,
            y: menuItemRect.top + window.scrollY - 32
        };

        parentMenu.openSubmenuItemIndex = itemIndex;

        // Stays highlighted while its submenu is open, however far the pointer moves into it.
        parentMenu.openSubmenuItemElement = menuItemElement._addClass("ren-is-submenu-open");

        renderMenu(submenuItems, position, parentMenu, false);
    };

    /**
     * Builds one menu - root or submenu - and puts it on screen.
     */
    const renderMenu = (menuItems, position, parentMenu, useExactPosition) => {

        const menuElement = Ren.HtmlUtils.append(
            Ren.HtmlUtils.create("div")
                ._addClass("ren-context-menu"),
            Ren.HtmlUtils.create("div")
                ._addClass("ren-context-menu__title-bar")
        );

        const menu = {
            element: menuElement,
            menuItems: menuItems,
            openSubmenuItemIndex: -1,
            openSubmenuItemElement: null
        };

        openMenus.push(menu);

        const entries = prepareEntries(menuItems);

        for (let i = 0; i < entries.length; i++) {

            const entry = entries[i];

            if (entry.kind === "heading") {

                menuElement.appendChild(
                    Ren.HtmlUtils.create("div")
                        ._addClass("ren-context-menu__section-heading")
                        ._set("innerText", entry.text)
                );

                continue;
            }

            if (entry.kind === "separator") {

                menuElement.appendChild(
                    Ren.HtmlUtils.create("div")
                        ._addClass("ren-context-menu__item", "ren-context-menu__item--separator")
                );

                continue;
            }

            menuElement.appendChild(renderMenuItem(menu, entry));
        }

        menuElement.style.left = (useExactPosition ? position.x : position.x + 10) + "px";
        menuElement.style.top = (useExactPosition ? position.y : position.y + 32) + "px";

        makeDraggable(menuElement);

        // Measured before the menu goes in, as a menu overhanging the edge brings up scrollbars
        // that shrink the viewport, and window.innerWidth/innerHeight count the scrollbars in.
        // Fitting the menu to either measure leaves it under the scrollbars, keeping them there.
        // In quirks mode the root element measures the whole document, and the body the viewport.
        const viewportElement = document.compatMode === "BackCompat"
            ? document.body
            : document.documentElement;

        const viewportSize = {
            width: viewportElement.clientWidth,
            height: viewportElement.clientHeight
        };

        document.body.appendChild(menuElement);

        // A menu being rebuilt where it already stands has nowhere better to go.
        if (!useExactPosition) {

            ensureMenuNotOffScreen(
                menuElement,
                parentMenu ? parentMenu.element : null,
                viewportSize
            );
        }

        return menu;
    };

    /**
     * Builds a single clickable menu item.
     */
    const renderMenuItem = (menu, entry) => {

        const menuItem = entry.menuItem;

        const menuItemElement = Ren.HtmlUtils.create("div")
            ._addClass("ren-context-menu__item", "ren-context-menu__item--clickable")
            ._set("textContent", resolve(menuItem.text));

        // Lets a rebuild find the item that opened a submenu.
        menuItemElement.setAttribute("data-menu-item-index", entry.itemIndex);

        if (menuItem.id) menuItemElement.id = resolve(menuItem.id);

        if (menuItem.title) menuItemElement.title = resolve(menuItem.title);

        if (menuItem.className) {

            menuItemElement._addClass(resolve(menuItem.className).replace(/\s/g, "-"));
        }

        // A ticked item is a toggle, and shows its state rather than opening anything.
        const hasSubmenu = !!menuItem.submenu && !menuItem.ticked;

        if (menuItem.ticked) {

            menuItemElement._addClass("ren-context-menu__item--toggle-boolean");

            if (resolve(menuItem.ticked)) menuItemElement._addClass("ren-is-checked");
        }

        if (hasSubmenu) {

            menuItemElement._addClass("ren-context-menu__item--submenu");

            // An ID from its text lets an unnamed submenu item be addressed as a named one can.
            if (!menuItemElement.id) {

                menuItemElement.id =
                    Ren.TextUtils.convertToKebabCase(menuItemElement.textContent);
            }
        }

        menuItemElement.onmouseover = () => {

            closeMenusBelow(menu);

            if (hasSubmenu) openSubmenu(menu, menuItemElement, menuItem.submenu, entry.itemIndex);
        };

        menuItemElement.onmouseenter = () => {

            if (menuItem.onmouseleave) hoveredMenuItem = menuItem;

            if (menuItem.onmouseenter) {

                menuItem.onmouseenter();
            }
        };

        menuItemElement.onmouseleave = () => {

            if (hoveredMenuItem === menuItem) leaveHoveredMenuItem();
        };

        menuItemElement.onclick = () => {

            if (!menuItem.action && !menuItem.hyperlink && !menuItem.popupReport) return;

            invokeAction(menuItem, menuItemElement);

            if (menuItem.hyperlink) window.open(menuItem.hyperlink(), "_blank");

            if (menuItem.popupReport) {

                if (Ren.UrlContext.isDownloadedReport()) {

                    // A downloaded report opens the popup in a new tab, against the reporting
                    // server.
                    window.open(Ren.HostUrls.reportUrl(menuItem.popupReport()), "_blank");
                }
                else {

                    Ren.ShowPopupReport(
                        menuItem.popupReport(),
                        menuItem.popupReportTitle(),
                        menuItem.popupReportZoom,
                        {
                            popupWidth: menuItem.popupReportWidth,
                            popupHeight: menuItem.popupReportHeight,
                            scalePopupContentToFit: menuItem.popupReportScaleContentToFit
                        }
                    );
                }
            }

            close();
        };

        // Right-clicking applies an item without dismissing the menu, so a run of changes can be
        // made.
        menuItemElement.oncontextmenu = (e) => {

            if (e.ctrlKey) return; // Show the browser's context menu.

            e.preventDefault();
            e.stopPropagation();

            invokeAction(menuItem, menuItemElement);

            // Many actions only queue their change, which the ticks would otherwise not yet show.
            Ren.MessageBus.sendQueuedMessages();

            reopen();
        };

        return menuItemElement;
    };

    /**
     * Rebuilds the open menus where they stand, so their labels and ticks reflect a right-clicked
     * item's change.
     */
    const reopen = () => {

        if (!isOpen()) return;

        const path = [];

        for (let i = 0; i < openMenus.length; i++) {

            path.push({
                menuItems: openMenus[i].menuItems,
                openSubmenuItemIndex: openMenus[i].openSubmenuItemIndex
            });
        }

        // Read from the element, so that a dragged menu is rebuilt where it was dragged to.
        const rootElement = openMenus[0].element;

        const rootPosition = {
            x: parseFloat(rootElement.style.left),
            y: parseFloat(rootElement.style.top)
        };

        close();

        // Items built for what the menu was opened on may be out of date after the change.
        const rootMenuItems = rebuildRootMenuItems
            ? sortRootMenuItems(rebuildRootMenuItems())
            : path[0].menuItems;

        if (!rootMenuItems.length) return;

        renderMenu(rootMenuItems, rootPosition, null, true);

        for (let i = 1; i < path.length; i++) {

            const parentMenu = openMenus[i - 1];
            const previousItem = path[i - 1].menuItems[path[i - 1].openSubmenuItemIndex];
            const itemIndex = findMatchingItemIndex(parentMenu.menuItems, previousItem);

            // The change just applied may have hidden the item that opened this submenu.
            if (itemIndex < 0) break;

            const menuItemElement = parentMenu.element
                .querySelector(`[data-menu-item-index="${itemIndex}"]`);

            const submenuItems = rebuildRootMenuItems
                ? parentMenu.menuItems[itemIndex].submenu
                : path[i].menuItems;

            if (!menuItemElement || !submenuItems) break;

            openSubmenu(parentMenu, menuItemElement, submenuItems, itemIndex);
        }
    };

    /**
     * Gets the index of the item in rebuilt items that stands for a previous item, matched on its
     * ID, else its text, or -1.
     */
    const findMatchingItemIndex = (menuItems, previousItem) => {

        const previousId = resolve(previousItem.id);
        const previousText = resolve(previousItem.text);

        for (let i = 0; i < menuItems.length; i++) {

            if (menuItems[i] === previousItem) return i;
        }

        for (let i = 0; i < menuItems.length; i++) {

            const isMatch = previousId
                ? resolve(menuItems[i].id) === previousId
                : resolve(menuItems[i].text) === previousText;

            if (isMatch) return i;
        }

        return -1;
    };

    // Only root menus are sorted, as they are assembled from contributors that know nothing of each
    // other; a submenu is written by one author in the order meant.
    const sortRootMenuItems = (menuItems) => {

        const sortedMenuItems = menuItems.slice(0);

        Ren.ContextMenuItemSorter().sortMenuItems(sortedMenuItems);

        return sortedMenuItems;
    };

    /**
     * Opens a root menu at the given page position, replacing whatever was open.  In tech mode the
     * menu, and every submenu opened from it, includes the items marked techOnly.  The editor page
     * is always in tech mode.  rebuildMenuItems, if given, collects the items afresh, so that a
     * right-clicked item's change is reflected in which items are shown and what they act on.
     */
    const open = (menuItems, position, techMode, rebuildMenuItems) => {

        close();

        isTechMode = !!techMode || Ren.UrlContext.onEditorPage();
        rebuildRootMenuItems = rebuildMenuItems || null;

        if (!menuItems.length) return;

        renderMenu(sortRootMenuItems(menuItems), position, null, false);
    };

    /**
     * Gets a value indicating whether the open menu is in tech mode.
     */
    const getIsTechMode = () => isTechMode;

    // Clicking anywhere that isn't the menu, or the button that opened it, dismisses it.
    document.addEventListener("click", (e) => {

        if (e.ctrlKey) return;
        if (!e.target.closest) return;
        if (e.target.closest(".js-ren-context-menu-button")) return;
        if (e.target.closest(".ren-context-menu")) return;

        close();
    });

    return {
        open,
        close,
        isOpen,
        getIsTechMode
    };
})();
