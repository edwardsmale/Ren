/**
 * Working out a settings form from a menu's items: which items are a choice and which toggles,
 * what an item ending in an ellipsis opens, and how submenus and sections are grouped.
 */

const option = (text, isTicked, extra) =>
    Object.assign({ text, ticked: () => isTicked, action: () => {} }, extra);

// Expects each of the given fields of a node to be as given.
const expectFields = (node, fields) => {

    for (const name in fields) expect(node[name]).toEqual(fields[name]);
};

const build = (menuItems, options) => Ren.MenuSettingsModel.build(menuItems, options).children;

test("build_UnnamedOptionsOneTicked_IsAChoice", () => {

    const nodes = build([{
        text: "Layout",
        submenu: [option("Side-by-side", true), option("Stacked", false)]
    }]);

    expect(nodes.length).toBe(1);
    expect(nodes[0].type).toBe("choice");
    expect(nodes[0].label).toBe("Layout");
    expect(nodes[0].options.map(o => o.selected)).toEqual([true, false]);
});

// Named options whose ticks call out, none of them ticked, read as toggles but for isChoice.
test("build_SubmenuWithIsChoice_IsAChoiceWhateverItsTicks", () => {

    const isColumn = () => false;

    const nodes = build([{
        text: "Value column",
        isChoice: true,
        submenu: ["Id", "Name", "Total"].map(text =>
            option(text, false, { id: "column-" + text, ticked: () => isColumn(text) }))
    }]);

    expect(nodes.length).toBe(1);
    expect(nodes[0].type).toBe("choice");
    expect(nodes[0].label).toBe("Value column");
    expect(nodes[0].options.map(o => o.selected)).toEqual([false, false, false]);
});

test("build_ActionWithIsSettingAction_IsAButton", () => {

    const flip = { text: "Flip sort order", id: "flip", isSettingAction: true, action: () => {} };
    const nodes = build([flip, { text: "Download", id: "download", action: () => {} }]);

    expect(nodes.length).toBe(1);
    expectFields(nodes[0], { type: "button", label: "Flip sort order", item: flip });
});

test("build_NamedItemsStartingWithShow_AreToggles", () => {

    const nodes = build([{
        text: "Hover",
        submenu: [
            option("Show hovered date", true, { id: "a" }),
            option("Show hovered values", false, { id: "b" })
        ]
    }]);

    expect(nodes[0].type).toBe("group");
    expect(nodes[0].heading).toBe("Hover");
    expect(nodes[0].children.map(n => n.type)).toEqual(["toggle", "toggle"]);
});

test("build_MoreThanOneTicked_AreToggles", () => {

    const nodes = build([{
        text: "Columns",
        submenu: [option("A", true), option("B", true), option("C", false)]
    }]);

    expect(nodes[0].children.map(n => n.type)).toEqual(["toggle", "toggle", "toggle"]);
});

test("build_NoneSeparatedFromItsOptions_JoinsTheChoice", () => {

    const nodes = build([{
        text: "Date column",
        submenu: [option("None", false, { id: "none" }), Ren.MENU_SEPARATOR, option("Created", true), option("Updated", false)]
    }]);

    expect(nodes[0].type).toBe("choice");
    expect(nodes[0].options.map(o => o.label)).toEqual(["None", "Created", "Updated"]);
});

// Columns listed by the type of their values, a lone one of a type included.
test("build_OptionsDividedIntoKinds_AreOneChoice", () => {

    const nodes = build([{
        text: "Split data",
        submenu: [
            option("None", false, { id: "none" }),
            Ren.MENU_OPTION_GROUP_SEPARATOR,
            option("DepartmentName", true),
            option("Region", false),
            Ren.MENU_OPTION_GROUP_SEPARATOR,
            option("IsBusiness", false)
        ]
    }]);

    expect(nodes.length).toBe(1);
    expect(nodes[0].type).toBe("choice");
    expect(nodes[0].label).toBe("Split data");
    expect(nodes[0].options.map(o => o.label)).toEqual(["None", "DepartmentName", "Region", "IsBusiness"]);
});

test("build_NumberEditorItem_IsANumberField", () => {

    const onChange = jest.fn();

    const nodes = build([{
        text: "Label size...",
        action: () => Ren.CreateNumberEditorPopupWindow("Size", 10, onChange, { label: "Size (px)", min: 4, max: 40 })
    }]);

    expectFields(nodes[0], { type: "number", label: "Label size", value: 10, min: 4, max: 40, unit: "px" });
    expect(document.querySelector(".ren-report-popup-window")).toBeNull();

    nodes[0].onChange(12);
    expect(onChange).toHaveBeenCalledWith(12);
});

test("build_TextEditorItem_IsATextField", () => {

    const nodes = build([{
        text: "Title...",
        action: () => Ren.CreateTextEditorPopupWindow("Title", "Sales", () => {})
    }]);

    expectFields(nodes[0], { type: "text", label: "Title", value: "Sales" });
});

