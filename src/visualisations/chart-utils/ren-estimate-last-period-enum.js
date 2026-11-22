/**
 * Enum for how a date/value chart series shows an estimate of the last period's final total, for
 * the case where that period is still part way through and so reads lower than the ones before it.
 * None plots the period as it stands; Overlayed draws the estimate alongside the actual value;
 * InPlace plots the estimate in place of the actual value.
 */
Ren.EstimateLastPeriodEnum = Ren.DefineEnum({
    None: 0,
    Overlayed: 1,
    InPlace: 2
});
