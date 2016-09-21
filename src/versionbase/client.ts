/// <reference path="../../typings/index.d.ts" />
/// <reference path="../../typings/auto.d.ts" />
/// <reference path="../manual.d.ts" />
let web_socket = require('ws');
let uuid = require('uuid');
let q = require('q');

export class Connection {
    ws: any
    active_defereds: any
    transaction_id: any
    constructor(ws) {
        this.ws = ws;
        this.active_defereds = {};
        this.transaction_id = null;
    }

    createPromise() {
        let deferred_id = uuid.v4();

        let deferred = q.defer():
        this.active_defereds[deferred_id] = deferred;

        return [deferred_id, deferred.promise];
    }

    static connect(url = "localhost", port=9876) {
        let ws = web_socket.WebSocket(`ws://${url}:${port}`);

        let connection = new Connection(ws);
        let [connection_id, connection_promise] = connection.createPromise();

        ws.on("open", function() {
            connection.active_defereds[connection_id].resolve(connection);
        });

        ws.on("message", function (raw_message){
            let message = JSON.parse(raw_message);

            if (message.hasOwnProperty("message_id")) {
                let message_deferred = connection.active_defereds[message.message_id];

                if (message_deferred) {
                    message_deferred.resolve(message.result);
                    delete connection.active_defereds[message.message_id];
                } else {
                    throw new Error("Server sent a response with a message_id that doesn't exist.");
                }
            } else {
                throw new Error("Server sent a response without a message_id.");
            }
        });

        ws.on("close", function (code, raw_message) {
            if (code === 1000) {
                let message = JSON.parse(raw_message);

                if (message.hasOwnProperty("message_id")) {
                    let message_deferred = connection.active_defereds[message.message_id];

                    if (message_deferred) {
                        message_deferred.resolve(message.result);
                        delete connection.active_defereds[message.message_id];
                    } else {
                        throw new Error("Server sent a response with a message_id that doesn't exist.");
                    }
                } else {
                    throw new Error("Server sent a response without a message_id.");
                }
            } else {
                throw new Error(`code: ${code} message: ${raw_message}`);
            }
        });

        ws.on("error", function (error) {
            throw error;
        });

        return connection_promise;
    }

    disconnect(connection) {
        let [message_id, promise] = this.createPromise();
        connection.ws.close(1000, {message_id: message_id, operation: "close"});
        return promise;
    }

    sendRequest(operation, values) {
        let [message_id, promise] = this.createPromise();
        let message: any = {message_id: message_id, operation: operation};
        if (process.env.LAZY_CLOUD_COMMIT_ID) {
            message.version_id = process.env.LAZY_CLOUD_COMMIT_ID;
        } else {
            throw new Error("LAZY_CLOUD_COMMIT_ID environment variable must be set.");
        }
        if (this.transaction_id) {
            message.transaction_id = this.transaction_id;
        }
        Object.assign(message, values);
        this.ws.send(JSON.stringify(message));
        return promise;
    }

    get(item_id) {
        return sendRequest("get", {item_id: item_id});
    }

    create(data) {
        return sendRequest("create", {data: data});
    }

    update(item_id, data) {
        return sendRequest("update", {item_id: item_id, data: data});
    }

    delete(item_id) {
        return sendRequest("delete", {item_id: item_id});
    }

    find(connection) {

    }

    async begin(snapshot_id) {
        if (this.transaction_id) {
            throw new Error("Transaction already started.");
        }
        if (snapshot_id) {
            var message = {snapshot_id: snapshot_id};
        } else {
            var message = {};
        }
        this.transaction_id = await sendRequest("begin", message);

        await Promise.resolve(this.transaction_id);
    }

    async commit() {
        await sendRequest("commit");
        this.transaction_id = null;
        await Promise.resolve();
    }

    rollback() {
        await sendRequest("rollback");
        this.transaction_id = null;
        await Promise.resolve();
    }

    async transact(func, snapshot_id) {
        await this.begin(snapshot_id);

        try {
            await func();
            await this.commit();
        } catch (e) {
            await this.rollback();
            throw e;
        }
    }

    snapshot() {
        return sendRequest("create_snapshot");
    }

    delete_snapshot(snapshot_id) {
        return sendRequest("delete_snapshot", {snapshot_id: snapshot_id});
    }
}
