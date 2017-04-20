console.log(`${process.cwd()}/tmp/`);
require('./config/config');
const {geocode} = require('./geocode/geocode');
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
            cb(null, `${process.cwd()}/tmp/`);
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
app.use(express.static(`${process.cwd()}/tmp/`));

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

app.post('/users/me/propic', upload.single('picture'), authenticate, (req, res) => {
    var file = req.file;
    if (!file) {
        return res.status(400).send();
    }
    Attachment.write({
      filename: file.filename,
      contentType:'image/jpeg'
      },
      fs.createReadStream(`${process.cwd()}/tmp/${file.filename}`),
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
    Attachment.findOne({
        "_id" : id
    },
    (err, file) => {
        if (err) {
            return res.status(400).send(err);
        }
        fileName = file.filename;
        var readStream = Attachment.readById(id);
        var writeStream = fs.createWriteStream(`${process.cwd()}/tmp/${fileName}`);
        readStream.pipe(writeStream);
        res.status(200).sendFile(`${process.cwd()}/tmp/${fileName}`);
    });
});

app.patch('/users/me/location', authenticate, (req, res) => {
    if (!req.body.address) {
        return res.status(400).send();
    }
    var user = req.user;
    geocode(req.body.address, (err, results) => {
        if (err) {
            return res.status(400).send(err);
        } else {
            address = results.address;
            lat = results.latitude;
            lon = results.longitude;
            user.setLocation({
                address, lat, lon
            });
            res.status(200).send({address, lat, lon});
        }
    });
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

app.get('/listings/me', authenticate, (req, res) => {
    Listing.find({
        user: req.user._id
    }).then((listings) => {
        res.status(200).send(listings);
    }).catch((e) => res.status(400).send(e));
});

app.delete('/listings/:id', authenticate, (req, res) => {
    var id = req.params.id;
    if (!ObjectID.isValid(id)) {
        console.log("hello");
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
    if (!ObjectID.isValid(id)) {
        return res.status(404).send();
    }
    var body = _.pick(req.body, ["name", "description", "active", "location"]);
    Listing.findOneAndUpdate({
        _id: id,
        user: req.user._id
    }, {$set: body}, {new: true}).then((listing => {
        if (!listing) {
            return res.status(404).send();
        }
        res.status(200).send(listing);
    })).catch((e) => {
        res.status(400).send();
    });
});

app.get('/users', authenticate, (req, res) => {
    User.find().then((users => {
        var list = [];
        users.forEach((user) => {
            if (user.location.lat) {
                list.push({
                    _id: user._id,
                    location: user.location,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email
                });
            }
        });
        res.status(200).send(list);
    })).catch((err) => {
        res.status(400).send(err);
    });
});

app.get('/listings/:id', authenticate, (req, res) => {
    var id = req.params.id;
    Listing.find({
        user: id
    }).then((listings) => {
        res.status(200).send(listings);
    }).catch((err) => {
        res.status(400).send(err);
    })
});
app.get('/users/:filter', authenticate, (req, res) => {
    var filter = req.params.filter;
    var listings = [];
    Listing.find({
        name: filter
    }, "user", (err, results) => {
        if (err) {
            return res.status(400).send(err);
        }
        results.forEach((result) => {
            listings.push(result);
        });
        var user = [];
        listings.forEach((listing) => {
            User.findById(listing.user, "firstName lastName location email"), (err, result) =>{
                if (err) {
                    res.status(400).send(err);
                }
                users.push(result);
                console.log(users);
            }
        });
        res.status(200).send(users);
    });
});

app.get('/user/:id', authenticate, (req, res) => {
    var id = req.params.id;
    User.findById(id).then((user) => {
        var modified = _.pick(user, ['firstName', 'lastName', 'email', 'location']);
        res.status(200).send(modified);
    }).catch((err) => {
        console.log(err);
        res.status(400).send(err);
    })
});

app.get('/listings/by/:userId', authenticate, (req, res) => {
    var userId = req.params.userId;
    Listing.find({
        user: userId,
        active: true
    }, (err, results) => {
        if (err) {
            return res.status(400).send(err);
        }
        res.status(200).send(results);
    })
})

console.log(process.env.NODE_ENV);
console.log(process.env.MONGODB_URI);


module.exports = {app};