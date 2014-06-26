/// <reference path="node.d.ts"/>
/// <reference path="node_redis.d.ts"/>
/// <reference path="async.d.ts"/>
var Redis = require('redis');
var Async = require('async');

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

var RedisEventSourcedRepository = (function () {
    function RedisEventSourcedRepository(options) {
        this.options = options;
    }
    RedisEventSourcedRepository.prototype.getClient = function () {
        return this.client;
    };

    RedisEventSourcedRepository.prototype.connect = function (callback) {
        this.client = Redis.createClient(this.options.port, this.options.host);

        this.client.on('error', function (errorMessage) {
            if (errorMessage.indexOf && errorMessage.indexOf('connect') >= 0) {
                callback(errorMessage);
            }
        });

        this.client.on('ready', callback);
    };

    RedisEventSourcedRepository.prototype.getEventsByAggregateId = function (id, callback) {
        var self = this;
        this.client.lrange('aggregate:' + id, 0, -1, function (error, results) {
            self.constructResultsResponse(error, results, callback);
        });
    };

    RedisEventSourcedRepository.prototype.saveEventsByAggregateId = function (id, events, callback) {
        if (!events || events.length === 0) {
            callback(null);
            return;
        }

        var self = this;
        Async.forEachSeries(events, function (versionedEvent, callback) {
            var serializedEvent = JSON.stringify(versionedEvent);
            self.client.rpush('aggregate:' + versionedEvent.sourceId, serializedEvent, function (error) {
                if (error)
                    return callback(error);
                callback(null);
            });
        }, callback);
    };

    RedisEventSourcedRepository.prototype.constructResultsResponse = function (error, results, callback) {
        if (error)
            return callback(error, null);

        if (results && results.length > 0) {
            var arr = [];

            results.forEach(function (item) {
                arr.push(JSON.parse(item));
            });

            return callback(null, arr);
        }

        callback(null, []);
    };
    return RedisEventSourcedRepository;
})();
exports.RedisEventSourcedRepository = RedisEventSourcedRepository;
