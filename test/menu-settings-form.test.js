/**
 * Showing a settings model as a form: which control each node is, the settings a choice leads
 * set in beneath it, and updates made in place, greying out what the menu hides.
 */

const CLASS_NAME = "ren-menu-settings-form";

const option = (text, isTicked, extra) =>
    Object.assign({ text, ticked: () => isTicked, action: () => {} }, extra);

const createForm = () => {

    const container = document.createElement("div");

    document.body.appendChild(container);

    return { container, form: Ren.MenuSettingsForm(container) };
};

const show = (form, menuItems) =>
    form.update(Ren.MenuSettingsModel.build(menuItems, { includeHidden: true }));

const findKeyed = (container, suffix) =>
    Array.from(container.querySelectorAll("[data-key]"))
        .find(element => element.getAttribute("data-key").endsWith(suffix));

test("update_FewOptions_AreRadioButtonsWithTheTickedChecked", () => {

    const { container, form } = createForm();

    show(form, [{ text: "Size", submenu: [option("Small", false), option("Large", true)] }]);

    const radios = container.querySelectorAll("input[type=radio]");

    expect(radios.length).toBe(2);
    expect(radios[1].checked).toBe(true);
    expect(container.querySelector("." + CLASS_NAME + "__label").textContent).toBe("Size");
});

test("update_ManyOptions_IsADropdown", () => {

    const { container, form } = createForm();
    const names = ["A one", "A two", "A three", "A four", "A five", "A six", "A seven"];

    show(form, [{ text: "Pick", submenu: names.map((name, i) => option(name, i === 2)) }]);

    const select = container.querySelector("select");

    expect(select).not.toBeNull();
    expect(select.value).toBe("2");
});

test("update_ChoiceLedSubmenu_SetsItsSettingsInBeneathIt", () => {

    const { container, form } = createForm();

    show(form, [{
        text: "Subdivide by",
        isChoiceLed: true,
        submenu: [
            option("None", false),
            option("Colour", true),
            Ren.MENU_SEPARATOR,
            { text: "Show labels", id: "labels", ticked: () => true, action: () => {} }
        ]
    }]);

    const choice = container.querySelector("." + CLASS_NAME + "__choice");
    const nested = choice.querySelector("." + CLASS_NAME + "__group--nested");

    expect(choice.querySelectorAll("input[type=radio]").length).toBe(2);
    expect(nested.querySelector("input[type=checkbox]").checked).toBe(true);
});

test("update_SameControls_UpdatesValuesInPlace", () => {

    const { container, form } = createForm();
    let isOn = false;
    const items = [{ text: "Show grid", id: "grid", ticked: () => isOn, action: () => {} }];

    show(form, items);

    const checkbox = container.querySelector("input[type=checkbox]");

    isOn = true;
    show(form, items);

    expect(container.querySelector("input[type=checkbox]")).toBe(checkbox);
    expect(checkbox.checked).toBe(true);
});

test("update_ControlHiddenOnceShown_IsGreyedOutAndDisabled", () => {

    const { container, form } = createForm();
    let isVisible = true;
    const items = [{ text: "Show grid", id: "grid", ticked: () => false, action: () => {}, visible: () => isVisible }];

    show(form, items);

    isVisible = false;
    show(form, items);

    const checkbox = findKeyed(container, "grid");

    expect(checkbox.disabled).toBe(true);
    expect(checkbox.closest("." + CLASS_NAME + "__row").classList.contains(CLASS_NAME + "--unavailable")).toBe(true);
});

test("update_ControlNeverShown_IsLeftOut", () => {

    const { container, form } = createForm();

    show(form, [
        { text: "Show grid", id: "grid", ticked: () => false, action: () => {}, visible: () => false },
        { text: "Show axes", id: "axes", ticked: () => false, action: () => {} }
    ]);

    expect(findKeyed(container, "grid")).toBeUndefined();
    expect(findKeyed(container, "axes")).toBeDefined();
});

test("update_NumberField_ShowsItsValue", () => {

    const { container, form } = createForm();

    show(form, [{
        text: "Width...",
        action: () => Ren.CreateNumberEditorPopupWindow(
            "Width",
            7,
            () => {},
            { label: "Width (px)", min: 1, max: 20, showSlider: true }
        )
    }]);

    expect(container.querySelector("input[type=number]").value).toBe("7");
    expect(container.querySelector("input[type=range]").value).toBe("7");
    expect(container.querySelector("." + CLASS_NAME + "__unit").textContent).toBe("px");
});

test("update_ScopeGroup_IsMarkedOffAndNotASubtab", () => {

    const { container, form } = createForm();
    const shared = option("Show labels", false, { id: "labels", section: "Appearance" });

    shared.ticked = () => {
        Ren.MenuItemProbe.noteDependency("shared");
        return false;
    };

    form.update(Ren.MenuSettingsModel.build(
        [option("Show legend", true, { id: "legend", section: "Appearance" }), shared],
        { includeHidden: true, getScope: control => control.dependencies.has("shared") ? "Shared" : null }
    ));

    const scopeGroup = container.querySelector("." + CLASS_NAME + "__group--scope");

    expect(scopeGroup.querySelector("input[type=checkbox]")).toBe(findKeyed(container, "labels"));
    expect(Array.from(container.querySelectorAll("." + CLASS_NAME + "__subtab")).map(t => t.textContent))
        .not.toContain("Shared");
});
