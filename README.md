cqrs-typescript
===============

###CQRS implementation in typescript.

Components avaliable:
- Event Sourcing
  - Interfaces for creating versioned events
  - Base classes for creating an event sourced aggregates and raising versioned events  
- Command processing
  - Interfaces for creating commands
  - Command bus for sending events
  - Redis based command bus using ['rpoplpush'](http://redis.io/commands/rpoplpush)
  - Command handling registry for signing up for command types
- Event processing
  - Interfaces for creating events
  - Event bus for sending events
  - Redis based event bus using ['rpoplpush'](http://redis.io/commands/rpoplpush)
  - Event handling registry for signing up for command types

View the tests for more examples on usage.

####Event Sourcing

```typescript
/// <reference path="mocha.d.ts"/>
/// <reference path="should.d.ts"/>

import CQRS = require('cqrs-typescript');
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

var account : BankAccount;

describe('extending from "EventSourced" to create a "bank account"', function() {
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
```

####Redis based event sourcing repository

```typescript
var account = new BankAccount('2');
account.credit(100);
account.credit(100);
account.debit(50);
account.credit(100);
account.debit(200);
account.balance.should.be.exactly(50);

var provider = new CQRS.RedisEventSourcedRepository({ host: "127.0.0.1", port:6379});
it('should connect to a specified Redis server',function(done){
  provider.connect((error)=>{
    should.equal(error, null);
    done();
  });
});

it('should be able to persist an event stream for an given aggregate id',function(done){
  var events = account.getEvents();
  events.length.should.be.exactly(5);
  provider.saveEventsByAggregateId(account.getId(),events, (error)=>{
      should.equal(error, null);
      done();
  });
});

it('should be able to retrieve an event stream by aggregate id and recreate an aggregate instance',function(done){
  provider.getEventsByAggregateId(account.getId(),(error, events)=>{
    should.equal(error, null);
    events.length.should.be.exactly(5);

    var accountFromEvents = new BankAccount(account.getId());
    accountFromEvents.loadFromEvents(events);
    accountFromEvents.balance.should.be.exactly(account.balance);
    done();
  });
});
```
