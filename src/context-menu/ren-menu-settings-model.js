/**
 * Works out a settings form from a context menu's items, so that a settings window offers what the
 * menu offers without either being written twice.  Everything - which controls, in what order,
 * grouped how and headed what - is worked out from the items alone (see Ren.MenuSettingsForm for
 * how the result is shown).
 *
 * The result is a tree of nodes:
 *   { type: "group", heading, title, key, children, isList }
 *   { type: "toggle", label, title, key, checked, item }
 *   { type: "choice", label, title, key, options: [{ label, title, selected, item }], children }
 *   { type: "number", label, title, key, value, min, max, step, unit, showSlider,
 *     applyOnEnterOnly, onChange, onCommit }
 *   { type: "text", label, title, key, value, onApply }
 *   { type: "button", label, title, key, item }
 *   { type: "menu", label, title, key, value, getMenuItems }
 * where key identifies a node from one build to the next, and item is the menu item to run.
 *
 * How items become nodes:
 *   - Items with a tick and an action are tickable.  A run of them, unbroken by a separator or a
 *     heading, is either one choice or a set of toggles, decided by scoring the run (see
 *     scoreAsChoice).  Neighbouring runs of unnamed options that between them have at most one
 *     ticked are one choice, as a list of options is sometimes split into parts by separators.
 *   - Toggles that are each alone between separators, and share a tick comparing a current value
 *     with theirs, are one choice, as when each option is followed by settings of its own.
 *   - Toggles naming the same exclusiveGroup are one choice, led by a "None" option, as switching
 *     one on switches the others off, which only running them would otherwise show.
 *   - Items ending in an ellipsis open something.  Each is probed (see Ren.MenuItemProbe) to find
 *     out what: a number or text editor becomes a field holding the number or text, and anything
 *     else a button opening it.
 *   - A submenu becomes a group headed by its text, unless it comes to a single control, which
 *     then stands for it, a choice taking the submenu's text as its label.
 *   - A submenu too big to lay out as controls (more than MAX_INLINE_CONTROLS of them), such as a
 *     list of date ranges, is a menu instead: a row showing what is set in it, from which the
 *     submenu itself is opened.  What is set is what the submenu's text gives in brackets, as in
 *     "Date range (Last 30 days)", or else what is ticked in it.
 *   - Sections become groups headed by the section's name: always in a root menu, and in a
 *     submenu where it has more than one, as the menu shows their headings.
 *   - Items that only do something once, such as Download or Copy, are not settings and are left
 *     out, as are links and the items only shown in tech mode.  An item with isSettingAction,
 *     which changes a setting each time it is run, such as flipping a sort order, is a button.
 * Within a group, its controls come before its subgroups, and are otherwise in menu order.
 *
 * Ren.MENU_OPTION_GROUP_SEPARATOR divides a run's options into kinds without ending it, so they
 * are still one choice.
 *
 * A submenu with isChoice is one choice of its options, however its ticks read, for options
 * whose ticks call out rather than compare, and of which none may be ticked by default.
 *
 * A submenu with isList, such as the columns a filter module offers, is a list of toggles however
 * many there are, and however their ticks read: a group with isList, shown as a list of checkboxes.
 *
 * A submenu with isChoiceLed, whose first run is a choice and whose other items are settings for
 * what it chooses, is that choice, labelled with the submenu's text, with those settings as its
 * children.  It's a control, so it keeps its place as they come and go.
 *
 * options.includeHidden keeps the items the menu hides for now, marked isHidden, so that a form
 * built again after a change has the same controls, only some of them unavailable.  An item with
 * omitWhenHidden is left out all the same, for one that only applies to some settings, such as
 * a chart's pie layout, which would only be clutter greyed out.
 *
 * options.memory, a Map kept by the caller between builds, keeps the decisions made on how items
 * are shown, such as whether a run is a choice or toggles, which otherwise depend in part on which
 * are ticked.
 *
 * options.getScope, if given, is passed { item, dependencies } for each control, where dependencies
 * are those noted while its tick was read or its editor opened, and says what, beyond what the
 * form is for, the control acts on, if anything, such as every series split from the same column.
 * Controls acting on the same scope are set apart from the rest of their section or submenu, in a
 * group headed by it (isScope), unless that is all of it.
 *
 * options.include, if given, is passed { item, dependencies } for each control and says whether to
 * keep it, where dependencies are the names noted by Ren.MenuItemProbe.noteDependency while the
 * item was looked at, e.g. that it acts on a chart's series.
 */
