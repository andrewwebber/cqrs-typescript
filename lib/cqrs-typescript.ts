/// <reference path="node.d.ts"/>
/// <reference path="node_redis.d.ts"/>
/// <reference path="async.d.ts"/>
import Redis = require('redis');
import Async = require('async');

export interface IEnvelope<T>{
  body : T;
  correlationId: string;
  messageId: string;
  TTL? : number;
}

export interface ICommand{
  id: string;
  name : string
}

export interface ICommandHandler{
  handleCommand(commandToHandle : IEnvelope<ICommand>, callback: (error)=>void): void;
}

export interface IEvent{
  sourceId : string;
  name : string;
}

export interface IEventHandler{
  handleEvent(eventToHandle : IEnvelope<IEvent>, callback: (error)=>void): void;
}

export class HandlerRegistry implements ICommandHandler, IEventHandler{
  constructor(){
      this.commandsRegistry = {};
      this.eventsRegistry = {};
  }

  commandsRegistry : any;
  eventsRegistry : any;

  registerCommandHandler(commandName: string, commandHandler : ICommandHandler){
    var handlers = this.commandsRegistry[commandName];
    if(!handlers){
      handlers = [];
    }

    handlers.push(commandHandler);
    this.commandsRegistry[commandName] = handlers;
  }

  registerEventHandler(eventName: string, eventHandler : IEventHandler){
    var handlers = this.eventsRegistry[eventName];
    if(!handlers){
      handlers = [];
    }

    handlers.push(eventHandler);
    this.eventsRegistry[eventName] = handlers;
  }

  handleCommand(commandToHandle : IEnvelope<ICommand>, callback: (error)=>void){
    var handlers = this.commandsRegistry[commandToHandle.body.name];
    if(!handlers) return callback(null);

    Async.forEach(handlers,function(handler : ICommandHandler, callback : (error:any)=>void){
      handler.handleCommand(commandToHandle,callback);
    },callback);
  }

  handleEvent(eventToHandle : IEnvelope<IEvent>, callback: (error)=>void){
    var handlers = this.eventsRegistry[eventToHandle.body.name];
    if(!handlers) return callback(null);

    Async.forEach(handlers,function(handler : IEventHandler, callback : (error:any)=>void){
      handler.handleEvent(eventToHandle,callback);
    },callback);
  }
}

export interface IVersionedEvent extends IEvent{
  version : number;
}

export interface IEventSourced{
  getId() : string;
  getVersion() : number;
  getEvents() : Array<IVersionedEvent>;
}

export class EventSourced implements IEventSourced {
  private id: string;
  private version : number;
  private events : Array<IVersionedEvent>;

  constructor(id : string){
    this.id = id;
    this.events = new Array<IVersionedEvent>();
    this.version = 0;
  }

  getId() : string{
     return this.id;
  }

  getVersion() : number{
    return this.version;
  }

  getEvents() : Array<IVersionedEvent>{
    return this.events;
  }

  loadFromEvents(events : Array<IVersionedEvent>) : void{
    var self = this;
    events.forEach(function(item){
        self["on" + item.name](item);
        self.version = item.version;
      });
  }

  update(versionedEvent : IVersionedEvent) : void{
    versionedEvent.sourceId = this.id;
    versionedEvent.version = this.version + 1;
    this["on" + versionedEvent.name](versionedEvent);
    this.version = versionedEvent.version;
    this.events.push(versionedEvent);
  }
}

export class RedisResource {
  private client : Redis.RedisClient;

  constructor(options : IRedisConnectionOptions){
    this.options = options;
  }

  options : IRedisConnectionOptions;

  getClient() : Redis.RedisClient{
    return this.client;
  }

  connect(callback : (error)=>void ):void{
    this.client = Redis.createClient(this.options.port, this.options.host);

    this.client.on('error', function(errorMessage){
      if (errorMessage.indexOf && errorMessage.indexOf('connect') >= 0) {
        callback(errorMessage);
      }
    });

    var self = this;
    this.client.on('ready', ()=>{
        if(self['onConnected']){
          self['onConnected']();
        }

        callback(null);
    });
  }
}

export class RedisCommandReceiver extends RedisResource{
  constructor(options: IRedisConnectionOptions, commandReceiver : ICommandHandler){
    super(options);
    this.commandReceiver = commandReceiver;
  }

  commandReceiver : ICommandHandler;
  paused : boolean;

  onConnected(){
    var self = this;
    var receiveLoop = function(){
      if(self.paused) return setTimeout(receiveLoop, 500);

      self.getClient().rpoplpush('messaging.queuedcommands','messaging.activecommands',function(error, result){
        if(result){
          var command = JSON.parse(result);
          return self.commandReceiver.handleCommand(command, (error)=>{
            self.getClient().lrem('messaging.activecommands', 0, result,function(error, count){
              if(count !== 1)throw "invalid count " + count;
              receiveLoop();
            });
          });
        }

        setTimeout(receiveLoop, 500);
      });
    };

    receiveLoop();
  }
}

