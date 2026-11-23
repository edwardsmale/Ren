Ren.ClipboardUtils = (() => {

    const COPIED_MESSAGE_MS = 1500;

    // Each button's own text, read before it first shows an outcome, so a second click while it
    // shows "Copied" doesn't keep that as its text.
    const buttonTexts = new WeakMap();

    /**
     * Copies all of a textarea's text to the clipboard, reporting the outcome on the button that
     * asked for it, as the clipboard API is missing on an insecure origin and can be refused.
     */
    const copyAllOfTextArea = (textArea, button) => {

        if (!buttonTexts.has(button)) buttonTexts.set(button, button.textContent);

        const buttonText = buttonTexts.get(button);

        textArea.focus();
        textArea.select();

        const reportCopied = () => {

            button.textContent = "Copied";

            setTimeout(() => button.textContent = buttonText, COPIED_MESSAGE_MS);
        };

        const copyWithSelection = () => {

            let copied = false;

            try {

                copied = document.execCommand("copy");
            }
            catch (error) {

                copied = false;
            }

            if (copied) {

                reportCopied();
            }
            else {

                button.textContent = "Can't copy";
            }
        };

        if (!navigator.clipboard) {

            copyWithSelection();
            return;
        }

        navigator.clipboard.writeText(textArea.value).then(reportCopied, copyWithSelection);
    };

    return {
        copyAllOfTextArea
    };
})();
