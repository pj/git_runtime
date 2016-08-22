/**
  * @file Admin functionality for lazy cloud
  */
var express = require('express'),
    cons = require('consolidate'),
    cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
    expressSession = require('express-session');

function create_admin(db) {
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
    admin.get('/deployment/progress/:id', function(req, res){
    });
}
module.exports = admin;
