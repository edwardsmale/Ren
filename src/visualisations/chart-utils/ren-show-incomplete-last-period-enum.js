/**
 * Enum for when a date/value chart shows a last period that is still part way through.  Always
 * shows it as it stands; FromHalfway, FromOneThird and FromTwoThirds leave it off until that much
 * of its working days have gone, when there is enough of it in to read (or estimate) fairly; Never
 * leaves it off until it is over.
 */
Ren.ShowIncompleteLastPeriodEnum = Ren.DefineEnum({
    Always: 0,
    FromHalfway: 1,
    FromOneThird: 2,
    Never: 3,
    FromTwoThirds: 4
});
