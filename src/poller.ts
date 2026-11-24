/**
 * Suspends Liferay.Poller once it becomes available, so that the page
 * stops making periodic background requests to the server.
 */

function suspendLiferayPoller() : void {
  var pollerSuspendInterval = setInterval(function() {
    // Read from unsafeWindow on every check rather than using the cached
    // Liferay variable, since Liferay.Poller might be added later.

    var liferay = <Liferay | undefined> unsafeWindow.Liferay;

    if (!liferay || !liferay.Poller) {
      return;
    }

    clearInterval(pollerSuspendInterval);

    liferay.Poller.suspend();
  }, 1000);
}
