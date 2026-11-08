// These tests cover query embeddings: encoding and comparing them, and how they pair a tab's
// query with the grid state and data grouping settings saved against it, even once it's moved.

const query = (embedding, columns) => ({
    QueryEmbedding: embedding,
    ColumnModels: columns.map(column => ({ Heading: column, ColumnIdOrHeading: column }))
});

const saved = (embedding, columns) => ({
    queryEmbedding: Ren.EmbeddingUtils.encodeEmbedding(embedding),
    queryColumns: columns
});

const tabsOf = (familyGroup, tabularDatas) => ({
    tabularDatas: tabularDatas,
    settingsGroups: tabularDatas.map((tabularData, index) =>
        index === 0 ? familyGroup : familyGroup + "[" + index + "]"
    ),
    familyGroup: familyGroup
});

const find = (tabIndex, tabs, allSettings) =>
    Ren.SettingsEmbeddingMatcher.findSettingsForTab(
        tabIndex, tabs, allSettings, "Test"
    );

describe("EmbeddingUtils - encoding and decoding", () => {

    test("EncodeEmbedding_CountsFitInAByte_DecodesBackToTheSameCounts", () => {

        const encoded = Ren.EmbeddingUtils.encodeEmbedding([0, 1, -1, 5, -127, 127]);

        expect(JSON.stringify(Ren.EmbeddingUtils.decodeEmbedding(encoded))).toBe(
            "[0,1,-1,5,-127,127]"
        );
    });

    test("EncodeEmbedding_CountsExceedAByte_ClampsThemToTheByteRange", () => {

        const encoded = Ren.EmbeddingUtils.encodeEmbedding([200, -300]);

        expect(JSON.stringify(Ren.EmbeddingUtils.decodeEmbedding(encoded))).toBe("[127,-127]");
    });

    test("EncodeEmbedding_WholeNumberCounts_WritesThemAsSignedBytes", () => {

        expect(Ren.EmbeddingUtils.encodeEmbedding([1, -1])).toBe("Af8=");
    });

    // Data generated before the counts were sent - and still cached - holds each count
    // divided by the vector's magnitude, and has to encode to the same bytes.
    test("EncodeEmbedding_NormalisedVector_RecoversTheCountsItWasScaledFrom", () => {

        const encoded = Ren.EmbeddingUtils.encodeEmbedding([1 / 3, 2 / 3, 0, -2 / 3]);

        expect(JSON.stringify(Ren.EmbeddingUtils.decodeEmbedding(encoded))).toBe("[1,2,0,-2]");
    });

    test("EncodeEmbedding_NoBucketHeldOne_RecoversTheCountsAtAMultiple", () => {

        const magnitude = Math.sqrt(13);

        const encoded = Ren.EmbeddingUtils.encodeEmbedding(
            [2 / magnitude, 3 / magnitude]
        );

        expect(JSON.stringify(Ren.EmbeddingUtils.decodeEmbedding(encoded))).toBe("[2,3]");
    });

    test("EncodeEmbedding_ValuesAreNotProportionalToWholeNumbers_ReturnsItUnchanged", () => {

        const embedding = [0.1, 0.1 * Math.SQRT2];

        expect(Ren.EmbeddingUtils.encodeEmbedding(embedding)).toBe(embedding);
    });

    test("EncodeEmbedding_NotAnArray_ReturnsTheValueUnchanged", () => {

        expect(Ren.EmbeddingUtils.encodeEmbedding("abc")).toBe("abc");
    });

    test("DecodeEmbedding_AlreadyAnArray_ReturnsTheSameArray", () => {

        const embedding = [1, 2];

        expect(Ren.EmbeddingUtils.decodeEmbedding(embedding)).toBe(embedding);
    });

    test("DecodeEmbedding_NotAnEncodedString_ReturnsNull", () => {

        expect(JSON.stringify([
            Ren.EmbeddingUtils.decodeEmbedding(""),
            Ren.EmbeddingUtils.decodeEmbedding(42),
            Ren.EmbeddingUtils.decodeEmbedding(null),
            Ren.EmbeddingUtils.decodeEmbedding(undefined)
        ])).toBe("[null,null,null,null]");
    });

    test("DecodeEmbedding_NotValidBase64_ReturnsNull", () => {

        expect(Ren.EmbeddingUtils.decodeEmbedding("!!!")).toBeNull();
    });
});

