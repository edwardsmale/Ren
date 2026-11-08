/**
 * Creates functions from HTML templates: the library's own, and those a page provides.
 */
Ren.HtmlTemplateFunctions = (() => {

    const createFunctionFromTemplate = (htmlTemplateString) => {

        htmlTemplateString = "`" + htmlTemplateString + "`";

        const resolvedFunctionString = Ren.FunctionResolver.resolveAtExpressions(htmlTemplateString);

        const outputFunctionString = "(parameters) => { return " + resolvedFunctionString + "; }";

        try {

            return eval(outputFunctionString);
        }
        catch (e) {

            Ren.PopupErrorMessage("Error in HTML template function definition: " + e);
        }
    };

    const functionCache = {};
    const htmlTemplateFunctions = {};

    // Added by Ren.Extensions.registerHtmlTemplate, and used where the page has no template of the
    // same name.  Each is the template's source, or a function already compiled from it (as the
    // library's own are, by the build), which is used as it is, with no eval.
    const registeredHtmlTemplateFunctions = {};
    let initialised = false;

    const initialiseHtmlTemplateFunctions = () => {

        const sourceElement = document.querySelector(".html-template-function-source-code");

        // Left uninitialised rather than caching the emptiness, so that the templates are picked up
        // if the element arrives later.
        if (!sourceElement) return;

        const htmlTemplateFunctionsSource = JSON.parse(sourceElement.innerHTML);

        for (const key in htmlTemplateFunctionsSource) {

            const functionName = key;
            const body = htmlTemplateFunctionsSource[key].trim();

            htmlTemplateFunctions[functionName] = body;
        }

        initialised = true;
    };

    Ren.Extensions.handle("htmlTemplate", (registration) => {

        registeredHtmlTemplateFunctions[registration.name] = typeof registration.source === "function"
            ? registration.source
            : registration.source.trim();

        if (!htmlTemplateFunctions[registration.name]) delete functionCache[registration.name];
    });

    /**
     * Creates a function based on the specified HTML template name.  Functions are cached for
     * performance.
     */
    const createFunction = (htmlTemplateName) => {

        if (!initialised) initialiseHtmlTemplateFunctions();

        if (functionCache[htmlTemplateName]) {

            return functionCache[htmlTemplateName];
        }

        const template = htmlTemplateFunctions[htmlTemplateName] ||
            registeredHtmlTemplateFunctions[htmlTemplateName];

        if (!template) {

            Ren.PopupErrorMessage(`HTML template function "${htmlTemplateName}" not found.`);

            functionCache[htmlTemplateName] = () =>
                `<span>HTML template function ${htmlTemplateName} not found.</span>`;

            return functionCache[htmlTemplateName];
        }

        if (typeof template === "function") {

            functionCache[htmlTemplateName] = template;

            return template;
        }

        try {

            functionCache[htmlTemplateName] = createFunctionFromTemplate(template);
        }
        catch (e) {

            functionCache[htmlTemplateName] = () =>
                `<span>Error in HTML template function definition: ${e}</span>`;
        }

        return functionCache[htmlTemplateName];
    };

    /**
     * Renders the specified HTML template function to an HTML string.  Use this where a string is
     * needed (such as a fragment passed as another template's parameter); where an element is
     * needed, use reifyHtmlTemplate instead.
     */
    const renderHtmlTemplate = (htmlTemplateName, parameters) => {

        const func = createFunction(htmlTemplateName);

        return func(parameters);
    };

    /**
     * Creates an element based on the specified HTML template function and parameters.
     */
    const reifyHtmlTemplate = (htmlTemplateName, parameters) => {

        const html = renderHtmlTemplate(htmlTemplateName, parameters);

        // createRootElement does the wrapping of a template that renders more than one root
        // element, off the parse it has already done.
        return Ren.HtmlUtils.createRootElement(html);
    };

    return {
        createFunctionFromTemplate,
        renderHtmlTemplate,
        reifyHtmlTemplate
    };
})();
