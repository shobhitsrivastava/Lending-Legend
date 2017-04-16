require('./config/config');

const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const {ObjectID} = require('mongodb');
const mongo = require('mongodb');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const mime = require('mime');
const path = require('path');
var storage = multer.diskStorage(
    {
        destination: (req, file, cb) => {
            cb(null, "/tmp/");
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
// app.use(express.static(`tmp/`));

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

// app.post('/multertest', upload.single('testfile'), (req, res) => {
//     var file = req.file;
//     console.log(file);
//     Attachment.write({
//       filename: file.filename,
//       contentType:'image/jpeg'
//       },
//       fs.createReadStream(`./server/uploads/${file.filename}`),
//       function(error, createdFile){
//         if (error) {
//             res.status(400).send(error);
//         }
//         res.status(200).send(createdFile);
//     });
// });

app.post('/users/me/propic', upload.single('picture'), authenticate, (req, res) => {
    var file = req.file;
    if (!file) {
        return res.status(400).send();
    }
    Attachment.write({
      filename: file.filename,
      contentType:'image/jpeg'
      },
      fs.createReadStream(`/tmp/${file.filename}`),
      function(error, createdFile){
        if (error) {
            res.status(400).send(error);
        }
        req.user.setProPic(createdFile);
        res.status(200).send(createdFile);
    });
});

app.get('/users/me/propic', authenticate, (req, res) => {
    var id = req.user.proPic;
    if (!id){
        res.status(404).send("The user has no profile picture");
    }
    var readStream = Attachment.readById(id);
    var writeStream = fs.createWriteStream(`/tmp/${id}`);
    readStream.pipe(writeStream);
    var filePath = path.join(__dirname, "../tmp", `${id}`);
    console.log(filePath);
    res.status(200).sendFile(filePath);
    // Attachment.findOne({
    //     "_id" : id
    // },
    // (err, file) => {
    //     if (err) {
    //         return res.status(400).send(err);
    //     }
    //     fileName = file.filename;
    //     var readStream = Attachment.readById(id);
    //     var writeStream = fs.createWriteStream(`tmp/${fileName}`);
    //     readStream.pipe(writeStream);
    //     // var path = `${__dirname}/uploads/${fileName}`;
    //     // res.status(200).sendFile(path);
    //     res.status(200).send();
    // });
});

app.post('/listings', authenticate, (req, res) => {
    var listing = new Listing({
        user: req.user._id,
        name: req.body.name,
        description: req.body.description,
        active: true
    });
    listing.save().then((doc) => {
        res.send(doc);
    }, (e) => {
        res.status(400).send(e);
    });
});

app.delete('/listings/:id', authenticate, (req, res) => {
    var id = req.params.id;
    if (!ObjectID.isValid(id)) {
        return res.status(404).send();
    }
    Listing.findOneAndRemove({
        _id: id,
        user: req.user._id
    }).then((listing) => {
        if (!listing) {
            console.log("hello");
            return res.status(404).send();
        }
        res.send({listing});
    }).catch((e) => res.status(400).send());
});

app.patch('/listings/:id', authenticate, (req, res) => {
    var id = req.params.id;
    var body = _.pick(req.body, ['description', 'active']);
    if (!ObjectID.isValid(id)) {
        return res.status(404).send();
    }
    if (_.isBoolean(body.completed) && body.completed) {
        body.completedAt = new Date().getTime();
    } else {
        body.completed = false;
        body.completedAt = null;
    }

    Todo.findOneAndUpdate({
        _id: id,
        _creator: req.user._id
    }, {$set: body}, {new: true}).then((todo => {
        if (!todo) {
            return res.status(404).send();
        }
        res.send({todo});
    })).catch((e) => {
        res.status(400).send();
    });
});

console.log(process.env.NODE_ENV);
console.log(process.env.MONGODB_URI);


module.exports = {app};