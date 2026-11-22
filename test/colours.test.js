// The colours are checked against the ones Ren has always given for them.
describe("Colours", () => {

    const FRACTIONS = [-0.5, 0, 0.25, 0.5, 0.625, 0.875, 1, 1.375];

    // Pairs of greys, with the colour between them at each of the fractions.
    const GREY_INTERPOLATIONS = [
        {
            from: "#000000",
            to: "#FFFFFF",
            expected: [
                "rgb(0, 0, 0)", "rgb(0, 0, 0)", "rgb(59, 59, 59)", "rgb(119, 119, 119)",
                "rgb(151, 151, 151)", "rgb(219, 219, 219)", "rgb(255, 255, 255)",
                "rgb(255, 255, 255)"
            ]
        },
        {
            from: "#FFFFFF",
            to: "#000000",
            expected: [
                "rgb(255, 255, 255)", "rgb(255, 255, 255)", "rgb(185, 185, 185)",
                "rgb(119, 119, 119)", "rgb(88, 88, 88)", "rgb(33, 33, 33)", "rgb(0, 0, 0)",
                "rgb(0, 0, 0)"
            ]
        },
        {
            from: "#FFFFFF",
            to: "#F4F4F4",
            expected: [
                "rgb(255, 255, 255)", "rgb(255, 255, 255)", "rgb(252, 252, 252)",
                "rgb(249, 249, 249)", "rgb(248, 248, 248)", "rgb(245, 245, 245)",
                "rgb(244, 244, 244)", "rgb(240, 240, 240)"
            ]
        },
        {
            from: "#333333",
            to: "#808080",
            expected: [
                "rgb(17, 17, 17)", "rgb(51, 51, 51)", "rgb(69, 69, 69)", "rgb(88, 88, 88)",
                "rgb(98, 98, 98)", "rgb(118, 118, 118)", "rgb(128, 128, 128)",
                "rgb(160, 160, 160)"
            ]
        }
    ];

    test("interpolateLab_Greys_MatchesD3InterpolateHcl", () => {

        for (let i = 0; i < GREY_INTERPOLATIONS.length; i++) {

            const pair = GREY_INTERPOLATIONS[i];
            const interpolate = Ren.Colours.interpolateLab(pair.from, pair.to);

            for (let k = 0; k < FRACTIONS.length; k++) {
                expect(interpolate(FRACTIONS[k])).toBe(pair.expected[k]);
            }
        }
    });

    test("interpolateLab_SameGrey_GivesTheGrey", () => {

        const interpolate = Ren.Colours.interpolateLab("#F4F4F4", "#F4F4F4");

        for (let k = 0; k < FRACTIONS.length; k++) {
            expect(interpolate(FRACTIONS[k])).toBe("rgb(244, 244, 244)");
        }
    });

    test("interpolateLab_Colours_MatchesD3InterpolateLab", () => {

        const interpolate = Ren.Colours.interpolateLab("#0288D1", "#FBF6C9");

        expect(interpolate(0.3)).toBe("rgb(120, 167, 208)");
    });

    test("shiftLightness_Grey_LighterGrey", () => {

        expect(Ren.Colours.shiftLightness("#777777", 10)).toBe("rgb(145, 145, 145)");
    });

    test("shiftLightness_Colour_DarkerOfSameHue", () => {

        const shade = Ren.Colours.shiftLightness("#0288D1", -15);
        const rgb = Ren.Colours.toRgb(shade);

        expect(rgb.blue).toBeGreaterThan(rgb.green);
        expect(rgb.green).toBeGreaterThan(rgb.red);
        expect(Ren.Colours.lightnessOfColour(shade))
            .toBeLessThan(Ren.Colours.lightnessOfColour("#0288D1"));
    });

    test("shiftLightness_PastWhite_White", () => {

        expect(Ren.Colours.shiftLightness("#F4F4F4", 50)).toBe("rgb(255, 255, 255)");
    });

    test("shiftLightness_Unreadable_Null", () => {

        expect(Ren.Colours.shiftLightness("not a colour", 10)).toBeNull();
    });

    test("lightnessOfColour_Colours_MatchesD3Hsl", () => {

        const expectedLightnesses = [
            ["#000000", 0],
            ["#FFFFFF", 1],
            ["#0288D1", 0.4137254901960784],
            ["rgb(128, 64, 200)", 0.5176470588235293],
            ["#F4F4F4", 0.9568627450980393]
        ];

        for (let i = 0; i < expectedLightnesses.length; i++) {

            expect(Ren.Colours.lightnessOfColour(expectedLightnesses[i][0]))
                .toBeCloseTo(expectedLightnesses[i][1], 10);
        }
    });

    test("lightnessOfColour_Unreadable_ReturnsNull", () => {

        expect(Ren.Colours.lightnessOfColour("linear-gradient(red, blue)")).toBeNull();
    });

    test("applyFilter_NoFilter_ReturnsColourUnchanged", () => {

        expect(Ren.Colours.applyFilter("#80c0ff", null)).toBe("#80c0ff");
        expect(Ren.Colours.applyFilter("#80c0ff", "none")).toBe("#80c0ff");
    });

    test("applyFilter_Brightness_ScalesChannels", () => {

        expect(Ren.Colours.applyFilter("#ff8080", "brightness(0.5)")).toBe("#804040");
        expect(Ren.Colours.applyFilter("#ff8080", "brightness(50%)")).toBe("#804040");
    });

    test("applyFilter_Contrast_StretchesFromMidGrey", () => {

        expect(Ren.Colours.applyFilter("#c8c8c8", "contrast(1.4)")).toBe("#e5e5e5");
    });

    test("applyFilter_SaturateZero_GivesGrey", () => {

        expect(Ren.Colours.applyFilter("#ff0000", "saturate(0)")).toBe("#363636");
    });

    test("applyFilter_DarkVariantOnAmber_GivesWhiteText", () => {

        const dark = Ren.Colours.applyFilter("#FFC107", "brightness(0.5) contrast(1.4)");

        expect(Ren.Colours.contrastingTextColour("#FFC107")).toBe("black");
        expect(Ren.Colours.contrastingTextColour(dark)).toBe("white");
    });

    test("applyFilter_UnreadableColour_ReturnsColourUnchanged", () => {

        expect(Ren.Colours.applyFilter("url(#gradient)", "brightness(0.5)"))
            .toBe("url(#gradient)");
    });
});

