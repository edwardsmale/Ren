/**
 * Shows the settings Ren.MenuSettingsModel works out from a menu's items as a form: a heading for
 * each group, and a row for each control, its label on the left.  A choice of a few options is a
 * set of radio buttons, outlined as one, and a longer one a dropdown.  A choice with settings for
 * what it chooses has them set in beneath it.
 *
 * Options:
 *   runAction(fn) - runs what a control does, as the menu would have run it, e.g. as if opened on
 *                   the visualisation.
 *   onChanged()   - called once a control has changed something, to build the form afresh.
 *
 * Where the model has more than one section, each section is a subtab, so that only one section's
 * settings are shown at a time.  Settings in no section come first, under "General".
 *
 * A list group (isList) is its checkboxes in a box of their own, which scrolls where they would
 * make it too tall.
 *
 * A menu node is a row showing what is set in a submenu too big to lay out, with a pencil opening
 * the submenu itself, as a context menu.
 *
 * update() takes a newly built model.  Where it has the same controls as the shown one, their
 * values are updated in place, so that a field being typed in is left alone; otherwise the form is
 * rebuilt, keeping the focus on the control it was on, and that control where it was on screen.
 *
 * Controls the menu hides for now (isHidden, see MenuSettingsModel's includeHidden) that have been
 * shown are kept, greyed out and not to be used, so that the form keeps its shape as settings
 * change.  Those never shown are left out, as they may be for another kind of column or chart.
 */
