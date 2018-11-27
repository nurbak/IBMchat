//Nur Bakan 761313, Lucas Lawitschka 762365

var express = require('express'), app=express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var db = require( 'ibm_db' );
var md5 = require('md5');
var fs = require('fs');
var async = require('async');
app.enable('trust proxy');
var uuid = require('uuid');
var os = require('os');
var VisualRecognitionV3 = require('watson-developer-cloud/visual-recognition/v3');
var validPic= false;
//ibm
var connStr = 'DRIVER={DB2};' +
    'HOSTNAME=dashdb-txn-sbox-yp-lon02-01.services.eu-gb.bluemix.net;' +
    'PORT=50000;' +
    'DATABASE=BLUDB;' +
    'UID=vfm40570;' +
    'PWD=0b7hhr^qmtmzck5l';


//ibm
let ToneAnalyzerV3 = require('watson-developer-cloud/tone-analyzer/v3');
let bodyParser = require('body-parser');

require('dotenv').config({silent: true});


// Create the service wrapper
let toneAnalyzer = new ToneAnalyzerV3({
    version_date: '2017-09-21',
    username: 'aa9742c6-e129-45be-a628-d51f744e76af',
    password: 'QUzBsczCdB7S',
    url: 'https://gateway-fra.watsonplatform.net/tone-analyzer/api'
});

//Create the service to visual recognition
var visualRecognition = new VisualRecognitionV3({
    version: '2018-03-19',
    url: 'https://gateway.watsonplatform.net/visual-recognition/api',
    iam_apikey: 'SSBJQrmUc222Yc0jI5n6PMgcMnSEDIoiF5A4uxNs6b0o',
    use_unauthenticated: false
});

//Redirecting to https if not secure
app.use (function (req, res, next) {
    if (req.secure || process.env.BLUEMIX_REGION === undefined) {
        next();
    } else {
        console.log('redirecting to https');
        res.redirect('https://' + req.headers.host + req.url);
    }
});

jdbc:db2://dashdb-txn-sbox-yp-lo
//All username of the connected users
var usernames= {};
var moods= {};

//Direction where it starts to search for a file
var publicDir = require('path').join(__dirname);
app.use(express.static(publicDir));
app.use(bodyParser.json());

//multer for multimedia upload
const multer= require('multer');
var path = require('path');

//Option where the uploaded files will be saved and with what name
var storageOptions = multer.diskStorage({
    destination: function(req, file, callback) {
        callback(null, 'public/uploads');
    },

    filename: function(req, file, callback) {
        var fname = file.fieldname + '-' + Date.now() + path.extname(file.originalname);

        callback(null, fname);

    }
});

//complete multer var for the upload
var upload = multer({storage : storageOptions});


/**
 * when a user conntects to the server it will direct him to the index.html.
 */
app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});


/**
 * This function is called when someone wants to share a file with the chat.
 * It can upload and share sounds, images and videos. If the sender wants to whisper to
 * someone he needs to pick it in the option before sending the file. Then it will only send the file
 * to the user he wants it to whisper to.
 * @param req stores the information of the file.
 */
app.post('/upload', upload.any(), function upload(req, res, next){
    var ending = (req.files[0].path).split(".")[(req.files[0].path).split(".").length-1];
    if(req.body.selectall === "1. Send it to everyone") {
        if (ending === "jpg" || ending === "jepg" || ending === "png")
            io.sockets.emit('img upload', {file: req.files[0].path})
        if (ending === "mp4")
            io.sockets.emit('video upload', {file: req.files[0].path})
        if (ending === "mp3" || ending === "mpeg")
            io.sockets.emit('sound upload', {file: req.files[0].path})
    }
    else{
        var name = req.body.selectall.substr(req.body.selectall.indexOf(" "));
        name = name.trim();

        console.log(name);

        if(name in usernames){
            if (ending === "jpg" || ending === "jepg" || ending === "png")
                usernames[name].emit('img upload', {file: req.files[0].path});
            if (ending === "mp4")
                usernames[name].emit('video upload', {file: req.files[0].path});
            if (ending === "mp3" || ending === "mpeg")
                usernames[name].emit('sound upload', {file: req.files[0].path});
        }
    }
});



//Its the port. You can access the server on port 3000.
server.listen(process.env.PORT || 3000);
console.log('Server running...');




/**
 * Function is called when someone connects with the Server
 */
