Ren.DateSelector_ContextMenu_Utils = (() => {

    const getStartDate = (y, m) => {

        return Ren.DateUtils.formatSortableYmd(y, m, 1);
    };

    const getEndDate = (y, m) => {

        const now = new Date();
        const cy = now.getFullYear();
        const cm = now.getMonth() + 1;

        if ((y === cy && m > cm) || y > cy) {
            return Ren.DateUtils.toSortableDate(now);
        }
        return Ren.DateUtils.formatSortableYmd(y, m, 1);
    };

    const isPastOrCurrent = (y, m) => {

        const cy = new Date().getFullYear();
        const cm = new Date().getMonth() + 1;
        return y < cy || (y === cy && m <= cm);
    };

    return {
        getStartDate,
        getEndDate,
        isPastOrCurrent
    };
})();
