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
