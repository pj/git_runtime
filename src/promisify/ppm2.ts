/// <reference path="../typings/index.d.ts" />
/// <reference path="../typings/auto.d.ts" />
/// <reference path="manual.d.ts" />
import * as pm2 from 'pm2';
import * as denodeify from 'denodeify';

export const connect = denodeify(pm2.connect);

export const disconnect: any = denodeify(pm2.disconnect);
export const list: any = denodeify(pm2.list);
export const start: any  = denodeify(pm2.start);
//export function start(process_def: any) {
    //return new Promise(function (resolve, reject) {
        //pm2.start(process_def, function (err) {
            //console.log(err);
            //if (err) reject(err);
            //resolve();
        //});
    //});
//}

export const stop: any = denodeify(pm2.stop);
export const deleteProcess: any = denodeify((pm2 as any).delete);
export const killDaemon: any = denodeify(pm2.killDaemon);
