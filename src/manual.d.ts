//declare module 'commander' {

//}

declare module 'q-io/fs' {
    export function stat(blah: any): any;
    export function read(blah: any): any;
    export function write(foo: any, bah: any): any;
}

declare module 'fs-extra' {
    export function mkdirp(): any;
    export function emptyDir(): any;
    export function writeJSON(name: string, out: any): any;
}

//declare module 'q' {
    //// The type side
    //export type cls = any;
    //// The value side
    //export var cls: any;
//}

declare module 'jsonfile' {
    export function readFile(): any;
}

declare module 'pm2' {
    export function connect(cb: any): any;
    export function disconnect(): any;
    export function list(): any;
    export function start(blah: any, cb: any): any;
    export function stop(): any;
    export function killDaemon(): any;
}

declare interface ObjectConstructor {
    assign(target: any, ...sources: any[]): any;
}
