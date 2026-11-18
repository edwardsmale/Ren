/**
 * Shows the settings Ren.MenuSettingsModel works out from a menu's items as a form: a heading for
 * each group, and a row for each control, its label on the left.  A choice of a few options is a
 * set of radio buttons, outlined as one, and a longer one a dropdown.
 *
 * Options:
 *   runAction(fn) - runs what a control does, as the menu would have run it, e.g. as if opened on
 *                   the visualisation.
 *   onChanged()   - called once a control has changed something, to build the form afresh.
 *
 * Where the model has more than one section, each section is a subtab, so that only one section's
 * settings are shown at a time.  Settings in no section come first, under "General".
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

    // The most options shown as radio buttons rather than a dropdown, beyond which they would take
    // up too much of the form.
    const MAX_RADIO_OPTIONS = 6;


    const runAction = (options && options.runAction) || (fn => fn());
    const onChanged = (options && options.onChanged) || (() => {});

    let shownSignature = null;

    // The control last used, then the groups it is in, innermost first: the first of them still
    // there is kept in place where the form is rebuilt.
    let lastUsedAnchors = [];

    // The controls and options that have been available while the form has been open.
    const seenKeys = new Set();

    // Updates each shown control's value from its node, by key.
    let valueUpdaters = new Map();
    let groupUpdaters = new Map();

    // The subtab shown, by its title, kept as the form is rebuilt.
    let selectedSubtabTitle = null;

    const GENERAL_SUBTAB_TITLE = "General";

    const runItem = (item) => runAction(() => item.action.apply(null, item.actionParameters ?? []));

    const change = (fn, key) => {

        if (key) lastUsedAnchors = getAnchors(findByKey(key));

        runAction(fn);
        onChanged();
    };

    const isShownAsRadios = (node) => node.options.length <= MAX_RADIO_OPTIONS;

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

    /**
     * Shows whether a node is hidden by the menu, greying out its element and disabling the given
     * controls.
     */
    const showHidden = (element, controls, isHidden) => {

        element.classList.toggle(CLASS_NAME + "--unavailable", !!isHidden);
        controls.forEach(control => { control.disabled = !!isHidden; });
    };

    const createRow = (node, control, isWide) => {

        const row = create("div", "row");

        if (node.title) row.title = node.title;

        if (isWide) {

            row._addClass(CLASS_NAME + "__row--wide");
        }
        else {

            row._append(create("label", "label")._textContent(node.label || ""));
        }

        row._append(control);

        return row;
    };

    const renderToggle = (node) => {

        const control = create("label", "toggle");
        const checkbox = Ren.HtmlUtils.create("input")._set("type", "checkbox")._attr("data-key", node.key);

        checkbox.checked = node.checked;

        checkbox.addEventListener("change", () => {

            // The item flips the setting, so is only run where the setting isn't already as asked.
            if (checkbox.checked !== node.checked) change(() => runItem(node.item), node.key);
        });

        control._append(checkbox, create("span", "toggle-text")._textContent(node.label));

        const row = createRow(node, control, true);

        const showValue = () => {

            checkbox.checked = node.checked;
            showHidden(row, [checkbox], node.isHidden);
        };

        showValue();

        valueUpdaters.set(node.key, newNode => {

            node = newNode;
            showValue();
        });

        return row;
    };

    const renderChoiceRadios = (node) => {

        const control = create("div", "radios")._attr("role", "radiogroup");
        // Unique in the page, as other forms' radio buttons are in it too.
        const name = CLASS_NAME + "-radio-" + (++Ren.MenuSettingsForm.radioNameCount);

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

        if (node.label) control.setAttribute("aria-label", node.label);

        const row = createRow(node, control, !node.label)._addClass(CLASS_NAME + "__row--radios");

        const showSelected = () => {

            labels.forEach((label, index) => {

                const option = node.options[index];
                const radio = label.querySelector("input");

                radio.checked = !!option.selected;
                showHidden(label, [radio], option.isHidden || node.isHidden);
            });

            row.classList.toggle(CLASS_NAME + "--unavailable", !!node.isHidden);
        };

        showSelected();

        valueUpdaters.set(node.key, newNode => {

            node = newNode;
            showSelected();
        });

        return row;
    };

    const renderChoiceSelect = (node) => {

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

        const row = createRow(node, select, false);

        const showSelected = () => {

            const selectedIndex = node.options.findIndex(option => option.selected);

            optionElements.forEach((element, index) => {
                element.disabled = !!node.options[index].isHidden;
            });

            blankOption.hidden = selectedIndex >= 0;
            select.value = selectedIndex >= 0 ? String(selectedIndex) : "";

            showHidden(row, [select], node.isHidden);
        };

        showSelected();

        select.addEventListener("change", () => {

            const option = node.options[parseInt(select.value)];

            if (option && !option.selected) change(() => runItem(option.item), node.key);
        });

        valueUpdaters.set(node.key, newNode => {

            node = newNode;
            if (document.activeElement !== select) showSelected();
        });

        return row;
    };

    const renderNumber = (node) => {

        const control = create("div", "number");

        const createInput = (type, className) => {

            const input = create("input", className)
                ._set("type", type)
                ._set("min", String(node.min))
                ._set("max", String(node.max))
                ._set("step", String(node.step));

            input.value = String(node.value ?? "");

            return input;
        };

        const input = createInput("number", "number-input")._attr("data-key", node.key);
        const slider = node.showSlider ? createInput("range", "slider") : null;

        const readValue = (from) => {

            const value = parseFloat(from.value);

            return isNaN(value) ? null : Math.min(node.max, Math.max(node.min, value));
        };

        // As the editor it stands in for, a change shows as it is made and is kept once done.
        const apply = (from, isDone) => {

            const value = readValue(from);

            if (value === null) return;

            if (from !== input) input.value = String(value);
            if (slider && from !== slider) slider.value = String(value);

            if (!node.applyOnEnterOnly || isDone) runAction(() => node.onChange(value));

            if (isDone) change(() => node.onCommit && node.onCommit(), node.key);
        };

        [input, slider].filter(Boolean).forEach(element => {

            element.addEventListener("input", () => apply(element, false));
            element.addEventListener("change", () => apply(element, true));
        });

        control._append(input);

        if (node.unit) control._append(create("span", "unit")._textContent(node.unit));
        if (slider) control._append(slider);

        const row = createRow(node, control, false);
        const inputs = [input, slider].filter(Boolean);

        showHidden(row, inputs, node.isHidden);

        valueUpdaters.set(node.key, newNode => {

            node = newNode;

            if (document.activeElement !== input) input.value = String(newNode.value ?? "");
            if (slider && document.activeElement !== slider) slider.value = String(newNode.value ?? "");

            showHidden(row, inputs, newNode.isHidden);
        });

        return row;
    };

    const renderText = (node) => {

        const input = create("input", "text-input")._set("type", "text")._attr("data-key", node.key);

        input.value = node.value;

        input.addEventListener("change", () => change(() => node.onApply(input.value), node.key));

        input.addEventListener("keydown", (e) => {

            if (e.key === "Enter") input.blur();
        });

        const row = createRow(node, input, false);

        showHidden(row, [input], node.isHidden);

        valueUpdaters.set(node.key, newNode => {

            node = newNode;
            if (document.activeElement !== input) input.value = newNode.value;
            showHidden(row, [input], newNode.isHidden);
        });

        return row;
    };

    const renderButton = (node) => {

        const button = create("button", "button")
            ._set("type", "button")
            ._attr("data-key", node.key)
            ._textContent(node.label);

        button.addEventListener("click", () => change(() => runItem(node.item), node.key));

        const row = createRow(node, button, true);

        showHidden(row, [button], node.isHidden);

        valueUpdaters.set(node.key, newNode => {

            node = newNode;
            showHidden(row, [button], newNode.isHidden);
        });

        return row;
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

        const row = createRow(node, button, false);

        const showValue = () => {

            value._textContent(node.value);
            button.disabled = !!node.isHidden;
            row.classList.toggle(CLASS_NAME + "--unavailable", !!node.isHidden);
        };

        showValue();

        valueUpdaters.set(node.key, newNode => {

            node = newNode;
            showValue();
        });

        return row;
    };

    const renderNode = (node, depth) => {

        switch (node.type) {

            case "group": return renderGroup(node, depth);
            case "toggle": return renderToggle(node);
            case "choice": return isShownAsRadios(node) ? renderChoiceRadios(node) : renderChoiceSelect(node);
            case "number": return renderNumber(node);
            case "text": return renderText(node);
            case "button": return renderButton(node);
            case "menu": return renderMenu(node);
            default: return null;
        }
    };

    function renderGroup(node, depth) {

        const group = create("div", "group")
            ._addClass(CLASS_NAME + "__group--depth-" + Math.min(depth, 3))
            ._attr("data-group-key", node.key);

        if (node.heading) {

            const heading = create("div", "heading")._textContent(node.heading);

            if (node.title) heading.title = node.title;

            group._append(heading);
        }

        node.children.forEach(child => {

            const element = renderNode(child, depth + 1);

            if (element) group._append(element);
        });

        // Its heading is greyed out with its controls, where all of them are hidden.
        const showGroupHidden = (isHidden) =>
            group.classList.toggle(CLASS_NAME + "__group--unavailable", !!isHidden);

        showGroupHidden(node.isHidden);
        groupUpdaters.set(node.key, newNode => showGroupHidden(newNode.isHidden));

        return group;
    }

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

        const isSection = (node) => node.type === "group" && !!node.heading;
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

            tab.classList.toggle(CLASS_NAME + "--unavailable", subtab.isHidden);

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

            subtab.nodes.forEach(node => {

                const element = renderNode(node, 0);

                if (element) panel._append(element);
            });

            panels.push(panel);
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

        valueUpdaters = new Map();
        groupUpdaters = new Map();

        const form = Ren.HtmlUtils.create("div")._addClass(CLASS_NAME);

        const subtabs = getSubtabs(model);

        if (!model.children.length) {

            form._append(create("div", "empty")._textContent("There are no settings here."));
        }
        else if (subtabs) {

            renderSubtabs(form, subtabs);
        }
        else {

            model.children.forEach(child => {

                const element = renderNode(child, 0);

                if (element) form._append(element);
            });
        }

        Ren.HtmlUtils.enrich(container)._content(form);

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

        if (node.type === "group") {

            const children = node.children.map(getShown).filter(Boolean);

            if (!children.length && node.key) return null;

            return Object.assign({}, node, { children, isHidden: children.every(child => child.isHidden) });
        }

        if (node.type === "choice") {

            const options = node.options.filter(option =>
                !option.isHidden || seenKeys.has(getOptionKey(node, option))
            );

            return options.length ? Object.assign({}, node, { options }) : null;
        }

        return !node.isHidden || seenKeys.has(node.key) ? node : null;
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

            const updateValue = valueUpdaters.get(node.key);

            if (node.type === "group") {

                const updateGroup = groupUpdaters.get(node.key);

                if (updateGroup) updateGroup(node);
            }
            else if (updateValue) {

                updateValue(node);
            }
        });
    };

    return {
        update
    };
};

// Numbers the radio buttons' names across every form, which tie each choice's buttons together.
Ren.MenuSettingsForm.radioNameCount = 0;
