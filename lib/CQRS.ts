export interface IVersionedEvent{
  version : number;
  name : string;
  sourceId : string;
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
