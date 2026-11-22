/**
 * DOM control builders shared throughout the data grouping settings editor: the small square
 * buttons, grouping rows, selects, labels and function-editor button, plus the helper that opens
 * the function editor window.  These depend only on the HTML template functions and a couple of
 * global Ren services, so they live here as a standalone module the editor destructures at
 * construction time.
 */
Ren.DataGroupingSettingsEditorControls = (() => {

    const CLASS = "ren-data-grouping-settings-editor-grouping";

    // Resolved lazily (at call time) so this module doesn't depend on the load order of the HTML
    // template utilities.
    const create = (tagName) => Ren.HtmlUtils.create(tagName);
    const reify = (templateName, data) => Ren.HtmlTemplateFunctions.reifyHtmlTemplate(templateName, data);

    // Builds one of the small square buttons (pencil / add / remove / done) shared throughout the
    // editor via the DataGroupingSettingsEditorButton HTML template.  modifierClass is the
    // button's own BEM modifier (e.g. `${CLASS}__pencil-button`).
    const buildSmallButton = (modifierClass, title, symbol) =>
        reify("DataGroupingSettingsEditorButton", { className: modifierClass, title, symbol });

    // Builds an empty grouping row via the DataGroupingSettingsEditorRow HTML template, optionally
    // indented (nested under a heading row).  Callers append the row's controls afterwards.
    const buildRow = (indented) =>
        reify("DataGroupingSettingsEditorRow", { indented: !!indented });

    // Builds a <select>.  Adds a fallback option if currentValue isn't among options so unknown
    // named functions/formats still display sensibly.  onChange receives (value, selectElement).
    const createSelect = (options, currentValue, onChange, className) => {

        const select = reify("DataGroupingSettingsEditorSelect", { className });

        let matched = false;

        for (let i = 0; i < options.length; i++) {

            const option = create("option");
            option.value = options[i].value;
            option.textContent = options[i].label;

            if (options[i].value === currentValue) {

                option.selected = true;
                matched = true;
            }

            select.appendChild(option);
        }

        if (!matched && currentValue) {

            const derivedLabel = currentValue.indexOf("name:") === 0
                ? currentValue.slice(5)
                : currentValue;

            const option = create("option");
            option.value = currentValue;
            option.textContent = derivedLabel;
            option.selected = true;
            select.appendChild(option);
        }

        select.addEventListener("change", () => onChange(select.value, select));
        return select;
    };

    const createLabel = (text) =>
        reify("DataGroupingSettingsEditorLabel", { text });

    // Builds a pencil button that reveals a plain-text row's edit controls, in the style shared by
    // "Sort by", the column-settings fields and group-level filters.
    const buildRevealPencil = (title, onClick) => {

        const pencil = buildSmallButton(`${CLASS}__pencil-button`, title, "✎");
        pencil.addEventListener("click", onClick);
        return pencil;
    };

    // Builds one of the settings rows that shows its value as plain text with a pencil beside it
    // until the pencil is clicked, and then a dropdown whose selection commits the change.  Every
    // per-column field (aggregation type, "with respect to", format) is one of these, so the shape
    // lives here rather than being spelled out once per field.
    const buildRevealableSelectRow = (field) => {

        const row = buildRow(true);
        row._append(createLabel(field.label));

        if (field.revealed) {

            row._append(createSelect(
                field.options,
                field.currentValue,
                field.onChange,
                field.selectClass
            ));
        }
        else {

            row._append(createLabel(field.summaryText));
            row._append(buildRevealPencil(field.pencilTitle, field.onReveal));
        }

        return row;
    };

    // Builds a small [✕] button in the same style/dimensions as the pencil and [+] buttons, for
    // removing a "then by" sort level.
    const buildRemoveButton = (title, onClick) => {

        const button = buildSmallButton(`${CLASS}__remove-button`, title, "✕");
        button.addEventListener("click", onClick);
        return button;
    };

    // Builds a small [+] button that offers a context menu of items, in the style shared by the
    // group-by "add column" and column-settings "add" buttons.
    const buildAddMenuButton = (title, items) => {

        const button = buildSmallButton(`${CLASS}__add-button`, title, "✚");

        Ren.AddButtonMenuItems(button, items);

        return button;
    };

    // Builds a hyperlink that offers a context menu of items, in the same underline-on-hover style
    // as the tile's "disable" link.  Used where a menu trigger should read as a plain link rather
    // than one of the small square buttons.
    const buildAddMenuLink = (text, modifierClass, items) => {

        const link = create("a")._addClass(modifierClass)._attr("href", "javascript:void(0)");
        link.textContent = text;

        Ren.AddButtonMenuItems(link, items);

        return link;
    };

    // Builds a function-editor button that shows whether a function is currently set.
    const createFunctionButton = (label, isSet, onClick) => {

        const button = reify("DataGroupingSettingsEditorFunctionButton", { label, isSet });
        button.addEventListener("click", onClick);
        return button;
    };

    // parameterSet names the Ren.FunctionEditorWidget.parameterSets entry to list, and functionTag
    // the tag a function saved from the editor is given.  tabularData supplies the columns the
    // editor suggests.
    const openFunctionEditor = (getInitial, onSave, parameterSet, functionTag, tabularData) => {

        Ren.Messages.Requests.functionEditorWindow.notify(
            getInitial,
            onSave,
            null,
            null,
            { centred: true, parameterSet, functionTag, autoComplete: { tabularData } }
        );
    };

    return {
        buildSmallButton,
        buildRow,
        createSelect,
        createLabel,
        buildRevealPencil,
        buildRevealableSelectRow,
        buildRemoveButton,
        buildAddMenuButton,
        buildAddMenuLink,
        createFunctionButton,
        openFunctionEditor
    };
})();
