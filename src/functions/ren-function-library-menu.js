/**
 * The function editor's Functions menu: loads code from Ren.FunctionLibrary into the editor, saves
 * the editor's code to it, and manages what has been saved.
 */
Ren.FunctionLibraryMenu = (() => {

    const MAX_RECENT_ITEMS = 15;
    const MAX_ITEMS_BEFORE_GROUPING = 25;
    const MIN_PREFIX_GROUP_SIZE = 3;
    const MAX_LABEL_LENGTH = 60;
    const MAX_TOOLTIP_LENGTH = 1000;

    const HTML_TAG = "html";
    const STYLE_TAG = "style";
    const TOOLTIP_TAG = "tooltip";

    // Functions of these kinds return something other than a value to display, so an editor for
    // one kind offers that kind alone, and any other editor offers none of them.
    const EXCLUSIVE_TAGS = [STYLE_TAG, TOOLTIP_TAG];

    // The format function files' tags, each a submenu of the built-in functions.
    const BUILT_IN_TAG_SUBMENUS = [
        { tag: "format", text: "Format" },
        { tag: "calculation", text: "Calculation" },
        { tag: "binning", text: "Binning" },
        { tag: "sort", text: "Sort" },
        { tag: STYLE_TAG, text: "Style" },
        { tag: TOOLTIP_TAG, text: "Tooltip" },
        { tag: "report-specific", text: "Report-specific" },
        { tag: HTML_TAG, text: "HTML" }
    ];

    const truncate = (text, maxLength) =>
        text.length > maxLength ? text.substring(0, maxLength - 1) + "…" : text;

    const isExclusiveTag = (tag) => EXCLUSIVE_TAGS.indexOf(tag) !== -1;

    // A style function returns a style object rather than a value, so a style editor offers style
    // functions alone, and any other editor offers everything else.  Likewise for tooltips.
    const isOffered = (libraryFunction, editor) => {

        if (!editor.allowHtml && libraryFunction.tags.indexOf(HTML_TAG) !== -1) return false;

        for (let index = 0; index < EXCLUSIVE_TAGS.length; index++) {

            const tag = EXCLUSIVE_TAGS[index];

            if ((libraryFunction.tags.indexOf(tag) !== -1) !== (editor.functionTag === tag)) {
                return false;
            }
        }

        return true;
    };

    const getTaggedFunctions = (functions, tag) => {

        const tagged = [];

        for (let index = 0; index < functions.length; index++) {

            if (functions[index].tags.indexOf(tag) !== -1) tagged.push(functions[index]);
        }

        return tagged;
    };

    const createPlaceholderItem = (text) => ({ text });

    // Labels a recent function by its first line of code, below any header or line comments.
    const getCodeLabel = (code) => {

        const lines = Ren.FormatFunctionUtils.parseFunctionHeader(code.trim()).code.split("\n");

        for (let index = 0; index < lines.length; index++) {

            const line = lines[index].trim();

            if (line !== "" && line.indexOf("//") !== 0) return truncate(line, MAX_LABEL_LENGTH);
        }

        return truncate(code.trim(), MAX_LABEL_LENGTH);
    };

    // Long lists would run off the screen, so functions sharing a name's first word (date-, bin-)
    // are gathered into a submenu of their own.
    const groupByNamePrefix = (items, functions) => {

        if (items.length <= MAX_ITEMS_BEFORE_GROUPING) return items;

        const getPrefix = (name) => name.split("-")[0];
        const prefixCounts = {};

        for (let index = 0; index < functions.length; index++) {

            const prefix = getPrefix(functions[index].name);

            prefixCounts[prefix] = (prefixCounts[prefix] || 0) + 1;
        }

        const grouped = [];
        const groupItemsByPrefix = {};

        for (let index = 0; index < items.length; index++) {

            const prefix = getPrefix(functions[index].name);

            if (prefixCounts[prefix] < MIN_PREFIX_GROUP_SIZE) {

                grouped.push(items[index]);
                continue;
            }

            if (!groupItemsByPrefix[prefix]) {

                groupItemsByPrefix[prefix] = { text: prefix + "-", submenu: [] };
                grouped.push(groupItemsByPrefix[prefix]);
            }

            groupItemsByPrefix[prefix].submenu.push(items[index]);
        }

        return grouped;
    };

    /**
     * Attaches the menu to a button in a function editor.
     * @param {HTMLElement} button - The button opening the menu.
     * @param {object} editor - { getCode, replaceCode, allowHtml, functionTag, getIntro }:
     *     allowHtml offers functions tagged html, functionTag is the tag a function saved from this
     *     editor is given unless its code's own header says otherwise, and the optional getIntro
     *     gets the { description, tags } an editor shows apart from the code.
     */
    const attach = (button, editor) => {

        // The function last loaded or saved, so that saving again offers its name.
        let currentFunction = null;

        const loadFunction = (libraryFunction) => {

            editor.replaceCode(Ren.FunctionLibrary.getCodeToLoad(libraryFunction.source));
            currentFunction = libraryFunction;
        };

        const buildFunctionItems = (functions, action) => {

            const items = [];

            for (let index = 0; index < functions.length; index++) {

                const libraryFunction = functions[index];

                items.push({
                    text: libraryFunction.name,
                    title: libraryFunction.description,
                    actionParameters: [libraryFunction],
                    action
                });
            }

            return groupByNamePrefix(items, functions);
        };

        const buildLoadItems = (functions, placeholderText) => {

            const offered = [];

            for (let index = 0; index < functions.length; index++) {

                if (isOffered(functions[index], editor)) offered.push(functions[index]);
            }

            if (!offered.length) return [createPlaceholderItem(placeholderText)];

            return buildFunctionItems(offered, loadFunction);
        };

        const buildRecentItems = () => {

            const recent = Ren.FunctionLibrary.getRecentFunctions();
            const items = [];

            for (let index = 0; index < recent.length && items.length < MAX_RECENT_ITEMS; index++) {

                // Each exclusive kind of function is recent only to its own editors.
                const recentTag = isExclusiveTag(recent[index].functionTag)
                    ? recent[index].functionTag
                    : null;
                const editorTag = isExclusiveTag(editor.functionTag) ? editor.functionTag : null;

                if (recentTag !== editorTag) continue;

                const code = recent[index].code;

                items.push({
                    text: getCodeLabel(code),
                    title: truncate(code, MAX_TOOLTIP_LENGTH),
                    action: () => {

                        editor.replaceCode(code);
                        currentFunction = null;
                    }
                });
            }

            return items.length ? items : [createPlaceholderItem("(none yet)")];
        };

        const buildSharedLoadItems = () => {

            const statusEnum = Ren.FunctionLibrary.SharedFunctionsStatusEnum;
            const status = Ren.FunctionLibrary.getSharedFunctionsStatus();

            if (status === statusEnum.Loading) return [createPlaceholderItem("(loading...)")];

            if (status === statusEnum.Failed) {

                return [createPlaceholderItem("(could not be loaded)")];
            }

            return buildLoadItems(Ren.FunctionLibrary.getSharedFunctions(), "(none saved yet)");
        };

        // The submenu for the kind of function being edited leads, and a style editor has no other.
        const buildBuiltInItems = () => {

            const builtInFunctions = Ren.FunctionLibrary.getBuiltInFunctions();
            const isExclusiveEditor = isExclusiveTag(editor.functionTag);
            const tagSubmenus = [];
            const untagged = [];

            for (let index = 0; index < BUILT_IN_TAG_SUBMENUS.length; index++) {

                const tagSubmenu = BUILT_IN_TAG_SUBMENUS[index];

                if (tagSubmenu.tag === HTML_TAG && !editor.allowHtml) continue;

                if (isExclusiveTag(tagSubmenu.tag)) {

                    if (tagSubmenu.tag !== editor.functionTag) continue;
                }
                else if (isExclusiveEditor) {

                    continue;
                }

                const tagged = getTaggedFunctions(builtInFunctions, tagSubmenu.tag);
                const item = { text: tagSubmenu.text, submenu: buildLoadItems(tagged, "(none)") };

                if (tagSubmenu.tag === editor.functionTag) {

                    tagSubmenus.unshift(item);
                }
                else {

                    tagSubmenus.push(item);
                }
            }

            for (let index = 0; index < builtInFunctions.length; index++) {

                if (!builtInFunctions[index].tags.length) untagged.push(builtInFunctions[index]);
            }

            if (untagged.length && !isExclusiveEditor) {

                tagSubmenus.push({ text: "Untagged", submenu: buildLoadItems(untagged, "(none)") });
            }

            return tagSubmenus;
        };

        const getSaveDefaults = () => {

            const code = editor.getCode();
            const parsed = Ren.FormatFunctionUtils.parseFunctionHeader(code.trim());

            if (currentFunction) {

                return {
                    name: currentFunction.name,
                    description: currentFunction.description,
                    tags: currentFunction.tags
                };
            }

            // An editor showing the description and tags apart from the code keeps them there,
            // leaving the code's header holding its @param lines alone.
            const intro = editor.getIntro ? editor.getIntro() : null;

            if (intro && (intro.description || intro.tags.length)) {

                return {
                    name: "",
                    description: intro.description.split("\n\n")[0],
                    tags: intro.tags.length
                        ? intro.tags
                        : (editor.functionTag ? [editor.functionTag] : [])
                };
            }

            if (parsed.headerComment) {

                return {
                    name: "",
                    description: Ren.FunctionLibrary.getDescription(parsed.headerComment),
                    tags: parsed.tags
                };
            }

            return {
                name: "",
                description: "",
                tags: editor.functionTag ? [editor.functionTag] : []
            };
        };

        const openSavePopup = (isShared) => {

            const code = editor.getCode();

            if (code.trim() === "") {

                Ren.PopupErrorMessage("There is no code to save.");
                return;
            }

            const save = async (name, description, tags) => {

                const source = Ren.FunctionLibrary.buildSource(description, tags, code);
                const exists = isShared
                    ? Ren.FunctionLibrary.hasSharedFunction(name)
                    : Ren.FunctionLibrary.hasMyFunction(name);

                if (exists && !confirm("Replace the function \"" + name + "\"?")) return false;

                let saved;

                if (isShared) {

                    saved = await Ren.FunctionLibrary.saveSharedFunction(name, source);
                }
                else {

                    saved = Ren.FunctionLibrary.saveMyFunction(name, source);

                    if (!saved) Ren.PopupErrorMessage("This browser would not store the function.");
                }

                if (saved) currentFunction = { name, source, description, tags };

                return saved;
            };

            Ren.FunctionSavePopup.show(
                isShared ? "Save as shared function" : "Save as my function",
                getSaveDefaults(),
                save
            );
        };

        const deleteMyFunction = (libraryFunction) => {

            if (!confirm("Delete your function \"" + libraryFunction.name + "\"?")) return;

            Ren.FunctionLibrary.deleteMyFunction(libraryFunction.name);
        };

        const deleteSharedFunction = (libraryFunction) => {

            const message = "Delete the shared function \"" + libraryFunction.name
                + "\" for everyone?";

            if (!confirm(message)) return;

            Ren.FunctionLibrary.deleteSharedFunction(libraryFunction.name);
        };

        const buildDeleteItems = (functions, action) =>
            functions.length
                ? buildFunctionItems(functions, action)
                : [createPlaceholderItem("(none saved yet)")];

        const clearRecentFunctions = () => {

            if (!confirm("Clear your recently used functions?")) return;

            Ren.FunctionLibrary.clearRecentFunctions();
        };

        const buildMenuItems = () => {

            const canUseShared = Ren.FunctionLibrary.canUseSharedFunctions();

            return [
                {
                    text: "Recent",
                    id: "function-library-recent",
                    submenu: buildRecentItems()
                },
                {
                    text: "My functions",
                    id: "function-library-mine",
                    submenu: buildLoadItems(
                        Ren.FunctionLibrary.getMyFunctions(),
                        "(none saved yet)"
                    )
                },
                {
                    text: "Shared functions",
                    id: "function-library-shared",
                    visible: () => canUseShared,
                    submenu: buildSharedLoadItems()
                },
                {
                    text: "Built-in functions",
                    id: "function-library-built-in",
                    submenu: buildBuiltInItems()
                },
                Ren.MENU_SEPARATOR,
                {
                    text: "Save as my function...",
                    id: "function-library-save-mine",
                    title: "Saves the code in this browser, for you to load again",
                    action: () => openSavePopup(false)
                },
                {
                    text: "Save as shared function...",
                    id: "function-library-save-shared",
                    title: "Saves the code on the Reporting server, for everyone to load",
                    visible: () => canUseShared,
                    action: () => openSavePopup(true)
                },
                {
                    text: "Manage",
                    id: "function-library-manage",
                    submenu: [
                        {
                            text: "Delete my function",
                            submenu: buildDeleteItems(
                                Ren.FunctionLibrary.getMyFunctions(),
                                deleteMyFunction
                            )
                        },
                        {
                            text: "Delete shared function",
                            visible: () => canUseShared,
                            submenu: buildDeleteItems(
                                Ren.FunctionLibrary.getSharedFunctions(),
                                deleteSharedFunction
                            )
                        },
                        {
                            text: "Clear recent functions",
                            action: clearRecentFunctions
                        }
                    ]
                }
            ];
        };

        Ren.FunctionLibrary.refreshSharedFunctions();

        Ren.AddButtonMenuItems(button, buildMenuItems);
    };

    return {
        attach
    };
})();