describe("EmbeddingUtils - comparing embeddings", () => {

    test("CosineSimilarity_VectorsPointTheSameWay_ReturnsOne", () => {

        expect(Ren.EmbeddingUtils.cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 6);
    });

    test("CosineSimilarity_VectorsAreOrthogonal_ReturnsZero", () => {

        expect(Ren.EmbeddingUtils.cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
    });

    // This is what lets an embedding saved before the bucket count was raised still be
    // compared with one generated since.
    test("CosineSimilarity_OneVectorIsAMultipleOfTheOthersLength_FoldsItAndMatches", () => {

        expect(Ren.EmbeddingUtils.cosineSimilarity(
            [1, 0, 0, 0, 0, 1, 0, 0], [1, 1, 0, 0]
        )).toBeCloseTo(1, 6);
    });

    test("CosineSimilarity_LengthsDoNotDivide_ReturnsZero", () => {

        expect(Ren.EmbeddingUtils.cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
    });

    test("CosineSimilarity_VectorsAreMissingEmptyOrAllZero_ReturnsZero", () => {

        expect(JSON.stringify([
            Ren.EmbeddingUtils.cosineSimilarity([], []),
            Ren.EmbeddingUtils.cosineSimilarity([0, 0], [1, 1]),
            Ren.EmbeddingUtils.cosineSimilarity(null, [1]),
            Ren.EmbeddingUtils.cosineSimilarity([1], undefined)
        ])).toBe("[0,0,0,0]");
    });

    test("FindMostSimilar_SeveralCandidates_ReturnsTheClosestAndItsScore", () => {

        const match = Ren.EmbeddingUtils.findMostSimilar(
            [1, 0.2], { a: [1, 0], b: [1, 1], c: [0, 1] }
        );

        expect(match.key + ":" + match.similarity.toFixed(2)).toBe("a:0.98");
    });

    test("FindMostSimilar_TargetOrCandidatesAreMissing_ReturnsNull", () => {

        expect(JSON.stringify([
            Ren.EmbeddingUtils.findMostSimilar(null, { a: [1, 0] }),
            Ren.EmbeddingUtils.findMostSimilar([1, 0], null)
        ])).toBe("[null,null]");
    });

    test("FindSimilar_DefaultThreshold_ReturnsTheMatchesMostSimilarFirst", () => {

        const matches = Ren.EmbeddingUtils.findSimilar(
            [1, 0], { low: [0, 1], mid: [1, 1], high: [2, 0.1] }
        );

        expect(matches.map(match => match.key).join(",")).toBe("high,mid");
    });

    test("FindSimilar_HigherThreshold_LeavesOutTheWeakerMatches", () => {

        const matches = Ren.EmbeddingUtils.findSimilar(
            [1, 0], { low: [0, 1], mid: [1, 1], high: [2, 0.1] }, 0.8
        );

        expect(matches.map(match => match.key).join(",")).toBe("high");
    });

    test("FindSimilar_TargetIsMissing_ReturnsNoMatches", () => {

        expect(JSON.stringify(Ren.EmbeddingUtils.findSimilar(null, { a: [1, 0] }))).toBe("[]");
    });
});

describe("SettingsEmbeddingMatcher", () => {

    // An identical entry that is no tab's own is no reason to give up the tab's own.
    test("FindSettingsForTab_TheKeyedSettingsWereSavedAgainstTheQuery_KeepsThem", () => {

        const tabs = tabsOf("G", [query([1, 0, 0, 0], ["Alpha", "Beta"])]);

        expect(find(0, tabs, {
            G: saved([1, 0, 0, 0], ["Alpha", "Beta"]),
            "G[1]": saved([1, 0, 0, 0], ["Alpha", "Beta"])
        })).toEqual({ key: "G", columnNames: null });
    });

    test("FindSettingsForTab_TheSavedEmbeddingIsBase64_ItIsDecodedToCompare", () => {

        const tabs = tabsOf("G", [query([1, -1], []), query([5, 5], [])]);

        expect(find(0, tabs, { "G[1]": { queryEmbedding: "Af8=" } }).key).toBe("G[1]");
    });

    test("FindSettingsForTab_TheQueryHasNoEmbedding_FindsByKeyAlone", () => {

        const tabs = tabsOf("G", [{ ColumnModels: [] }, { ColumnModels: [] }]);
        const allSettings = { G: saved([1, 0, 0, 0], []) };

        expect(JSON.stringify([find(0, tabs, allSettings), find(1, tabs, allSettings)])).toBe(
            `[{"key":"G","columnNames":null},null]`
        );
    });

    // The legacy settings are the first tab's, so the second tab is the only one left to
    // pair and is paired with the only settings left, however unalike.
    test("FindSettingsForTab_TheKeyedSettingsHaveNoEmbedding_KeepsThem", () => {

        const tabs = tabsOf("G", [
            query([1, 0, 0, 0], ["Alpha"]),
            query([0, 1, 0, 0], ["Beta"])
        ]);

        const allSettings = {
            G: { columns: [] },
            "G[1]": saved([1, 0, 0, 0], ["Alpha"])
        };

        expect(JSON.stringify([find(0, tabs, allSettings), find(1, tabs, allSettings)])).toBe(
            `[{"key":"G","columnNames":null},{"key":"G[1]","columnNames":["Alpha"]}]`
        );
    });

    test("FindSettingsForTab_AQueryIsInsertedBeforeTheOthers_TheyKeepTheirSettings", () => {

        const tabs = tabsOf("G", [
            query([0, 0, 1, 0], ["Gamma"]),
            query([1, 0, 0, 0], ["Alpha"]),
            query([0, 1, 0, 0], ["Beta"])
        ]);

        const allSettings = {
            G: saved([1, 0, 0, 0], ["Alpha"]),
            "G[1]": saved([0, 1, 0, 0], ["Beta"])
        };

        const keys = [];

        for (let i = 0; i < tabs.tabularDatas.length; i++) {
            keys.push(find(i, tabs, allSettings)?.key ?? null);
        }

        expect(JSON.stringify(keys)).toBe(`[null,"G","G[1]"]`);
    });

    test("FindSettingsForTab_AQueryIsRemoved_TheQueriesAfterItKeepTheirSettings", () => {

        const tabs = tabsOf("G", [
            query([0, 1, 0, 0], ["Beta"]),
            query([0, 0, 1, 0], ["Gamma"])
        ]);

        const allSettings = {
            G: saved([1, 0, 0, 0], ["Alpha"]),
            "G[1]": saved([0, 1, 0, 0], ["Beta"]),
            "G[2]": saved([0, 0, 1, 0], ["Gamma"])
        };

        expect(JSON.stringify([
            find(0, tabs, allSettings).key,
            find(1, tabs, allSettings).key
        ])).toBe(`["G[1]","G[2]"]`);
    });

    test("FindSettingsForTab_TwoTabsRunTheSameQuery_EachKeepsItsOwnSettings", () => {

        const tabs = tabsOf("G", [
            query([1, 0, 0, 0], ["Alpha"]),
            query([1, 0, 0, 0], ["Alpha"])
        ]);

        const allSettings = {
            G: saved([1, 0, 0, 0], ["Alpha"]),
            "G[1]": saved([1, 0, 0, 0], ["Alpha"])
        };

        expect(JSON.stringify([
            find(0, tabs, allSettings).key,
            find(1, tabs, allSettings).key
        ])).toBe(`["G","G[1]"]`);
    });

    // The first and third tabs have the same columns, so share grid state, which was last
    // saved against the third tab's query.
    test("FindSettingsForTab_TabsShareAKey_TheyKeepSettingsSavedAgainstEitherOfThem", () => {

        const tabs = {
            tabularDatas: [
                query([1, 0, 0, 0], ["Alpha"]),
                query([0, 1, 0, 0], ["Beta"]),
                query([0, 0, 1, 0], ["Alpha"])
            ],
            settingsGroups: ["G", "G[1]", "G"],
            familyGroup: "G"
        };

        const allSettings = {
            G: saved([0, 0, 1, 0], ["Alpha"]),
            "G[1]": saved([0, 1, 0, 0], ["Beta"])
        };

        expect(JSON.stringify([
            find(0, tabs, allSettings),
            find(1, tabs, allSettings).key,
            find(2, tabs, allSettings).key
        ])).toBe(`[{"key":"G","columnNames":null},"G[1]","G"]`);
    });

    // The tabs sharing G are one query to pair, not two, so with G[1]'s query taking G, the
    // settings left over are theirs, and both are given them.
    test("FindSettingsForTab_TabsShareAKeyAndTheirQueriesMoved_ArePairedTogether", () => {

        const tabs = {
            tabularDatas: [
                query([0, 1, 0, 0], ["Beta"]),
                query([1, 0, 0, 0], ["Alpha"]),
                query([0, 0, 1, 0], ["Beta"])
            ],
            settingsGroups: ["G", "G[1]", "G"],
            familyGroup: "G"
        };

        const allSettings = {
            G: saved([1, 0, 0, 0], ["Alpha"]),
            "G[1]": saved([0, 0, 1, 0], ["Beta"])
        };

        expect(JSON.stringify([
            find(0, tabs, allSettings).key,
            find(1, tabs, allSettings).key,
            find(2, tabs, allSettings).key
        ])).toBe(`["G[1]","G","G[1]"]`);
    });

    // Another visualisation's settings, and variations, which are chosen by name.
    test("FindSettingsForTab_TheTabsAreAGridSet_OnlyItsOwnSettingsArePaired", () => {

        const tabs = tabsOf("G", [query([1, 0, 0, 0], ["Alpha"])]);

        expect(find(0, tabs, {
            Other: saved([1, 0, 0, 0], ["Alpha"]),
            G2: saved([1, 0, 0, 0], ["Alpha"]),
            "G[x]": saved([1, 0, 0, 0], ["Alpha"]),
            "G__Variation": saved([1, 0, 0, 0], ["Alpha"]),
            "G[1]__Variation": saved([1, 0, 0, 0], ["Alpha"])
        })).toBeNull();
    });

    test("FindSettingsForTab_APreviewKeyListsAnInternalColumn_ItIsNotTakenForAVariation", () => {

        const tabs = {
            tabularDatas: [query([1, 0, 0, 0], ["A", "C", "__Zero"])],
            settingsGroups: ["A|C|__Zero"],
            familyGroup: null
        };

        expect(find(0, tabs, {
            "A|B|__Zero__Variation": saved([1, 0, 0, 0], ["A", "C", "__Zero"]),
            "A|B|__Zero": saved([1, 0, 0, 0], ["A", "B", "__Zero"])
        })).toEqual({ key: "A|B|__Zero", columnNames: ["A", "B", "__Zero"] });
    });

    test("FindSettingsForTab_TooLittleAlikeToPair_KeepsTheKeyedSettingsAndTheirColumns", () => {

        const tabs = tabsOf("G", [
            query([0, 0, 1, 0], ["Gamma"]),
            query([0, 0, 0, 1], ["Delta"])
        ]);

        const allSettings = {
            G: saved([1, 0, 0, 0], ["Alpha"]),
            "G[1]": saved([0, 1, 0, 0], ["Beta"])
        };

        expect(JSON.stringify([find(0, tabs, allSettings), find(1, tabs, allSettings)])).toBe(
            `[{"key":"G","columnNames":["Alpha"]},{"key":"G[1]","columnNames":["Beta"]}]`
        );
    });

    // The threshold is there to choose between competing candidates, so where nothing is
    // competing the only settings there are belong to the only query there is.
    test("FindSettingsForTab_OneQueryAndOneCandidateBelowTheThreshold_PairsThem", () => {

        const tabs = {
            tabularDatas: [query([1, 0, 0, 0], [])],
            settingsGroups: ["Target"],
            familyGroup: null
        };

        expect(find(0, tabs, { Other: saved([0, 1, 0, 0], []) }).key).toBe("Other");
    });

    test("FindSettingsForTab_TwoQueriesAndTwoCandidatesAllBelowIt_PairsNeither", () => {

        const tabs = {
            tabularDatas: [query([1, 0, 0, 0], []), query([0, 1, 0, 0], [])],
            settingsGroups: ["First", "Second"],
            familyGroup: null
        };

        const allSettings = {
            A: saved([0, 0, 1, 0], []),
            B: saved([0, 0, 0, 1], [])
        };

        expect(JSON.stringify([find(0, tabs, allSettings), find(1, tabs, allSettings)])).toBe(
            "[null,null]"
        );
    });

    // A scores 0.4 on its identical embedding alone; B scores 0.883 because its columns are
    // the query's columns, which weigh more than how the SQL was written.
    test("FindSettingsForTab_ColumnsAgreeButTheEmbeddingDoesNot_ColumnsWinOut", () => {

        const tabs = {
            tabularDatas: [query([1, 0, 0, 0], ["Alpha", "Beta"])],
            settingsGroups: ["Target"],
            familyGroup: null
        };

        expect(find(0, tabs, {
            A: {
                queryEmbedding: Ren.EmbeddingUtils.encodeEmbedding([1, 0, 0, 0]),
                columns: [{ column: "Gamma" }, { column: "Delta" }]
            },
            B: {
                queryEmbedding: Ren.EmbeddingUtils.encodeEmbedding([1, 1, 0, 0]),
                columns: [{ column: "Alpha" }, { column: "Beta" }]
            }
        }).key).toBe("B");
    });

    // A is the better candidate for both queries, but the first query scores higher on it,
    // so the second query falls to B rather than either taking A or both claiming it.
    test("FindSettingsForTab_TwoQueriesWantTheSameSettings_TheBetterFitTakesThem", () => {

        const tabs = {
            tabularDatas: [
                query([1, 0, 0, 0], ["Alpha", "Beta"]),
                query([1, 1, 0, 0], ["Alpha", "Beta"])
            ],
            settingsGroups: ["First", "Second"],
            familyGroup: null
        };

        const allSettings = {
            A: saved([1, 0, 0, 0], ["Alpha", "Beta"]),
            B: saved([1, 1, 0, 0], ["Alpha", "Beta", "Gamma"])
        };

        expect(find(0, tabs, allSettings).key + "," + find(1, tabs, allSettings).key).toBe("A,B");
    });

    // A SELECT is inserted above two similar ones, each edited to look a little more like
    // the other's saved SQL.  The crossed pairing scores 0.008 higher, which is too close
    // to choose on, so they keep the order they were saved in.
    test("FindSettingsForTab_SimilarQueriesEditedTowardsEachOther_KeepTheirOrder", () => {

        const tabs = tabsOf("G", [
            query([0, 0, 0, 1], ["Gamma"]),
            query([10, 1, 2, 0], ["Alpha", "Beta"]),
            query([10, 2, 1, 0], ["Alpha", "Beta"])
        ]);

        const allSettings = {
            G: saved([10, 1, 0, 0], ["Alpha", "Beta"]),
            "G[1]": saved([10, 0, 1, 0], ["Alpha", "Beta"])
        };

        const keys = [];

        for (let i = 0; i < tabs.tabularDatas.length; i++) {
            keys.push(find(i, tabs, allSettings)?.key ?? null);
        }

        expect(JSON.stringify(keys)).toBe(`[null,"G","G[1]"]`);
    });

    // Unedited queries are certain matches, so however close the crossed pairing scores,
    // their order does not swap them back.
    test("FindSettingsForTab_SimilarQueriesSwappedUnedited_FollowTheirQueries", () => {

        const tabs = tabsOf("G", [
            query([10, 0, 1, 0], ["Alpha", "Beta"]),
            query([10, 1, 0, 0], ["Alpha", "Beta"])
        ]);

        const allSettings = {
            G: saved([10, 1, 0, 0], ["Alpha", "Beta"]),
            "G[1]": saved([10, 0, 1, 0], ["Alpha", "Beta"])
        };

        expect(find(0, tabs, allSettings).key + "," + find(1, tabs, allSettings).key).toBe(
            "G[1],G"
        );
    });

    // Data grouping settings carry their query's columns; grid state carries its columns
    // array; an Editor-path key spells its columns out as the headings it is composed of;
    // a web report's key is its SQL filename and says nothing about them.
    test("FindSettingsForTab_Paired_ReturnsTheColumnsTheSettingsWereSavedAgainst", () => {

        const encoded = Ren.EmbeddingUtils.encodeEmbedding([1, 0, 0, 0]);

        const findColumnNames = (settingsGroup, settings) => {

            const tabs = {
                tabularDatas: [query([1, 0, 0, 0], [])],
                settingsGroups: ["Target"],
                familyGroup: null
            };

            const allSettings = {};
            allSettings[settingsGroup] = settings;

            return find(0, tabs, allSettings).columnNames;
        };

        expect(JSON.stringify([
            findColumnNames("Key", {
                queryEmbedding: encoded,
                queryColumns: ["Alpha"],
                columns: [{ column: "Gamma" }]
            }),
            findColumnNames(
                "Key", { queryEmbedding: encoded, columns: [{ column: "Gamma" }] }
            ),
            findColumnNames("Alpha|Beta", { queryEmbedding: encoded }),
            findColumnNames("Plain", { queryEmbedding: encoded })
        ])).toBe(`[["Alpha"],["Gamma"],["Alpha","Beta"],[]]`);
    });

    test("FindSettingsForTab_AnInternalLastColumnIsNamedAsAVariation_ItIsNotPaired", () => {

        const tabs = {
            tabularDatas: [query([1, 0, 0, 0], ["A", "__Zero"])],
            settingsGroups: ["A|__Zero"],
            familyGroup: null
        };

        expect(find(0, tabs, {
            "A|__Zero__Mine": saved([1, 0, 0, 0], ["A", "__Zero"])
        })).toBeNull();
    });
});

describe("DataGroupingSettingsTransformer_All", () => {

    test("Transform_TabularDataHasAQueryEmbedding_PutsTheQueryFingerprintFirst", () => {

        const visualisation = {
            dataGroupingSettingsGroup: "Group",
            instance: {
                dataGroupingSettings: [{ dataGroupingSettingsGroup: "Group" }],
                dataGrids: [{
                    tabularData: {
                        ColumnModels: [
                            { Heading: "Order ID", ColumnIdOrHeading: "OrderID" },
                            { Heading: "Total", ColumnIdOrHeading: "Total" }
                        ],
                        QueryEmbedding: [1, -1]
                    }
                }]
            }
        };

        const transformed =
            Ren.DataGroupingSettingsTransformer_All.transform([visualisation]).Group;

        expect(JSON.stringify(Object.keys(transformed).slice(0, 2)) + " " +
            transformed.queryEmbedding + " " + JSON.stringify(transformed.queryColumns)
        ).toBe(
            `["queryEmbedding","queryColumns"] Af8= ["OrderID","Total"]`
        );
    });

    test("Transform_TabularDataHasNoQueryEmbedding_LeavesTheFingerprintOut", () => {

        const visualisation = {
            dataGroupingSettingsGroup: "Group",
            instance: {
                dataGroupingSettings: [{ dataGroupingSettingsGroup: "Group" }],
                dataGrids: [{
                    tabularData: {
                        ColumnModels: [{ Heading: "Total", ColumnIdOrHeading: "Total" }]
                    }
                }]
            }
        };

        const transformed =
            Ren.DataGroupingSettingsTransformer_All.transform([visualisation]).Group;

        expect(JSON.stringify([
            "queryEmbedding" in transformed,
            "queryColumns" in transformed
        ])).toBe("[false,false]");
    });
});

describe("DuplicateQueryEmbeddingsRemover", () => {

    test("RemoveDuplicateQueryEmbeddings_TwoGridStatesShareOne_RemovesItFromBoth", () => {

        const settings = {
            gridState: {
                A: { queryEmbedding: [1, 2] },
                B: { queryEmbedding: [1, 2] },
                C: { queryEmbedding: "AAI=" },
                D: {}
            }
        };

        Ren.ReportSerializer_DuplicateQueryEmbeddingsRemover
            .removeDuplicateQueryEmbeddings(settings);

        expect(JSON.stringify(settings.gridState)).toBe(
            `{"A":{},"B":{},"C":{"queryEmbedding":"AAI="},"D":{}}`
        );
    });

    test("RemoveDuplicateQueryEmbeddings_TheSharedEmbeddingIsEncoded_StillRemovesIt", () => {

        const settings = {
            gridState: {
                A: { queryEmbedding: "AAI=" },
                B: { queryEmbedding: "AAI=" }
            }
        };

        Ren.ReportSerializer_DuplicateQueryEmbeddingsRemover
            .removeDuplicateQueryEmbeddings(settings);

        expect(JSON.stringify(settings.gridState)).toBe(`{"A":{},"B":{}}`);
    });

    test("RemoveDuplicateQueryEmbeddings_DuplicatesAreInAnotherCollection_LeavesThem", () => {

        const settings = {
            gridState: { A: { queryEmbedding: [1, 2] } },
            dataGroupingSettings: {
                X: { queryEmbedding: [1, 2] },
                Y: { queryEmbedding: [1, 2] }
            }
        };

        Ren.ReportSerializer_DuplicateQueryEmbeddingsRemover
            .removeDuplicateQueryEmbeddings(settings);

        expect(JSON.stringify(settings)).toBe(
            `{"gridState":{"A":{"queryEmbedding":[1,2]}},` +
            `"dataGroupingSettings":{"X":{"queryEmbedding":[1,2]},"Y":{"queryEmbedding":[1,2]}}}`
        );
    });

    test("RemoveDuplicateQueryEmbeddings_ThereIsNoGridState_DoesNothing", () => {

        const remover = Ren.ReportSerializer_DuplicateQueryEmbeddingsRemover;

        remover.removeDuplicateQueryEmbeddings(null);
        remover.removeDuplicateQueryEmbeddings({});

        expect("ok").toBe("ok");
    });
});

describe("GridStateTransformer", () => {

    test("Transform_TabularDataHasAQueryEmbedding_EncodesItIntoTheGridState", () => {

        const transformed = Ren.GridStateTransformer.transform(
            {
                ColumnModels: [{ Heading: "A", ColumnIdOrHeading: "A" }],
                QueryEmbedding: [1, -1]
            },
            { columnWidths: [], columns: [] }
        );

        expect(transformed.queryEmbedding).toBe("Af8=");
    });

    test("Transform_TabularDataHasNoQueryEmbedding_LeavesThePropertyOut", () => {

        const transformed = Ren.GridStateTransformer.transform(
            { ColumnModels: [{ Heading: "A", ColumnIdOrHeading: "A" }] },
            { columnWidths: [], columns: [] }
        );

        expect("queryEmbedding" in transformed).toBe(false);
    });

    test("Transform_TabularDataIsMissing_ReturnsNull", () => {

        expect(Ren.GridStateTransformer.transform(null, {})).toBeNull();
    });
});

describe("GridState_Initial", () => {

    test("GetInitialGridState_TheKeyedGridStateWasSavedAgainstTheQuery_ReturnsIt", () => {

        const reportSettings = {
            gridState: {
                Group: {
                    queryEmbedding: Ren.EmbeddingUtils.encodeEmbedding([1, 0, 0, 0]),
                    columns: [{ column: "Alpha" }]
                }
            }
        };

        const tabs = tabsOf("Group", [query([1, 0, 0, 0], ["Alpha"])]);

        const gridState = Ren.GridState_Initial.getInitialGridState(
            "Group", reportSettings, tabs, 0
        );

        expect(gridState).toBe(reportSettings.gridState.Group);
    });

    test("GetInitialGridState_NoTabsAreGiven_FindsByKeyAlone", () => {

        const reportSettings = { gridState: { Group: { visibleColumns: [] } } };
        const initial = Ren.GridState_Initial;

        expect(JSON.stringify([
            initial.getInitialGridState("Group", reportSettings) ===
                reportSettings.gridState.Group,
            initial.getInitialGridState("Missing", reportSettings),
            initial.getInitialGridState("Group", null)
        ])).toBe("[true,null,null]");
    });

    test("GetInitialGridState_TheQueryHasMoved_ReturnsACloneOfTheGridStateSavedAgainstIt", () => {

        const reportSettings = {
            gridState: {
                Group: {
                    queryEmbedding: Ren.EmbeddingUtils.encodeEmbedding([1, 0, 0, 0]),
                    columns: [{ column: "Alpha" }, { column: "Beta" }]
                }
            }
        };

        const tabs = tabsOf("Group", [
            query([0, 0, 1, 0], ["Gamma"]),
            query([1, 0, 0, 0], ["Alpha", "Beta"])
        ]);

        const gridState = Ren.GridState_Initial.getInitialGridState(
            "Group[1]", reportSettings, tabs, 1
        );

        expect(JSON.stringify([
            gridState !== reportSettings.gridState.Group,
            gridState.originalColumns,
            reportSettings.gridState.Group.originalColumns === undefined
        ])).toBe(`[true,["Alpha","Beta"],true]`);
    });

    test("GetInitialGridState_MatchSaysNothingAboutItsColumns_AddsNoOriginalColumns", () => {

        const reportSettings = {
            gridState: {
                Group: {
                    queryEmbedding: Ren.EmbeddingUtils.encodeEmbedding([1, 0, 0, 0])
                }
            }
        };

        const tabs = tabsOf("Group", [
            query([0, 0, 1, 0], ["Gamma"]),
            query([1, 0, 0, 0], ["Alpha", "Beta"])
        ]);

        const gridState = Ren.GridState_Initial.getInitialGridState(
            "Group[1]", reportSettings, tabs, 1
        );

        expect("originalColumns" in gridState).toBe(false);
    });

    test("GetInitialGridState_NothingWasSavedAgainstTheQuery_ReturnsNull", () => {

        const tabs = tabsOf("Group", [query([1, 0, 0, 0], ["Alpha"])]);
        const initial = Ren.GridState_Initial;

        expect(JSON.stringify([
            initial.getInitialGridState("Group", { gridState: {} }, tabs, 0),
            initial.getInitialGridState("Group", {}, tabs, 0)
        ])).toBe("[null,null]");
    });
});

describe("ReportSettings_GridStateCollection", () => {

    test("GetClonedGridState_TheQueryHasMoved_ReturnsTheGridStateSavedAgainstIt", () => {

        const allGridState = Ren.ReportSettings_GridStateCollection.allGridState;

        allGridState["Saved"] = {
            queryEmbedding: Ren.EmbeddingUtils.encodeEmbedding([0, 0, 3, 4]),
            columns: [{ column: "Alpha" }]
        };

        try {
            const tabs = tabsOf("Saved", [
                query([1, 0, 0, 0], ["Beta"]),
                query([0, 0, 3, 4], ["Alpha"])
            ]);

            const gridState = Ren.ReportSettings_GridStateCollection.getClonedGridState(
                tabs.settingsGroups[1], undefined, tabs, 1
            );

            expect(gridState.gridStateGroup).toBe("Saved[1]");
            expect(gridState.originalColumns).toEqual(["Alpha"]);
        }
        finally {
            delete allGridState["Saved"];
        }
    });

    test("GetClonedGridState_AVariationIsAskedFor_DoesNotPairIt", () => {

        const allGridState = Ren.ReportSettings_GridStateCollection.allGridState;

        allGridState["Saved"] = {
            queryEmbedding: Ren.EmbeddingUtils.encodeEmbedding([0, 0, 3, 4]),
            columns: [{ column: "Alpha" }]
        };

        try {
            const tabs = tabsOf("Saved", [
                query([1, 0, 0, 0], ["Beta"]),
                query([0, 0, 3, 4], ["Alpha"])
            ]);

            expect(Ren.ReportSettings_GridStateCollection.getClonedGridState(
                tabs.settingsGroups[1], "Variation", tabs, 1
            )).toBeNull();
        }
        finally {
            delete allGridState["Saved"];
        }
    });
});

describe("DataGroupingSettings_Initial", () => {

    test("GetInitialDataGroupingSettings_NoTabsAreGiven_FindsByKeyAlone", () => {

        const reportSettings = { dataGroupingSettings: { Group: { groupings: {} } } };
        const initial = Ren.DataGroupingSettings_Initial;

        expect(JSON.stringify([
            initial.getInitialDataGroupingSettings("Group", reportSettings) ===
                reportSettings.dataGroupingSettings.Group,
            initial.getInitialDataGroupingSettings("Missing", reportSettings)
        ])).toBe("[true,null]");
    });

    test("GetInitialDataGroupingSettings_TheQueryHasMoved_ReturnsACloneOfTheSettings", () => {

        const reportSettings = {
            dataGroupingSettings: { Group: saved([1, 0, 0, 0], ["Alpha"]) }
        };

        const tabs = tabsOf("Group", [
            query([0, 0, 1, 0], ["Gamma"]),
            query([1, 0, 0, 0], ["Alpha"])
        ]);

        const settings = Ren.DataGroupingSettings_Initial.getInitialDataGroupingSettings(
            "Group[1]", reportSettings, tabs, 1
        );

        expect(JSON.stringify([
            settings !== reportSettings.dataGroupingSettings.Group,
            settings.queryColumns
        ])).toBe(`[true,["Alpha"]]`);
    });

    test("GetInitialDataGroupingSettings_TheKeyedSettingsMatchTheQuery_ReturnsThem", () => {

        const reportSettings = {
            dataGroupingSettings: { Group: saved([1, 0, 0, 0], ["Alpha"]) }
        };

        const tabs = tabsOf("Group", [query([1, 0, 0, 0], ["Alpha"])]);

        const settings = Ren.DataGroupingSettings_Initial.getInitialDataGroupingSettings(
            "Group", reportSettings, tabs, 0
        );

        expect(settings).toBe(reportSettings.dataGroupingSettings.Group);
    });
});

describe("ReportSettings_DataGroupingSettingsCollection", () => {

    test("GetClonedDataGroupingSettings_TheQueryHasMoved_ReturnsTheSettingsForItsQuery", () => {

        const collection = Ren.ReportSettings_DataGroupingSettingsCollection;

        collection.allDataGroupingSettings["Saved"] = saved([0, 0, 3, 4], ["Alpha"]);

        try {
            const tabs = tabsOf("Saved", [
                query([1, 0, 0, 0], ["Beta"]),
                query([0, 0, 3, 4], ["Alpha"])
            ]);

            const settings = collection.getClonedDataGroupingSettings(
                tabs.settingsGroups[1], undefined, tabs, 1
            );

            expect(settings.dataGroupingSettingsGroup).toBe("Saved[1]");
            expect(settings.queryColumns).toEqual(["Alpha"]);
        }
        finally {
            delete collection.allDataGroupingSettings["Saved"];
        }
    });

    test("GetClonedDataGroupingSettings_AVariationIsAskedFor_DoesNotPairIt", () => {

        const collection = Ren.ReportSettings_DataGroupingSettingsCollection;

        collection.allDataGroupingSettings["Saved"] = saved([0, 0, 3, 4], ["Alpha"]);

        try {
            const tabs = tabsOf("Saved", [
                query([1, 0, 0, 0], ["Beta"]),
                query([0, 0, 3, 4], ["Alpha"])
            ]);

            expect(collection.getClonedDataGroupingSettings(
                tabs.settingsGroups[1], "Variation", tabs, 1
            )).toBeNull();
        }
        finally {
            delete collection.allDataGroupingSettings["Saved"];
        }
    });
});
