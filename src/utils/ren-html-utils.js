/**
 * Functions for doing things with HTML.
 */
Ren.HtmlUtils = (() => {

    /**
     * Gets the HTML body, or null if it has not been parsed yet.
     */
    const getBody = () => {

        const body = document.body;
        return body ? enrich(body) : null;
    };

    const getBodyScrollPos = () => {

        const viewport = document.scrollingElement || document.documentElement;

        return {
            left: viewport.scrollLeft,
            top: viewport.scrollTop
        };
    };

    /**
     * Gets the js-ren-report-context element that contains the given element.
     */
    const getContainingReportContext = (element) => {

        if (!element?.classList) return null;

        if (element.classList.contains("js-ren-report-context")) {

            return element;
        }

        return element.closest(".js-ren-report-context");
    };

    /**
     * Gets a value indicating whether a report context element is shown in a popup window.  Its
     * class is not enough, as a report opened by Ren.ShowPopupReport is rendered as an embedded
     * report rather than with the inside-popup layout.
     */
    const isReportContextInsidePopup = (reportContext) => {

        return reportContext.classList.contains("js-ren-report-context--inside-popup") ||
            !!reportContext.closest(".ren-report-popup-window");
    };

    /**
     * Gets all js-ren-report-context elements that are nested below the main report context.
     */
    const getAllEmbeddedReportContexts = () => {

        const reportContexts = Array.from(document.querySelectorAll(".js-ren-report-context"));

        reportContexts.shift(); // Remove the first one, which is the main report context.

        return reportContexts;
    };

    const executeScript = (script) => {

        if (script.dataset.run === "true") return;

        const type = script.type || "text/javascript";
        if (type !== "text/javascript") return;

        const newScript = document.createElement("script");
        if (script.hasAttribute("src")) newScript.src = script.src;

        newScript.innerHTML = script.innerHTML;
        document.head.appendChild(newScript);
        document.head.removeChild(newScript);

        script.dataset.run = "true";
    };

    /**
     * Runs the scripts in the given element, and the element itself if it is a script.
     */
    const executeScripts = (element) => {

        if (element.nodeType !== Node.ELEMENT_NODE) return;

        if (element.tagName === "SCRIPT") {

            executeScript(element);
            return;
        }

        const scripts = element.querySelectorAll("script");

        for (let i = 0; i < scripts.length; i++) {

            executeScript(scripts[i]);
        }
    };

    const setHTML = (element, html) => {

        if (!html) {

            element.innerHTML = "";
            return;
        }

        element.innerHTML = "";
        appendHTML(element, html);
    };

    const appendHTML = (element, html) => {

        if (!html) return;

        if (typeof html === "string") {

            const div = create("div");
            div.innerHTML = "<div style='display: contents'>" + html + "</div>";
            html = div.firstChild;
        }

        // Only the appended content needs scanning, but a fragment is empty once appended.
        const appended = html.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? element : html;

        element.appendChild(html);

        executeScripts(appended);
    };

    function _append() {

        const createFn = Ren.HtmlUtils.create;
        const frag = document.createDocumentFragment();

        for (let i = 0; i < arguments.length; i++) {

            const arg = arguments[i];

            if (typeof arg === "string") {

                frag.appendChild(createFn(arg));
            }
            else if (arg instanceof Node) {

                frag.appendChild(arg);
            }
        }
        this.appendChild(frag);
        return this;
    }

    function _prepend() {

        const createFn = Ren.HtmlUtils.create;
        const frag = document.createDocumentFragment();

        for (let i = arguments.length - 1; i >= 0; i--) {

            const arg = arguments[i];

            if (typeof arg === "string") {
                frag.insertBefore(createFn(arg), frag.firstChild);
            }
            else if (arg instanceof Node) {

                frag.insertBefore(arg, frag.firstChild);
            }
        }
        this.insertBefore(frag, this.firstChild);
        return this;
    }

    function _text(text) {

        this.innerText = text;
        return this;
    }

    function _textContent(text) {

        // Defused here so that every script built via create("script") is safe whatever its
        // content (see escapeScriptClosingTag).
        if (this.tagName === "SCRIPT" && typeof text === "string") {
            text = escapeScriptClosingTag(text);
        }

        this.textContent = text;
        return this;
    }

    function _html(html) {

        Ren.HtmlUtils.setHTML(this, html);
        return this;
    }

    function _empty() {

        this.innerHTML = "";
        return this;
    }

    function _content() {

        this._empty();
        this._append.apply(this, arguments);
        return this;
    }

    /**
     * Adds a class name, a space-separated list of them, or a (nested) array of either.
     */
    const addClassValue = (element, val) => {

        if (typeof val === "string") {

            if (val.includes(" ")) {

                const classes = val.split(" ");

                for (let ci = 0; ci < classes.length; ci++) {
                    if (classes[ci]) element.classList.add(classes[ci]);
                }
            }
            else {

                element.classList.add(val);
            }
        }
        else if (Array.isArray(val)) {

            for (let i = 0; i < val.length; i++) {

                addClassValue(element, val[i]);
            }
        }
    };

    function _addClass() {

        for (let i = 0; i < arguments.length; i++) {

            addClassValue(this, arguments[i]);
        }
        return this;
    }

    function _removeClass() {

        for (let i = 0; i < arguments.length; i++) {

            const val = arguments[i];

            if (typeof val === "string") {

                if (val.includes(" ")) {

                    const classes = val.split(" ");

                    for (let ci = 0; ci < classes.length; ci++) {
                        if (classes[ci]) this.classList.remove(classes[ci]);
                    }
                }
                else {

                    this.classList.remove(val);
                }
            }
        }
        return this;
    }

    function _style(name, value) {

        if (typeof name === "string") {

            this.style[name] = value;
        }
        else {

            for (const key in name) {
                this.style[key] = name[key];
            }
        }
        return this;
    }

    function _attr(name, value) {

        if (typeof name === "string") {

            this.setAttribute(name, value);
        }
        else {

            for (const key in name) {
                this.setAttribute(key, name[key]);
            }
        }
        return this;
    }

    function _removeAttr(name) {

        this.removeAttribute(name);
        return this;
    }

    function _set(name, value) {

        this[name] = value;
        return this;
    }

    function _findAll(selector) {

        const elements = this.querySelectorAll(selector);
        if (elements.length === 0) return null;
        return Array.from(elements).map(element => Ren.HtmlUtils.enrich(element));
    }

    const enrichmentMethods = {
        _append,
        _prepend,
        _text,
        _textContent,
        _html,
        _empty,
        _content,
        _addClass,
        _removeClass,
        _style,
        _attr,
        _removeAttr,
        _set,
        _findAll
    };

    const enrich = (element) => {

        Object.assign(element, enrichmentMethods);
        return element;
    };

    const get = (selector) => {

        const element = document.querySelector(selector);
        if (!element) return null;

        return enrich(element);
    };

    // Parses an HTML string and places the parsed elements in a cached parent element.
    const parseIntoCachedParent = (html) => {

        // The parser only keeps some roots inside a suitable parent, e.g. a <tr> inside a table.

        let parentTag = "div";

        if (html.startsWith("<tr")) {

            parentTag = "table";
        }
        else if (html.startsWith("<td")) {

            parentTag = "tr";
        }

        // Cache the parent element (per tag type) for performance.

        const parentCache = parseIntoCachedParent._parentCache
            || (parseIntoCachedParent._parentCache = {});

        let parent = parentCache[parentTag];

        if (!parent) {

            parent = document.createElement(parentTag);
            parentCache[parentTag] = parent;
        }

        parent.innerHTML = html;

        return parent;
    };

    /**
     * Removes the first child element from the parent, and returns the detached element.
     */
    const detachRootElement = (parent) => {

        const element = parent.firstElementChild;

        if (element) parent.removeChild(element);

        return element;
    };

    /**
     * Creates an element from an HTML string that is allowed to have more than one root element,
     * wrapping the roots in a display:contents div where it has.
     */
    const createRootElement = (html) => {

        const parent = parseIntoCachedParent(html);

        if (parent.childElementCount > 1) {

            const wrapper = document.createElement("div");
            wrapper.style.display = "contents";

            while (parent.firstChild) {

                wrapper.appendChild(parent.firstChild);
            }

            return enrich(wrapper);
        }

        const element = detachRootElement(parent);

        if (!element) {

            throw new Error("Could not create element from HTML string.");
        }

        return enrich(element);
    };

    const create = (html_or_tag_name, attributes) => {

        let element = null;

        if (typeof html_or_tag_name !== "string") {

            throw new Error("html_or_tag_name must be a string.");
        }

        // Fast path: tag name only, no angle brackets.
        if (html_or_tag_name[0] !== "<") {

            element = document.createElement(html_or_tag_name);

            if (attributes && typeof attributes === "object") {

                for (const key in attributes) {

                    element.setAttribute(key, attributes[key]);
                }
            }

            return enrich(element);
        }

        // HTML string path.
        const parent = parseIntoCachedParent(html_or_tag_name);

        if (parent.childElementCount > 1) {

            throw new Error("HTML string must contain only a single root element.");
        }

        element = detachRootElement(parent);

        if (!element) {

            throw new Error("Could not create element from HTML string.");
        }

        if (attributes && typeof attributes === "object") {

            for (const key in attributes) {

                element.setAttribute(key, attributes[key]);
            }
        }

        return enrich(element);
    };

    const append = function (parent, child_ren) { // Regular function to allow use of arguments.

        if (typeof parent === "string") parent = create(parent);

        if (Array.isArray(child_ren)) {

            for (let i = 0; i < child_ren.length; i++) {

                parent.appendChild(child_ren[i]);
            }
        }
        else if (typeof child_ren === "string") {

            parent.append(create(child_ren));
        }
        else {

            for (let i = 1; i < arguments.length; i++) {

                parent.appendChild(arguments[i]);
            }
        }

        return parent;
    };

    const getAttributeOrDefault = (element, attributeName, defaultValue) => {

        return element.getAttribute(attributeName) ?? defaultValue;
    };

    const getOuterWidth = (element) => {

        const style = window.getComputedStyle(element);
        const marginLeft = parseFloat(style.marginLeft) || 0;
        const marginRight = parseFloat(style.marginRight) || 0;
        const width = element.offsetWidth || 0;
        return width + marginLeft + marginRight;
    };

    const getOuterHeight = (element) => {

        const style = window.getComputedStyle(element);
        const marginTop = parseFloat(style.marginTop) || 0;
        const marginBottom = parseFloat(style.marginBottom) || 0;
        const height = element.offsetHeight || 0;
        return height + marginTop + marginBottom;
    };

    /**
     * Gets the outer width and height of an element, margins included, reading its computed style
     * only once.
     */
    const getOuterSize = (element) => {

        const style = window.getComputedStyle(element);
        const marginLeft = parseFloat(style.marginLeft) || 0;
        const marginRight = parseFloat(style.marginRight) || 0;
        const marginTop = parseFloat(style.marginTop) || 0;
        const marginBottom = parseFloat(style.marginBottom) || 0;

        return {
            width: (element.offsetWidth || 0) + marginLeft + marginRight,
            height: (element.offsetHeight || 0) + marginTop + marginBottom
        };
    };

    /**
     * Removes all elements from the document that match the given selector.
     */
    const removeElements = (selector) => {

        const elements = document.querySelectorAll(selector);

        elements.forEach(element => element.remove());
    };

    /**
     * Moves the given element to a new parent element (event handlers are not removed).
     */
    const moveElement = (element, newParent) => {

        if (element.parentNode) {
            element.parentNode.removeChild(element);
        }
        newParent.appendChild(element);
    };

    const isElementVisible = (element) => {

        return !!element.offsetParent;
    };

    const parser = new DOMParser();

    const parseHTML = (html) => {

        return parser.parseFromString(html, "text/html");
    };

    const replaceWith = (element, html) => {

        if (typeof html === "string") {

            html = parseHTML(html).documentElement
                .querySelector(".js-ren-report-context");
        }

        element.insertAdjacentElement("afterend", html);
        element.remove();
    };

    const getClassName = (element, startsWith) => {

        if (!element?.classList) return null;

        const classes = element.classList;

        for (let i = 0; i < classes.length; i++) {

            if (classes[i].startsWith(startsWith)) {
                return classes[i];
            }
        }
        return null;
    };

    const guidSuffixPattern = /^(static-)?\d+$/;

    /**
     * Gets the element's generated GUID class with the passed prefix, or null if absent.  The
     * prefix must be followed by digits, or by "static-" and digits, so "ren-visualisation-"
     * doesn't match classes such as ren-visualisation-target.
     */
    const getGuidClassName = (element, prefix) => {

        if (!element?.classList) return null;

        const classes = element.classList;

        for (let i = 0; i < classes.length; i++) {

            const className = classes[i];
            const suffix = className.slice(prefix.length);

            if (className.startsWith(prefix) && guidSuffixPattern.test(suffix)) {
                return className;
            }
        }
        return null;
    };

    /**
     * Gets the row index encoded in the element's ren-r-N class, or null if absent.
     */
    const getRowIndex = (element) => {

        const className = getClassName(element, "ren-r-");
        return className ? parseInt(className.slice(6)) : null;
    };

    /**
     * Gets the column index encoded in the element's ren-c-N class, or null if absent.
     */
    const getColumnIndex = (element) => {

        const className = getClassName(element, "ren-c-");
        return className ? parseInt(className.slice(6)) : null;
    };

    const htmlEscapeTestPattern = /[&<>\u00A0\r\n]/;
    const htmlEscapePattern = /[&<>\u00A0]|\r\n?|\n/g;

    const htmlEscapes = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        " ": "&nbsp;",
        "\r\n": "<br>",
        "\r": "<br>",
        "\n": "<br>"
    };

    /**
     * Escapes HTML special characters in a string, turning line breaks into <br> elements.  This
     * matches setting an element's innerText and reading back its innerHTML.
     */
    const escapeHtml = (html) => {

        const text = html === null ? "" : String(html);

        if (!htmlEscapeTestPattern.test(text)) return text;

        return text.replace(htmlEscapePattern, match => htmlEscapes[match]);
    };

    /**
     * Escapes a value for a quoted attribute, whichever quote it's in.  Unlike escapeHtml, line
     * breaks are kept, as an attribute's value is text.
     */
    const escapeAttribute = (value) =>
        (value === null || value === undefined ? "" : String(value))
            .replace(/[&<>"']/g, match => "&#" + match.charCodeAt(0) + ";");

    /**
     * Defuses any closing-script-tag sequence in text for a <script> element's content by inserting
     * a backslash after the "<".  A <script>'s content is serialized verbatim, so "</script" would
     * otherwise end the element early when the HTML is parsed again.  The backslash is harmless in
     * JavaScript, where "</script" can only be in a string, regex or comment, and in JSON.
     */
    const escapeScriptClosingTag = (text) => {

        if (typeof text !== "string") return text;

        return text.replace(/<(\/script)/gi, "<\\$1");
    };

    return {
        append,
        appendHTML,
        create,
        createRootElement,
        enrich,
        escapeAttribute,
        escapeHtml,
        escapeScriptClosingTag,
        get,
        getAllEmbeddedReportContexts,
        getAttributeOrDefault,
        getBody,
        getBodyScrollPos,
        getClassName,
        getGuidClassName,
        getColumnIndex,
        getContainingReportContext,
        getRowIndex,
        getOuterHeight,
        getOuterSize,
        getOuterWidth,
        isElementVisible,
        isReportContextInsidePopup,
        moveElement,
        parseHTML,
        removeElements,
        replaceWith,
        setHTML
    };
})();
