// Which settings have a scope at all is checked in C#, in FilterModuleSettingScopeTests, as
// the browser these run in can't list the source files.
describe("FilterModule_ItemLevels", () => {

    const ItemLevels = Ren.FilterModule_ItemLevels;

    test("getSettingKeys_EachLevelsSetting_GivesEveryLevel", () => {

        expect(ItemLevels.getSettingKeys(["Top", "Middle", "Leaf"], "sortByValue"))
            .toEqual(["Top", "Middle", "Leaf"]);
    });

    test("getSettingKeys_ItemsSetting_GivesTheLeaf", () => {

        expect(ItemLevels.getSettingKeys(["Top", "Leaf"], "showTotal")).toEqual(["Leaf"]);
    });

    test("getSettingKeys_HeadingOverride_GivesTheTopLevel", () => {

        expect(ItemLevels.getSettingKeys(["Top", "Leaf"], "HeadingOverride")).toEqual(["Top"]);
    });

    test("getSettingKeys_FlatItem_GivesItsOneColumnWhateverTheScope", () => {

        for (const name of ["sortByValue", "showTotal", "HeadingOverride"]) {

            expect(ItemLevels.getSettingKeys(["Only"], name)).toEqual(["Only"]);
        }
    });

    test("getShownSettingKey_EachLevelsSetting_GivesTheTopLevel", () => {

        expect(ItemLevels.getShownSettingKey(["Top", "Leaf"], "valueColumn")).toBe("Top");
    });

    test("getScope_UnknownSetting_Throws", () => {

        expect(() => ItemLevels.getScope("noSuchSetting")).toThrow("noSuchSetting");
    });

    test("isPerLevelMenuItem_LevelSection_IsUnlessTheItemSaysOtherwise", () => {

        expect(ItemLevels.isPerLevelMenuItem({ id: "a" }, "Values")).toBe(true);
        expect(ItemLevels.isPerLevelMenuItem({ id: "a", perLevel: false }, "Values")).toBe(false);
        expect(ItemLevels.isPerLevelMenuItem({ id: "a" }, "View settings")).toBe(false);
    });
});
