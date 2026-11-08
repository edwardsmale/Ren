/**
 * Creates a non-modal popup window containing an optional header, optional label, optional
 * shortcut links, and a text field with OK and Cancel buttons.
 * Options: { header, label, shortcuts, initialText, width, height, centred, isResizable,
 *            multiline }
 * When multiline is false a single-line text input is used and Enter submits; otherwise a
 * multi-line textarea is used (the default) and Ctrl+Enter submits.
 */
Ren.CreateOkCancelTextEditorPopupWindow = (title, onOk, options) => {

    const width = (options && options.width) || 320;
    const height = (options && options.height) || 150;
    const centred = !options || options.centred !== false;
    const isResizable = !options || options.isResizable !== false;
    const multiline = !options || options.multiline !== false;

    const renderContent = (contentContainer, popup) => {

        contentContainer.style.cssText += "display: flex; flex-direction: column; height: 100%; overflow: hidden;";

        const wrapper = document.createElement("div");
        wrapper.style.cssText = "display: flex; flex-direction: column; flex: 1; padding: 12px; min-height: 0;";

        if (options && options.header) {

            const header = document.createElement("div");
            header.style.cssText = "font-weight: bold; margin-bottom: 8px;";
            header.textContent = options.header;
            wrapper.appendChild(header);
        }

        if (options && options.label) {

            const label = document.createElement("label");
            label.style.cssText = "font-size: 0.875rem; margin-bottom: 4px;";
            label.textContent = options.label;
            wrapper.appendChild(label);
        }

        const inputField = document.createElement(multiline ? "textarea" : "input");

        inputField.className = "qa-ren-text-editor-input";

        if (!multiline) inputField.type = "text";

        inputField.value = (options && options.initialText) || "";
        inputField.style.cssText = multiline ?
            `
            flex: 1;
            min-height: 0;
            padding: 6px;
            border: 1px solid #999;
            font-family: Calibri, Arial, sans-serif;
            box-sizing: border-box;
            resize: none;
            margin-bottom: 10px;
            outline: none;
            ` :
            `
            padding: 6px;
            border: 1px solid #999;
            font-family: Calibri, Arial, sans-serif;
            box-sizing: border-box;
            margin-bottom: 10px;
            outline: none;
            `;

        if (options && options.shortcuts && options.shortcuts.length > 0) {

            const shortcutsDiv = document.createElement("div");
            shortcutsDiv.style.cssText = "display: flex; flex-wrap: wrap; gap: 4px 8px; margin-top: 4px; margin-bottom: 6px;";

            options.shortcuts.forEach(text => {

                const link = document.createElement("a");
                link.href = "#";
                link.textContent = text;
                link.style.cssText = "font-size: 0.8rem;";
                link.addEventListener("click", e => {

                    e.preventDefault();
                    inputField.value += text;
                    inputField.focus();
                });
                shortcutsDiv.appendChild(link);
            });

            wrapper.appendChild(shortcutsDiv);
        }

        const buttonsDiv = document.createElement("div");
        buttonsDiv.style.cssText = "display: flex; gap: 6px; justify-content: flex-end;";

        const createButton = (text, className, onClick) => {

            const btn = document.createElement("button");
            btn.textContent = text;
            btn.className = className;
            btn.addEventListener("click", onClick);
            return btn;
        };

        const okBtn = createButton("OK", "qa-ren-text-editor-ok", () => {

            onOk(inputField.value);
            popup.closeWindow();
        });

        okBtn.title = `Apply the change and close the popup (${multiline ? "Ctrl+Enter" : "Enter"})`;

        const cancelBtn = createButton("Cancel", "qa-ren-text-editor-cancel", () => {

            popup.closeWindow();
        });

        buttonsDiv.appendChild(okBtn);
        buttonsDiv.appendChild(cancelBtn);

        wrapper.appendChild(inputField);
        wrapper.appendChild(buttonsDiv);
        contentContainer.appendChild(wrapper);

        inputField.addEventListener("keydown", e => {

            e.stopPropagation();

            // In multi-line mode, Ctrl+Enter submits (so plain Enter can insert newlines).  In
            // single-line mode, plain Enter submits.
            const submitKeyPressed = multiline ?
                (e.ctrlKey && e.key === "Enter") :
                (e.key === "Enter");

            if (submitKeyPressed) {

                e.preventDefault();
                onOk(inputField.value);
                popup.closeWindow();
            }
            else if (e.key === "Escape") {

                e.preventDefault();
                popup.closeWindow();
            }
        });

        setTimeout(() => {

            window.getSelection()?.removeAllRanges();
            inputField.focus();
        }, 0);
    };

    Ren.PopupWindow(
        "ren-text-editor-popup",
        renderContent,
        title,
        {
            width: width,
            height: height,
            centred: centred,
            isResizable: isResizable,
            verticalScrollbar: false,
            horizontalScrollbar: false
        }
    );
};

