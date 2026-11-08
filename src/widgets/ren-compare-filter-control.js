/**
 * A self-contained control for authoring one "compare" row-filter predicate on a single column: an
 * operator picker (grouped Text / Number / Date / Ranking / Blank, from Ren.FilterCompareOperators)
 * plus the value input(s) that operator needs, an Apply button and a Clear button.  A column may
 * carry more than one, each in a slot of its own, ANDed with one another or ORed where grouped.
 *
 * The "custom" operator filters by a function of the user's own, written in the function editor
 * window and run per row with a format function's signature; the row is kept where it returns
 * something truthy (see Ren.FilterPredicates).
 *
 * The control owns none of the filter state: it reads the column's current predicate through
 * getPredicate() and reports a new one, or null to clear, through onApply().
 */
Ren.CompareFilterControl = (() => {

    // The control's parts each carry a qa-ren- class beside their styling class, so the integration
    // tests address the control through hooks that exist for them.

    // Master switch for the operator-based compare filters.  Predicates already saved in report
    // settings still filter either way; with the switch off they cannot be authored or cleared.
    const ENABLED = true;

    // How narrow the value box can be dragged: narrow enough to be worth doing on a box holding a
    // single digit, wide enough to stay grabbable by its grip.
    const MINIMUM_VALUE_WIDTH_PX = 30;

    // Maps a descriptor's inputType to the HTML input type used for its value box.  The "function"
    // input type is absent, being authored in the function editor window.  A date is a text box,
    // picked in a calendar window rather than the browser's own date picker.
    const INPUT_TYPES = {
        text: "text",
        number: "number",
        int: "number",
        date: "text"
    };

    // Gets a value indicating whether an operator's value is a function of the user's own
    // ("custom"), authored in the function editor window rather than typed into a box.
    const isFunctionInputType = (descriptor) => !!descriptor && descriptor.inputType === "function";

    // Gets a value indicating whether an operator's values are dates, picked in a calendar window.
    const isDateInputType = (descriptor) => !!descriptor && descriptor.inputType === "date";

    // Gets a date typed or picked as yyyy-MM-dd, the form a calendar takes, or null.
    const toSortableDate = (text) => {

        const date = Ren.DateUtils.parseDateTimeUniversal(String(text ?? "").trim(), false);

        return date ? Ren.DateUtils.toSortableDate(date) : null;
    };

    /**
     * Creates a compare-filter control.
     *
     * @param {object} options
     * @param {string} options.column - The column identifier the predicate filters on.
     * @param {number} [options.slot] - Which of the column's compare filters this control authors
     *     (see Ren.FilterCompareOperators).  Omitted, or 0, for the only one.
     * @param {function} options.getPredicate - Returns the column's current compare predicate, or
     *     null.
     * @param {function} options.onApply - Called with the new predicate, or null to clear.
     * @param {boolean} [options.compact] - Tighter layout for an inline strip.
     * @param {string} [options.columnKind] - The target column's value kind ("text" / "number" /
     *     "date"), which decides the operators offered and what the value box accepts.  Omitted
     *     means "unknown", in which case every operator is offered.
     * @param {boolean} [options.useContextMenuOperatorPicker] - Pick the operator from a Ren
     *     context menu opened by the down arrow, rather than from a native select.
     * @param {function} [options.onRemove] - Removes this compare filter from the column: given
     *     one, the cross button removes the filter rather than resetting it.  Omitted for the last
     *     (or only) compare filter, whose cross resets it.
     * @param {number} [options.orGroup] - The slot naming the OR group this compare filter belongs
     *     to, written into the predicate so it is ORed with that slot's filter rather than ANDed.
     *     Omitted where the filter leads its own group.
     * @param {function} [options.onAddAnother] - Adds a further compare filter, ANDed with this:
     *     given one, an "and" link is drawn beside the cross button.
     * @param {function} [options.onAddOr] - As onAddAnother, for a further filter ORed with this
     *     one: given one, an "or" link is drawn beside the "and".
     * @param {string} [options.joinWord] - The word joining this filter to the one drawn beneath
     *     it, shown as plain text in the links' place.  Omitted where nothing is drawn beneath.
     * @param {number} [options.valueWidth] - How wide to draw the value box, in pixels.  Omitted
     *     leaves it at the stylesheet's own width.
     * @param {function} [options.onValueWidthChanged] - Records a new value box width: given one,
     *     a grip is drawn on the box's right edge, and this is called with the width it was left
     *     at.
     * @param {function} [options.onValueWidthChanging] - Called with the box's width as the grip is
     *     dragged, before it is settled on.  Only called where onValueWidthChanged is given.
     * @param {function} [options.getMaximumValueWidth] - Given the box's current width, returns how
     *     wide it may be dragged, in pixels, measured afresh on each move.  Omitted, or returning
     *     null, leaves the box free to grow.
     * @param {function} [options.onOperatorChanged] - Called once a newly chosen operator has shown
     *     the value inputs it takes, which can leave the control wider or narrower than it was.
     * @param {object} [options.pendingInputs] - A host-owned { operator, value, value2 } store that
     *     survives a rebuild of the control, holding what the inputs read while no filter is in
     *     effect, and the group of the calendar its dates are picked in.  Omitted where the control
     *     outlives the filter.
     * @returns {{ element: HTMLElement, refresh: function, focusValue: function }}
     */
    const create = (options) => {

        const CompareOperators = Ren.FilterCompareOperators;
        const column = options.column;
        const slot = options.slot ?? 0;

        // The target column's value kind restricts which operators are offered and what the value
        // box accepts.  Null when the host does not know it (every operator shown).
        const columnKind = options.columnKind ?? null;

        // Where the unapplied operator and typed values are kept between rebuilds of the control,
        // or null where the inputs themselves are the only record.
        const pendingInputs = options.pendingInputs ?? null;

        const element = Ren.HtmlUtils.create("div")._addClass("ren-compare-filter", "qa-ren-compare-filter");
        if (options.compact) element._addClass("ren-compare-filter--compact");

        // --- Operator picker (built once; the operator set is fixed) ---

        // How the operator is chosen: from a native select of option groups, or from a Ren context
        // menu opened by the down arrow.
        const useContextMenuPicker = !!options.useContextMenuOperatorPicker;

        // The chosen operator, which is all the rest of the control reads. Empty where the column's
        // predicate names an operator this column is not offered, so the value inputs are hidden.
        let selectedOperatorId = "";

        // The custom function's source, held here rather than in the first value box: an <input>
        // strips the newlines out of whatever is put in it, which would run a multi-line function's
        // lines together - swallowing everything after a // comment - by the time it was read back.
        let functionSource = "";

        const operatorDisplaySymbol = Ren.HtmlUtils.create("span")
            ._addClass("ren-compare-filter__operator-symbol");

        const createOperatorSelect = () => {

            const select = Ren.HtmlUtils.create("select")
                ._addClass("ren-compare-filter__operator", "qa-ren-compare-filter-operator");

            const groups = CompareOperators.getGroupsForColumnKind(columnKind);

            for (let g = 0; g < groups.length; g++) {

                let optgroup = null;
                let optgroupLabel = null;

                const operators =
                    CompareOperators.getOperatorsInGroupForColumnKind(groups[g], columnKind);

                for (let i = 0; i < operators.length; i++) {

                    // Option groups cannot nest, so an operator's submenu is an option group of
                    // its own, following the group it sits in.
                    const label = operators[i].submenu ? operators[i].submenu.label : groups[g];

                    if (label !== optgroupLabel) {

                        optgroupLabel = label;
                        optgroup = Ren.HtmlUtils.create("optgroup")._attr("label", label);
                        select.appendChild(optgroup);
                    }

                    // An operator marked separatorBefore starts a new band within its group,
                    // divided by a disabled option of dashes (<hr> in a <select> is not supported
                    // everywhere).  Skipped when the operator is first in its option group.
                    if (operators[i].separatorBefore && optgroup.children.length > 0) {

                        optgroup.appendChild(
                            Ren.HtmlUtils.create("option")
                                ._addClass("ren-compare-filter__operator-separator")
                                ._attr("disabled", "disabled")
                                ._textContent("──────────")
                        );
                    }

                    const option = Ren.HtmlUtils.create("option")
                        ._attr("value", operators[i].id)
                        ._attr("data-symbol", operators[i].symbol)
                        ._textContent(operators[i].label);

                    optgroup.appendChild(option);
                }
            }

            return select;
        };

        // The button the context-menu picker is opened from.  It sits transparently over the
        // collapsed operator text and the down arrow, so the whole of the picker opens the menu.
        // Its items are rebuilt on each open, so the tick always follows the current operator.
        const createOperatorButton = () => {

            const button = Ren.HtmlUtils.create("button")
                ._attr("type", "button")
                ._attr("title", "Change the operator")
                ._addClass(
                    "ren-compare-filter__operator",
                    "ren-compare-filter__operator--button",
                    "ren-link-button",
                    "qa-ren-compare-filter-operator"
                );

            // Wrapped rather than passed directly, since buildOperatorMenuItems is declared below
            // this - the wrapper resolves it when the menu is opened.
            Ren.AddButtonMenuItems(button, () => buildOperatorMenuItems());

            return button;
        };

        const operatorSelect = useContextMenuPicker ? null : createOperatorSelect();
        const operatorButton = useContextMenuPicker ? createOperatorButton() : null;

        // --- Value inputs (shown / typed to suit the chosen operator) ---
        const valueInput1 = Ren.HtmlUtils.create("input")
            ._addClass(
                "ren-compare-filter__value",
                "ren-compare-filter__value--1",
                "qa-ren-compare-filter-value-1"
            );

        const valueInput2 = Ren.HtmlUtils.create("input")
            ._addClass(
                "ren-compare-filter__value",
                "ren-compare-filter__value--2",
                "qa-ren-compare-filter-value-2"
            );

        // Shown in the value box's place while the custom function operator is chosen, as the way
        // back into the function editor window.
        const editFunctionButton = Ren.HtmlUtils.create("button")
            ._attr("type", "button")
            ._attr("title", "Edit the function rows are filtered by")
            ._addClass(
                "ren-compare-filter__edit-function",
                "ren-link-button",
                "qa-ren-compare-filter-edit-function"
            )
            ._textContent("edit function");

        const tickContent = Ren.HtmlUtils.create("span")
            ._addClass("ren-compare-filter__apply-tick")
            ._textContent("✓");

        const spinnerContent = Ren.HtmlUtils.create("span")
            ._addClass("ren-compare-filter__apply-spinner");

        const applyButton = Ren.HtmlUtils.create("button")
            ._attr("type", "button")
            ._addClass("ren-compare-filter__apply", "qa-ren-compare-filter-apply")
            ._append(tickContent, spinnerContent);

        // What the cross button does: take this compare filter off the column where the host offers
        // one that can be removed, or - for the last one left, which the column always keeps -
        // reset it to empty.
        const removeFilter = options.onRemove ?? null;

        const clearButton = Ren.HtmlUtils.create("button")
            ._attr("type", "button")
            ._addClass(
                "ren-compare-filter__clear",
                "ren-link-button",
                "qa-ren-compare-filter-clear"
            )
            ._attr("title", removeFilter ? "Remove this compare filter" : "Clear filter")
            ._textContent("✕");

        if (removeFilter) clearButton._addClass("qa-ren-compare-filter-remove");

        // The links adding a further compare filter to the column, each reading as the word joining
        // it to this one: "and" for a filter a row must also pass, "or" for one it may pass
        // instead.  Drawn only where the host offers them.
        const buildJoinLink = (word, title, addFilter) => {

            const link = Ren.HtmlUtils.create("button")
                ._attr("type", "button")
                ._addClass(
                    "ren-compare-filter__join",
                    "ren-link-button",
                    "qa-ren-compare-filter-" + word
                )
                ._attr("title", title)
                ._textContent(word);

            Ren.DomEventUtils.onClickWithoutSelectingContainer(link, () => addFilter());

            return link;
        };

        const addAnotherLink = options.onAddAnother
            ? buildJoinLink(
                "and",
                "Add another compare filter, which a row must pass as well as this one",
                options.onAddAnother
            )
            : null;

        const addOrLink = options.onAddOr
            ? buildJoinLink(
                "or",
                "Add another compare filter, which a row may pass instead of this one",
                options.onAddOr
            )
            : null;

        // The word joining this filter to the one drawn beneath it, as plain text rather than a
        // link: the links that add a further filter belong to the last of the group alone.
        const joinWordText = options.joinWord
            ? Ren.HtmlUtils.create("span")
                ._addClass("ren-compare-filter__join-word", "qa-ren-compare-filter-join-word")
                ._textContent(options.joinWord)
            : null;

        // The value box's width is set on both inputs together, so a "between" filter's from/to
        // pair stays even however wide it is dragged.
        const setValueWidth = (widthPx) => {

            valueInput1.style.width = widthPx + "px";
            valueInput2.style.width = widthPx + "px";
        };

        // The grip on the right edge of the value box, dragged to widen or narrow it.  Drawn only
        // where the host keeps the width it is left at, since a width that isn't kept would be lost
        // to the next rebuild of the control.
        const buildValueResizeHandle = () => {

            const handle = Ren.HtmlUtils.create("div")
                ._addClass("ren-compare-filter__value-resize", "qa-ren-compare-filter-value-resize")
                ._attr("title", "Drag to widen the value box");

            handle.addEventListener("mousedown", (event) => {

                // The drag is the grip's alone: the item beneath treats a mousedown as the start of
                // a reorder, and would take the text of the strip with the pointer besides.
                event.preventDefault();
                event.stopPropagation();

                const startX = event.pageX;
                const startWidth = valueInput1.offsetWidth;
                let width = startWidth;

                const onMouseMove = (moveEvent) => {

                    const maximum = options.getMaximumValueWidth
                        ? options.getMaximumValueWidth(valueInput1.offsetWidth)
                        : null;

                    width = Math.max(MINIMUM_VALUE_WIDTH_PX, startWidth + moveEvent.pageX - startX);

                    // The floor wins over the cap: a box narrow enough to keep hold of its grip is
                    // worth more than one that fits a panel with no room left in it.
                    if (maximum !== null && maximum !== undefined) {
                        width = Math.max(Math.min(width, maximum), MINIMUM_VALUE_WIDTH_PX);
                    }

                    setValueWidth(width);

                    if (options.onValueWidthChanging) options.onValueWidthChanging(width);
                };

                const onMouseUp = () => {

                    document.removeEventListener("mousemove", onMouseMove);
                    document.removeEventListener("mouseup", onMouseUp);

                    document.body.style.userSelect = previousUserSelect;
                    document.body.style.cursor = previousCursor;

                    if (width !== startWidth) options.onValueWidthChanged(width);
                };

                const previousUserSelect = document.body.style.userSelect;
                const previousCursor = document.body.style.cursor;

                document.body.style.userSelect = "none";
                document.body.style.cursor = "col-resize";
                document.addEventListener("mousemove", onMouseMove);
                document.addEventListener("mouseup", onMouseUp);
            });

            // The click the drag ends on is the grip's too.
            Ren.DomEventUtils.stopClickSelectingContainer(handle);

            return handle;
        };

        const valueResizeHandle = options.onValueWidthChanged ? buildValueResizeHandle() : null;

        if (options.valueWidth) setValueWidth(options.valueWidth);

        const operatorWrapper = Ren.HtmlUtils.create("div")
            ._addClass("ren-compare-filter__operator-wrapper")
            ._append(operatorSelect ?? operatorButton, operatorDisplaySymbol);

        const valueAndButtonsWrapper = Ren.HtmlUtils.create("div")
            ._addClass("ren-compare-filter__value-and-buttons-wrapper")
            ._append(valueInput1, valueInput2);

        if (valueResizeHandle) valueAndButtonsWrapper._append(valueResizeHandle);

        valueAndButtonsWrapper._append(editFunctionButton, applyButton, clearButton);

        if (joinWordText) valueAndButtonsWrapper._append(joinWordText);
        if (addAnotherLink) valueAndButtonsWrapper._append(addAnotherLink);
        if (addOrLink) valueAndButtonsWrapper._append(addOrLink);

        element._append(operatorWrapper, valueAndButtonsWrapper);

        // True when the value box and buttons have wrapped below the operator picker onto a second
        // row, that is when their row starts at or below the operator row's bottom edge.
        const valueAndButtonsHaveWrapped = () => {

            const operatorRect = operatorWrapper.getBoundingClientRect();
            const valueRect = valueAndButtonsWrapper.getBoundingClientRect();

            // Not laid out yet (detached / hidden): nothing can have wrapped.
            if (operatorRect.height === 0 && valueRect.height === 0) return false;

            return valueRect.top >= operatorRect.bottom;
        };

        // Sets the collapsed operator display behind which the (invisible, CSS-sized) select sits.
        // The comparison operators prefer their longhand label, but fall back to the compact symbol
        // (shown larger via CSS) where the label would push the value box onto a second line.
        const setOperatorDisplay = (text, isSymbol) => {

            operatorDisplaySymbol._textContent(text);
            operatorDisplaySymbol.classList.toggle(
                "ren-compare-filter__operator-symbol--symbol",
                isSymbol
            );
        };

        const updateOperatorDisplay = (operatorId) => {

            const descriptor = CompareOperators.getOperator(operatorId);

            if (!descriptor) {

                setOperatorDisplay("?", false);
                return;
            }

            if (!descriptor.symbol) {

                setOperatorDisplay(descriptor.label, false);
                return;
            }

            // Try the label first, then read back whether it caused a wrap and, if so, use the
            // symbol.
            setOperatorDisplay(descriptor.label, false);

            if (valueAndButtonsHaveWrapped()) {
                setOperatorDisplay(descriptor.symbol, true);
            }
        };

        // Shows, types and labels the value inputs for the current operator: hidden for arity 0
        // (blank / date-relative), one box for arity 1, two ("from"/"to") for a between filter.
        const configureInputsFor = (operatorId) => {

            const descriptor = CompareOperators.getOperator(operatorId);
            const arity = descriptor ? descriptor.arity : 0;
            let inputType = descriptor ? INPUT_TYPES[descriptor.inputType] ?? "text" : "text";

            // The custom function operator's value is written in the editor window, so its box is
            // hidden and the button opening the editor shown in its place.
            const isFunctionInput = isFunctionInputType(descriptor);

            // On a text column the comparison operators compare as strings, so their value box must
            // accept non-number input rather than the numeric box their descriptor asks for.
            if (columnKind === "text" && inputType === "number") inputType = "text";

            valueInput1.type = inputType;
            valueInput2.type = inputType;
            valueInput1.style.display = arity >= 1 && !isFunctionInput ? "" : "none";
            valueInput2.style.display = arity >= 2 && !isFunctionInput ? "" : "none";

            editFunctionButton.style.display = isFunctionInput ? "" : "none";

            // Nothing to size while the operator takes no value (is blank, this month, ...), nor
            // while the value is a function rather than something in a box.
            if (valueResizeHandle) {
                valueResizeHandle.style.display = arity >= 1 && !isFunctionInput ? "" : "none";
            }

            if (arity >= 2) {

                // A date range runs up to its second date, as a calendar picks one.
                valueInput1.placeholder = "from";
                valueInput2.placeholder = isDateInputType(descriptor) ? "before" : "to";
            }
            else if (descriptor && descriptor.inputType === "int") {

                valueInput1.placeholder = "N";
            }
            else {

                // No placeholder for a plain single value: the operator beside the box already says
                // what is being typed.
                valueInput1.placeholder = "";
            }
        };

        // Gets the first value as the filter reads it: the function's source while the custom
        // function operator is chosen, and whatever is in the box otherwise.
        const getValue1 = () =>
            isFunctionInputType(CompareOperators.getOperator(selectedOperatorId))
                ? functionSource
                : valueInput1.value;

        // Sets the first value, putting it wherever the current operator reads it from.  The box is
        // left empty for a function, so switching to an operator typed into it does not present the
        // function's mangled source as something to apply.
        const setValue1 = (text) => {

            const value = text ?? "";
            const isFunctionInput =
                isFunctionInputType(CompareOperators.getOperator(selectedOperatorId));

            functionSource = isFunctionInput ? value : "";
            valueInput1.value = isFunctionInput ? "" : value;
        };

        // Gets a value indicating whether an operator is offered for this column.
        const isOperatorOffered = (operatorId) => {

            const descriptor = CompareOperators.getOperator(operatorId);

            return !!descriptor
                && CompareOperators.operatorAppliesToColumnKind(descriptor, columnKind);
        };

        // Records the chosen operator and mirrors it onto whichever picker is in use.
        const setSelectedOperator = (operatorId) => {

            selectedOperatorId = isOperatorOffered(operatorId) ? operatorId : "";

            if (operatorSelect) operatorSelect.value = selectedOperatorId;

            // The button carries the chosen operator so that it can be read back off the DOM the
            // way a select's value can be.
            if (operatorButton) operatorButton.setAttribute("data-operator", selectedOperatorId);
        };

        // Notes what the control currently reads into the host's store, so a rebuilt control can be
        // refilled from it.
        const recordPendingInputs = () => {

            if (!pendingInputs) return;

            pendingInputs.operator = selectedOperatorId;
            pendingInputs.value = getValue1();
            pendingInputs.value2 = valueInput2.value;
        };

        // Gets a value indicating whether the filter in effect is the chosen operator's.
        const isSelectedOperatorInEffect = () => {

            const predicate = options.getPredicate();

            return !!predicate && predicate.type === "compare" &&
                predicate.operator === selectedOperatorId;
        };

        // Takes the operator just chosen from either picker: it decides the value inputs shown and
        // the collapsed text, and withdraws any filter still in effect (see
        // clearInEffectFilterOnOperatorChange).  The new filter itself is only written on Apply,
        // save for an operator taking no value, which has nothing left to fill in so is applied on
        // the spot - and again when picked afresh after being cleared.
        const selectOperator = (operatorId) => {

            const operatorChanged = operatorId !== selectedOperatorId;

            setSelectedOperator(operatorId);
            configureInputsFor(selectedOperatorId);
            updateOperatorDisplay(selectedOperatorId);
            recordPendingInputs();

            if (operatorChanged && options.onOperatorChanged) options.onOperatorChanged();

            const descriptor = CompareOperators.getOperator(selectedOperatorId);

            // Applying replaces whatever filter is in effect, so none is withdrawn first.
            if (descriptor && descriptor.arity === 0) {

                if (!isSelectedOperatorInEffect()) apply();

                return;
            }

            if (!operatorChanged) return;

            clearInEffectFilterOnOperatorChange();

            // Choosing "custom" is choosing to write a function, so the editor opens on the spot,
            // as the same item does on a binning menu.
            if (isFunctionInputType(CompareOperators.getOperator(selectedOperatorId))) {
                openFunctionEditor();
            }
        };

        const createOperatorMenuItem = (operatorId, label) => ({
            text: label,
            id: "compare-operator-" + operatorId,
            ticked: () => selectedOperatorId === operatorId,
            action: () => selectOperator(operatorId)
        });

        // The context-menu picker's items: one per operator, ticked when chosen, under the same
        // group headings and dividers as the select, each with an ID taken from its operator.  An
        // operator naming a submenu is filed under an item of that name, whose ID is taken from
        // the submenu's.
        const buildOperatorMenuItems = () => {

            const menuItems = [];
            const groups = CompareOperators.getGroupsForColumnKind(columnKind);

            for (let g = 0; g < groups.length; g++) {

                menuItems.push({ heading: groups[g] });

                const operators =
                    CompareOperators.getOperatorsInGroupForColumnKind(groups[g], columnKind);

                let submenu = null;
                let submenuItems = null;

                for (let i = 0; i < operators.length; i++) {

                    const operator = operators[i];
                    const startsSubmenu = !!operator.submenu && operator.submenu !== submenu;

                    // As in the select, an operator marked separatorBefore starts a new band within
                    // its group — unless it heads the group, where the divider would sit directly
                    // beneath the heading.  One starting a submenu has the divider above that.
                    if (operator.separatorBefore && i > 0) {

                        if (operator.submenu && !startsSubmenu) {
                            submenuItems.push(Ren.MENU_SEPARATOR);
                        }
                        else {

                            menuItems.push(Ren.MENU_SEPARATOR);
                        }
                    }

                    const menuItem = createOperatorMenuItem(operator.id, operator.label);

                    if (!operator.submenu) {

                        submenu = null;
                        menuItems.push(menuItem);
                        continue;
                    }

                    if (startsSubmenu) {

                        submenu = operator.submenu;
                        submenuItems = [];

                        menuItems.push({
                            text: submenu.label,
                            id: "compare-operator-submenu-" + submenu.id,
                            submenu: submenuItems
                        });
                    }

                    submenuItems.push(menuItem);
                }
            }

            return menuItems;
        };

        // Colours the Apply button while the column has a compare filter in effect, since the
        // inputs read the same whether just typed or filled from the live filter.
        const updateInEffectState = () => {

            const predicate = options.getPredicate();

            const inEffect = !!predicate && predicate.type === "compare";

            applyButton.classList.toggle("ren-compare-filter__apply--in-effect", inEffect);
            applyButton.classList.toggle("qa-ren-compare-filter-in-effect", inEffect);
        };

        const apply = () => {

            const operatorId = selectedOperatorId;
            const predicate = CompareOperators.buildPredicate(
                column,
                operatorId,
                getValue1(),
                valueInput2.value,
                slot,
                options.orGroup
            );

            // A null predicate means the value inputs are not filled in enough to apply; leave the
            // current filter untouched rather than silently clearing it.
            if (predicate) {

                // Show the spinner and disable the button whilst applying.
                tickContent.style.display = "none";
                spinnerContent.style.display = "inline-block";
                applyButton.disabled = true;
                applyButton.classList.add("ren-compare-filter__apply--loading");
                applyButton.classList.add("qa-ren-compare-filter-applying");
                clearButton.disabled = true;

                // Deferred to a macrotask so the browser paints the spinner first: a
                // requestAnimationFrame callback still runs before the paint step.
                setTimeout(() => {

                    options.onApply(predicate);
                    updateInEffectState();

                    // Restore the tick button after the filter application completes.  Use
                    // setTimeout to ensure the spinner is visible even for fast filter
                    // applications.
                    setTimeout(() => {

                        tickContent.style.display = "";
                        spinnerContent.style.display = "none";
                        applyButton.disabled = false;
                        applyButton.classList.remove("ren-compare-filter__apply--loading");
                        applyButton.classList.remove("qa-ren-compare-filter-applying");
                        clearButton.disabled = false;
                    }, 300);
                }, 0);
            }
        };

        // Opens the function editor window on the custom filter function the control holds, and
        // applies what is written in it on save; a cancelled edit writes nothing.  The source goes
        // through setValue1, so it is applied, cleared, filled and remembered as a typed value is.
        // No function, which the editor gives for a blank code box, withdraws the filter instead.
        const openFunctionEditor = () => {

            Ren.Messages.Requests.functionEditorWindow.notify(
                () => functionSource,
                (customCode) => {

                    setValue1(customCode);
                    recordPendingInputs();

                    if (functionSource.trim() === "") {
                        clearFilterKeepingInputs();
                    }
                    else {

                        apply();
                    }
                },
                null,
                null,
                { centred: true, parameterSet: "filter" }
            );
        };

        // The calendar a date is picked in, grouped by whether it picks a single date or a range,
        // so that one left open from another operator picks nothing.  Kept in the host's store
        // where there is one, so that a calendar left open carries on with the rebuilt control.
        const calendarGroupBase =
            pendingInputs?.calendarGroup ?? "CompareFilter|" + crypto.randomUUID();

        if (pendingInputs) pendingInputs.calendarGroup = calendarGroupBase;

        const getCalendarGroup = (descriptor) =>
            calendarGroupBase + (descriptor.arity >= 2 ? "|Range" : "|Date");

        // Gets the range a calendar shows for the date(s) in the value boxes, by its start and
        // exclusive end, each null where there is nothing to show.
        const getCalendarRange = (descriptor) => {

            const start = toSortableDate(valueInput1.value);

            if (descriptor.arity < 2) {

                return {
                    start,
                    end: start ? Ren.DateUtils.addDaysToSortableDate(start, 1) : null
                };
            }

            return { start, end: toSortableDate(valueInput2.value) };
        };

        // Opens a calendar below a value box for picking the date(s) the chosen operator takes,
        // unless one is already open for them.
        const openCalendar = (anchorElement) => {

            const descriptor = CompareOperators.getOperator(selectedOperatorId);

            if (!isDateInputType(descriptor)) return;

            const calendarGroup = getCalendarGroup(descriptor);
            const calendars = Ren.VisualisationCollection.getVisualisations("Calendar");

            for (let index = 0; index < calendars.length; index++) {

                const calendar = calendars[index];

                if (calendar.calendarGroup === calendarGroup && !calendar.isDestroyed) return;
            }

            const range = getCalendarRange(descriptor);

            Ren.Messages.Requests.calendarWindow.notify(
                calendarGroup,
                Ren.TextUtils.makeFirstCharUpperCase(descriptor.label),
                range.start,
                range.end,
                anchorElement,
                descriptor.arity < 2
            );
        };

        // Lets a calendar open for the chosen operator follow the date(s) typed.
        const notifyCalendar = () => {

            const descriptor = CompareOperators.getOperator(selectedOperatorId);

            if (!isDateInputType(descriptor)) return;

            const range = getCalendarRange(descriptor);

            Ren.Messages.Events.dateSelectorDateRangeChanged.notify(
                getCalendarGroup(descriptor),
                range.start,
                range.end
            );
        };

        // Applies the date or range picked in the chosen operator's calendar.  A control no longer
        // on the page stops listening, the calendar being answered by the one that replaced it.
        Ren.Messages.Events.calendarDateRangeSelected.handle((
            calendarGroup,
            startDate,
            endDate
        ) => {

            if (!element.isConnected) return false;

            const descriptor = CompareOperators.getOperator(selectedOperatorId);

            if (!isDateInputType(descriptor) || calendarGroup !== getCalendarGroup(descriptor)) {
                return;
            }

            setValue1(startDate);

            if (descriptor.arity >= 2) valueInput2.value = endDate;

            recordPendingInputs();
            apply();
        });

        // Withdraws the column's compare filter, leaving the control's inputs as they are.
        const clearFilterKeepingInputs = () => {

            options.onApply(null);
            updateInEffectState();
        };

        // Withdraws a filter still in effect when the operator is changed, since it was authored
        // with the operator just replaced.  Unlike the Clear button this leaves the typed value in
        // its box.  Nothing is written where no compare filter is in effect.
        const clearInEffectFilterOnOperatorChange = () => {

            const predicate = options.getPredicate();

            if (predicate && predicate.type === "compare") clearFilterKeepingInputs();
        };

        // Withdraws the column's compare filter and empties the value boxes, leaving the chosen
        // operator alone so the next value can be typed straight into the same test (see refresh).
        const clear = () => {

            setValue1("");
            valueInput2.value = "";
            recordPendingInputs();
            clearFilterKeepingInputs();
        };

        // Refills the control's inputs from the column's current predicate: its operator and
        // value(s) when one is set, or the default operator with empty inputs when none is.
        const refresh = () => {

            const predicate = options.getPredicate();

            if (predicate && predicate.type === "compare") {

                setSelectedOperator(predicate.operator);
                setValue1(predicate.value ?? "");
                valueInput2.value = predicate.value2 ?? "";
            }
            else {

                // With no predicate set, the control falls back to what the user last had in it,
                // held by this instance or the pending store.  An operator already picked stays
                // picked, since clearing the filter is not a choice to stop using that test; the
                // default is taken only where nothing has been chosen yet.
                if (!selectedOperatorId) {

                    setSelectedOperator(
                        (pendingInputs && pendingInputs.operator)
                            || CompareOperators.getDefaultOperatorForColumnKind(columnKind).id
                    );
                }

                setValue1(pendingInputs ? pendingInputs.value ?? "" : "");
                valueInput2.value = pendingInputs ? pendingInputs.value2 ?? "" : "";
            }

            // Configure the inputs first: their visibility sets the value-block width that the
            // longhand-fits decision in updateOperatorDisplay then measures against.
            configureInputsFor(selectedOperatorId);
            updateOperatorDisplay(selectedOperatorId);
            updateInEffectState();
        };

        if (operatorSelect) {

            operatorSelect.addEventListener("change", () => selectOperator(operatorSelect.value));
        }

        // Re-evaluate the longhand/symbol choice whenever the available width changes.  The parent
        // is observed rather than the control, which shrink-wraps to its content; deferred to the
        // next frame so that the host has appended the control.
        if (typeof ResizeObserver !== "undefined") {

            // Deferred to the next frame and coalesced: updateOperatorDisplay can change this
            // control's size, which would re-enter the observer and raise the browser's
            // "ResizeObserver loop" warning.
            let reevaluationScheduled = false;

            const reevaluateNextFrame = () => {

                if (reevaluationScheduled) return;
                reevaluationScheduled = true;

                requestAnimationFrame(() => {

                    reevaluationScheduled = false;
                    updateOperatorDisplay(selectedOperatorId);
                });
            };

            requestAnimationFrame(() => {

                const target = element.parentElement ?? element;
                const resizeObserver = new ResizeObserver(reevaluateNextFrame);
                resizeObserver.observe(target);
            });
        }

        applyButton.addEventListener("click", apply);
        // The cross withdraws the filter and empties the inputs, or - where this compare filter is
        // one the host can take away - removes it outright.  Removing withdraws the filter first,
        // through the same path, so it can't stay in effect with nothing left to clear it from.
        clearButton.addEventListener("click", () => {

            clear();

            if (removeFilter) removeFilter();
        });

        Ren.DomEventUtils.onClickWithoutSelectingContainer(
            editFunctionButton,
            () => openFunctionEditor()
        );

        const applyOnEnter = (event) => { if (event.key === "Enter") apply(); };
        valueInput1.addEventListener("keydown", applyOnEnter);
        valueInput2.addEventListener("keydown", applyOnEnter);

        valueInput1.addEventListener("input", recordPendingInputs);
        valueInput2.addEventListener("input", recordPendingInputs);

        valueInput1.addEventListener("click", () => openCalendar(valueInput1));
        valueInput2.addEventListener("click", () => openCalendar(valueInput2));

        valueInput1.addEventListener("change", notifyCalendar);
        valueInput2.addEventListener("change", notifyCalendar);

        refresh();

        // Puts the caret in the value box, and returns whether it did: while the chosen operator
        // takes no value there is no box to type in.
        const focusValue = () => {

            if (valueInput1.style.display === "none") return false;

            valueInput1.focus();
            valueInput1.select();

            return true;
        };

        return {
            element,
            refresh,
            focusValue,
            // Draws the value box at a given width without telling the host, so that several
            // controls at one width can follow a drag together.
            setValueWidth
        };
    };

    // Gets a value indicating whether hosts should offer the compare filter at all.
    const isEnabled = () => ENABLED;

    return {
        create,
        isEnabled
    };
})();
