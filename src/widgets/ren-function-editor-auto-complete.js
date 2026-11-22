/**
 * Suggests a function editor's parameters from the second character of their names, and the keys
 * its object parameters are read by: column IDs after rowVals, compressedRowVals and the summary
 * stats parameters, aggregation types after the summary stats parameters, and the report's
 * parameters after paras.
 */
Ren.FunctionEditorAutoComplete = (() => {

    const ROW_PARAMETERS = ["rowVals", "compressedRowVals"];
    const STATS_PARAMETERS = ["groupSummaryStats", "overallSummaryStats"];

    // Offered where the editor names no parameters.
    const ALL_PARAMETER_NAMES = ["value"].concat(ROW_PARAMETERS, STATS_PARAMETERS, ["paras"]);

    // The fewest characters of a parameter name typed before the names are suggested.
    const MIN_PARAMETER_NAME_LENGTH = 2;

    // Offered first after a summary stats parameter, ahead of the rarer aggregation types.
    const COMMON_AGGREGATION_KEYS = [
        "sum", "average", "count", "countDistinct", "min", "max", "median", "first", "last"
    ];

    // Aggregation types that are no statistic a function could read.
    const UNOFFERED_AGGREGATION_KEYS = ["noTotal", "expandIcon", "expandIconAlways"];

    const MAX_DETAIL_LENGTH = 40;
    const ELLIPSIS = "…";

    // Follows the text before the caret in the (unseen) caret mirror, its left edge being the
    // caret's.  A character with width, since a zero-width one may measure as an empty box.
    const CARET_MARKER = "|";

    const IDENTIFIER_REGEX = /^[A-Za-z_$][\w$]*$/;

    // The key being typed after a parameter, as .key or ["key".
    const DOT_ACCESSOR_REGEX = /\.([\w$]*)$/;
    const BRACKET_ACCESSOR_REGEX = /\[\s*(["']?)([^"'\]\n]*)$/;

    // A name being typed, not itself read off something else.
    const NAME_REGEX = /(?:^|[^\w$.])([A-Za-z_$][\w$]*)$/;

    // A parameter at the end of the text, not itself read off something else.
    const PARAMETER_HEAD_REGEX =
        /(?:^|[^\w$.])(rowVals|compressedRowVals|groupSummaryStats|overallSummaryStats|paras)$/;

    // A summary stats parameter read by column key at the end of the text.
    const STATS_COLUMN_HEAD_REGEX = new RegExp(
        "(?:^|[^\\w$.])(groupSummaryStats|overallSummaryStats)" +
        "(?:\\.([A-Za-z_$][\\w$]*)|\\[\\s*([\"'])([^\"'\\n]+)\\3\\s*\\])$"
    );

    let aggregationKeys = null;

    const getAggregationKeys = () => {

        if (aggregationKeys) return aggregationKeys;

        aggregationKeys = COMMON_AGGREGATION_KEYS.slice();

        const names = Ren.AggregationTypeEnum.Names;

        for (let index = 0; index < names.length; index++) {

            const key = Ren.TextUtils.makeFirstCharLowerCase(names[index]);

            if (aggregationKeys.indexOf(key) === -1 &&
                UNOFFERED_AGGREGATION_KEYS.indexOf(key) === -1) {

                aggregationKeys.push(key);
            }
        }

        return aggregationKeys;
    };

    const truncate = (text) => text.length > MAX_DETAIL_LENGTH
        ? text.substring(0, MAX_DETAIL_LENGTH - 1) + ELLIPSIS
        : text;

    const describeValue = (value) => {

        if (value == null) return String(value);

        if (typeof value === "object") {

            try {
                return truncate(JSON.stringify(value));
            }
            catch (e) {

                return "";
            }
        }

        return truncate(String(value));
    };

    /**
     * Formats a key as the accessor that reads it: .key where it is an identifier, otherwise
     * ["key"], or always in brackets with the given quote where the user has opened a bracket.
     */
    const formatAccessor = (key, bracketQuote) => {

        if (!bracketQuote && IDENTIFIER_REGEX.test(key)) return "." + key;

        const quote = bracketQuote || "\"";
        const escapedKey = key.replace(/\\/g, "\\\\").split(quote).join("\\" + quote);

        return "[" + quote + escapedKey + quote + "]";
    };

    // Formats a suggested key as it is inserted: a parameter name as it stands, otherwise as an
    // accessor.
    const formatSuggestion = (key, context) => context.isName
        ? key
        : formatAccessor(key, context.bracketQuote);

    /**
     * Attaches autocomplete to the textarea in a function editor's edit box.
     * @param {HTMLElement} editorElement - The function editor widget element.
     * @param {object} highlighting - The object Ren.FunctionEditorHighlighting.attach returned.
     * @param {string[]} parameterNames - The parameters the function is given, or null for all.
     * @param {object} source - { tabularData, paras }, either of which may be missing; the
     * tabular data's columns are suggested as keys, and the paras object's keys after paras.
     * @returns {object} { destroy }.
     */
    const attach = (editorElement, highlighting, parameterNames, source) => {

        const textarea = editorElement.querySelector(".ren-function-editor-widget__edit-textarea");
        const caretMirror = editorElement.querySelector(".js-ren-function-editor-caret-mirror");

        const boxElement =
            Ren.HtmlTemplateFunctions.reifyHtmlTemplate("FunctionEditorAutoComplete", {});

        document.body.appendChild(boxElement);

        let suggestions = [];
        let selectedIndex = 0;
        let context = null;

        // Whether Enter should take the selected suggestion rather than start a new line: the user
        // has typed into an accessor, moved through the suggestions or asked for them.
        let isChosen = false;
        let isInserting = false;

        const hasParameter = (name) => !parameterNames || parameterNames.indexOf(name) !== -1;

        let columnCandidates = null;

        // Each column once, keyed by its ID (safer than a heading that may change), and matched by
        // its heading too.
        const getColumnCandidates = () => {

            if (columnCandidates) return columnCandidates;

            columnCandidates = [];

            const columnModels = source?.tabularData?.ColumnModels;

            if (!columnModels) return columnCandidates;

            const seenKeys = new Set();

            for (let index = 0; index < columnModels.length; index++) {

                const columnModel = columnModels[index];
                const key = columnModel.ColumnIdOrHeading
                    ?? columnModel.ColumnId
                    ?? columnModel.Heading;

                if (key == null || key === "" || seenKeys.has(key)) continue;

                seenKeys.add(key);

                const heading = columnModel.Heading ?? "";

                columnCandidates.push({
                    key: String(key),
                    matchTexts: [String(key), String(heading)],
                    detail: heading !== "" && heading !== key ? heading : "",
                    type: "column"
                });
            }

            return columnCandidates;
        };

        let parasCandidates = null;

        const getParasCandidates = () => {

            if (parasCandidates) return parasCandidates;

            parasCandidates = [];

            const paras = source?.paras;

            if (!paras) return parasCandidates;

            const keys = Object.keys(paras);

            for (let index = 0; index < keys.length; index++) {

                parasCandidates.push({
                    key: keys[index],
                    matchTexts: [keys[index]],
                    detail: describeValue(paras[keys[index]]),
                    type: "parameter"
                });
            }

            return parasCandidates;
        };

        let parameterNameCandidates = null;

        const getParameterNameCandidates = () => {

            if (parameterNameCandidates) return parameterNameCandidates;

            const names = parameterNames ?? ALL_PARAMETER_NAMES;

            parameterNameCandidates = [];

            for (let index = 0; index < names.length; index++) {

                parameterNameCandidates.push({
                    key: names[index],
                    matchTexts: [names[index]],
                    detail: "",
                    type: "parameterName"
                });
            }

            return parameterNameCandidates;
        };

        const getAggregationCandidates = (detail) => {

            const keys = getAggregationKeys();
            const candidates = [];

            for (let index = 0; index < keys.length; index++) {

                candidates.push({
                    key: keys[index],
                    matchTexts: [keys[index]],
                    detail,
                    type: "aggregation"
                });
            }

            return candidates;
        };

        /**
         * Keeps the candidates matching the partial key, those starting with it ahead of those
         * containing it (unless isPrefixOnly), each in their original order.
         */
        const filterCandidates = (candidates, partial, isPrefixOnly) => {

            if (partial === "") return candidates;

            const lowerPartial = partial.toLowerCase();
            const prefixMatches = [];
            const containsMatches = [];

            for (let index = 0; index < candidates.length; index++) {

                const candidate = candidates[index];
                let rank = -1;

                for (let textIndex = 0; textIndex < candidate.matchTexts.length; textIndex++) {

                    const position =
                        candidate.matchTexts[textIndex].toLowerCase().indexOf(lowerPartial);

                    if (position === 0) {

                        rank = 0;
                        break;
                    }

                    if (position > 0) rank = 1;
                }

                if (rank === 0) {
                    prefixMatches.push(candidate);
                }
                else if (rank === 1) {

                    containsMatches.push(candidate);
                }
            }

            return isPrefixOnly ? prefixMatches : prefixMatches.concat(containsMatches);
        };

        /**
         * Gets the candidates for the text ahead of an accessor, with the label prefix each is
         * shown after, or null if the text ends in nothing that takes keys.
         */
        const getCandidatesForHead = (head) => {

            let match = PARAMETER_HEAD_REGEX.exec(head);

            if (match && hasParameter(match[1])) {

                const parameterName = match[1];
                let candidates;

                if (parameterName === "paras") {
                    candidates = getParasCandidates();
                }
                else if (STATS_PARAMETERS.indexOf(parameterName) !== -1) {

                    candidates =
                        getAggregationCandidates("this column").concat(getColumnCandidates());
                }
                else {

                    candidates = getColumnCandidates();
                }

                return { parameterName, labelPrefix: parameterName, candidates };
            }

            match = STATS_COLUMN_HEAD_REGEX.exec(head);

            if (match && hasParameter(match[1])) {

                const columnKey = match[2] === undefined ? match[4] : match[2];

                // A stats parameter read by aggregation type has no further keys.
                if (getAggregationKeys().indexOf(columnKey) !== -1) return null;

                return {
                    parameterName: match[1],
                    labelPrefix: match[1] + formatAccessor(columnKey, null),
                    candidates: getAggregationCandidates(columnKey)
                };
            }

            return null;
        };

        /**
         * Works out what is being typed at the caret: the accessor or parameter name being typed
         * (from accessorStart to the caret) and the suggestions for it.  A key typed out in full
         * after a summary stats parameter is followed by the aggregation types for it.
         */
        const getContext = () => {

            const caret = textarea.selectionStart;
            const textBeforeCaret = textarea.value.substring(0, caret);
            const accessorForms = [];

            let match = DOT_ACCESSOR_REGEX.exec(textBeforeCaret);

            if (match) {

                accessorForms.push({
                    accessorStart: match.index,
                    partial: match[1],
                    bracketQuote: null
                });
            }
            else if ((match = BRACKET_ACCESSOR_REGEX.exec(textBeforeCaret))) {

                accessorForms.push({
                    accessorStart: match.index,
                    partial: match[2],
                    bracketQuote: match[1] || "\""
                });
            }

            // No accessor yet, after a parameter or a summary stats column.
            accessorForms.push({
                accessorStart: caret,
                partial: "",
                bracketQuote: null,
                isBare: true
            });

            match = NAME_REGEX.exec(textBeforeCaret);

            if (match && match[1].length >= MIN_PARAMETER_NAME_LENGTH) {

                accessorForms.push({
                    accessorStart: caret - match[1].length,
                    partial: match[1],
                    bracketQuote: null,
                    isName: true
                });
            }

            for (let index = 0; index < accessorForms.length; index++) {

                const form = accessorForms[index];
                const headCandidates = form.isName
                    ? {
                        parameterName: null,
                        labelPrefix: "",
                        candidates: getParameterNameCandidates()
                    }
                    : getCandidatesForHead(textBeforeCaret.substring(0, form.accessorStart));

                if (!headCandidates) continue;

                const matches =
                    filterCandidates(headCandidates.candidates, form.partial, form.isName);

                // A key typed out in full needs no suggestion.
                if (!matches.length || (matches.length === 1 && matches[0].key === form.partial)) {
                    continue;
                }

                form.caret = caret;
                form.parameterName = headCandidates.parameterName;
                form.labelPrefix = headCandidates.labelPrefix;
                form.suggestions = matches;

                return form;
            }

            return null;
        };

        const hide = () => {

            boxElement.hidden = true;
            suggestions = [];
            context = null;
        };

        const isOpen = () => !boxElement.hidden;

        // Gets the caret's position in the viewport, or null where it is scrolled out of view.
        const getCaretPosition = () => {

            caretMirror.textContent =
                textarea.value.substring(0, textarea.selectionStart) + CARET_MARKER;

            const textNode = caretMirror.firstChild;
            const range = document.createRange();

            range.setStart(textNode, textNode.length - 1);
            range.setEnd(textNode, textNode.length);

            const caretRect = range.getBoundingClientRect();
            const textareaRect = textarea.getBoundingClientRect();
            const left = caretRect.left - textarea.scrollLeft;
            const top = caretRect.top - textarea.scrollTop;
            const bottom = caretRect.bottom - textarea.scrollTop;

            caretMirror.textContent = "";

            if (left < textareaRect.left || left > textareaRect.right ||
                bottom < textareaRect.top || top > textareaRect.bottom) {

                return null;
            }

            return { left, top, bottom };
        };

        // Places the box below the caret, or above it where there is no room below.
        const positionBox = (caretPosition) => {

            boxElement.style.left = "0px";
            boxElement.style.top = "0px";

            const boxRect = boxElement.getBoundingClientRect();
            const left =
                Math.max(0, Math.min(caretPosition.left, window.innerWidth - boxRect.width));
            const top = caretPosition.bottom + boxRect.height > window.innerHeight
                ? Math.max(0, caretPosition.top - boxRect.height)
                : caretPosition.bottom;

            boxElement.style.left = left + "px";
            boxElement.style.top = top + "px";
        };

        const showSelection = () => {

            const itemElements = boxElement.children;

            for (let index = 0; index < itemElements.length; index++) {

                itemElements[index].classList.toggle(
                    "ren-function-editor-auto-complete__item--selected",
                    index === selectedIndex
                );
            }

            itemElements[selectedIndex]?.scrollIntoView({ block: "nearest" });
        };

        const render = () => {

            boxElement.textContent = "";

            for (let index = 0; index < suggestions.length; index++) {

                const suggestion = suggestions[index];
                const itemElement = Ren.HtmlTemplateFunctions.reifyHtmlTemplate(
                    "FunctionEditorAutoCompleteItem",
                    { type: suggestion.type, isSelected: index === selectedIndex }
                );

                itemElement.querySelector(".js-ren-function-editor-auto-complete-text").textContent =
                    context.labelPrefix + formatSuggestion(suggestion.key, context);
                itemElement.querySelector(".js-ren-function-editor-auto-complete-detail").textContent =
                    suggestion.detail;

                // Keep focus (and so the caret) in the textarea.
                itemElement.addEventListener("mousedown", (e) => e.preventDefault());
                itemElement.addEventListener("click", () => accept(index));

                boxElement.appendChild(itemElement);
            }
        };

        /**
         * Shows the suggestions for the text at the caret, or hides the box where there are none.
         * isRequested marks the suggestions as asked for, so that Enter takes one.
         */
        const update = (isRequested) => {

            const newContext = getContext();
            const caretPosition = newContext ? getCaretPosition() : null;

            if (!caretPosition) {

                hide();
                return;
            }

            // Stays on the same suggestion while it is still offered.
            const selectedKey = isOpen() ? suggestions[selectedIndex]?.key : undefined;

            context = newContext;
            suggestions = newContext.suggestions;
            selectedIndex = 0;

            for (let index = 0; index < suggestions.length; index++) {

                if (suggestions[index].key === selectedKey) {

                    selectedIndex = index;
                    break;
                }
            }

            isChosen = isRequested || !newContext.isBare || (isChosen && selectedKey !== undefined);

            render();
            boxElement.hidden = false;
            positionBox(caretPosition);
            showSelection();
        };

        // Replaces the accessor being typed, and any rest of it after the caret, with the
        // suggestion's, as one undoable edit.
        const accept = (index) => {

            const suggestion = suggestions[index];

            if (!suggestion) return;

            const acceptedContext = context;
            const textAfterCaret = textarea.value.substring(acceptedContext.caret);
            const restMatch = acceptedContext.isBare
                ? null
                : (acceptedContext.bracketQuote && /^[^"'\]\n]*["']?\s*\]/.exec(textAfterCaret))
                    || /^[\w$]*/.exec(textAfterCaret);
            const end = acceptedContext.caret + (restMatch ? restMatch[0].length : 0);

            hide();

            isInserting = true;

            try {

                textarea.focus();
                textarea.setSelectionRange(acceptedContext.accessorStart, end);
                highlighting.insertText(formatSuggestion(suggestion.key, acceptedContext));
            }
            finally {

                isInserting = false;
            }

            // A column read off a summary stats parameter goes on to its aggregation types.
            if (suggestion.type === "column" &&
                STATS_PARAMETERS.indexOf(acceptedContext.parameterName) !== -1) {

                update(true);
            }
            // A parameter goes on to the keys it is read by, as if typed out.
            else if (suggestion.type === "parameterName") {

                update(false);
            }
        };

        const moveSelection = (offset) => {

            const count = suggestions.length;

            if (Math.abs(offset) > 1) {
                selectedIndex = Math.max(0, Math.min(count - 1, selectedIndex + offset));
            }
            else {

                selectedIndex = (selectedIndex + offset + count) % count;
            }

            isChosen = true;
            showSelection();
        };

        const getPageSize = () => {

            const itemElement = boxElement.firstElementChild;

            return itemElement
                ? Math.max(1, Math.floor(boxElement.clientHeight / itemElement.offsetHeight) - 1)
                : 1;
        };

        const onInput = (e) => {

            if (isInserting) return;

            const inputType = e.inputType ?? "";

            if (inputType === "insertText" || inputType === "insertCompositionText") {
                update(false);
            }
            else if (inputType.indexOf("delete") === 0 && isOpen()) {

                update(false);
            }
            else {

                hide();
            }
        };

        // Handled on the textarea, ahead of the editor's own shortcuts, which the keys used here
        // are kept from while the box is open.
        const onKeyDown = (e) => {

            if (e.ctrlKey && (e.key === " " || e.code === "Space")) {

                update(true);
                e.preventDefault();
                return;
            }

            if (!isOpen()) return;

            if (e.ctrlKey || e.altKey || e.metaKey) {

                hide();
                return;
            }

            let isHandled = true;

            switch (e.key) {

                case "ArrowDown":
                    moveSelection(1);
                    break;
                case "ArrowUp":
                    moveSelection(-1);
                    break;
                case "PageDown":
                    moveSelection(getPageSize());
                    break;
                case "PageUp":
                    moveSelection(-getPageSize());
                    break;
                case "Tab":
                    accept(selectedIndex);
                    break;
                case "Enter":

                    if (isChosen && !e.shiftKey) {
                        accept(selectedIndex);
                    }
                    else {

                        hide();
                        isHandled = false;
                    }
                    break;
                case "Escape":
                    hide();
                    break;
                case "ArrowLeft":
                case "ArrowRight":
                case "Home":
                case "End":
                    hide();
                    isHandled = false;
                    break;
                default:
                    isHandled = false;
            }

            if (isHandled) {

                e.preventDefault();
                e.stopPropagation();
            }
        };

        // Typing near the textarea's edge scrolls it, so the box follows the caret rather than
        // closing.
        const onScroll = () => {

            if (!isOpen()) return;

            const caretPosition = getCaretPosition();

            if (caretPosition) {
                positionBox(caretPosition);
            }
            else {

                hide();
            }
        };

        textarea.addEventListener("input", onInput);
        textarea.addEventListener("keydown", onKeyDown);
        textarea.addEventListener("blur", hide);
        textarea.addEventListener("mousedown", hide);
        textarea.addEventListener("scroll", onScroll);

        const destroy = () => {

            textarea.removeEventListener("input", onInput);
            textarea.removeEventListener("keydown", onKeyDown);
            textarea.removeEventListener("blur", hide);
            textarea.removeEventListener("mousedown", hide);
            textarea.removeEventListener("scroll", onScroll);
            boxElement.remove();
        };

        return {
            destroy
        };
    };

    return {
        attach
    };
})();