/**
 * Creates a non-modal popup window containing a textarea with OK, Apply, and Cancel buttons.
 */
Ren.CreateTextEditorPopupWindow = (title, initialText, onApply, options) => {

    const width = (options && options.width) || 320;
    const height = (options && options.height) || 110;
    const centred = !options || options.centred !== false;
    const isResizable = !options || options.isResizable !== false;

    const renderContent = (contentContainer, popup) => {

        contentContainer.style.cssText += "display: flex; flex-direction: column; height: 100%; overflow: hidden;";

        const wrapper = document.createElement("div");
        wrapper.style.cssText = "display: flex; flex-direction: column; flex: 1; padding: 12px; min-height: 0;";

        const textarea = document.createElement("textarea");
        textarea.value = initialText || "";
        textarea.style.cssText = `
            flex: 1;
            min-height: 0;
            padding: 6px;
            border: 1px solid #999;
            font-family: Calibri, Arial, sans-serif;
            box-sizing: border-box;
            resize: none;
            margin-bottom: 10px;
            outline: none;
        `;

        const focusAtEnd = () => {

            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        };

        const buttonsDiv = document.createElement("div");
        buttonsDiv.style.cssText = "display: flex; gap: 6px; justify-content: flex-end;";

        const createButton = (text, onClick) => {

            const btn = document.createElement("button");
            btn.textContent = text;
            btn.addEventListener("click", onClick);
            return btn;
        };

        const okBtn = createButton("OK", () => {

            onApply(textarea.value);
            popup.closeWindow();
        });

        okBtn.title = "Apply the change and close the popup (Ctrl+Enter)";

        const applyBtn = createButton("Apply", () => {

            onApply(textarea.value);
            focusAtEnd();
        });

        applyBtn.title = "Apply the change without closing the popup (Alt+Enter)";

        const cancelBtn = createButton("Cancel", () => {

            popup.closeWindow();
        });

        buttonsDiv.appendChild(okBtn);
        buttonsDiv.appendChild(applyBtn);
        buttonsDiv.appendChild(cancelBtn);

        wrapper.appendChild(textarea);
        wrapper.appendChild(buttonsDiv);
        contentContainer.appendChild(wrapper);

        textarea.addEventListener("keydown", e => {

            e.stopPropagation();

            if (e.ctrlKey && e.key === "Enter") {

                e.preventDefault();
                onApply(textarea.value);
                popup.closeWindow();
            }
            else if (e.altKey && e.key === "Enter") {

                e.preventDefault();
                onApply(textarea.value);
                focusAtEnd();
            }
            else if (e.key === "Escape") {

                e.preventDefault();
                popup.closeWindow();
            }
        });

        setTimeout(() => {

            window.getSelection()?.removeAllRanges();
            focusAtEnd();
        }, 0);
    };

    Ren.PopupWindow(
        "ren-text-editor-popup",
        renderContent,
        title,
        {
            width: width,
            height: height,
            centred: centred,
            isResizable: isResizable,
            verticalScrollbar: false,
            horizontalScrollbar: false
        }
    );
};