Ren.MenuSettingsForm = (container, options) => {

    const CLASS_NAME = "ren-menu-settings-form";
    const UNAVAILABLE_CLASS_NAME = CLASS_NAME + "--unavailable";

    // The most options shown as radio buttons rather than a dropdown, beyond which they would take
    // up too much of the form.
    const MAX_RADIO_OPTIONS = 6;

    const GENERAL_SUBTAB_TITLE = "General";

    const runAction = (options && options.runAction) || (fn => fn());
    const onChanged = (options && options.onChanged) || (() => {});

    let shownSignature = null;

    // The control last used, then the groups it is in, innermost first: the first of them still
    // there is kept in place where the form is rebuilt.
    let lastUsedAnchors = [];

    // The controls and options that have been available while the form has been open.
    const seenKeys = new Set();

    // Shows a node in the control or group shown for the node with its key, as the form is
    // updated in place.
    let updaters = new Map();

    // The subtab shown, by its title, kept as the form is rebuilt.
    let selectedSubtabTitle = null;

    const runItem = (item) => runAction(() => item.action.apply(null, item.actionParameters ?? []));

    const change = (fn, key) => {

        if (key) lastUsedAnchors = getAnchors(findByKey(key));

        runAction(fn);
        onChanged();
    };

    /**
     * Describes the controls a model has, so that a model with the same ones is known to be.
     */
    const getSignature = (node) => {

        const parts = [node.type, node.key, node.label || node.heading || ""];

        if (node.type === "choice") node.options.forEach(option => parts.push(option.label));
        if (node.children) node.children.forEach(child => parts.push("[" + getSignature(child) + "]"));

        return parts.join("|");
    };

    const create = (tagName, className) =>
        Ren.HtmlUtils.create(tagName)._addClass(CLASS_NAME + "__" + className);

    const isFocused = (element) => document.activeElement === element;

    // The label column is left empty where the control carries its own text, as a checkbox does.
    const createRow = (node, control, isWide, label = node.label) => {

        const row = create("div", "row");

        if (node.title) row.title = node.title;

        if (isWide) row._addClass(CLASS_NAME + "__row--wide");
        else row._append(create("label", "label")._textContent(label || ""));

        return row._append(control);
    };

    /*
     * Each control's renderer gives { row, inputs, show(node) }: its row, the inputs disabled
     * while the menu hides it, and how to show a node's value in it, as one with its key is
     * updated.  The node shown is kept, so that what is done with the control is done with it.
     */

    const renderToggle = (node) => {

        const control = create("label", "toggle");
        const checkbox = Ren.HtmlUtils.create("input")._set("type", "checkbox")._attr("data-key", node.key);

        checkbox.addEventListener("change", () => {

            // The item flips the setting, so is only run where the setting isn't already as asked.
            if (checkbox.checked !== node.checked) change(() => runItem(node.item), node.key);
        });

        control._append(checkbox, create("span", "toggle-text")._textContent(node.label));

        return {
            // In the control column, its text beside it, so it lines up with the other controls.
            row: createRow(node, control, false, ""),
            inputs: [checkbox],
            show: (newNode) => {

                node = newNode;
                checkbox.checked = node.checked;
            }
        };
    };

    const renderRadios = (node) => {

        const control = create("div", "radios")._attr("role", "radiogroup");
        // Unique in the page, as other forms' radio buttons are in it too.
        const name = CLASS_NAME + "-radio-" + (++Ren.MenuSettingsForm.radioNameCount);

        if (node.label) control.setAttribute("aria-label", node.label);

        const labels = node.options.map((option, index) => {

            const key = node.key + "#" + index;
            const radio = Ren.HtmlUtils.create("input")
                ._set("type", "radio")
                ._set("name", name)
                ._attr("data-key", key);

            const label = create("label", "radio")._append(
                radio,
                create("span", "radio-text")._textContent(option.label)
            );

            if (option.title) label.title = option.title;

            radio.addEventListener("change", () => {

                const current = node.options[index];

                if (radio.checked && !current.selected && current.item) {
                    change(() => runItem(current.item), key);
                }
            });

            control._append(label);

            return label;
        });

        return {
            // Kept in the control column even where unlabelled, so every choice's buttons line up.
            row: createRow(node, control, false)._addClass(CLASS_NAME + "__row--radios"),
            // Each is disabled with its option (see show).
            inputs: [],
            show: (newNode) => {

                node = newNode;

                labels.forEach((label, index) => {

                    const option = node.options[index];
                    const radio = label.querySelector("input");

                    radio.checked = !!option.selected;
                    radio.disabled = !!(option.isHidden || node.isHidden);
                    label.classList.toggle(UNAVAILABLE_CLASS_NAME, !!option.isHidden && !node.isHidden);
                });
            }
        };
    };

    const renderSelect = (node) => {

        const select = create("select", "select")._attr("data-key", node.key);

        // Where none is selected, as for series set differently, a blank option says so.
        const blankOption = Ren.HtmlUtils.create("option")._set("value", "")._textContent("");

        select._append(blankOption);

        const optionElements = node.options.map((option, index) => {

            const element = Ren.HtmlUtils.create("option")
                ._set("value", String(index))
                ._textContent(option.label);

            select._append(element);

            return element;
        });

        select.addEventListener("change", () => {

            const option = node.options[parseInt(select.value)];

            if (option && !option.selected) change(() => runItem(option.item), node.key);
        });

        return {
            row: createRow(node, select, false),
            inputs: [select],
            show: (newNode) => {

                node = newNode;

                if (isFocused(select)) return;

                const selectedIndex = node.options.findIndex(option => option.selected);

                optionElements.forEach((element, index) => {
                    element.disabled = !!node.options[index].isHidden;
                });

                blankOption.hidden = selectedIndex >= 0;
                select.value = selectedIndex >= 0 ? String(selectedIndex) : "";
            }
        };
    };

    const renderNumber = (node) => {

        const control = create("div", "number");

        const createInput = (type, className) => create("input", className)
            ._set("type", type)
            ._set("min", String(node.min))
            ._set("max", String(node.max))
            ._set("step", String(node.step));

        const input = createInput("number", "number-input")._attr("data-key", node.key);
        const slider = node.showSlider ? createInput("range", "slider") : null;
        const inputs = [input, slider].filter(Boolean);

        const readValue = (from) => {

            const value = parseFloat(from.value);

            return isNaN(value) ? null : Math.min(node.max, Math.max(node.min, value));
        };

        // As the editor it stands in for, a change shows as it is made and is kept once done.  Where
        // typed values wait for Enter, the slider's still show as it's slid.
        const apply = (from, isDone) => {

            const value = readValue(from);

            if (value === null) return;

            inputs.forEach(other => { if (other !== from) other.value = String(value); });

            if (!node.applyOnEnterOnly || from !== input || isDone) runAction(() => node.onChange(value));

            if (isDone) change(() => node.onCommit && node.onCommit(), node.key);
        };

        inputs.forEach(element => {

            element.addEventListener("input", () => apply(element, false));
            element.addEventListener("change", () => apply(element, true));
        });

        control._append(input);

        if (node.unit) control._append(create("span", "unit")._textContent(node.unit));
        if (slider) control._append(slider);

        return {
            row: createRow(node, control, false),
            inputs,
            show: (newNode) => {

                node = newNode;

                inputs.forEach(element => {
                    if (!isFocused(element)) element.value = String(node.value ?? "");
                });
            }
        };
    };

    const renderText = (node) => {

        const input = create("input", "text-input")._set("type", "text")._attr("data-key", node.key);

        input.addEventListener("change", () => change(() => node.onApply(input.value), node.key));

        input.addEventListener("keydown", (e) => {

            if (e.key === "Enter") input.blur();
        });

        return {
            row: createRow(node, input, false),
            inputs: [input],
            show: (newNode) => {

                node = newNode;

                if (!isFocused(input)) input.value = node.value;
            }
        };
    };

    const renderButton = (node) => {

        const button = create("button", "button")
            ._set("type", "button")
            ._attr("data-key", node.key)
            ._textContent(node.label);

        button.addEventListener("click", () => change(() => runItem(node.item), node.key));

        return {
            row: createRow(node, button, true),
            inputs: [button],
            show: (newNode) => { node = newNode; }
        };
    };

    /**
     * Wraps a menu's items so that what they do, and what they show, is worked out as the form's
     * own controls are (see runAction), and so that the form follows a change made from them.
     */
    const wrapMenuItems = (items) => items.map(item => {

        if (!item || (!item.action && !item.submenu)) return item;

        const inContext = (fn) => function () {

            const args = arguments;
            let result;

            runAction(() => { result = fn.apply(item, args); });

            return result;
        };

        const wrapped = Object.create(item);

        ["ticked", "visible", "text", "title"].forEach(name => {

            if (typeof item[name] === "function") wrapped[name] = inContext(item[name]);
        });

        if (item.action) {

            wrapped.action = function () {

                inContext(item.action).apply(null, arguments);
                onChanged();
            };
        }

        if (item.submenu) {

            Object.defineProperty(wrapped, "submenu", {
                get: () => wrapMenuItems(inContext(() => item.submenu)() || [])
            });
        }

        return wrapped;
    });

    const renderMenu = (node) => {

        const button = create("button", "menu-button")
            ._addClass("js-ren-context-menu-button")
            ._set("type", "button")
            ._attr("data-key", node.key)
            ._set("title", "Change " + (node.label || "").toLowerCase());

        const value = create("span", "menu-value");

        button._append(value, create("span", "menu-pencil")._textContent("✎"));

        const getMenuItems = () => {

            let items = [];

            runAction(() => { items = node.getMenuItems(); });

            return wrapMenuItems(items);
        };

        button.addEventListener("click", (e) => {

            e.stopPropagation();

            lastUsedAnchors = getAnchors(button);

            const rect = button.getBoundingClientRect();

            Ren.ContextMenuRenderer.open(
                getMenuItems(),
                { x: rect.left + window.scrollX, y: rect.bottom + window.scrollY },
                false,
                getMenuItems
            );
        });

        return {
            row: createRow(node, button, false),
            inputs: [button],
            show: (newNode) => {

                node = newNode;
                value._textContent(node.value);
            }
        };
    };

    const CONTROL_RENDERERS = {
        toggle: renderToggle,
        number: renderNumber,
        text: renderText,
        button: renderButton,
        menu: renderMenu
    };

    /**
     * Renders a control, noting how to show a node with its key in it, greyed out and disabled
     * where the menu hides it.
     */
    const renderControl = (node, renderer) => {

        const { row, inputs, show } = renderer(node);

        const update = (newNode) => {

            show(newNode);

            row.classList.toggle(UNAVAILABLE_CLASS_NAME, !!newNode.isHidden);
            inputs.forEach(input => { input.disabled = !!newNode.isHidden; });
        };

        update(node);
        updaters.set(node.key, update);

        return row;
    };

    const renderChildren = (parent, nodes, depth) => {

        nodes.forEach(node => {

            const element = renderNode(node, depth);

            if (element) parent._append(element);
        });

        return parent;
    };

    const createGroupElement = (key, depth) => {

        const group = create("div", "group");

        if (key !== null) group._attr("data-group-key", key);

        // Each level down is set in a little further, its labels' column narrowed to match so that
        // its controls line up with the rest.
        if (depth > 0) {

            group._addClass(CLASS_NAME + "__group--nested");
            group.style.setProperty("--ren-menu-settings-form-depth", String(depth));
        }

        return group;
    };

    const renderGroup = (node, depth) => {

        const group = createGroupElement(node.key, depth);

        if (node.isScope) group._addClass(CLASS_NAME + "__group--scope");

        if (node.heading) {

            const heading = create("div", "heading")._textContent(node.heading);

            if (node.title) heading.title = node.title;

            group._append(heading);
        }

        // A list's checkboxes scroll in a box of their own, where there are too many to show.
        if (node.isList) {
            group._append(renderChildren(create("div", "list")._attr("data-list-key", node.key), node.children, depth + 1));
        }
        else {
            renderChildren(group, node.children, depth + 1);
        }

        // Its heading is greyed out with its controls, where all of them are hidden.
        const update = (newNode) =>
            group.classList.toggle(CLASS_NAME + "__group--unavailable", !!newNode.isHidden);

        update(node);
        updaters.set(node.key, update);

        return group;
    };

    /**
     * Renders a choice, with the settings for what it chooses, where it has any (see
     * Ren.MenuSettingsModel's isChoiceLed), set in beneath it.  The two are a group, so that the
     * choice keeps its place on screen as they come and go.
     */
    const renderChoice = (node, depth) => {

        const row = renderControl(node, node.options.length <= MAX_RADIO_OPTIONS ? renderRadios : renderSelect);

        if (!node.children?.length) return row;

        return create("div", "choice")
            ._attr("data-group-key", node.key)
            ._append(row, renderChildren(createGroupElement(null, depth + 1), node.children, depth + 1));
    };

    const renderNode = (node, depth) => {

        if (node.type === "group") return renderGroup(node, depth);
        if (node.type === "choice") return renderChoice(node, depth);

        const renderer = CONTROL_RENDERERS[node.type];

        return renderer ? renderControl(node, renderer) : null;
    };

    const forEachNode = (node, fn) => {

        fn(node);

        if (node.children) node.children.forEach(child => forEachNode(child, fn));
    };

    const findByAttribute = (name, value) => value == null ? null :
        Array.from(container.querySelectorAll("[" + name + "]"))
            .find(element => element.getAttribute(name) === value);

    const findByKey = (key) => findByAttribute("data-key", key);

    /**
     * Gets what to keep in place for a control: the control, then each group it is in, as the
     * control itself may go once used.
     */
    const getAnchors = (element) => {

        const anchors = [];

        if (!element) return anchors;

        anchors.push({ name: "data-key", value: element.getAttribute("data-key") });

        for (let group = element.closest("[data-group-key]"); group; group = group.parentElement.closest("[data-group-key]")) {
            anchors.push({ name: "data-group-key", value: group.getAttribute("data-group-key") });
        }

        return anchors;
    };

    const findAnchor = (anchors) => {

        for (let i = 0; i < anchors.length; i++) {

            const element = findByAttribute(anchors[i].name, anchors[i].value);

            if (element) return { anchor: anchors[i], element };
        }

        return null;
    };

    // The element the form scrolls in, such as a window's tab.
    const getScroller = () => {

        for (let element = container; element; element = element.parentElement) {

            const overflowY = getComputedStyle(element).overflowY;

            if (overflowY === "auto" || overflowY === "scroll") return element;
        }

        return null;
    };

    /**
     * Gets the subtabs a model's settings are shown on, [{ title, key, isHidden, nodes }], or null
     * where it has fewer than two sections.
     */
    const getSubtabs = (model) => {

        // A group setting apart what acts on a scope (see Ren.MenuSettingsModel) is not a section.
        const isSection = (node) => node.type === "group" && !!node.heading && !node.isScope;
        const sections = model.children.filter(isSection);

        if (sections.length < 2) return null;

        const subtabs = [];
        const others = model.children.filter(node => !isSection(node));

        if (others.length) {

            subtabs.push({
                title: GENERAL_SUBTAB_TITLE,
                key: "",
                isHidden: others.every(node => node.isHidden),
                nodes: others
            });
        }

        sections.forEach(section => subtabs.push({
            title: section.heading,
            key: section.key,
            isHidden: !!section.isHidden,
            nodes: section.children
        }));

        return subtabs;
    };

    const renderSubtabs = (form, subtabs) => {

        if (!subtabs.some(subtab => subtab.title === selectedSubtabTitle)) {
            selectedSubtabTitle = subtabs[0].title;
        }

        const strip = create("div", "subtabs");
        const panels = [];

        const select = (title) => {

            selectedSubtabTitle = title;

            subtabs.forEach((subtab, index) => {

                const isSelected = subtab.title === title;

                strip.children[index].classList.toggle(CLASS_NAME + "__subtab--selected", isSelected);
                panels[index].style.display = isSelected ? "" : "none";
            });
        };

        subtabs.forEach(subtab => {

            const tab = create("button", "subtab")._set("type", "button")._textContent(subtab.title);

            tab.classList.toggle(UNAVAILABLE_CLASS_NAME, subtab.isHidden);

            tab.addEventListener("click", () => {

                if (subtab.title === selectedSubtabTitle) return;

                select(subtab.title);
                lastUsedAnchors = [];

                const scroller = getScroller();

                if (scroller) scroller.scrollTop = 0;
            });

            strip._append(tab);

            // Each panel is a group, so that a control in it can be kept in place by it.
            const panel = create("div", "subtab-panel")._attr("data-group-key", subtab.key);

            panels.push(renderChildren(panel, subtab.nodes, 0));
        });

        form._append(strip);
        panels.forEach(panel => form._append(panel));

        select(selectedSubtabTitle);
    };

    const render = (model) => {

        const focusedKey = document.activeElement && container.contains(document.activeElement)
            ? document.activeElement.getAttribute("data-key")
            : null;

        // The control last used, or else the one with the focus, is kept where it is on screen,
        // so that what it changed comes and goes around it rather than moving it.
        const scroller = getScroller();
        const scrollTop = scroller ? scroller.scrollTop : 0;
        const anchors = lastUsedAnchors.length ? lastUsedAnchors : getAnchors(findByKey(focusedKey));
        const found = findAnchor(anchors);
        const anchorTop = found ? found.element.getBoundingClientRect().top : null;

        // Each list scrolled as it was.
        const listScrollTops = new Map(Array.from(container.querySelectorAll("[data-list-key]"))
            .map(list => [list.getAttribute("data-list-key"), list.scrollTop]));

        updaters = new Map();

        const form = Ren.HtmlUtils.create("div")._addClass(CLASS_NAME);
        const subtabs = getSubtabs(model);

        if (!model.children.length) form._append(create("div", "empty")._textContent("There are no settings here."));
        else if (subtabs) renderSubtabs(form, subtabs);
        else renderChildren(form, model.children, 0);

        Ren.HtmlUtils.enrich(container)._content(form);

        listScrollTops.forEach((listScrollTop, key) => {

            const list = findByAttribute("data-list-key", key);

            if (list) list.scrollTop = listScrollTop;
        });

        if (scroller) {

            scroller.scrollTop = scrollTop;

            const newAnchor = found ? findByAttribute(found.anchor.name, found.anchor.value) : null;

            if (newAnchor) scroller.scrollTop += newAnchor.getBoundingClientRect().top - anchorTop;
        }

        const focused = findByKey(focusedKey);

        if (focused) focused.focus({ preventScroll: true });
    };

    const getOptionKey = (node, option) => node.key + "#" + option.label;

    /**
     * Notes the controls and options a model shows as available, so that they're kept, greyed out,
     * once hidden.
     */
    const noteSeen = (node) => forEachNode(node, n => {

        if (n.type === "choice") {
            n.options.forEach(option => { if (!option.isHidden) seenKeys.add(getOptionKey(n, option)); });
        }
        else if (n.type !== "group" && !n.isHidden) {
            seenKeys.add(n.key);
        }
    });

    /**
     * Gets the part of a model to show: what is available, and what was and is now hidden.  What
     * has always been hidden is left out, as it may be for another kind of column or chart.
     */
    const getShown = (node) => {

        const shown = Object.assign({}, node);

        if (node.children) shown.children = node.children.map(getShown).filter(Boolean);

        if (node.type === "group") {

            if (!shown.children.length && node.key) return null;

            shown.isHidden = shown.children.every(child => child.isHidden);

            return shown;
        }

        if (node.type === "choice") {

            shown.options = node.options.filter(option =>
                !option.isHidden || seenKeys.has(getOptionKey(node, option))
            );

            return shown.options.length ? shown : null;
        }

        return !node.isHidden || seenKeys.has(node.key) ? shown : null;
    };

    const update = (fullModel) => {

        noteSeen(fullModel);

        const model = getShown(fullModel);
        const signature = getSignature(model);

        if (signature !== shownSignature) {

            shownSignature = signature;
            render(model);
            return;
        }

        forEachNode(model, node => {

            const updateNode = updaters.get(node.key);

            if (updateNode) updateNode(node);
        });
    };

    return {
        update
    };
};

// Numbers the radio buttons' names across every form, which tie each choice's buttons together.
Ren.MenuSettingsForm.radioNameCount = 0;
