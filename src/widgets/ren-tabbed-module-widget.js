/**
 * A simple, JavaScript-based tabbed module widget.
 */
Ren.TabbedModuleWidget = () => {

    const tabInfos = {};

    let selectedTabTitle = null;

    const render = (targetElement) => {

        targetElement = Ren.HtmlUtils.enrich(targetElement);

        const tabstrip = Ren.HtmlUtils.create("div")
            ._addClass("ren-tabbed-module-widget__tabstrip");

        targetElement._append(tabstrip);

        for (const tabTitle in tabInfos) {

            const tabInfo = tabInfos[tabTitle];
            tabstrip._append(tabInfo.tab);
            targetElement._append(tabInfo.content);
        }

        setSelectedTab(selectedTabTitle);

        for (const tabTitle in tabInfos) {

            const tabInfo = tabInfos[tabTitle];

            tabInfo.tab.addEventListener("click", () => {

                tabInfos[selectedTabTitle].tab._removeClass("ren-tabbed-module-widget__tab--selected");
                tabInfos[selectedTabTitle].content.style.display = "none";

                tabInfo.tab._addClass("ren-tabbed-module-widget__tab--selected");
                tabInfo.content.style.display = "block";

                selectedTabTitle = tabTitle;
            });
        }
    };

    const addTab = (tabTitle) => {

        const tab = Ren.HtmlUtils.create("div")
            ._addClass("ren-tabbed-module-widget__tab")
            ._text(tabTitle);

        if (selectedTabTitle == null) {

            selectedTabTitle = tabTitle;
        }

        const content = Ren.HtmlUtils.create("div")
            ._addClass("ren-tabbed-module-widget__content");

        tabInfos[tabTitle] = {
            tab,
            content
        };

        return {
            addTab,
            render
        };
    };

    const setSelectedTab = (tabTitle) => {

        for (const title in tabInfos) {

            const tabInfo = tabInfos[title];

            if (title === tabTitle) {

                tabInfo.tab._addClass("ren-tabbed-module-widget__tab--selected");
                tabInfo.content.style.display = "block";
            }
            else {

                tabInfo.tab._removeClass("ren-tabbed-module-widget__tab--selected");
                tabInfo.content.style.display = "none";
            }
        }

        selectedTabTitle = tabTitle;
    };

    const setTabContent = (tabTitle, html, className) => {

        const pre = Ren.HtmlUtils.create("pre")
            ._html(html);

        if (className) {
            pre._addClass(className);
        }

        tabInfos[tabTitle].content._content(pre);

        Ren.JsonHighlighter.setupDoubleClickSelectsEntireString();
    };

    /**
     * Gets the element holding a tab's content, for content other than text.
     */
    const getTabContent = (tabTitle) => tabInfos[tabTitle].content;

    return {
        setSelectedTab,
        setTabContent,
        getTabContent,
        render,
        addTab
    };
};
