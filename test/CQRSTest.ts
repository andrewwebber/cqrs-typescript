/// <reference path="mocha.d.ts"/>
/// <reference path="should.d.ts"/>

/*global describe, it, import */
/*jslint node: true */
import CQRS = require('../lib/CQRS');
import should = require('should');
should.equal('actual', 'actual');

interface ICreditAccountEvent extends CQRS.IVersionedEvent{
    amount:number
}

interface IDebitAccountEvent extends CQRS.IVersionedEvent{
    amount:number
}

class BankAccount extends CQRS.EventSourced{
  constructor(id :string){
    super(id);
    this.balance = 0;
  }

  balance : number;

  credit(amount:number) : void {
      this.update({
          name: 'CreditAccount',
          amount: amount,
          version: -1,
          sourceId: ''
      });
  }

  debit(amount:number) : void{
    this.update({
        name: 'DebitAccount',
        amount: amount,
        version: -1,
        sourceId: ''
      });
  }

  private onCreditAccount(e : ICreditAccountEvent):void{
    this.balance += e.amount;
  }

  private onDebitAccount(e : IDebitAccountEvent):void{
    this.balance -= e.amount;
  }
}

var account :BankAccount;

describe('CQRS Tests', function() {
  describe('Core Tests', function(){
    describe('extending from "EventSourced" to create a "bank account"',function(){
      it('should be ok to create one once supplying an id ', function() {
        account = new BankAccount('1');
      });

      it('should be ok to credit the account to 100 by raising an event',function(){
        account.credit(100);
        account.balance.should.be.exactly(100);
        account.getEvents().length.should.be.exactly(1);
        account.getVersion().should.be.exactly(1);
      });

      it('should be ok to credit the account to 150 by raising an event',function(){
        account.credit(50);
        account.balance.should.be.exactly(150);
        account.getEvents().length.should.be.exactly(2);
        account.getVersion().should.be.exactly(2);
      });

      it('should be ok to debit the account by 100 by raising an event',function(){
        account.debit(100);
        account.balance.should.be.exactly(50);
        account.getEvents().length.should.be.exactly(3);
        account.getVersion().should.be.exactly(3);
      });

      it('should be ok to load a bank account from an event stream',function(){
          var accountFromEvents = new BankAccount('1');
          var events = account.getEvents();
          accountFromEvents.loadFromEvents(events);
          accountFromEvents.balance.should.be.exactly(account.balance);
          accountFromEvents.getVersion().should.be.exactly(account.getVersion());
      });
    });
    describe('using an in memory "event sourced" repository',function(){
      var provider = new CQRS.InMemoryEventSourcedRepository();

      it('should be able to save events in memory',function(done){
        provider.saveEventsByAggregateId(account.getId(), account.getEvents(), (error)=>{
            should.equal(error,null);
            done();
          });
      });

      it('should be able to load events previously saved',function(done){
        provider.getEventsByAggregateId(account.getId(), (error, events)=>{
          events.should.be.an.Array;
          events.length.should.be.exactly(account.getEvents().length);
          done();
        });
      });

      it('should be possible to load a bank account from events loaded from the repository',function(done){
        provider.getEventsByAggregateId(account.getId(), (error, events)=>{
          should.equal(error, null);
          var accountFromEvents = new BankAccount(account.getId());
          accountFromEvents.loadFromEvents(events);
          accountFromEvents.balance.should.be.exactly(account.balance);
          done();
        });
      });
    });
  });

  describe('Infrastructure tests',function(){
    describe('redis event sourced provides',function(){
      var provider = new CQRS.RedisEventSourcedRepository({ host: "127.0.0.1", port:6379});
      it('should connect to a specified Redis server',function(done){
        provider.connect((error)=>{
          should.equal(error, null);
          done();
        });
      });
    });
  })
});