describe("GroupColourProvider", () => {

    const createProvider = (numGroupings) =>
        Ren.GroupColourProvider({ groupings: { numGroupings: () => numGroupings } });

    // By the number of groupings, each group level's background.
    const D3_GROUP_BACKGROUNDS = [
        ["rgb(248, 248, 248)", "rgb(248, 248, 248)"],
        ["rgb(240, 240, 240)", "rgb(248, 248, 248)", "rgb(255, 255, 255)"],
        ["rgb(242, 242, 242)", "rgb(246, 246, 246)", "rgb(250, 250, 250)", "rgb(254, 254, 254)"],
        [
            "rgb(243, 243, 243)", "rgb(245, 245, 245)", "rgb(248, 248, 248)", "rgb(251, 251, 251)",
            "rgb(254, 254, 254)"
        ],
        [
            "rgb(243, 243, 243)", "rgb(245, 245, 245)", "rgb(247, 247, 247)", "rgb(249, 249, 249)",
            "rgb(251, 251, 251)", "rgb(253, 253, 253)"
        ]
    ];

    test("getGroupBackground_EachLevel_MatchesTheD3Colours", () => {

        for (let numGroupings = 0; numGroupings <= 4; numGroupings++) {

            const provider = createProvider(numGroupings);

            for (let groupLevel = 0; groupLevel <= numGroupings + 1; groupLevel++) {

                expect(provider.getGroupBackground(groupLevel))
                    .toBe(D3_GROUP_BACKGROUNDS[numGroupings][groupLevel]);
            }
        }
    });

    test("foregrounds_FirstCall_ReturnTheColour", () => {

        const provider = createProvider(2);

        expect(provider.getGroupForeground(0)).toBe("#000000");
        expect(provider.getGroupForeground(1)).toBe("#000000DD");
        expect(provider.childRowForeground(1)).toBe("#000000DD");
        expect(provider.lightChildRowForeground()).toBe("#333333");
    });

    test("invalidateCachedColours_DarkThemeSet_GivesLightForegrounds", () => {

        const provider = createProvider(2);

        provider.getGroupForeground(0);

        document.body.style.setProperty("--ren-data-grid-background", "#000000");
        document.body.style.setProperty("--ren-data-grid-group-background", "#333333");

        try {

            provider.invalidateCachedColours();

            expect(provider.getGroupForeground(0)).toBe("#EFEFEF");
        }
        finally {

            document.body.style.removeProperty("--ren-data-grid-background");
            document.body.style.removeProperty("--ren-data-grid-group-background");
        }
    });
});
