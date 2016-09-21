/// <reference path="../../typings/index.d.ts" />
/// <reference path="../../typings/auto.d.ts" />
/// <reference path="../manual.d.ts" />
import {Server as WebSocketServer} from 'ws';
import * as database from './database';

function generate_result(result, status=0, message="") {
    return {
        status: status,
        message: message,
        result: result
    };
}

function process_message(snapshots, message) {
    switch (message.operation) {
        case "get":
            let result = database.get_item(snapshots, message.id, message.version_id,
                                      message.transaction_id);
            return [snapshots, result];
        case "update":
            return [database.update_item(snapshots, message.item_id,
                                    message.version_id,
                                    message.transaction_id,
                                    message.data), null];
        case "delete":
            return [database.delete_item(snapshots, message.item_id,
                                    message.version_id,
                                    message.transaction_id), null];
        case "create":
            return database.create_item(snapshots,
                                   message.version_id,
                                   message.transaction_id,
                                   message.data);
        case "find":
            return database.find_items(snapshots,
                                 message.project,
                                 message.select,
                                 message.reduce,
                                 message.version_id,
                                 message.transaction_id);
        // start transaction.
        case "begin":
            return database.begin_transaction(snapshots, message.snapshot_id);
        // commit transaction.
        case "commit":
            return [database.commit_transaction(snapshots, message.transaction_id), null];
        // rollback transaction.
        case "rollback":
            return [database.rollback_transaction(snapshots, message.transaction_id), null];
        case "create_snapshot":
            return database.create_snapshot(snapshots);
        case "delete_snapshot":
            return [database.delete_snapshot(snapshots, message.snapshot_id), null];
        // add a new git version to current snapshot.
        case "create_version":
            return [database.create_version(snapshots, message.commit_id,
                                            message.parent_commit_id), null];
        }
}

function handle_message(ws, state, message) {
    if (message.transaction_id) {
        state.current_transaction_id = message.transaction_id;
    }
    try {
        let [new_snapshots, result] = process_message(state.transshots, message);
        state.transshots = new_snapshots;
        ws.send(generate_result(result));
    } catch(e) {
        console.error(e);
        ws.close(1011, generate_result(e.stack, 1, e.toString()))
    }
}

export function create_server(port=9876) {
    let state = {
        current_transaction_id: null,
        transshots: new Map()
    }
    const wss = new WebSocketServer({ port: port });
    wss.on('connection', function connection(ws) {
        ws.on('message', function (raw_message) {
            let message = JSON.parse(raw_message);
            if (state.current_transaction_id === null || (message.transaction_id && message.transaction_id === state.current_transaction_id)) {
                handle_message(ws, state, message);
            } else {
                let times = 0;
                let transaction_interval = setInterval(function (){
                    if (state.current_transaction_id === null) {
                        handle_message(ws, state, message);
                    } else if(times > 5) {
                        ws.close(1013, "Timed out waiting for transaction to complete");
                    } else {
                        times += 1;
                    }
                }, 100);
            }
        });

        ws.on('error', function (error) {
            console.error(error);
        });

        ws.on('close', function (code, message) {
            if (code != 1000) {
                console.error(`connection closed with error: ${code} ${message}`);
            } else {
                console.log(`connection closed with: ${code} ${message}`);
            }
        });
    });

    wss.on('error', function (error){
        console.error(error);
    });
}