io.sockets.on('connection', function(socket){
    console.log('Socket Connected...');

    /**
     *    Function is called when someone wants to send a chat message.
     *    Furthermore the message will be analyze if the sender wants to send a normal message
     *    or wants to whisper to someone ("/w [name]"). If the message is "/list" it will open a list
     *    of all users. "/listoff" will close the user list.
     *    An error gets send back when the username doesnt exits or
     *    when a user tries to whisper without a message.
     *
     *    @param data stores the message. "/w " to whisper. "/list" to open the list. "/listoff" to close the list.
     */
    socket.on('send message', function(data,callback){
        var msg= data.trim();
        if(msg.substr(0,3)=== '/w '){
            msg= msg.substr(3);
            var ind= msg.indexOf(' ');
            console.log(ind);
            if(ind !== -1){
                var name= msg.substr(0,ind);
                var msg= msg.substr(ind+1);

                if(name in usernames){
                    usernames[name].emit('whisper',{msg: msg, user: socket.username});
                    console.log('private');
                }else{
                    callback('Error enter a valid user!');
                }
            }else{
                callback('Error please enter a message for your whisper.')
            }

        }else if(msg === '/list'){
            socket.emit('liston');

        }else if(msg === '/listoff') {
            socket.emit('listoff');
        }
        else{


            var toneParams = {
                'tone_input': {'text': msg},
                'content_type': 'application/json'
            }

            toneAnalyzer.tone(toneParams, (err, response) => {
                var mood = "";
                if (err) {
                    console.log(err);
                } else {
                    if (!(response.document_tone.tones[0] == null)) {
                        mood = response.document_tone.tones[0].tone_id;
                        socket.mood = mood;
                        updateUsernames();
                    }
                }
            });
            io.sockets.emit('new message',{msg: msg, user: socket.username});
        }

    });



    /**
     *  Function is called when a new user logins in with a username. If the username
     *  is already taken its send a error back. Otherwise it stores the username in the server
     *  by updating the username-list.
     *  @param data stores the username.
     */
    socket.on('new user', function(data, pw, pic, callback){
       // var regexp = /[a-zA-Z]/gi;
        var regexp2 = /\W/;
        let hashed = md5(pw); //34feb914c099df25794bf9ccb85bea72


       detectFace(pic).then((result)=>{
           if(validPic) {

               if(data in usernames || (regexp2.test(data))){
                   callback(false);
               }else{

                   callback(true);
                   socket.username = data;
                   socket.passwort = hashed;
                   socket.pic = pic;
                   socket.mood = "Normal    ";
                   usernames[socket.username] = socket;
                   io.sockets.emit('user connect', data);
                   updateUsernames();

                   db.open(connStr, function (err,conn) {
                       if (err) return console.log(err);

                       var sql = "INSERT INTO PASSWORT (UNAME, PASSWORT) VALUES ('"+socket.username +"', '"+ socket.passwort + "')";
                       console.log(sql);

                       conn.query(sql, function (err, data) {
                           if (err) console.log(err);
                           else console.log(data);

                           conn.close(function () {
                               console.log('done');
                           });
                       });
                   });

               }

           }
           else{
               callback(false);
           }

       })
           .catch((error) =>
               callback(false)
           );


    });


    /**
     * Function is called when someone exits from the chat and deletes the username from the server
     * by updating the username-list.
     */
    socket.on('disconnect', function () {
        console.log(socket.username + " wants to leave");
        if(!socket.username) {
            return;
        }
        io.sockets.emit('user disconnect', socket.username);
        delete usernames[socket.username];
        updateUsernames();
    })

    socket.on('moods', function(data){
        socket.mood =data;
        updateUsernames();
    });

    /**
     * Updates the username list after someone connects to or disconnects from the chat.
     */
    function updateUsernames(){
        let moods= {};
        let pics= {};
        let i = 0;
        for (let name in usernames) {
            moods[i] = usernames[name].mood;
            pics[i] = usernames[name].pic;
            i++;
        }

        io.sockets.emit('usernames', {names: Object.keys(usernames), moods: moods, pics: pics});
    };

    function detectFace(img) {
        return new Promise(function (resolve, reject) {
            var params = {
                images_file: null
            };
            // write the base64 image to a temp fil
            var temp = path.join('public/uploads/' + img);
            params.images_file = fs.createReadStream(temp);

            var methods = [];
            params.threshold = 0.5; //So the classifers only show images with a confindence level of 0.5 or higher
            methods.push('detectFaces');
            async.parallel(methods.map(function (method) {
                var fn = visualRecognition[method].bind(visualRecognition, params);
                return async.reflect(async.timeout(fn, 40000));
            }), function (err, results) {
                // combine the results
                results.map(function (result) {
                    if (result.value && result.value.length) {
                        result.value = result.value[0];
                    }
                    if (result.value["images"][0]["faces"].length > 0) {
                        validPic = true;
                        console.log("GESICHT");
                        resolve(true);
                    } else {
                        validPic = false;
                        console.log("KEIN GESICHT!");
                        reject(false);
                    }
                    return result;
                })
            });
        });
    }

});
