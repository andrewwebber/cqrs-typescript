/// <reference path="mocha.d.ts"/>
/// <reference path="should.d.ts"/>
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
/*global describe, it, import */
/*jslint node: true */
var CQRS = require('../lib/CQRS');
var should = require('should');
should.equal('actual', 'actual');

var BankAccount = (function (_super) {
    __extends(BankAccount, _super);
    function BankAccount(id) {
        _super.call(this, id);
        this.balance = 0;
    }
    BankAccount.prototype.credit = function (amount) {
        this.update({
            name: 'CreditAccount',
            amount: amount,
            version: -1,
            sourceId: ''
        });
    };

    BankAccount.prototype.debit = function (amount) {
        this.update({
            name: 'DebitAccount',
            amount: amount,
            version: -1,
            sourceId: ''
        });
    };

    BankAccount.prototype.onCreditAccount = function (e) {
        this.balance += e.amount;
    };

    BankAccount.prototype.onDebitAccount = function (e) {
        this.balance -= e.amount;
    };
    return BankAccount;
})(CQRS.EventSourced);

var TestCommand = (function () {
    function TestCommand(message) {
        this.name = 'TestCommand';
        this.message = message;
    }
    return TestCommand;
})();

var TestCommandHandler = (function () {
    function TestCommandHandler() {
    }
    TestCommandHandler.prototype.handleCommand = function (commandToHandle, callback) {
        commandToHandle.body.name.should.be.exactly('TestCommand');
        commandToHandle.body.message.should.be.exactly('hello world');
        callback(null);
    };
    return TestCommandHandler;
})();
;

var TestEventMessageReceived = (function () {
    function TestEventMessageReceived(message) {
        this.name = 'TestEventMessageReceived';
        this.message = message;
    }
    return TestEventMessageReceived;
})();

var TestEventMessageReceivedHandler = (function () {
    function TestEventMessageReceivedHandler() {
    }
    TestEventMessageReceivedHandler.prototype.handleEvent = function (eventToHandle, callback) {
        eventToHandle.body.name.should.be.exactly('TestEventMessageReceived');
        eventToHandle.body.message.should.be.exactly('hello world');
        callback(null);
    };
    return TestEventMessageReceivedHandler;
})();
;

