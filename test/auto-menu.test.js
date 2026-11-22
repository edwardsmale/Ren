/**
 * Auto menus: the popup reports a host configures for the values of matching columns, which the
 * word cloud also offers on its words.
 */

beforeAll(() => {

    Ren.configure({
        autoMenus: {
            "search-term": {
                parameterName: "SearchTerm",
                columnHeadingEndsWith: ["SearchTerm"],
                columnFormats: ["General"],
                reports: [{ reportName: "SearchTermReport", text: "Search term report" }]
            },
            "no-formats": {
                parameterName: "Code",
                columnHeadings: ["Code"],
                reports: [{ reportName: "CodeReport" }]
            }
        }
    });
});

test("getMenuNameForColumn_HeadingEndsWithConfiguredText_GetsThatMenu", () => {

    const columnModel = { Heading: "Popular Search Term", ColumnFormat: 0 };

    expect(Ren.AutoMenu.getMenuNameForColumn(columnModel)).toBe("search-term");
});

test("getMenuNameForColumn_NoMenuHeadingMatches_GetsNull", () => {

    const columnModel = { Heading: "Product Name", ColumnFormat: 0 };

    expect(Ren.AutoMenu.getMenuNameForColumn(columnModel)).toBeNull();
});

test("getMenuNameForColumn_MenuWithoutColumnFormats_GetsNull", () => {

    const columnModel = { Heading: "Code", ColumnFormat: 0 };

    expect(Ren.AutoMenu.getMenuNameForColumn(columnModel)).toBeNull();
});
