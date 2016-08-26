/**
  * @file Admin functionality for lazy cloud
  */
import * as express from 'express';
import * as cookieParser from 'cookie-parser';
import * as bodyParser from 'body-parser';
import * as expressSession from 'express-session';
import {deploy_commit} from './deploy';

export function create_admin(deployment_path) {
    var admin = express.Router();

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
        res.write("Port: " + process.argv[2] + '\n');
        res.write("Hostname: " + process.argv[4] + '\n');
        res.end();
    });

    /**
      * Used to poll to get deployment status
      */
    admin.ws('/deployment/progress', function(ws, req) {
        var started = false;
        ws.on('message', function(msg) {
            var message_split = msg.split(" ");

            if (message_split.length !== 2) {
                ws.close('ERROR Invalid deploy message');
                return;
            }

            if (message_split[0] !== "DEPLOY") {
                ws.close("ERROR message should be deploy");
                return
            }

            if (!started) {
                var inprogress = deploy_commit(deployment_path, message_split[1]);

                inprogress.on('start', _ => ws.send("STARTED"));
                inprogress.on('end', _ => ws.close("ENDED"));
                inprogress.on('error', err => ws.close("ERROR " + err.toString()));
                inprogress.on('progress', progress => ws.send("PROGRESS " + progress));
                started = true;
            }
        });

       ws.on('error', function (error) {
           console.log("client side error", error);
       });
    });

    return admin;
}
