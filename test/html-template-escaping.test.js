/**
 * Text put into HTML templates is escaped, so that markup in it shows as text rather than being
 * parsed.
 */

const MARKUP = "<img class=\"injected\">";

afterEach(() => {

    document.body.innerHTML = "";
});

const reify = (templateName, parameters) =>
    Ren.HtmlTemplateFunctions.reifyHtmlTemplate(templateName, parameters);

test("a parameter's label and value are shown as text", () => {

    const visualisation = {
        parameterSpecs: {
            Colour: { Name: "Colour", Label: "Label " + MARKUP, Value: "Value " + MARKUP }
        }
    };

    const module = Ren.CreateParametersModule(null, visualisation);

    expect(module.element.querySelector(".injected")).toBeNull();
    expect(module.element.textContent).toContain("Label " + MARKUP);
    expect(module.element.textContent).toContain("Value " + MARKUP);
});

test("a parameter with no value is shown as not set", () => {

    const visualisation = {
        parameterSpecs: { Colour: { Name: "Colour", Label: "Colour", Value: null } }
    };

    const module = Ren.CreateParametersModule(null, visualisation);

    expect(module.element.querySelector(".ren-not-set")).not.toBeNull();
});

test("an embedded report's name is shown as text", () => {

    ["EmbeddedReportNotFound", "EmbeddedReportFetchError"].forEach(templateName => {

        const element = reify(templateName, { reportName: MARKUP });

        expect(element.querySelector(".injected")).toBeNull();
        expect(element.querySelector("strong").textContent).toBe(MARKUP);
    });
});

test("a table's title is kept whole in its attribute", () => {

    const title = "A \"quoted\" title " + MARKUP;

    const table = reify("EmptyTableTemplate", { class: "a-table", title });

    expect(table.getAttribute("title")).toBe(title);
});

test("report settings can't close their script element early", () => {

    const reportSettings = Ren.JsonUtils.serialize({ name: "</script>" + MARKUP });

    ["LoadSaveReportSettingsWindow", "DataGridVariationsWindow"].forEach(templateName => {

        const element = reify(templateName, {
            anyData: true,
            dataSourceUri: "a-data-source",
            settingsGroup: "a-settings-group",
            reportSettings
        });

        const script = element.querySelector(".js-ren-report-settings");

        expect(element.querySelector(".injected")).toBeNull();
        expect(Ren.JsonUtils.parse(script.textContent.trim()).name).toBe("</script>" + MARKUP);
    });
});