test("build_ItemOpeningAWindow_IsAButtonAndOpensNothing", () => {

    const nodes = build([{
        text: "Colours...",
        action: () => Ren.PopupWindow("x", () => {}, "Colours", {})
    }]);

    expectFields(nodes[0], { type: "button", label: "Colours…" });
    expect(document.querySelector(".ren-report-popup-window")).toBeNull();
});

test("build_ItemDoneOnce_IsLeftOut", () => {

    const action = jest.fn();

    expect(build([{ text: "Copy image", action }])).toEqual([]);
    expect(action).not.toHaveBeenCalled();
});

test("build_RootSections_AreGroupsInMenuOrder", () => {

    const nodes = build([
        option("Show legend", true, { id: "legend", section: "Appearance" }),
        option("Show date filter", false, { id: "filter", section: "Dates" })
    ]);

    expect(nodes.map(n => n.heading)).toEqual(["Dates", "Appearance"]);
});

test("build_IncludeLeavesOutItemsWithADependency", () => {

    const nodes = build(
        [
            option("Chart thing", false, { id: "a" }),
            { text: "Series thing", id: "b", action: () => {}, ticked: () => Ren.MenuItemProbe.noteDependency("series") }
        ],
        { include: control => !control.dependencies.has("series") }
    );

    expect(nodes.map(n => n.label)).toEqual(["Chart thing"]);
});

test("build_IncludeHidden_KeepsHiddenItemsMarkedHidden", () => {

    const menuItems = [{
        text: "Labels",
        submenu: [
            option("Show labels", true, { id: "labels" }),
            option("Label outlines", false, { id: "outlines", visible: () => false })
        ]
    }];

    expect(build(menuItems)[0].type).toBe("toggle");

    const nodes = build(menuItems, { includeHidden: true });

    expect(nodes[0].children.map(n => n.isHidden)).toEqual([false, true]);
});

test("build_IncludeHidden_HidesAGroupWhoseItemsAreAllHidden", () => {

    const nodes = build(
        [{
            text: "Pies",
            visible: () => false,
            submenu: [option("Holes", false, { id: "holes" }), option("Totals", false, { id: "totals" })]
        }],
        { includeHidden: true }
    );

    expect(nodes[0].isHidden).toBe(true);
    expect(nodes[0].children.every(n => n.isHidden)).toBe(true);
});

test("build_Memory_KeepsTogglesAsTogglesOnceOneIsTicked", () => {

    let ticked = null;

    const menuItems = () => [{
        text: "Values",
        submenu: ["Share of total", "Index to first period"].map(text =>
            option(text, ticked === text, { action: () => { ticked = text; } })
        )
    }];

    const memory = new Map();

    expect(build(menuItems(), { memory })[0].children.map(n => n.type)).toEqual(["toggle", "toggle"]);

    ticked = "Share of total";

    expect(build(menuItems())[0].type).toBe("choice");
    expect(build(menuItems(), { memory })[0].children.map(n => n.type)).toEqual(["toggle", "toggle"]);
});

test("build_SubmenuTooBigToLayOut_IsAMenuShowingItsBracketedValue", () => {

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const nodes = build([{
        text: "Date range (Last 30 days)",
        submenu: [
            option("All dates", false),
            Ren.MENU_SEPARATOR,
            { text: "Month", submenu: months.map(month => option(month, false, { id: month })) }
        ]
    }]);

    expectFields(nodes[0], { type: "menu", label: "Date range", value: "Last 30 days" });
    expect(nodes[0].getMenuItems().length).toBe(3);
});

test("build_SubmenuTooBigToLayOut_WithoutBracketedValue_ShowsWhatIsTicked", () => {

    const columns = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];

    const nodes = build([{
        text: "Filter by",
        submenu: columns.map(column => option(column, column === "B" || column === "D", { id: column }))
    }]);

    expectFields(nodes[0], { type: "menu", label: "Filter by", value: "B, D" });
});

test("build_SubmenuSmallEnoughToLayOut_IsAGroup", () => {

    const nodes = build([{
        text: "Filter by",
        submenu: ["A", "B", "C"].map(column => option(column, false, { id: column }))
    }]);

    expect(nodes[0].type).toBe("group");
});

test("build_TogglesOfOneExclusiveGroup_AreAChoiceLedByNone", () => {

    const action = jest.fn();

    const nodes = build([{
        text: "Values",
        submenu: [
            option("Custom", false, { id: "custom" }),
            option("Running total", true, { id: "a", exclusiveGroup: "totals", action }),
            option("Year to date", false, { id: "b", exclusiveGroup: "totals" })
        ]
    }]);

    const choice = nodes[0].children[1];

    expect(nodes[0].children[0].type).toBe("toggle");
    expect(choice.type).toBe("choice");
    expect(choice.options.map(o => o.label)).toEqual(["None", "Running total", "Year to date"]);
    expect(choice.options.map(o => o.selected)).toEqual([false, true, false]);

    // Choosing None switches off the one that is on.
    choice.options[0].item.action();
    expect(action).toHaveBeenCalled();
});

