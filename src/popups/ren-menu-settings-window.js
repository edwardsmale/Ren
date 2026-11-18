/**
 * A window of tabs, each a form of the settings a menu offers (see Ren.MenuSettingsModel and
 * Ren.MenuSettingsForm), for a visualisation or anything else with a context menu.
 *
 * open() takes:
 *   owner        - what the window is for, such as a visualisation.  There is one window per owner.
 *   title        - the window's title.
 *   popupReuseId - so that opening it again brings the open one to the front.
 *   tabs         - [{ title, buildModel, subjects, runAction }], where buildModel builds the tab's
 *                  settings afresh, or is null for a tab with nothing in it yet.  A tab whose
 *                  settings are of one of several things, such as one of a chart's series, has
 *                  subjects, { label, getOptions }, where getOptions gets [{ key, label }]: a
 *                  dropdown above its settings chooses which, and its key is passed to buildModel
 *                  and the tab's runAction.
 *   runAction    - runs what a control does, as the menu would have run it, where a tab has no
 *                  runAction of its own.
 *
 * refresh(owner) builds an open window's settings afresh, as when its owner has redrawn after a
 * change made elsewhere.
 */
Ren.MenuSettingsWindow = (() => {

    const CLASS_NAME = "ren-menu-settings-window";

    // The tallest the window is opened at, beyond which its settings scroll.
    const MAX_HEIGHT_PX = 640;

    // The shortest, so that a tab with little in it doesn't leave the window a sliver.
    const MIN_HEIGHT_PX = 200;

    /**
     * Makes the window as tall as its tallest tab, or subtab, needs, so that it doesn't change
     * size as they are switched between, up to MAX_HEIGHT_PX and what fits on screen.
     */
    const fitHeight = (popupWindow, container) => {

        const tabContents = Array.from(
            container.querySelectorAll(".ren-tabbed-module-widget__content")
        );

        // Each tab, and each subtab within it, is shown in turn to be measured.
        const measure = () => tabContents.reduce((tallest, tabContent) => {

            const shownDisplay = tabContent.style.display;

            tabContent.style.display = "";

            const panels = Array.from(tabContent.querySelectorAll(".ren-menu-settings-form__subtab-panel"));
            const panelDisplays = panels.map(panel => panel.style.display);

            panels.forEach(panel => { panel.style.display = "none"; });

            const measurePanel = (panel) => {

                if (panel) panel.style.display = "";

                const overflow = tabContent.scrollHeight - tabContent.clientHeight;

                if (panel) panel.style.display = "none";

                return overflow;
            };

            const overflow = panels.length
                ? Math.max(...panels.map(measurePanel))
                : measurePanel(null);

            panels.forEach((panel, index) => { panel.style.display = panelDisplays[index]; });
            tabContent.style.display = shownDisplay;

            return Math.max(tallest, overflow);
        }, -Infinity);

        const onScreen = window.innerHeight - 40;
        const height = popupWindow.getBoundingClientRect().height + measure();

        popupWindow.style.height =
            Ren.NumberUtils.clamp(height, MIN_HEIGHT_PX, Math.min(MAX_HEIGHT_PX, onScreen)) + "px";
    };

    // owner -> { refresh }
    const openWindowsByOwner = new WeakMap();

    const open = (options) => {

        const tabbedModule = Ren.TabbedModuleWidget();

        options.tabs.forEach(tab => tabbedModule.addTab(tab.title));

        const renderContent = (contentContainer) => {

            const container = Ren.HtmlUtils.create("div")._addClass(CLASS_NAME + "__tabs");

            Ren.HtmlUtils.enrich(contentContainer)._content(container);
            tabbedModule.render(container);

            let forms = [];

            // The key of what each tab with subjects has chosen, by tab title.
            const subjectKeys = new Map();

            // The dropdown of each tab with subjects, by tab title.
            const subjectSelects = new Map();

            /**
             * Fills a tab's dropdown with what it can choose from, keeping what was chosen where it
             * still can be, and gets the key of what is chosen, or null if there is nothing.
             */
            const updateSubjects = (tab) => {

                const select = subjectSelects.get(tab.title);
                const subjectOptions = tab.subjects.getOptions();
                const keys = subjectOptions.map(option => String(option.key));

                let key = subjectKeys.get(tab.title);

                if (!keys.includes(key)) key = keys.length ? keys[0] : null;

                subjectKeys.set(tab.title, key);

                const signature = JSON.stringify(subjectOptions.map(option => [String(option.key), option.label]));

                if (select.dataset.signature !== signature) {

                    select.dataset.signature = signature;
                    select.replaceChildren(...subjectOptions.map(option => {

                        const element = document.createElement("option");

                        element.value = String(option.key);
                        element.textContent = option.label;

                        return element;
                    }));
                }

                select.value = key ?? "";
                select.disabled = keys.length < 2;

                return key;
            };

            const buildTabModel = (tab) => {

                if (!tab.subjects) return tab.buildModel();

                const key = updateSubjects(tab);

                return key === null
                    ? { type: "group", heading: "", key: "", children: [] }
                    : tab.buildModel(key);
            };

            const refresh = () => {

                forms.forEach((form, index) => {

                    if (form) form.update(buildTabModel(options.tabs[index]));
                });
            };

            // A change is seen through before the form is built again, so that it shows it.
            const onChanged = () => {

                Ren.MessageBus.sendQueuedMessages();
                refresh();
            };

            forms = options.tabs.map(tab => {

                let content = tabbedModule.getTabContent(tab.title);

                if (!tab.buildModel) return null;

                if (tab.subjects) {

                    const select = Ren.HtmlUtils.create("select")._addClass(CLASS_NAME + "__subject-select");

                    select.addEventListener("change", () => {

                        subjectKeys.set(tab.title, select.value);
                        forms[options.tabs.indexOf(tab)].update(buildTabModel(tab));
                    });

                    subjectSelects.set(tab.title, select);

                    const header = Ren.HtmlUtils.create("label")
                        ._addClass(CLASS_NAME + "__subject")
                        ._append(
                            Ren.HtmlUtils.create("span")
                                ._addClass(CLASS_NAME + "__subject-label")
                                ._textContent(tab.subjects.label),
                            select
                        );

                    const formContainer = Ren.HtmlUtils.create("div");

                    Ren.HtmlUtils.enrich(content)._content(header)._append(formContainer);

                    content = formContainer;
                }

                const runAction = tab.runAction
                    ? (fn) => tab.runAction(fn, subjectKeys.get(tab.title))
                    : options.runAction;

                return Ren.MenuSettingsForm(content, { runAction, onChanged });
            });

            openWindowsByOwner.set(options.owner, { refresh });

            refresh();

            const popupWindow = contentContainer.closest(".ren-report-popup-window");

            if (popupWindow) fitHeight(popupWindow, container);
        };

        Ren.PopupWindow(CLASS_NAME, renderContent, options.title, {
            popupReuseId: options.popupReuseId,
            width: 360,
            // Fitted to the settings once they are shown (see fitHeight).
            height: MIN_HEIGHT_PX,
            centred: true,
            // So that the tabs stay in view while a tab's settings scroll beneath them.
            fillAvailableSpace: true,
            onClose: () => openWindowsByOwner.delete(options.owner)
        });
    };

    const refresh = (owner) => {

        const openWindow = openWindowsByOwner.get(owner);

        if (openWindow) openWindow.refresh();
    };

    const isOpen = (owner) => openWindowsByOwner.has(owner);

    return {
        open,
        refresh,
        isOpen
    };
})();
