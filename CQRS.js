var EventSourced = (function () {
    function EventSourced(id) {
        this.id = id;
        this.events = new Array();
        this.version = 0;
    }
    EventSourced.prototype.getId = function () {
        return this.id;
    };

    EventSourced.prototype.getVersion = function () {
        return this.version;
    };

    EventSourced.prototype.getEvents = function () {
        return this.events;
    };

    EventSourced.prototype.loadFromEvents = function (events) {
        var self = this;
        events.forEach(function (item) {
            self["on" + item.name](item);
            self.version = item.version;
        });
    };

    EventSourced.prototype.update = function (versionedEvent) {
        versionedEvent.sourceId = this.id;
        versionedEvent.version = this.version + 1;
        this["on" + versionedEvent.name](versionedEvent);
        this.version = versionedEvent.version;
        this.events.push(versionedEvent);
    };
    return EventSourced;
})();
exports.EventSourced = EventSourced;
