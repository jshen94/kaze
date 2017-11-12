export type Callback<M> = (param: M) => void;
export type MessageId = number | string;

export type Handler<M> = {
    id: MessageId;
    func: Callback<M>;
    isOnce?: boolean;
    receiver?: any;
}
export type HandlerGroup<M> = Map<Callback<M>, Handler<M>>;

export class MessageHandler<M> {
    map = new Map<MessageId, HandlerGroup<M>>();

    on(handler: Handler<M>): void {
        if (!this.map.has(handler.id)) {
            this.map.set(handler.id, new Map<Callback<M>, Handler<M>>());
        }
        const handlerGroup = this.map.get(handler.id) as HandlerGroup<M>;
        handlerGroup.set(handler.func, handler);
    }

    off(id: MessageId, func: Callback<M>): boolean {
        if (!this.map.has(id)) return false;
        const handlerGroup = this.map.get(id) as HandlerGroup<M>;
        return handlerGroup.delete(func);
    }

    emit(id: MessageId, receiver: any, msg: M) {
        if (!this.map.has(id)) return;
        const handlerGroup = this.map.get(id);
        if (handlerGroup === undefined) return;
        for (const handler of handlerGroup.values()) {
            if (handler.receiver) {
                if (handler.receiver === receiver) {
                    handler.func(msg);
                    if (handler.isOnce) {
                        const result = handlerGroup.delete(handler.func);
                        console.assert(result);
                    }
                }
            } else {
                handler.func(msg);
                if (handler.isOnce) {
                    const result = handlerGroup.delete(handler.func);
                    console.assert(result);
                }
            }
        }
    }
}
