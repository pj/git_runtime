declare module 'jsonfile' {
    export function readFile(foo: any): any;
    export function readFileSync(foo: any): any;
}

declare module 'pm2' {
    export function connect(): any;
    export function disconnect(): any;
    export function list(): any;
    export function start(blah: any): any;
    export function stop(): any;
    export function killDaemon(): any;
}

declare interface ObjectConstructor {
    assign(target: any, ...sources: any[]): any;
}
