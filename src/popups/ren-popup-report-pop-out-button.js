/**
 * Sets up a popup report window's pop-out button so that it opens the report in a new browser tab.
 * If the user right-clicks the button, it also closes the pop-up window.
 */
Ren.SetupPopOutButton = (popupWindow, getPopOutUrl) => {

    const popOutButton = popupWindow.popOutButton;

    if (!popOutButton) return;

    const popOutWindow = () => { // Click on the pop out button.

        const popOutUrl = getPopOutUrl();

        let updatedPopOutUrl = Ren.UrlUtils.removeQueryParameter(popOutUrl, "isPopup");
        updatedPopOutUrl = Ren.UrlUtils.removeQueryParameter(updatedPopOutUrl, "noStatics");

        Ren.BrowserUtils.openNewBrowserTab(updatedPopOutUrl);
    };

    // Set the event handlers via assignment so we don't end up with multiple handlers when the 
    // popup report is reloaded due to its URL being updated.
    popOutButton.onclick = popOutWindow;
    popOutButton.oncontextmenu = (e) => {

        e.preventDefault();

        popOutWindow();
        popupWindow.closeWindow();
    };

    popOutButton.style.display = "block";
};
