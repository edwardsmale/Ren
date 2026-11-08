/**
 * Makes elements in a web report that carry a data-show-data-sql attribute, typically
 * figures quoted in the report's text, open that SQL in the host's SQL editor, through the
 * openSqlInEditor page hook.  Either click the element, or use its "Show data" context menu item.
 * Without that hook, the elements are left as they are.
 *
 * An element can instead name its SQL with data-show-data-sql-name, which keeps the SQL out of text
 * held in report settings.  The SQL is then the text of the page's element whose
 * data-show-data-sql-definition attribute has that name.
 */
Ren.ShowDataLinks = (() => {

    const SQL_ATTRIBUTE_NAME = "data-show-data-sql";
    const SQL_NAME_ATTRIBUTE_NAME = "data-show-data-sql-name";
    const SQL_DEFINITION_ATTRIBUTE_NAME = "data-show-data-sql-definition";

    const LINK_SELECTOR = "[" + SQL_ATTRIBUTE_NAME + "], [" + SQL_NAME_ATTRIBUTE_NAME + "]";

    const getSql = (element) => {

        const sql = element.getAttribute(SQL_ATTRIBUTE_NAME);

        if (sql !== null) return sql;

        const name = element.getAttribute(SQL_NAME_ATTRIBUTE_NAME);

        const definition = document.querySelector(
            "[" + SQL_DEFINITION_ATTRIBUTE_NAME + "=\"" + CSS.escape(name) + "\"]"
        );

        if (!definition) {

            Ren.PopupErrorMessage(`No SQL is defined for the name "${name}".`);
            return null;
        }

        return definition.textContent.trim();
    };

    const canOpenInEditor = () => Ren.PageHooks.getSqlEditorOpener() !== null;

    const openInEditor = (sql) => {

        const openSqlInEditor = Ren.PageHooks.getSqlEditorOpener();

        if (sql === null || !openSqlInEditor) return;

        openSqlInEditor(sql);
    };

    const setUpElement = (element) => {

        if (!canOpenInEditor()) return;

        element.classList.add("ren-web-report-show-data");

        Ren.AddContextMenuItems(element, [{
            section: "Data",
            text: "Show data",
            action: () => openInEditor(getSql(element))
        }]);
    };

    /**
     * Sets up the links in the root element, or in the whole page.
     */
    const setUpElements = (root) => {

        (root ?? document).querySelectorAll(LINK_SELECTOR).forEach(setUpElement);
    };

    const onDocumentClick = (event) => {

        const element = event.target.closest(LINK_SELECTOR);

        if (element && canOpenInEditor()) {

            event.preventDefault();
            openInEditor(getSql(element));
        }
    };

    // Delegated, since setUpElements runs again whenever a report is added to the page.
    document.addEventListener("click", onDocumentClick);

    Ren.Messages.Events.pageLoaded.handle(() => {

        setUpElements();
    });

    Ren.Messages.Events.reportAddedToDom.handle(() => {

        setUpElements();
    });

    return {
        openInEditor,
        setUpElements
    };
})();
