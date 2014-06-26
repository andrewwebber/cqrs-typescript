cqrs-typescript
===============

CQRS implementation in typescript

```
/// <reference path="./node_modules/CQRS/lib/CQRS.d.ts"/>
/// <reference path="mocha.d.ts"/>
/// <reference path="should.d.ts"/>

import CQRS = require('CQRS');
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
