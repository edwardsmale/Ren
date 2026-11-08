/**
 * Holds the menu items each element contributes, and turns a right-click into one menu, collected
 * along the clicked element's ancestor chain outermost first.
 */
Ren.ContextMenuRegistry = (() => {

    // A WeakMap, so contributions do not pin elements that grids and filter modules have rebuilt.
    const rightClickContributorsByElement = new WeakMap();

    // Contributions a re-render does not supersede, as maps of key to buildItems.
    const standingContributorsByElement = new WeakMap();

    // Certain buttons make context menus appear when clicked.
    const buttonContributorsByElement = new WeakMap();

    // What an element does with a right-click inside it before the menu's items are built.
    const rightClickPreparersByElement = new WeakMap();

    let nextContributorId = 1;

    // Set when a right-button drag has consumed the gesture, so the "contextmenu" the browser
    // reports on release shows no menu.
    let nextRightClickMenuSuppressed = false;

    // Marks an element that answers a right-click itself (e.g. a filter module checkbox), over
    // which no menu is shown at all.
    const SUPPRESSED_CLASS_NAME = "js-ren-suppress-context-menu";

    // Marks an element whose menu is its own (e.g. a chart axis), which takes nothing from the
    // elements around it.
    const ISOLATED_CLASS_NAME = "js-ren-isolated-context-menu";

    /**
     * Identifies everything one call to Ren.SetUpContextMenu contributes, so that a host's several
     * addMenuItems calls are known to belong together.
     */
    const createContributorId = () => nextContributorId++;

    /**
     * Suppresses the menu for the next right-click, for a host that has consumed the right-button
     * press itself where the browser reports the right-click on mouse-up (as Windows does).
     */
    const suppressNextRightClickMenu = () => {

        nextRightClickMenuSuppressed = true;
    };

    /**
     * Registers what an element does with a right-click inside it, run before the menu's items
     * are built, so that e.g. a grid selects the right-clicked cell before its items look at the
     * selection.  The menu is built in the capture phase, ahead of any listener of the element's
     * own.  Registering again replaces it.
     */
    const prepareForRightClick = (element, prepare) => {

        rightClickPreparersByElement.set(element, prepare);
    };

    /**
     * Gets an element and its ancestors, innermost first.
     */
    const getAncestors = (element) => {

        const ancestors = [];

        for (; element; element = element.parentElement) ancestors.push(element);

        return ancestors;
    };

    /**
     * Runs the right-click preparers of an element and its ancestors, innermost first.
     */
    const runRightClickPreparers = (ancestors, event) => {

        for (let i = 0; i < ancestors.length; i++) {

            const prepare = rightClickPreparersByElement.get(ancestors[i]);

            if (prepare) prepare(event);
        }
    };

    /**
     * Registers menu items against an element.  menuItems may be a function returning them, which
     * defers building them until the menu opens, for hosts contributing to thousands of elements.
     */
    const contributeTo = (contributorsByElement, element, contributorId, menuItems) => {

        if (typeof menuItems !== "function" && !menuItems.length) return;

        let contributors = contributorsByElement.get(element);

        if (!contributors) {

            contributors = [];
            contributorsByElement.set(element, contributors);
        }

        // Visualisations rebuild their menus on every render, so a newer contributor supersedes
        // older ones on the same element rather than adding to them.
        for (let i = contributors.length - 1; i >= 0; i--) {

            if (contributors[i].contributorId < contributorId) {

                contributors.splice(i, 1);
            }
        }

        contributors.push({
            contributorId,
            buildItems: typeof menuItems === "function" ? menuItems : () => menuItems
        });
    };

    const contribute = (element, contributorId, menuItems) =>
        contributeTo(rightClickContributorsByElement, element, contributorId, menuItems);

    /**
     * Registers menu items against an element that its other contributors do not supersede, for
     * items every visualisation offers whatever it contributes itself.  Contributing again under
     * the same key replaces them.
     */
    const contributeStanding = (element, key, menuItems) => {

        let contributors = standingContributorsByElement.get(element);

        if (!contributors) {

            contributors = new Map();
            standingContributorsByElement.set(element, contributors);
        }

        contributors.set(key, typeof menuItems === "function" ? menuItems : () => menuItems);
    };

    const collectStandingItems = (items, element) => {

        const contributors = standingContributorsByElement.get(element);

        if (!contributors) return;

        contributors.forEach(buildItems => {

            const contributed = buildItems();

            if (!contributed) return;

            for (let i = 0; i < contributed.length; i++) items.push(contributed[i]);
        });
    };

    // Each wiring of a button is a contributor of its own, so replaces any previous wiring's menu.
    const contributeToButton = (button, menuItems) =>
        contributeTo(buttonContributorsByElement, button, createContributorId(), menuItems);

    const collectItems = (items, contributors) => {

        if (!contributors) return;

        for (let i = 0; i < contributors.length; i++) {

            const contributed = contributors[i].buildItems();

            if (!contributed) continue;

            for (let j = 0; j < contributed.length; j++) items.push(contributed[j]);
        }
    };

    /**
     * Collects the items contributed by an element and its ancestors, given innermost first, in the
     * order outermost first, so that a menu reads from the general to the specific.
     */
    const collectItemsForRightClick = (elements) => {

        const items = [];

        for (let i = elements.length - 1; i >= 0; i--) {

            collectStandingItems(items, elements[i]);
            collectItems(items, rightClickContributorsByElement.get(elements[i]));
        }

        return items;
    };

    /**
     * Gets the ancestors, innermost first, whose items a right-click collects: all of them, or
     * those up to and including the innermost with a menu of its own.
     */
    const getMenuContributingAncestors = (ancestors) => {

        for (let i = 0; i < ancestors.length; i++) {

            if (ancestors[i].classList && ancestors[i].classList.contains(ISOLATED_CLASS_NAME)) {
                return ancestors.slice(0, i + 1);
            }
        }

        return ancestors;
    };

    /**
     * Removes items an inner contributor also offers, matched on ID, so that e.g. a grid's Windows
     * menu wins over the page's.  The last collected is the innermost.
     */
    const removeItemsOverriddenByInnerContributors = (items) => {

        const innermostIndexById = new Map();

        for (let i = 0; i < items.length; i++) {

            if (typeof items[i].id === "string") innermostIndexById.set(items[i].id, i);
        }

        const result = [];

        for (let i = 0; i < items.length; i++) {

            if (typeof items[i].id === "string" && innermostIndexById.get(items[i].id) !== i) {
                continue;
            }

            result.push(items[i]);
        }

        return result;
    };

    // The right-clicked element and its ancestors, innermost first.  Kept because a right-clicked
    // menu item applies without closing the menu and may redraw its host, detaching the element
    // from the ancestors that say what it belongs to.
    let rightClickAncestors = [];

    /**
     * Gets the element the menu was opened on or, where a redraw has since replaced it, the
     * innermost of its ancestors still in the document.
     */
    const getRightClickTarget = () => {

        for (let i = 0; i < rightClickAncestors.length; i++) {

            if (rightClickAncestors[i].isConnected) return rightClickAncestors[i];
        }

        return rightClickAncestors.length ? rightClickAncestors[0] : null;
    };

    /**
     * Gets the right-clicked element and its ancestors as they were when the menu opened,
     * innermost first, whether or not a redraw has since taken them out of the document.
     */
    const getRightClickAncestors = () => rightClickAncestors;

    // Read through a property so that every existing reader gets the fallback above.
    Object.defineProperty(
        Ren,
        "LastRightClickTarget",
        { get: getRightClickTarget, configurable: true }
    );

    /**
     * Gets the right-clicked element's ancestors, innermost first, that contributed menu items.
     * This tells the page background apart from a visualisation, whose block-level element spans
     * the full page width and so contains the empty space beside it.
     */
    const getRightClickContributingElements = () => {

        const elements = [];
        const target = getRightClickTarget();

        for (let element = target; element; element = element.parentElement) {

            if (rightClickContributorsByElement.has(element) ||
                standingContributorsByElement.has(element)) {

                elements.push(element);
            }
        }

        return elements;
    };

    /**
     * Records what the menu was opened on, and where, before its items are built, so that actions
     * creating something can place it at the click.
     */
    const recordOpener = (event, ancestors) => {

        Ren.LastRightClickPosition = { x: event.pageX, y: event.pageY };

        rightClickAncestors = ancestors || getAncestors(event.target);
    };

    const openButtonMenu = (button, event) => {

        recordOpener(event);

        const items = [];

        collectItems(items, buttonContributorsByElement.get(button));

        Ren.ContextMenuRenderer.open(
            removeItemsOverriddenByInnerContributors(items),
            { x: event.pageX, y: event.pageY },
            event.shiftKey
        );
    };

    // In the capture phase, so it sees the right-click before anything inside can stop it, and so
    // that a host cannot open a menu of its own over a report.  Right-clicks on the rest of the
    // host's page are left to the host.
    document.addEventListener("contextmenu", (e) => {

        if (!Ren.EventScope.isInScope(e.target)) {

            // A right-button drag that started in a report can still be released outside it.
            if (nextRightClickMenuSuppressed) {

                nextRightClickMenuSuppressed = false;
                e.preventDefault();
            }

            return;
        }

        // Taken before the preparers run, as they may redraw the target out of the document.
        const targetAncestors = getAncestors(e.target);

        runRightClickPreparers(targetAncestors, e);

        // The click the browser reports on releasing a right-button drag.
        if (nextRightClickMenuSuppressed) {

            nextRightClickMenuSuppressed = false;

            e.preventDefault();
            return;
        }

        // Ctrl falls through to the browser's own menu.
        if (e.ctrlKey) return;

        // An element that answers right-clicks itself shows neither Ren's menu nor the browser's.
        if (e.target.closest && e.target.closest("." + SUPPRESSED_CLASS_NAME)) {

            e.preventDefault();
            return;
        }

        // A right-click inside the open menu invokes the menu item; an item re-applies itself and
        // stays open, and anything else there is inert.
        if (e.target.closest && e.target.closest(".ren-context-menu")) {

            e.preventDefault();
            return;
        }

        recordOpener(e, targetAncestors);

        // The recorded ancestors still reach the contributors once a redraw detaches the target.
        const ancestors = getMenuContributingAncestors(rightClickAncestors);
        const items = collectItemsForRightClick(ancestors);

        // Nothing was contributed, so leave it to the browser's own menu.
        if (!items.length) return;

        e.preventDefault();

        Ren.ContextMenuRenderer.open(
            removeItemsOverriddenByInnerContributors(items),
            { x: e.pageX, y: e.pageY },
            // Holding Shift opens the menu in tech mode.
            e.shiftKey,
            () => removeItemsOverriddenByInnerContributors(collectItemsForRightClick(ancestors))
        );

    }, true);

    // Where the browser reports the right-click on mouse-down, a drag's flag would otherwise
    // swallow the next genuine right-click, which a press always precedes.
    document.addEventListener("mousedown", () => {

        nextRightClickMenuSuppressed = false;

    }, true);

    return {
        SUPPRESSED_CLASS_NAME,
        ISOLATED_CLASS_NAME,
        createContributorId,
        suppressNextRightClickMenu,
        contribute,
        contributeStanding,
        contributeToButton,
        getRightClickAncestors,
        getRightClickContributingElements,
        openButtonMenu,
        prepareForRightClick
    };
})();
