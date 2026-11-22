(() => {

    Ren.PopupMessageTypeEnum = Ren.DefineEnum({
        Success: 1,
        SuccessWithWarning: 2,
        Error: 3
    });

    const popupMessageOptions = {
        centred: true,
        autoSized: true,
        horizontalScrollbar: false,
        verticalScrollbar: false,
        isResizable: false,
        title: "Message"
    };

    const getPopupMessageContent = (message, options) => {

        message = message.toString().replace(/\n/g, "<br />");

        const content = document.createElement("div");
        content.classList.add("ren-popup-message__content");
        content.classList.add("js-ren-popup-message-content");
        content.classList.add("qa-ren-popup-message-content");
        content.innerHTML = message;

        if (!options.closeWhenFocusLost) {

            const buttons = document.createElement("div");
            buttons.className = "ren-popup-message__buttons";

            const okButton = document.createElement("button");
            okButton.className = "ren-popup-message__button js-ren-popup-message-ok-button";
            okButton.textContent = "OK";

            buttons.appendChild(okButton);
            content.appendChild(buttons);
        }

        return content.outerHTML;
    };

    Ren.PopupMessage = (message, messageType, options) => {

        const className = "ren-popup-message ren-popup-message--" + messageType;
        const content = getPopupMessageContent(message, options);

        const renderContent = (contentContainer) => {

            contentContainer.appendChild(Ren.HtmlUtils.create(content));
        };

        options.titleBarModifier = Ren.ObjectUtils.getEnumKey(Ren.PopupMessageTypeEnum, messageType);

        Ren.ObjectUtils.applyDefaultOptions(options, popupMessageOptions);

        return Ren.PopupWindow(
            className,
            renderContent,
            options.title,
            options
        );
    };

    Ren.PopupErrorMessage = (message, options) => {

        options ??= {};

        const defaultOptions = {
            title: "Error",
            closeWhenFocusLost: false
        };

        Ren.ObjectUtils.applyDefaultOptions(options, defaultOptions);

        return Ren.PopupMessage(
            message,
            Ren.PopupMessageTypeEnum.Error,
            options
        );
    };

    Ren.PopupSuccessWithWarningMessage = (message, options) => {

        options ??= {};

        const defaultOptions = {
            title: "Success",
            warningTriangle: true,
            closeWhenFocusLost: true
        };

        Ren.ObjectUtils.applyDefaultOptions(options, defaultOptions);

        return Ren.PopupMessage(
            message,
            Ren.PopupMessageTypeEnum.SuccessWithWarning,
            options
        );
    };

    /**
     * Asks a yes or no question, calling onYes if the answer is yes.  Closing the window is
     * taken as no.
     */
    Ren.PopupConfirm = (message, title, onYes) => {

        const renderContent = (contentContainer, popup) => {

            const content = Ren.HtmlTemplateFunctions.reifyHtmlTemplate("PopupConfirm", {});

            content.querySelector(".js-ren-popup-confirm-message").textContent = message;

            content.querySelector(".js-ren-popup-confirm-yes").addEventListener("click", () => {

                popup.closeWindow();
                onYes();
            });

            content.querySelector(".js-ren-popup-confirm-no")
                .addEventListener("click", () => popup.closeWindow());

            contentContainer.appendChild(content);
        };

        return Ren.PopupWindow(
            "ren-popup-message",
            renderContent,
            title,
            Object.assign({}, popupMessageOptions, { titleBarModifier: "Confirm" })
        );
    };

    Ren.PopupSuccessMessage = (message, options) => {

        options ??= {};

        const defaultOptions = {
            titls: "Success",
            closeWhenFocusLost: true
        };

        Ren.ObjectUtils.applyDefaultOptions(options, defaultOptions);

        return Ren.PopupMessage(
            message,
            Ren.PopupMessageTypeEnum.Success,
            options
        );
    };
})();
