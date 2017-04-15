require('./config/config');

const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const {ObjectID} = require('mongodb');
const mongo = require('mongodb');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const mime = require('mime');
var storage = multer.diskStorage(
    {
        destination: (req, file, cb) => {
            cb(null, "server/uploads/");
        }, filename: (req, file, cb) => {
            cb(null, file.fieldname + '-' + Date.now() + '.' + mime.extension(file.mimetype));
        }
    }
);
var upload = multer({ storage: storage });
const fs = require('fs');


var {mongoose} = require('./db/mongoose.js');
var {User} = require('./models/user');
var {Listing} = require('./models/listing');
var {authenticate} = require('./middleware/authenticate');
//instantiate mongoose-gridfs
var gridfs = require('mongoose-gridfs')({
  collection:'attachments',
  model:'Attachment'
});

//obtain a model
Attachment = gridfs.model;

var app = express();

const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(`./server/uploads/`));

app.listen(port, () => {
    console.log(`Started on port ${port}`);
});

app.post('/users', (req, res) => {
    var body =_.pick(req.body, ['email', 'firstName', 'lastName', 'password']);
    var user = new User(body);
    user.save().then(() => {
        return user.generateAuthToken();
    }).then((token) => {
        res.header('x-auth', token).send(user);
    }).catch((e) => {
        res.status(400).send(e);
    });
});

app.post('/users/login', (req, res) => {
    var body = _.pick(req.body, ['email', 'password']);
    User.findByCredentials(body.email, body.password).then((user) => {
        return user.generateAuthToken().then((token) => {
            res.header('x-auth', token).send(user);
        });
    }).catch((e) => {
        res.status(400).send();
    });
});

app.delete('/users/me/token', authenticate, (req, res) => {
    req.user.removeToken(req.token).then(() => {
        res.status(200).send();
    }, () => {
        res.status(400).send();
    })
});

app.post('/multertest', upload.single('testfile'), (req, res) => {
    var file = req.file;
    console.log(file);
    Attachment.write({
      filename: file.filename,
      contentType:'image/jpeg'
      },
      fs.createReadStream(`./server/uploads/${file.filename}`),
      function(error, createdFile){
        if (error) {
            res.status(400).send(error);
        }
        res.status(200).send(createdFile);
    });
});

app.post('/users/me/propic', upload.single('picture'), authenticate, (req, res) => {
    var file = req.file;
    req.user.setProPic(file);
    res.status(200).send();
});

app.get('/users/me/propic', authenticate, (req, res) => {
    var fileName = req.user.proPic;
    if (!fileName){
        res.status(404).send();
    }
    var path = `${__dirname}/uploads/${fileName}`;
    res.status(200).sendFile(path);
});



console.log(process.env.NODE_ENV);
console.log(process.env.MONGODB_URI);


module.exports = {app};