test("build_ExclusiveGroupWithNoneOn_HasNoneSelected", () => {

    const nodes = build([{
        text: "Values",
        submenu: [
            option("Running total", false, { id: "a", exclusiveGroup: "totals" }),
            option("Year to date", false, { id: "b", exclusiveGroup: "totals" })
        ]
    }]);

    expect(nodes[0].options.map(o => o.selected)).toEqual([true, false, false]);
});

test("build_LoneTogglesSharingAComparingTick_AreAChoice", () => {

    let type = "line";

    const kind = (text, value) => ({
        text,
        id: value,
        action: () => {},
        ticked: (() => () => type === value)()
    });

    const nodes = build([{
        text: "Chart type",
        submenu: [kind("Bars", "bar"), Ren.MENU_SEPARATOR, kind("Lines", "line"), { text: "Line style", submenu: [option("Solid", true), option("Dashed", false)] }, Ren.MENU_SEPARATOR, kind("Dots", "dot")]
    }]);

    // Joined although each kind's own settings come between them.
    const choice = nodes[0].children[0];

    expect(choice.type).toBe("choice");
    expect(choice.options.map(o => o.label)).toEqual(["Bars", "Lines", "Dots"]);
    expect(choice.options.map(o => o.selected)).toEqual([false, true, false]);
});

test("build_LoneTogglesSharingATestOfTrue_StayToggles", () => {

    const settings = { a: true, b: false };

    const toggle = (text, name) => ({
        text,
        id: name,
        action: () => {},
        ticked: (() => () => settings[name] === true)()
    });

    const nodes = build([{
        text: "Show",
        submenu: [toggle("Show A", "a"), Ren.MENU_SEPARATOR, toggle("Show B", "b")]
    }]);

    expect(nodes[0].children.map(n => n.type)).toEqual(["toggle", "toggle"]);
});

test("build_UnnamedOptionsTickedByMembership_AreTogglesThoughOneIsTicked", () => {

    const plotted = ["B"];

    const column = (text) => ({
        text,
        action: () => {},
        ticked: (() => () => plotted.indexOf(text) !== -1)()
    });

    const nodes = build([{ text: "Add data series", submenu: [column("A"), column("B"), column("C")] }]);

    expect(nodes[0].children.map(n => n.type)).toEqual(["toggle", "toggle", "toggle"]);
});

// An item whose tick notes the "shared" dependency, as a split series' shared settings do.
const sharedOption = (text, isTicked, extra) => Object.assign(option(text, isTicked, extra), {
    ticked: () => {
        Ren.MenuItemProbe.noteDependency("shared");
        return isTicked;
    }
});

const getSharedScope = control => control.dependencies.has("shared") ? "Shared" : null;

test("build_GetScope_SetsApartWhatActsOnAScopeAfterTheRest", () => {

    const nodes = build(
        [
            option("Show legend", true, { id: "legend", section: "Appearance" }),
            sharedOption("Show labels", false, { id: "labels", section: "Appearance" }),
            option("Show grid", false, { id: "grid", section: "Appearance" })
        ],
        { getScope: getSharedScope }
    );

    const children = nodes[0].children;

    expect(children.map(n => n.label || n.heading)).toEqual(["Show legend", "Show grid", "Shared"]);
    expectFields(children[2], { type: "group", isScope: true });
    expect(children[2].children.map(n => n.label)).toEqual(["Show labels"]);
});

test("build_GetScope_SubmenuAllActingOnAScope_IsSetApartWhole", () => {

    const nodes = build(
        [
            option("Show legend", true, { id: "legend", section: "Appearance" }),
            {
                text: "Draw as",
                id: "draw",
                section: "Appearance",
                submenu: [sharedOption("Bars", true), sharedOption("Lines", false)]
            }
        ],
        { getScope: getSharedScope }
    );

    const scopeGroup = nodes[0].children[1];

    expectFields(scopeGroup, { heading: "Shared", isScope: true });
    expectFields(scopeGroup.children[0], { type: "choice", label: "Draw as" });
});

test("build_NoGetScope_SetsNothingApart", () => {

    const nodes = build([
        option("Show legend", true, { id: "legend", section: "Appearance" }),
        sharedOption("Show labels", false, { id: "labels", section: "Appearance" })
    ]);

    expect(nodes[0].children.some(n => n.isScope)).toBe(false);
});

test("build_IsListSubmenuOfManyOptions_IsAListOfToggles", () => {

    const columns = Array.from({ length: 20 }, (_, i) => option("Column " + i, i === 3, { id: "column-" + i }));

    const nodes = build([{ text: "Add filter", id: "add", isList: true, submenu: columns }]);

    expectFields(nodes[0], { type: "group", heading: "Add filter", isList: true });
    expect(nodes[0].children.length).toBe(20);
    expect(nodes[0].children.every(n => n.type === "toggle")).toBe(true);
    expect(nodes[0].children[3].checked).toBe(true);
});
