// Sort keys and their text are split at "¬", which source files must keep as UTF-8 (see
// SourceEncodingTests, in test/Ren.Client.Tests).
describe("IndexedStringUtils", () => {

    test("getText_SortKeyAndText_ReturnsTheText", () => {

        expect(Ren.IndexedStringUtils.getText("2¬Medium")).toBe("Medium");
    });
});
