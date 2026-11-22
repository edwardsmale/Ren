/**
 * Turns each <ren-report-context report-name="..."> into the div report context it stands for,
 * keeping its contents, so that a host page can mark out where its report lives rather than Ren
 * making the body the report context.  The request URL is the page's, unless a request-url
 * attribute gives one.  Any other attributes are carried over to the div.
 */
Ren.ReportContextElement = (() => {

    const TAG_NAME = "ren-report-context";

    const ATTRIBUTES_BY_ELEMENT_ATTRIBUTE = {
        "report-name": "data-report-name",
        "request-url": "data-request-url"
    };

    const createContextElement = (element) => {

        const contextElement = document.createElement("div");
        const attributes = element.attributes;

        for (let index = 0; index < attributes.length; index++) {

            const name = attributes[index].name;
            const value = attributes[index].value;

            contextElement.setAttribute(ATTRIBUTES_BY_ELEMENT_ATTRIBUTE[name] || name, value);
        }

        contextElement.classList.add("js-ren-report-context", "js-ren-report-context--on-page");

        if (!contextElement.hasAttribute("data-request-url")) {

            contextElement.setAttribute(
                "data-request-url",
                window.location.pathname + window.location.search
            );
        }

        return contextElement;
    };

    const upgradeElements = () => {

        const elements = document.querySelectorAll(TAG_NAME);

        for (let index = 0; index < elements.length; index++) {

            const element = elements[index];

            if (!element.hasAttribute("report-name")) {

                console.warn(`[ReportContextElement] <${TAG_NAME}> has no report-name attribute.`);
            }

            const contextElement = createContextElement(element);

            while (element.firstChild) {

                contextElement.appendChild(element.firstChild);
            }

            element.replaceWith(contextElement);
        }
    };

    return {
        upgradeElements
    };
})();
