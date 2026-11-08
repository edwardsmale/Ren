describe("DateValueChart_SeriesColours", () => {

    const schemes = () => Ren.DateValueChart_ColourSchemes;
    const getDefaultColour = (seriesIndex, colourScheme) =>
        Ren.DateValueChart_SeriesColours.getDefaultColour(seriesIndex, colourScheme);

    test("getDefaultColour_NoScheme_GivesStandardPalette", () => {

        expect(schemes()[0].palette).toEqual(
            ["#3046b8", "#ED7014", "#4CAF50", "#FFC107", "#9C27B0", "#00BCD4"]
        );

        for (let index = 0; index < 6; index++) {
            expect(getDefaultColour(index)).toBe(schemes()[0].palette[index]);
        }
    });

    test("getDefaultColour_EachScheme_StartsWithItsPalette", () => {

        expect(schemes().length).toBe(8);

        for (let schemeIndex = 0; schemeIndex < schemes().length; schemeIndex++) {

            const palette = schemes()[schemeIndex].palette;

            for (let index = 0; index < palette.length; index++) {
                expect(getDefaultColour(index, schemeIndex)).toBe(palette[index]);
            }
        }
    });

    test("getDefaultColour_BeyondPalette_GivesDistinctColoursPerScheme", () => {

        for (let schemeIndex = 0; schemeIndex < schemes().length; schemeIndex++) {

            const colours = [];

            for (let index = 0; index < 20; index++) {
                colours.push(getDefaultColour(index, schemeIndex).toLowerCase());
            }

            expect(new Set(colours).size).toBe(colours.length);
        }
    });

    test("getSchemeIndex_OutOfRangeOrUnset_GivesZero", () => {

        const getSchemeIndex = Ren.DateValueChart_SeriesColours.getSchemeIndex;

        expect(getSchemeIndex(undefined)).toBe(0);
        expect(getSchemeIndex(null)).toBe(0);
        expect(getSchemeIndex(-1)).toBe(0);
        expect(getSchemeIndex(8)).toBe(0);
        expect(getSchemeIndex("3")).toBe(3);
        expect(getDefaultColour(0, 99)).toBe(schemes()[0].palette[0]);
    });
});
