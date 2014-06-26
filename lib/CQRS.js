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

var InMemoryEventSourcedRepository = (function () {
    function InMemoryEventSourcedRepository() {
        this.db = {};
    }
    InMemoryEventSourcedRepository.prototype.getEventsByAggregateId = function (id, callback) {
        if (!this.db[id])
            return callback(null, []);

        var aggregateEvents = this.db[id];
        callback(null, aggregateEvents);
    };

    InMemoryEventSourcedRepository.prototype.saveEventsByAggregateId = function (id, events, callback) {
        var aggregateEvents = this.db[id];
        if (!aggregateEvents)
            aggregateEvents = [];
        aggregateEvents = aggregateEvents.concat(events);
        this.db[id] = aggregateEvents;
        callback(null);
    };
    return InMemoryEventSourcedRepository;
})();
exports.InMemoryEventSourcedRepository = InMemoryEventSourcedRepository;