Ren.MenuSettingsModel = (() => {

    const ELLIPSIS = /\s*(\.\.\.|…)$/;

    // Words naming an option rather than a thing to switch on, as in "None" or "No estimate".
    const OPTION_WORDS =
        /^(none|no|off|on|auto|automatic|normal|default|standard|always|never|all|both|other)\b/i;

    // Words starting the text of an item that switches one thing on or off.
    const TOGGLE_VERBS =
        /^(show|hide|enable|disable|highlight|use|include|exclude|mark|shade|keep|allow|lock)\b/i;

    // A tick comparing a current value with the option's, as each of a choice's options does.
    const EQUALITY_TEST = /[^!=<>]===?[^=]/;

    // A tick asking whether the option is among those chosen, as for a list several of which may
    // be ticked, such as the columns plotted.
    const MEMBERSHIP_TEST = /\.(indexOf|includes|has|some)\(/;

    // A tick testing a setting is on or off.
    const BOOLEAN_TEST = /[!=]==?\s*(true|false)\b/;

    const resolve = (value) => typeof value === "function" ? value() : value;

    // The most controls a submenu is laid out as, beyond which it is a menu (see createMenuNode).
    const MAX_INLINE_CONTROLS = 12;

    /**
     * Counts the controls nodes are laid out as, in their groups too.
     */
    const countControls = (nodes) => nodes.reduce(
        (count, node) => count + (node.type === "group" ? countControls(node.children) : 1),
        0
    );

    /**
     * Gets the labels of what is ticked or selected among nodes, in their groups too.
     */
    const getSelectedLabels = (nodes) => {

        const labels = [];

        nodes.forEach(node => {

            if (node.isHidden) return;

            if (node.type === "group") labels.push(...getSelectedLabels(node.children));
            else if (node.type === "toggle" && node.checked) labels.push(node.label);
            else if (node.type === "choice") {
                node.options.filter(option => option.selected).forEach(option => labels.push(option.label));
            }
        });

        return labels;
    };

    /**
     * Gets the node for a submenu too big to lay out, shown as what is set in it.  The submenu is
     * read again each time it's opened, as it may be built afresh, e.g. against today's date.
     */
    const createMenuNode = (item, label, title, key, nodes) => {

        const bracketed = /^(.*\S)\s*\(([^()]+)\)$/.exec(label);
        const selectedLabels = getSelectedLabels(nodes);

        return {
            type: "menu",
            label: bracketed ? bracketed[1] : label,
            title,
            key,
            value: bracketed ? bracketed[2] : (selectedLabels.join(", ") || "None"),
            getMenuItems: () => item.submenu || []
        };
    };

    const isSeparator = (item) => item === Ren.MENU_SEPARATOR || item.text === "-";

    const isTickable = (item) =>
        item.ticked !== undefined && item.ticked !== null && !!item.action;

    const firstWord = (text) => text.split(/\s+/)[0].toLowerCase();

    const lastWord = (text) => Ren.ArrayUtils.last(text.split(/\s+/)).toLowerCase();

    /**
     * Gets a value indicating whether the labels all start, or all end, with the same word and
     * differ in the rest, as "At most 4 charts" and "At most 8 charts" do.  A shared toggle verb
     * doesn't count, as "Show values" and "Show names" are two things to show.
     */
    const shareWording = (labels) => {

        if (labels.length < 2 || new Set(labels).size < labels.length) return false;

        const shares = (getWord) => {

            const word = getWord(labels[0]);

            return labels.every(label => label.includes(" ") && getWord(label) === word);
        };

        return (shares(firstWord) && !TOGGLE_VERBS.test(labels[0])) || shares(lastWord);
    };

    /**
     * Scores how much a run of tickable items looks like the options of one choice rather than
     * separate toggles.  More than one ticked can only be toggles.
     */
    const scoreAsChoice = (run) => {

        const tickedCount = run.filter(leaf => leaf.ticked).length;

        if (run.length < 2 || tickedCount > 1) return -Infinity;

        let score = 0;

        // A choice has one of its options ticked.  Toggles may all be off.
        score += tickedCount === 1 ? 2 : -2;

        // Options are typically made from a list with no IDs of their own; toggles named.
        const namedCount = run.filter(leaf => leaf.id).length;

        if (namedCount === 0) score += 2;
        else if (namedCount === run.length) score -= 2;

        if (run.some(leaf => OPTION_WORDS.test(leaf.label))) score += 2;

        if (run.filter(leaf => TOGGLE_VERBS.test(leaf.label)).length * 2 > run.length) score -= 3;

        if (shareWording(run.map(leaf => leaf.label))) score += 2;

        // Options any number of which may be ticked, though only one is now.
        if (run.every(leaf => MEMBERSHIP_TEST.test(leaf.tickedSource))) score -= 6;

        // Options made from one list share a tick comparing the current value with each's.
        if (run.every(leaf => EQUALITY_TEST.test(leaf.tickedSource))) {

            score += run.every(leaf => leaf.tickedSource === run[0].tickedSource) ? 4 : 2;
        }

        return score;
    };

    /**
     * Gets an option of a choice, from a tickable item or a toggle.
     */
    const toOption = (source, selected) => ({
        label: source.label,
        title: source.title,
        selected: !!selected,
        isHidden: !!source.isHidden,
        item: source.item,
        scope: source.scope || null
    });

    /**
     * Gets whether all of a group's nodes, or a choice's options, are hidden, so that it is too.
     */
    const isAllHidden = (nodes) => nodes.length > 0 && nodes.every(node => node.isHidden);

    /**
     * Gets a choice, as yet unlabelled, hidden where all its options are.
     */
    const createChoiceNode = (key, options, isUnnamed) => ({
        type: "choice",
        label: null,
        title: null,
        key,
        isUnnamed,
        isHidden: isAllHidden(options),
        options
    });

    const createChoice = (run) => createChoiceNode(
        run[0].key,
        run.map(leaf => toOption(leaf, leaf.ticked)),
        run.every(leaf => !leaf.id)
    );

    const createToggle = (leaf, isAlone) => ({
        type: "toggle",
        label: leaf.label,
        title: leaf.title,
        key: leaf.key,
        checked: leaf.ticked,
        isHidden: leaf.isHidden,
        item: leaf.item,
        isAlone,
        isOptionAlone: isAlone && OPTION_WORDS.test(leaf.label),
        tickedSource: leaf.tickedSource,
        exclusiveGroup: leaf.exclusiveGroup,
        scope: leaf.scope
    });

    /**
     * Gets the unit a number editor's label gives in brackets, as in "Size (px)".
     */
    const getUnit = (editorLabel) => {

        const match = /\(([^)]+)\)\s*$/.exec(editorLabel || "");

        return match ? match[1] : null;
    };

    /**
     * Builds the node an item that opens something stands for, from what probing it found it
     * would open, or null if it failed.
     */
    const createOpenerNode = (item, probe, label, title, key) => {

        const details = probe.details;

        if (probe.kind === "error") return null;

        if (probe.kind === "number") {

            const editorOptions = details.options;

            return {
                type: "number",
                label,
                title,
                key,
                value: details.initialValue,
                min: editorOptions.min !== undefined ? editorOptions.min : 1,
                max: editorOptions.max !== undefined ? editorOptions.max : 100,
                step: editorOptions.step || 1,
                unit: getUnit(editorOptions.label),
                showSlider: !!editorOptions.showSlider,
                applyOnEnterOnly: !!editorOptions.applyTypedValuesOnEnter,
                onChange: details.onChange,
                onCommit: editorOptions.onClose || null
            };
        }

        if (probe.kind === "text") {

            return {
                type: "text",
                label,
                title,
                key,
                value: details.initialText || "",
                onApply: details.onApply
            };
        }

        return { type: "button", label: label + "…", title, key, item };
    };

    /**
     * Puts a group's controls before its subgroups, keeping each in order.
     */
    const placeControlsFirst = (nodes) => [
        ...nodes.filter(node => node.type !== "group"),
        ...nodes.filter(node => node.type === "group")
    ];

    const countSelected = (options) => options.filter(option => option.selected).length;

    /**
     * Gets a value indicating whether two neighbouring nodes are parts of one choice, with at most
     * one option ticked between them: two runs of unnamed options, or an option on its own, such as
     * "None", beside a choice.
     */
    const arePartsOfOneChoice = (first, second) => {

        const isUnlabelledChoice = (node) => node.type === "choice" && !node.label;
        const getOptions = (node) => node.type === "choice" ? node.options : [toOption(node, node.checked)];

        const isJoinable =
            (isUnlabelledChoice(first) && isUnlabelledChoice(second) &&
                first.isUnnamed && second.isUnnamed) ||
            (isUnlabelledChoice(first) && second.isOptionAlone) ||
            (first.isOptionAlone && isUnlabelledChoice(second));

        if (!isJoinable) return false;

        const options = [...getOptions(first), ...getOptions(second)];

        // Parts offering the same option twice are separate choices, such as the same formats
        // for two kinds of percentage.
        return countSelected(options) <= 1 &&
            new Set(options.map(option => option.label)).size === options.length;
    };

    /**
     * Gets what marks a toggle as an option of a choice with others: the exclusive group it names,
     * or, where it is alone between separators, its tick comparing a current value with its own,
     * as options made by one function share.  Null where it is a toggle in its own right.
     */
    const getExclusiveKey = (node) => {

        if (node.type !== "toggle") return null;
        if (node.exclusiveGroup) return "group:" + node.exclusiveGroup;

        const source = node.tickedSource || "";

        // A test against true or false is a toggle's own, as made by a helper for many toggles.
        return node.isAlone && EQUALITY_TEST.test(source) && !BOOLEAN_TEST.test(source)
            ? "ticked:" + source
            : null;
    };

    /**
     * Gets the choice a run of exclusive toggles is.  Those of an exclusive group may all be off,
     * so a "None" option leads, which switches off whichever is on.
     */
    const createChoiceOfToggles = (toggles) => {

        const options = toggles.map(toggle => toOption(toggle, toggle.checked));
        const selected = toggles.find(toggle => toggle.checked);

        if (toggles[0].exclusiveGroup) {

            options.unshift({
                label: "None",
                title: null,
                selected: !selected,
                isHidden: isAllHidden(options),
                scope: getCommonScope(options),
                item: selected
                    ? { action: () => selected.item.action.apply(null, selected.item.actionParameters ?? []) }
                    : null
            });
        }

        return createChoiceNode(toggles[0].key, options, false);
    };

    /**
     * Joins the toggles that are options of one choice (see getExclusiveKey) into it, where the
     * first of them is.  They needn't be neighbours, as each may be followed by settings of its own.
     */
    const joinExclusiveToggles = (nodes) => {

        const togglesByKey = new Map();

        nodes.forEach(node => {

            const key = getExclusiveKey(node);

            if (key === null) return;
            if (!togglesByKey.has(key)) togglesByKey.set(key, []);

            togglesByKey.get(key).push(node);
        });

        const joined = [];

        nodes.forEach(node => {

            const toggles = togglesByKey.get(getExclusiveKey(node));

            if (!toggles || toggles.length < 2) joined.push(node);
            else if (toggles[0] === node) joined.push(createChoiceOfToggles(toggles));
        });

        return joined;
    };

    /**
     * Joins the neighbouring parts of a choice that separators have divided, as a list of options
     * sometimes is.
     */
    const joinSplitChoices = (nodes, remember) => {

        const joined = [];

        for (let i = 0; i < nodes.length; i++) {

            const node = nodes[i];
            const previous = joined.length ? Ren.ArrayUtils.last(joined) : null;

            const isJoined = previous &&
                remember("join:" + previous.key + "+" + node.key, () => arePartsOfOneChoice(previous, node));

            if (!isJoined) {

                joined.push(node);
                continue;
            }

            if (previous.type === "choice") {

                previous.options = previous.options.concat(
                    node.type === "choice" ? node.options : [toOption(node, node.checked)]
                );
            }
            else {

                // The option on its own leads, as "None" does, and the choice takes its place.
                node.options = [toOption(previous, previous.checked)].concat(node.options);
                joined[joined.length - 1] = node;
            }

            const choice = Ren.ArrayUtils.last(joined);

            choice.isHidden = isAllHidden(choice.options);
        }

        return joined;
    };

    /**
     * Gets the scope every one of the given nodes or options has, or null where they differ.
     */
    const getCommonScope = (nodes) => {

        const scopes = nodes.map(node => getScope(node));

        return scopes.length && scopes[0] && scopes.every(scope => scope === scopes[0]) ? scopes[0] : null;
    };

    /**
     * Gets what a node acts on beyond what the form is for (see options.getScope): what all its
     * options or children do, or else nothing.  A group that sets a scope apart has none itself.
     */
    function getScope(node) {

        if (node.isScope) return null;
        if (node.type === "choice") return getCommonScope(node.options);
        if (node.type === "group") return getCommonScope(node.children);

        return node.scope || null;
    }

    /**
     * Sets apart the nodes acting on a scope, in a group headed by it, after the rest, in each
     * group too.  Where all of a submenu's nodes act on the same scope, they are left together,
     * for the submenu to be set apart as a whole; the top of a section is always divided.
     */
    const setApartScopes = (nodes, parentKey, isTop) => {

        nodes.forEach(node => {
            if (node.type === "group") node.children = setApartScopes(node.children, node.key, false);
        });

        const scopes = nodes.map(getScope);

        if (!scopes.some(Boolean) || (!isTop && getCommonScope(nodes))) return nodes;

        const nodesByScope = new Map();

        nodes.forEach((node, index) => {

            const scope = scopes[index];

            if (!scope) return;
            if (!nodesByScope.has(scope)) nodesByScope.set(scope, []);

            nodesByScope.get(scope).push(node);
        });

        const scopeGroups = Array.from(nodesByScope, ([scope, children]) =>
            Object.assign(createGroup(scope, null, parentKey + "/scope:" + scope, children), { isScope: true })
        );

        return nodes.filter((node, index) => !scopes[index]).concat(scopeGroups);
    };

    const createGroup = (heading, title, key, children) =>
        ({ type: "group", heading, title, key, children, isHidden: isAllHidden(children) });

    /**
     * Gets the node for a submenu or section: a group headed by its name or, where it comes to a
     * single control, that control.  An unlabelled choice takes the name as its label, both alone
     * and where it leads the settings for what it chooses (isChoiceLed), which are then its
     * children, so that it keeps its place as they come and go.
     */
    const createGroupOrControl = (heading, title, key, nodes, isChoiceLed) => {

        const [first, ...rest] = nodes;

        if (first.type === "choice" && !first.label && (!rest.length || isChoiceLed)) {

            Object.assign(first, { label: heading, title: title || first.title, key });

            if (rest.length) first.children = rest;

            return first;
        }

        return nodes.length === 1 && first.type !== "group" ? first : createGroup(heading, title, key, nodes);
    };

    /**
     * Marks a node, and everything in it, as hidden by the menu.
     */
    const markHidden = (node) => {

        node.isHidden = true;

        if (node.options) node.options.forEach(option => { option.isHidden = true; });
        if (node.children) node.children.forEach(markHidden);

        return node;
    };

    const createBuilder = (settings) => {

        /**
         * Gets a decision on how items are shown, as first made while settings.memory is kept, so
         * that items are shown the same way whatever their state, rather than, say, as a choice
         * only once one of them is ticked.
         */
        const remember = (key, decide) => {

            const memory = settings.memory;

            if (!memory) return decide();
            if (!memory.has(key)) memory.set(key, decide());

            return memory.get(key);
        };

        /**
         * Looks at an item, returning a tickable leaf ({ kind: "tickable", ... }), a node
         * ({ kind: "node", node }), or null where it offers nothing to set.
         */
        const describe = (item, parentKey) => {

            if (item.techOnly && !settings.isTechMode) return null;
            if (item.hyperlink || item.popupReport) return null;

            const looked = Ren.MenuItemProbe.track(() => ({
                isVisible: !item.visible || !!item.visible(),
                text: resolve(item.text),
                id: resolve(item.id),
                title: resolve(item.title)
            }));

            if (!looked.value) return null;

            // An item the menu hides for now is kept, marked hidden, so that a form shows the same
            // controls whatever the settings are, rather than moving them as they come and go.
            const isHidden = !looked.value.isVisible;

            if (isHidden && (!settings.includeHidden || item.omitWhenHidden)) return null;

            const described = describeShown(item, parentKey, looked);

            if (described && isHidden) {

                if (described.kind === "tickable") described.isHidden = true;
                else markHidden(described.node);
            }

            return described;
        };

        const getItemScope = (item, dependencies) => settings.getScope({ item, dependencies }) || null;

        const describeShown = (item, parentKey, looked) => {

            const dependencies = looked.dependencies;
            const text = String(looked.value.text ?? "").trim();
            const id = looked.value.id || null;
            const title = looked.value.title || null;
            const label = text.replace(ELLIPSIS, "");
            const key = parentKey + "/" + (id || text);

            const isIncluded = () => settings.include({ item, dependencies });

            // A ticked item shows its state rather than opening its submenu, as in the menu.
            if (isTickable(item)) {

                const ticked = Ren.MenuItemProbe.track(() => !!resolve(item.ticked));

                ticked.dependencies.forEach(name => dependencies.add(name));

                if (!isIncluded()) return null;

                return {
                    kind: "tickable",
                    scope: getItemScope(item, ticked.dependencies),
                    item,
                    id,
                    label,
                    title,
                    key,
                    ticked: !!ticked.value,
                    isHidden: false,
                    exclusiveGroup: item.exclusiveGroup || null,
                    tickedSource: typeof item.ticked === "function" ? item.ticked.toString() : ""
                };
            }

            if (item.submenu) {

                const submenu = Ren.MenuItemProbe.track(() => item.submenu).value || [];
                const nodes = buildSections(submenu, key, false, !!item.isChoice, !!item.isList);

                if (!nodes.length) return null;

                if (item.isList) {
                    return { kind: "node", node: Object.assign(createGroup(label, title, key, nodes), { isList: true }) };
                }

                if (countControls(nodes) > MAX_INLINE_CONTROLS) {

                    const node = createMenuNode(item, label, title, key, nodes);

                    node.scope = getCommonScope(nodes);

                    return { kind: "node", node };
                }

                return {
                    kind: "node",
                    node: createGroupOrControl(label, title, key, nodes, !!item.isChoiceLed)
                };
            }

            if (item.action && ELLIPSIS.test(text)) {

                const probed = Ren.MenuItemProbe.track(
                    () => Ren.MenuItemProbe.probeAction(item.action, item.actionParameters)
                );

                probed.dependencies.forEach(name => dependencies.add(name));

                if (!probed.value || !isIncluded()) return null;

                const node = createOpenerNode(item, probed.value, label, title, key);

                if (node) node.scope = getItemScope(item, probed.dependencies);

                return node ? { kind: "node", node } : null;
            }

            if (item.action && item.isSettingAction) {

                if (!isIncluded()) return null;

                const node = { type: "button", label, title, key, item };

                node.scope = getItemScope(item, dependencies);

                return { kind: "node", node };
            }

            // Anything else is done once rather than set, such as Download or Copy.
            return null;
        };

        /**
         * Builds the nodes for a list of items, which separators and headings divide into runs.
         */
        const buildList = (items, parentKey, isChoiceList, isToggleList) => {

            const nodes = [];
            let run = [];

            const endRun = () => {

                if (!run.length) return;

                const isChoice = !isToggleList && ((isChoiceList && run.length > 1) || remember(
                    "run:" + run.map(leaf => leaf.key).join(","),
                    () => scoreAsChoice(run) > 0
                ));

                // A choice can't have more than one option selected, whatever it was before.
                if (isChoice && run.filter(leaf => leaf.ticked).length <= 1) nodes.push(createChoice(run));
                else run.forEach(leaf => nodes.push(createToggle(leaf, run.length === 1)));

                run = [];
            };

            for (let i = 0; i < items.length; i++) {

                const item = items[i];

                if (!item) continue;

                // Options divided only into kinds are still one choice.
                if (item.keepsChoice) continue;

                if (isSeparator(item) || "heading" in item) {

                    endRun();
                    continue;
                }

                const described = describe(item, parentKey);

                if (!described) continue;

                if (described.kind === "tickable") {

                    run.push(described);
                    continue;
                }

                endRun();
                nodes.push(described.node);
            }

            endRun();

            return placeControlsFirst(joinExclusiveToggles(joinSplitChoices(nodes, remember)));
        };

        /**
         * Builds the nodes for a list of items in sections, as a menu shows them: under a heading
         * each, where there is more than one section, or always for a root menu.  Items in no
         * section come first, ungrouped.
         */
        const buildSections = (items, parentKey, isRoot, isChoiceList, isToggleList) => {

            const sections = [];

            // A separator divides the section it is in.
            let sectionName = null;

            for (let i = 0; i < items.length; i++) {

                const item = items[i];

                if (!item) continue;

                if (!isSeparator(item)) sectionName = item.section || null;

                const section = sections.find(s => s.name === sectionName);

                if (section) section.items.push(item);
                else sections.push({ name: sectionName, items: [item] });
            }

            if (!isRoot && sections.length < 2) return buildList(items, parentKey, isChoiceList, isToggleList);

            const nodes = [];

            for (let i = 0; i < sections.length; i++) {

                const section = sections[i];
                const key = section.name ? parentKey + "/section:" + section.name : parentKey;
                let children = buildList(section.items, key);

                if (isRoot) children = setApartScopes(children, key, true);

                if (!children.length) continue;

                // A root menu's sections are kept whole, as its headings are what it is read by.
                if (!section.name) nodes.push(...children);
                else if (isRoot) nodes.push(createGroup(section.name, null, key, children));
                else nodes.push(createGroupOrControl(section.name, null, key, children));
            }

            return placeControlsFirst(nodes);
        };

        /**
         * Builds the nodes for a root menu, its sections in the order the menu shows them.
         */
        const buildRoot = (menuItems) => {

            const sortedItems = menuItems.slice(0);

            Ren.ContextMenuItemSorter().sortMenuItems(sortedItems);

            return buildSections(sortedItems, "", true);
        };

        return { buildRoot };
    };

    /**
     * Builds the settings a root menu's items offer, as a group with no heading.  Options:
     * { include({ item, dependencies }), getScope({ item, dependencies }), isTechMode,
     * includeHidden, memory }.
     */
    const build = (menuItems, options) => {

        const settings = {
            include: (options && options.include) || (() => true),
            getScope: (options && options.getScope) || (() => null),
            isTechMode: !!(options && options.isTechMode),
            includeHidden: !!(options && options.includeHidden),
            memory: (options && options.memory) || null
        };

        return {
            type: "group",
            heading: null,
            title: null,
            key: "",
            children: createBuilder(settings).buildRoot(menuItems)
        };
    };

    return {
        build,
        scoreAsChoice
    };
})();
