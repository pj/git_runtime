/**
  * @file Admin functionality for lazy cloud
  */
import * as express from 'express';
import * as cookieParser from 'cookie-parser';
import * as bodyParser from 'body-parser';
import * as expressSession from 'express-session';
import {deploy_commit} from './deploy';

export function create_admin(deployment_path, base_hostname) {
    var admin: any = express.Router();

    admin.use(cookieParser());
    admin.use(bodyParser.urlencoded({ extended: false }));
    admin.use(bodyParser.json());
    admin.use(expressSession({
      secret: 'L4ZY CL0UD',
      resave: false,
      saveUninitialized: true
    }))

    admin.get('/', function(req, res){
        res.write("Hello from the lazy cloud server admin!\n");
        res.write("Port: " + process.argv[4] + '\n');
        res.write("Hostname: " + process.argv[5] + '\n');
        res.end();
    });

    admin.get('/heartbeat', function(req, res){
        res.json({'alive':true});
        res.end();
    });

    admin.ws('/deployment/progress', function(ws, req) {
        var started = false;
        ws.on('message', function(msg) {
            var message_split = msg.split(" ");

            if (message_split.length !== 2 && message_split[0] !== "DEPLOY") {
                ws.close(1003, 'ERROR Invalid deploy message');
                return;
            }

            if (!started) {
                var inprogress = deploy_commit(deployment_path, base_hostname, message_split[1]);

                inprogress.on('start', function () {
                    ws.send("STARTED");
                });
                inprogress.on('end', _ => ws.close(1000, "ENDED"));
                inprogress.on('error', function(err){
                    console.error(err);
                    ws.close(1003, "ERROR " + err.toString());
                });
                inprogress.on('progress', function(progress) {
                    ws.send("PROGRESS " + progress);
                });
                started = true;
            }
        });

       ws.on('error', function (error) {
           console.log("client side error", error);
       });
    });

    return admin;
}
