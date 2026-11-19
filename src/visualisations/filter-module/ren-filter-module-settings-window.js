/**
 * The settings window a filter module item's cog opens, offering what the item's heading menu
 * offers as a form (see Ren.MenuSettingsWindow).  A dropdown at its top chooses which of the
 * module's items it shows, starting with the one whose cog was clicked, or "All", whose changes
 * are made to each of them.
 *
 * A hierarchy's levels above its leaf each have their own value, label and sort settings, set from
 * a right-click on their options rather than from the heading, which sets the leaf's.  Its window
 * sets those of every level, so that what it sets is seen whichever levels are shown.  Which menu
 * items set such a setting is decided by Ren.FilterModule_ItemLevels.
 *
 * The module draws its items afresh on every change, and is itself built afresh when its data
 * are, so each item's heading row is noted as it is drawn (see addSettingsButton), and the window
 * reads its items from the latest.  This outlives the module, being kept by visualisation.
 */
Ren.FilterModule_SettingsWindow = (() => {

    const CLASS_NAME = "ren-filter-module";

    // visualisation -> Map of item key -> { headingRow, getHeading, getLevelMenus }, for the items
    // last drawn.
    const itemsByVisualisation = new WeakMap();

    // The dropdown's "All" choice, which no item's key can be, being neither a column's id nor a
    // heading.
    const ALL_KEY = "\u0000all";

    // The modules whose open window is to be built afresh once their items have been drawn.
    const pendingRefreshes = new Set();

    const getItems = (visualisation) => {

        if (!itemsByVisualisation.has(visualisation)) itemsByVisualisation.set(visualisation, new Map());

        return itemsByVisualisation.get(visualisation);
    };

    const getEntry = (visualisation, key) => {

        const entry = getItems(visualisation).get(key);

        return entry?.headingRow.isConnected ? entry : null;
    };

    /**
     * Gets the module's items to choose from, [{ key, label }], in the order they are drawn,
     * leaving out any no longer on the page.
     */
    const getItemOptions = (visualisation) => {

        const shown = Array.from(getItems(visualisation).entries())
            .filter(([, entry]) => entry.headingRow.isConnected);

        shown.sort(([, a], [, b]) =>
            a.headingRow.compareDocumentPosition(b.headingRow) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
        );

        return shown.map(([key, entry]) => ({ key, label: entry.getHeading() }));
    };

    const getItemKeys = (visualisation) => getItemOptions(visualisation).map(option => option.key);

    /**
     * Gets the dropdown's choices: the module's items, then "All" where there is more than one.
     */
    const getSubjectOptions = (visualisation) => {

        const options = getItemOptions(visualisation);

        return options.length > 1 ? options.concat({ key: ALL_KEY, label: "All" }) : options;
    };

    const getHeadingRow = (visualisation, key) => getEntry(visualisation, key)?.headingRow ?? null;

    /**
     * Runs a function as if the item's heading menu had been opened.
     */
    const runAsItemMenu = (visualisation, key, fn) => {

        const headingRow = getHeadingRow(visualisation, key);

        return headingRow ? Ren.ContextMenuRegistry.withOpener(headingRow, fn) : undefined;
    };

    /**
     * Copies a menu item, keeping its getters, with the given properties in place of its own.
     */
    const withOwnProperties = (item, properties) => {

        const copy = Object.defineProperties({}, Object.getOwnPropertyDescriptors(item));

        for (const name in properties) {

            Object.defineProperty(copy, name, {
                value: properties[name],
                enumerable: true,
                configurable: true,
                writable: true
            });
        }

        return copy;
    };

    // The item's "View settings" submenu, which is the item's main settings, but too many of them
    // to be laid out as controls were it kept a submenu (see Ren.MenuSettingsModel).
    const VIEW_SETTINGS_ITEM_ID = "filter-module-view";

    const inSection = (item, section) => withOwnProperties(item, { section });

    /**
     * Lays the "View settings" submenu's items out in its section, in place of the submenu.
     */
    const flattenViewSettings = (items) => items.flatMap(item => {

        if (item.id !== VIEW_SETTINGS_ITEM_ID || !Array.isArray(item.submenu)) return [item];

        return [{ section: item.section, text: "-" }].concat(item.submenu.map(subitem =>
            isSeparator(subitem) ? { section: item.section, text: "-" } : inSection(subitem, item.section)
        ));
    });

    const ELLIPSIS = /\s*(\.\.\.|…)$/;

    const resolve = (value) => typeof value === "function" ? value() : value;

    const isSeparator = (item) => item === Ren.MENU_SEPARATOR || item.text === "-";

    const isTickable = (item) => item.ticked !== undefined && item.ticked !== null;

    const runMenuItem = (item) => item.action.apply(null, item.actionParameters ?? []);

    /**
     * Gets the menu items of an item's heading, as the window lays them out.  Called with its
     * heading row as the menu's opener.
     */
    const collectMenuItems = (headingRow) =>
        flattenViewSettings(Ren.ContextMenuRegistry.collectItemsForElements([headingRow]));

    // What tells a menu item from those beside it, the same in one menu as in another's.
    const getPathPart = (item) => String(resolve(item.id) || resolve(item.text) || "");

    /**
     * Finds the menu item at a path of parts (see getPathPart) among menu items, or null where
     * there is none there.  Called with the menu's opener.
     */
    const findMenuItem = (items, path) => {

        let found = null;

        for (const part of path) {

            found = (items || []).find(item =>
                item && !isSeparator(item) && getPathPart(item) === part
            ) || null;

            if (!found) return null;

            items = resolve(found.submenu);
        }

        return found;
    };

    /**
     * Gets the menus an item's settings are made in, as last drawn: its heading's, then, for a
     * hierarchy, each level's above its leaf, as [{ headingRow, isLevel, getMenuItems }].
     */
    const getTargets = (visualisation, key) => {

        const entry = getEntry(visualisation, key);

        if (!entry) return [];

        const headingRow = entry.headingRow;

        return [{ headingRow, isLevel: false, getMenuItems: () => collectMenuItems(headingRow) }]
            .concat((entry.getLevelMenus?.() || []).map(menuItems => ({
                headingRow,
                isLevel: true,
                getMenuItems: () => menuItems
            })));
    };

    /**
     * Runs a function on the shown menu item at a path in each of the menus that the items with the
     * given keys have their settings made in, its levels' too where reachesLevels.  Each is found
     * afresh from the item as last drawn, with its heading row as the menu's opener, as running one
     * draws the items again.
     */
    const forEachTargetItem = (visualisation, keys, path, reachesLevels, fn) => {

        keys.forEach(key => {

            const count = getTargets(visualisation, key).length;

            for (let i = 0; i < count; i++) {

                const target = getTargets(visualisation, key)[i];

                if (!target || (target.isLevel && !reachesLevels)) continue;

                Ren.ContextMenuRegistry.withOpener(target.headingRow, () => {

                    const item = findMenuItem(target.getMenuItems(), path);

                    if (item?.action && (!item.visible || item.visible())) fn(item);
                });
            }
        });
    };

    /**
     * Gets a value indicating whether the menu item at a path is ticked wherever it is shown, as a
     * control acting on them all shows it.  Called while a form is built, a cache keeps each menu
     * collected for the next item.
     */
    const isTickedEverywhere = (visualisation, keys, path, reachesLevels, cache) => {

        let tickedCount = 0;
        let shownCount = 0;

        keys.forEach(key => {

            if (cache && !cache.has(key)) {

                cache.set(key, getTargets(visualisation, key).map(target => Object.assign({}, target, {
                    menuItems: Ren.ContextMenuRegistry.withOpener(target.headingRow, target.getMenuItems)
                })));
            }

            (cache ? cache.get(key) : getTargets(visualisation, key)).forEach(target => {

                if (target.isLevel && !reachesLevels) return;

                Ren.ContextMenuRegistry.withOpener(target.headingRow, () => {

                    const item = findMenuItem(target.menuItems ?? target.getMenuItems(), path);

                    if (!item || !isTickable(item) || (item.visible && !item.visible())) return;

                    shownCount++;

                    if (resolve(item.ticked)) tickedCount++;
                });
            });
        });

        return shownCount > 0 && tickedCount === shownCount;
    };

    /**
     * Gets the menu items a form acting on several menus is built from: the first item's, each
     * running the same item in every menu.  A tickable one, shown ticked only where ticked in them
     * all, is run in those not yet as clicking it makes it, so that each ends up alike, and an
     * option ticked in some can be ticked in all.
     *
     * Of those ending in an ellipsis, number and text editors set each menu's, and others, which
     * open a window, such as the heading's editor, are the first item's own: kept where
     * keepsWindows, and otherwise left out.  Called with the first item's heading row as the menu's
     * opener.
     */
    const getMenuItemsForAll = (
        scope, items, parentPath, parentSection, parentReachesLevels
    ) => items.flatMap(item => {

        if (!item || isSeparator(item)) return [item];

        const { visualisation, getKeys, cache } = scope;
        const path = parentPath.concat(getPathPart(item));
        const section = parentSection ?? resolve(item.section);
        // A submenu's items set what it does, so reach the levels where it does.
        const reachesLevels =
            parentReachesLevels ?? Ren.FilterModule_ItemLevels.isPerLevelMenuItem(item, section);

        const isTicked = () => isTickedEverywhere(visualisation, getKeys(), path, reachesLevels, cache);

        const runEverywhere = () => {

            if (!isTickable(item)) {

                forEachTargetItem(visualisation, getKeys(), path, reachesLevels, runMenuItem);
                return;
            }

            const isToBeTicked = !isTickedEverywhere(visualisation, getKeys(), path, reachesLevels, null);

            forEachTargetItem(visualisation, getKeys(), path, reachesLevels, each => {

                if (!!resolve(each.ticked) !== isToBeTicked) runMenuItem(each);
            });
        };

        const runsEverywhere = Object.assign(
            { action: runEverywhere, actionParameters: undefined },
            isTickable(item) ? { ticked: isTicked } : {}
        );

        if (item.submenu) {

            const copy = withOwnProperties(item, item.action ? runsEverywhere : {});

            Object.defineProperty(copy, "submenu", {
                get: () => getMenuItemsForAll(
                    scope, resolve(item.submenu) || [], path, section, reachesLevels
                ),
                enumerable: true,
                configurable: true
            });

            return [copy];
        }

        if (!item.action || item.hyperlink || item.popupReport) return [item];

        if (ELLIPSIS.test(String(resolve(item.text) ?? ""))) {

            const kind = Ren.MenuItemProbe.probeAction(item.action, item.actionParameters).kind;

            if (kind !== "number" && kind !== "text") return scope.keepsWindows ? [item] : [];

            return [withOwnProperties(item, {
                action: createEditorActionForAll(visualisation, getKeys, item, path, reachesLevels),
                actionParameters: undefined
            })];
        }

        return [withOwnProperties(item, runsEverywhere)];
    });

    /**
     * Gets the action of a menu item opening a number or text editor, for a form acting on several
     * menus.  While the settings model probes it, it gives the first item's editor, but with what
     * the editor sets made in each menu's.  Otherwise it opens the first item's editor.
     */
    const createEditorActionForAll = (visualisation, getKeys, firstItem, path, reachesLevels) => () => {

        if (!Ren.MenuItemProbe.isProbing()) {

            runMenuItem(firstItem);
            return;
        }

        const probe = Ren.MenuItemProbe.probeAction(firstItem.action, firstItem.actionParameters);
        const details = probe.details;

        // Runs fn with each menu's own editor's details, found as the first item's were.
        const forEachEditor = (fn) => forEachTargetItem(visualisation, getKeys(), path, reachesLevels, item => {

            const itemProbe = Ren.MenuItemProbe.probeAction(item.action, item.actionParameters);

            if (itemProbe.kind === probe.kind) fn(itemProbe.details);
        });

        if (probe.kind === "number") {

            const options = details.options || {};

            Ren.MenuItemProbe.intercept("number", Object.assign({}, details, {
                onChange: (value) => forEachEditor(each => each.onChange?.(value)),
                options: Object.assign({}, options, {
                    onClose: options.onClose
                        ? () => forEachEditor(each => each.options?.onClose?.())
                        : undefined
                })
            }));
        }
        else {

            Ren.MenuItemProbe.intercept("text", Object.assign({}, details, {
                onApply: (text) => forEachEditor(each => each.onApply?.(text))
            }));
        }
    };

    const EMPTY_MODEL = { type: "group", heading: "", key: "", children: [] };

    /**
     * Builds the form for an item, or for "All" from the first item's menu.  A form acting on more
     * than one menu, for "All" or a hierarchy's levels, runs each control in each of them.
     */
    const buildModel = (visualisation, key, memory) => {

        const isAll = key === ALL_KEY;
        const firstKey = isAll ? getItemKeys(visualisation)[0] : key;
        const entry = firstKey != null ? getEntry(visualisation, firstKey) : null;

        if (!entry) return EMPTY_MODEL;

        const headingRow = entry.headingRow;

        return Ren.ContextMenuRegistry.withOpener(headingRow, () => {

            let menuItems = collectMenuItems(headingRow);

            if (isAll || entry.getLevelMenus) {

                menuItems = getMenuItemsForAll({
                    visualisation,
                    getKeys: isAll ? () => getItemKeys(visualisation) : () => [key],
                    keepsWindows: !isAll,
                    // Each menu collected once while the form is built.
                    cache: new Map()
                }, menuItems, [], null);
            }

            return Ren.MenuSettingsModel.build(menuItems, {
                isTechMode: Ren.UrlContext.onEditorPage(),
                // So that controls a change hides are greyed out where they are, not taken away.
                includeHidden: true,
                // So that controls keep their kind as what is ticked changes.
                memory
            });
        });
    };

    const open = (visualisation, initialKey) => {

        // Each item's own, as what is ticked differs between them.
        const memories = new Map();

        const getMemory = (key) => {

            if (!memories.has(key)) memories.set(key, new Map());

            return memories.get(key);
        };

        const settingsWhenOpened = Ren.VisualisationOriginalSettings.snapshot(visualisation);

        Ren.MenuSettingsWindow.open({
            owner: visualisation,
            title: "Filter Settings",
            popupReuseId: "ren-filter-module-settings-" + visualisation.visualisationGuid,
            tabs: [
                {
                    title: "Filter",
                    subjects: {
                        label: "Filter",
                        getOptions: () => getSubjectOptions(visualisation),
                        initialKey
                    },
                    buildModel: (key) => buildModel(visualisation, key, getMemory(key)),
                    // "All" runs each item's own with that item's heading row as the opener.
                    runAction: (fn, key) => key === ALL_KEY ? fn() : runAsItemMenu(visualisation, key, fn)
                }
            ],
            runAction: fn => fn(),
            // Back to the module as it was when the window was opened, undoing what was changed in
            // it, rather than to the report's own settings as the menu's Reset is.
            onReset: settingsWhenOpened
                ? () => Ren.VisualisationOriginalSettings.restore(visualisation, settingsWhenOpened)
                : null,
            resetTitle: "Puts the filter module back as it was when this window was opened"
        });
    };

    /**
     * Notes an item's heading row as drawn, and adds the cog opening the window on it just after
     * its heading.  getLevelMenus, for a hierarchy, gets the menus of its levels above the leaf.
     * Builds the module's open window afresh to match, once it has finished drawing.
     */
    const addSettingsButton = (visualisation, headingRow, headingElement, key, getLevelMenus) => {

        if (!visualisation || visualisation.isVirtual) return;

        // As the window's dropdown gives it back.
        key = String(key);

        getItems(visualisation).set(key, {
            headingRow,
            getHeading: () => headingElement.textContent.trim() || String(key),
            getLevelMenus: getLevelMenus || null
        });

        const button = Ren.HtmlUtils.create("button")
            ._attr("type", "button")
            ._addClass(CLASS_NAME + "__item-settings", "qa-ren-filter-module-item-settings")
            ._attr("title", "Filter settings")
            ._append(Ren.CogIcon.create(CLASS_NAME + "__item-settings-icon", 11));

        Ren.DomEventUtils.onClickWithoutSelectingContainer(button, () => open(visualisation, key));

        headingElement.after(button);

        if (!Ren.MenuSettingsWindow.isOpen(visualisation) || pendingRefreshes.has(visualisation)) return;

        pendingRefreshes.add(visualisation);

        setTimeout(() => {

            pendingRefreshes.delete(visualisation);
            Ren.MenuSettingsWindow.refresh(visualisation);
        });
    };

    return {
        open,
        addSettingsButton
    };
})();
