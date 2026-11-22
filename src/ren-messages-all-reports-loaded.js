Ren.AllReportsLoadedMessage = (() => {

    const notifyAllReportsLoadedOnceNoLoadingAnimationsArePresent = () => {

        Ren.MessageBus_Conditions.onCondition(
            () => !Ren.LoadingAnimations.areAnyLoadingAnimationsPresent(),
            () => {

                Ren.Messages.Events.allReportsLoaded.notify();
            },
            true
        );
    };

    return {
        notifyAllReportsLoadedOnceNoLoadingAnimationsArePresent
    };
})();
