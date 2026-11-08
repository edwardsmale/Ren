Ren.CreateTabbedModule = (_tabularData, visualisation) => {

    // Applies raw Attr objects to a DOM element, merging class values with any existing classes.
    const applyRawAttributes = (targetElement, attributes) => {

        attributes.forEach(attribute => {

            if (attribute.name === "class") {

                attribute.value.split(/\s+/).forEach(className => {

                    if (className) targetElement._addClass(className);
                });
            }
            else {

                targetElement.setAttribute(attribute.name, attribute.value);
            }
        });
    };

    // Applies a camelCase-keyed parameters object to a DOM element, converting keys to kebab-case.
    const applyModuleAttributes = (targetElement, parameters) => {

        for (const key in parameters) {

            const name = Ren.TextUtils.convertToKebabCase(key);
            const value = parameters[key];

            if (name === "class") {

                String(value).split(/\s+/).forEach(className => {

                    if (className) targetElement._addClass(className);
                });
            }
            else if (value === true) {

                targetElement.setAttribute(name, "");
            }
            else if (value !== false && value !== null) {

                targetElement.setAttribute(name, String(value));
            }
        }
    };

    const element = Ren.HtmlUtils.create("div")
        ._addClass("ren-tabbed-module");

    // Client-side modules are edited in the browser. Mark them so the stylesheet can give empty tab
    // content a visible, right-clickable target (in-tab visualisations are popups that live
    // elsewhere, so the content element itself stays empty and would otherwise collapse to
    // nothing).
    //
    // isClientSideModule carries that over into a downloaded report, whose settings drop clientSide
    // so that every visualisation is recreated from them.  What the class selects for is the
    // module's own layout - it fills its popup, and its tab contents fill the module and clip the
    // tab-relative popups inside them - so without it the tab contents of a downloaded module
    // collapse to a few pixels and clip away everything they hold.
    if (visualisation.clientSide || visualisation.isClientSideModule) {
        element._addClass("ren-tabbed-module--editable");
    }

    applyModuleAttributes(element, visualisation.moduleAttributes ?? {});

    (visualisation.tabs ?? []).forEach(tab => {

        const tabEl = Ren.HtmlUtils.create("div")
            ._addClass("ren-tabbed-module__tab");

        (tab.tabAttributes ?? []).forEach(attribute => {

            if (attribute.name === "class") {

                attribute.value.split(/\s+/).forEach(className => {

                    if (className) tabEl._addClass(className);
                });
            }
            else {

                tabEl.setAttribute(attribute.name, attribute.value);
            }
        });

        // A stable data-tab-id lets popup visualisations linked to this tab be shown/hidden by the
        // tab-selection stylesheet.  For client-side (editable) modules the tabContentGuid is that
        // stable id - it is persisted with the module and is the value createVisualisationInTab
        // links popups to.  For server-rendered modules (from a <ren-tabbed-module> in a view)
        // the tabContentGuid is regenerated on every load, so using it here would override the
        // header-text-based id that getContainingTabIds derives - the stable id that persisted
        // popups were saved against.  In that case leave data-tab-id unset (unless an explicit
        // tab-id was supplied) so getContainingTabIds falls back to the header text.
        const effectiveTabId = tab.tabId || (visualisation.clientSide ? tab.tabContentGuid : null);

        if (effectiveTabId) {
            tabEl.setAttribute("data-tab-id", effectiveTabId);
        }

        const headerEl = Ren.HtmlUtils.create("div")
            ._addClass("ren-tabbed-module__tab-header");

        applyRawAttributes(headerEl, tab.headerAttributes ?? []);

        Ren.HtmlUtils.setHTML(headerEl, tab.headerHtml);
        tabEl.appendChild(headerEl);

        const contentEl = Ren.HtmlUtils.create("div")
            ._addClass("ren-tabbed-module__tab-content");

        applyRawAttributes(contentEl, tab.contentAttributes ?? []);

        if (tab.tabContentGuid) {
            contentEl.setAttribute("data-tab-content-guid", tab.tabContentGuid);
        }

        if (tab.contentHtml) {
            Ren.HtmlUtils.setHTML(contentEl, tab.contentHtml);
        }

        // Apply any explicit dimensions specified on the tab content (e.g. to give a tab that hosts
        // tab-relative popups a fixed clip area).  Inline styles override the content-sizing rules
        // in ren-tabbed-modules.scss.
        if (tab.contentWidth) {
            contentEl.style.width = tab.contentWidth;
        }

        if (tab.contentHeight) {
            contentEl.style.height = tab.contentHeight;
        }

        tabEl.appendChild(contentEl);
        element.appendChild(tabEl);
    });

    // Defer reportAddedToDom so it fires after ren-web-report-display.js has appended
    // this element to the DOM.  This lets setupNewTabbedModules select the first tab even when
    // the tab content is empty (no <ren-*> elements to trigger the notification automatically).
    Ren.FnUtils.defer(() => Ren.Messages.Events.reportAddedToDom.notify());

    return { element };
};