describe('CQRS Tests', function () {
    describe('Core Tests', function () {
        var account;

        describe('extending from "EventSourced" to create a "bank account"', function () {
            it('should be ok to create one once supplying an id ', function () {
                account = new BankAccount('1');
            });

            it('should be ok to credit the account to 100 by raising an event', function () {
                account.credit(100);
                account.balance.should.be.exactly(100);
                account.getEvents().length.should.be.exactly(1);
                account.getVersion().should.be.exactly(1);
            });

            it('should be ok to credit the account to 150 by raising an event', function () {
                account.credit(50);
                account.balance.should.be.exactly(150);
                account.getEvents().length.should.be.exactly(2);
                account.getVersion().should.be.exactly(2);
            });

            it('should be ok to debit the account by 100 by raising an event', function () {
                account.debit(100);
                account.balance.should.be.exactly(50);
                account.getEvents().length.should.be.exactly(3);
                account.getVersion().should.be.exactly(3);
            });

            it('should be ok to load a bank account from an event stream', function () {
                var accountFromEvents = new BankAccount('1');
                var events = account.getEvents();
                accountFromEvents.loadFromEvents(events);
                accountFromEvents.balance.should.be.exactly(account.balance);
                accountFromEvents.getVersion().should.be.exactly(account.getVersion());
            });
        });

        describe('using an in memory "event sourced" repository', function () {
            var provider = new CQRS.InMemoryEventSourcedRepository();

            it('should be able to save events in memory', function (done) {
                provider.saveEventsByAggregateId(account.getId(), account.getEvents(), function (error) {
                    should.equal(error, null);
                    done();
                });
            });

            it('should be able to load events previously saved', function (done) {
                provider.getEventsByAggregateId(account.getId(), function (error, events) {
                    events.should.be.an.Array;
                    events.length.should.be.exactly(account.getEvents().length);
                    done();
                });
            });

            it('should be possible to load a bank account from events loaded from the repository', function (done) {
                provider.getEventsByAggregateId(account.getId(), function (error, events) {
                    should.equal(error, null);
                    var accountFromEvents = new BankAccount(account.getId());
                    accountFromEvents.loadFromEvents(events);
                    accountFromEvents.balance.should.be.exactly(account.balance);
                    done();
                });
            });
        });

        describe('Handler registry', function () {
            var registry = new CQRS.HandlerRegistry();

            describe('command registration', function () {
                var testCommandHandler = new TestCommandHandler();
                var commandName = 'TestCommand';

                it('should be possible to register a command handler', function () {
                    registry.registerCommandHandler(commandName, testCommandHandler);
                    var handlers = registry.commandsRegistry[commandName];
                    handlers.length.should.be.exactly(1);
                });

                it('should be possible to execute a command handler having sending a command through the "HandlerRegistry"', function (done) {
                    var testCommand = new TestCommand('hello world');
                    testCommand.id = "1";
                    registry.handleCommand({
                        messageId: "1",
                        correlationId: "1",
                        body: testCommand
                    }, function (error) {
                        should.equal(error, null);
                        done();
                    });
                });
            });

            describe('event registration', function () {
                var testEventHandler = new TestEventMessageReceivedHandler();
                var eventName = 'TestEventMessageReceived';

                it('should be possible to register an event handler', function () {
                    registry.registerEventHandler(eventName, testEventHandler);
                    var handlers = registry.eventsRegistry[eventName];
                    handlers.length.should.be.exactly(1);
                });

                it('should be possible to execute an event handler having sending an event through the "HandlerRegistry"', function (done) {
                    var testEvent = new TestEventMessageReceived('hello world');
                    testEvent.sourceId = "1";
                    registry.handleEvent({
                        messageId: "1",
                        correlationId: "1",
                        body: testEvent
                    }, function (error) {
                        should.equal(error, null);
                        done();
                    });
                });
            });
        });
    });

    describe('Infrastructure tests', function () {
        describe('Redis event sourced repository', function () {
            var account = new BankAccount('2');
            account.credit(100);
            account.credit(100);
            account.debit(50);
            account.credit(100);
            account.debit(200);
            account.balance.should.be.exactly(50);

            var provider = new CQRS.RedisEventSourcedRepository({ host: "127.0.0.1", port: 6379 });
            it('should connect to a specified Redis server', function (done) {
                provider.connect(function (error) {
                    should.equal(error, null);
                    done();
                });
            });

            it('should be able to persist an event stream for an given aggregate id', function (done) {
                var events = account.getEvents();
                events.length.should.be.exactly(5);
                provider.saveEventsByAggregateId(account.getId(), events, function (error) {
                    should.equal(error, null);
                    done();
                });
            });

            it('should be able to retrieve an event stream by aggregate id and recreate an aggregate instance', function (done) {
                provider.getEventsByAggregateId(account.getId(), function (error, events) {
                    should.equal(error, null);
                    events.length.should.be.exactly(5);

                    var accountFromEvents = new BankAccount(account.getId());
                    accountFromEvents.loadFromEvents(events);
                    accountFromEvents.balance.should.be.exactly(account.balance);
                    done();
                });
            });

            after(function (done) {
                provider.getClient().del('eventsourcing.aggregate:' + account.getId(), function (error) {
                    should.equal(error, null);
                    done();
                });
            });
        });

        describe('Redis command bus', function () {
            var redisCommandBus = new CQRS.RedisCommandBus({ host: "127.0.0.1", port: 6379 });
            it('should connect to a specified Redis server', function (done) {
                redisCommandBus.connect(function (error) {
                    should.equal(error, null);
                    done();
                });
            });

            it('should be possible to persist a command into Redis in the pending commands list', function (done) {
                var testCommand = new TestCommand('hello world');
                testCommand.id = "1";
                redisCommandBus.handleCommand({
                    messageId: "1",
                    correlationId: "1",
                    body: testCommand
                }, function (error) {
                    should.equal(error, null);

                    redisCommandBus.getClient().lrange('messaging.queuedcommands', 0, -1, function (error, results) {
                        should.equal(error, null);
                        results.length.should.be.exactly(1);
                        var commandSerialized = results[0];
                        var command = JSON.parse(commandSerialized);
                        command.body.message.should.be.exactly(testCommand.message);
                        done();
                    });
                });
            });

            it('should be possible to persist another command into Redis in the pending commands list', function (done) {
                var testCommand = new TestCommand('hello world2');
                testCommand.id = "1";
                redisCommandBus.handleCommand({
                    messageId: "1",
                    correlationId: "1",
                    body: testCommand
                }, function (error) {
                    should.equal(error, null);

                    redisCommandBus.getClient().lrange('messaging.queuedcommands', 0, -1, function (error, results) {
                        should.equal(error, null);
                        results.length.should.be.exactly(2);
                        var commandSerialized = results[1];
                        var command = JSON.parse(commandSerialized);
                        command.body.message.should.be.exactly(testCommand.message);
                        done();
                    });
                });
            });

            after(function (done) {
                redisCommandBus.getClient().del('messaging.queuedcommands', function (error) {
                    should.equal(error, null);
                    done();
                });
            });
        });

        describe('Redis event bus', function () {
            var redisEventBus = new CQRS.RedisEventBus({ host: "127.0.0.1", port: 6379 });
            it('should connect to a specified Redis server', function (done) {
                redisEventBus.connect(function (error) {
                    should.equal(error, null);
                    done();
                });
            });

            it('should be possible to persist an event into Redis in the pending commands list', function (done) {
                var testEvent = new TestEventMessageReceived('hello world');
                testEvent.sourceId = "1";
                redisEventBus.handleEvent({
                    messageId: "1",
                    correlationId: "1",
                    body: testEvent
                }, function (error) {
                    should.equal(error, null);

                    redisEventBus.getClient().lrange('messaging.queuedevents', 0, -1, function (error, results) {
                        should.equal(error, null);
                        results.length.should.be.exactly(1);
                        var eventSerialized = results[0];
                        var _event = JSON.parse(eventSerialized);
                        _event.body.message.should.be.exactly(testEvent.message);
                        done();
                    });
                });
            });

            it('should be possible to persist another event into Redis in the pending commands list', function (done) {
                var testEvent = new TestEventMessageReceived('hello world');
                testEvent.sourceId = "1";
                redisEventBus.handleEvent({
                    messageId: "1",
                    correlationId: "1",
                    body: testEvent
                }, function (error) {
                    should.equal(error, null);

                    redisEventBus.getClient().lrange('messaging.queuedevents', 0, -1, function (error, results) {
                        should.equal(error, null);
                        results.length.should.be.exactly(2);
                        var eventSerialized = results[0];
                        var _event = JSON.parse(eventSerialized);
                        _event.body.message.should.be.exactly(testEvent.message);
                        done();
                    });
                });
            });

            after(function (done) {
                redisEventBus.getClient().del('messaging.queuedevents', function (error) {
                    should.equal(error, null);
                    done();
                });
            });
        });
    });
});
