Ren.ChartProps = (() => {

    const setMargin = (props, margin) => {

        margin.vertical = margin.top + margin.bottom;
        margin.horizontal = margin.left + margin.right;

        props.margin = margin;
    };

    return {
        setMargin
    };
})();