export class RedisEventReceiver extends RedisResource{
  constructor(options: IRedisConnectionOptions, eventReceiver : IEventHandler){
    super(options);
    this.eventReceiver = eventReceiver;
  }

  eventReceiver : IEventHandler;
  paused : boolean;

  onConnected(){
    var self = this;
    var receiveLoop = function(){
      if(self.paused) return setTimeout(receiveLoop, 500);

      self.getClient().rpoplpush('messaging.queuedevents','messaging.activeevents',function(error, result){
        if(result){
          var _event = JSON.parse(result);
          return self.eventReceiver.handleEvent(_event, (error)=>{
            self.getClient().lrem('messaging.activeevents', 0, result,function(error, count){
              if(count !== 1) throw 'invalid "messaging.activeevents" count ' + count;
              receiveLoop();
            });
          });
        }

        setTimeout(receiveLoop, 500);
      });
    };

    receiveLoop();
  }
}

export class RedisCommandBus extends RedisResource implements ICommandHandler{
  constructor(options : IRedisConnectionOptions){
    super(options);
  }

  handleCommand(commandToHandle : IEnvelope<ICommand>, callback: (error)=>void): void{
    var commandSerialized = JSON.stringify(commandToHandle);
    this.getClient().rpush('messaging.queuedcommands', commandSerialized, callback);
  }
}

export class RedisEventBus extends RedisResource implements IEventHandler{
  constructor(options : IRedisConnectionOptions){
    super(options);
  }

  handleEvent(eventToHandle : IEnvelope<IEvent>, callback: (error)=>void): void{
    var eventSerialized = JSON.stringify(eventToHandle);
    this.getClient().rpush('messaging.queuedevents', eventSerialized, callback);
  }
}

export interface IEventSourcedRepository {
  getEventsByAggregateId(id : string, callback : (error : any, events : Array<IVersionedEvent>) => void);
  saveEventsByAggregateId(id : string, events : Array<IVersionedEvent>,  callback: (error: any) => void);
}

export class InMemoryEventSourcedRepository implements IEventSourcedRepository{
  private db : any;

  constructor(){
      this.db = {};
  }

  getEventsByAggregateId(id : string, callback : (error : any, events : Array<IVersionedEvent>) => void){
    if(!this.db[id]) return callback(null,[]);

    var aggregateEvents = this.db[id];
    callback(null,aggregateEvents);
  }

  saveEventsByAggregateId(id : string, events : Array<IVersionedEvent>,  callback: (error: any) => void){
    var aggregateEvents = this.db[id];
    if(!aggregateEvents) aggregateEvents = [];
    aggregateEvents = aggregateEvents.concat(events);
    this.db[id] = aggregateEvents;
    callback(null);
  }
}

export interface IRedisConnectionOptions{
  host:string;
  port:number;
}

export class EventSourceRepositoryWithNotifications implements IEventSourcedRepository{
  constructor(repository: IEventSourcedRepository, onSaveCallback: (id : string, events : Array<IVersionedEvent>)=>void){
    this.repository = repository;
    this.onSaveCallback = onSaveCallback;
  }

  repository : IEventSourcedRepository;
  onSaveCallback: (id : string, events : Array<IVersionedEvent>)=>void;

  getEventsByAggregateId(id : string, callback : (error : any, events : Array<IVersionedEvent>) => void){
    this.repository.getEventsByAggregateId(id,callback);
  }

  saveEventsByAggregateId(id : string, events : Array<IVersionedEvent>,  callback: (error: any) => void){
    var self = this;
    this.repository.saveEventsByAggregateId(id,events,(error)=>{
      if(!error){
        self.onSaveCallback(id,events);
      }

      callback(error);
    });
  }
}

export class RedisEventSourcedRepository extends RedisResource implements IEventSourcedRepository{
  constructor(options : IRedisConnectionOptions){
      super(options);
  }

  getEventsByAggregateId(id : string, callback : (error : any, events : Array<IVersionedEvent>) => void){
    var self = this;
    this.getClient().lrange('eventsourcing.aggregate:' + id,0,-1, function(error, results){
      self.constructResultsResponse(error, results, callback);
    });
  }

  saveEventsByAggregateId(id : string, events : Array<IVersionedEvent>,  callback: (error: any) => void){
    if (!events || events.length === 0) {
      callback(null);
      return;
    }

    var self = this;
    Async.forEachSeries(events, function(versionedEvent : IVersionedEvent, callback : (error:any)=>void){
      var serializedEvent = JSON.stringify(versionedEvent);
      self.getClient().rpush('eventsourcing.aggregate:' + versionedEvent.sourceId, serializedEvent, function(error){
        if(error) return callback(error);
        callback(null);
      });
    },callback);
  }

  private constructResultsResponse(error : any, results : Array<string>, callback : (error: any, results: Array<IVersionedEvent>)=>void){
    if(error) return callback(error,null);

    if (results && results.length > 0) {
        var arr = [];

        results.forEach(function(item) {
            arr.push(JSON.parse(item));
        });

        return callback(null, arr);
    }

    callback(null, []);
  }
}
