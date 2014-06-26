var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
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
