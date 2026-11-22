/**
 * The editor for an html content visualisation's markup, reached from the module's "Edit
 * content..." context menu item.
 *
 * The visualisation renders whatever markup its contentHtml property holds, so the editor simply
 * shows that markup raw in a text editor popup and writes it back.  Apply re-renders the module
 * without closing the popup, so the markup can be adjusted and seen in place.
 *
 * The edited markup is kept on the visualisation, from where it is saved with the report settings:
 * in full for a client-side visualisation (those a settings-only report declares), and via the
 * type's persistedProperties for one declared as markup in a web report's view.
 */
Ren.HtmlContentEditor = (visualisation, element) => {

    const applyContent = (html) => {

        visualisation.contentHtml = html;

        Ren.HtmlUtils.setHTML(element, html);

        Ren.Messages.Events.visualisationSettingsChanged.notify(visualisation);
    };

    const open = () => {

        Ren.CreateTextEditorPopupWindow(
            "Edit content",
            visualisation.contentHtml ?? "",
            applyContent,
            {
                width: 640,
                height: 420
            }
        );
    };

    const getMenuItem = () => ({
        section: "Html content",
        text: "Edit content...",
        id: "html-content-edit-content",
        action: () => open()
    });

    return {
        open,
        getMenuItem
    };
};
