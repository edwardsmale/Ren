/**
 * Sets up Prism.js syntax highlighting for the function editor widget's edit box.
 * Uses the textarea-behind-overlay technique: a transparent textarea captures input
 * while a <pre><code> element rendered on top shows the highlighted version.
 */
Ren.FunctionEditorHighlighting = (() => {

    /**
     * Attaches live syntax highlighting to an edit box element.
     * @param {HTMLElement} editBoxElement - The .ren-function-editor-widget__edit-box container.
     * @param {string} initialContent - The initial text to place in the textarea.
     * @returns {object} { getValue, insertText, replaceText, updateText }.
     */
    const attach = (editBoxElement, initialContent) => {

        const textarea = editBoxElement.querySelector('.ren-function-editor-widget__edit-textarea');
        const preElement = editBoxElement.querySelector('.ren-function-editor-widget__highlight-pre');

        const highlight = (text) => {

            text = text == null ? '' : String(text);

            // A trailing newline causes the final blank line to collapse in the <pre>,
            // so we append a trailing space to keep the heights in sync.
            if (text[text.length - 1] === '\n') {
                text += ' ';
            }

            // Prism is Ren's own, with the JavaScript grammar, as ren.js runs inside a function:
            // another bundle's Prism (a SQL-only one, say) replaces window.Prism, not this.
            // Prism.highlight() handles its own HTML escaping and returns highlighted HTML written
            // directly into the <pre>, avoiding a <code> child (display:inline) that would offset
            // baselines vs the textarea.
            preElement.innerHTML = Prism.highlight(text, Prism.languages.javascript, 'javascript');
        };

        const syncScroll = () => {

            preElement.scrollTop = textarea.scrollTop;
            preElement.scrollLeft = textarea.scrollLeft;
        };

        const safeInitial = initialContent == null ? '' : String(initialContent);
        textarea.value = safeInitial;
        highlight(safeInitial);

        textarea.addEventListener('input', () => {

            highlight(textarea.value);
            syncScroll();
        });

        textarea.addEventListener('scroll', syncScroll);

        const insertText = (text) => {

            textarea.focus();

            // execCommand keeps the insertion on the textarea's undo stack and fires input.
            if (!document.execCommand("insertText", false, text)) {

                textarea.setRangeText(
                    text,
                    textarea.selectionStart,
                    textarea.selectionEnd,
                    "end"
                );

                textarea.dispatchEvent(new Event("input"));
            }
        };

        // Inserted over the whole text rather than assigned, so that Ctrl+Z brings the old text
        // back.
        const replaceText = (text) => {

            textarea.focus();
            textarea.select();
            insertText(text);
            textarea.setSelectionRange(0, 0);
            textarea.scrollTop = 0;
            syncScroll();
        };

        /**
         * Changes the text to the given text, replacing only the part that differs, without taking
         * the focus from an input outside the textarea that is changing it.  The caret and scroll
         * position are kept, but the change is not on the undo stack.
         */
        const updateText = (text) => {

            const oldText = textarea.value;

            if (text === oldText) return;

            let start = 0;

            while (start < oldText.length && start < text.length && oldText[start] === text[start]) {
                start++;
            }

            let oldEnd = oldText.length;
            let newEnd = text.length;

            while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === text[newEnd - 1]) {

                oldEnd--;
                newEnd--;
            }

            const scrollTop = textarea.scrollTop;
            const scrollLeft = textarea.scrollLeft;

            textarea.setRangeText(text.substring(start, newEnd), start, oldEnd, "preserve");
            textarea.scrollTop = scrollTop;
            textarea.scrollLeft = scrollLeft;
            textarea.dispatchEvent(new Event("input"));
        };

        return {
            getValue: () => textarea.value,
            insertText,
            replaceText,
            updateText
        };
    };

    return {
        attach
    };
})();
