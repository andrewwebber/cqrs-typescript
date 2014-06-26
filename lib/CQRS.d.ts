/// <reference path="node.d.ts" />
/// <reference path="node_redis.d.ts" />
export interface IVersionedEvent {
    version: number;
    name: string;
    sourceId: string;
}
export interface IEventSourced {
    getId(): string;
    getVersion(): number;
    getEvents(): IVersionedEvent[];
}
export declare class EventSourced implements IEventSourced {
    private id;
    private version;
    private events;
    constructor(id: string);
    public getId(): string;
    public getVersion(): number;
    public getEvents(): IVersionedEvent[];
    public loadFromEvents(events: IVersionedEvent[]): void;
    public update(versionedEvent: IVersionedEvent): void;
}
export interface IEventSourcedRepository {
    getEventsByAggregateId(id: string, callback: (error: any, events: IVersionedEvent[]) => void): any;
    saveEventsByAggregateId(id: string, events: IVersionedEvent[], callback: (error: any) => void): any;
}
export declare class InMemoryEventSourcedRepository implements IEventSourcedRepository {
    private db;
    constructor();
    public getEventsByAggregateId(id: string, callback: (error: any, events: IVersionedEvent[]) => void): void;
    public saveEventsByAggregateId(id: string, events: IVersionedEvent[], callback: (error: any) => void): void;
}
export interface IRedisConnectionOptions {
    host: string;
    port: number;
}
export declare class RedisEventSourcedRepository implements IEventSourcedRepository {
    private client;
    constructor(options: any);
    public options: IRedisConnectionOptions;
    public connect(callback: (error: any) => void): void;
    public getEventsByAggregateId(id: string, callback: (error: any, events: IVersionedEvent[]) => void): void;
    public saveEventsByAggregateId(id: string, events: IVersionedEvent[], callback: (error: any) => void): void;
    private constructResultsResponse(error, results, callback);
}
