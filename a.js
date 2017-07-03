var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var	express		=	require('express'),
	siofu 		= 	require("socketio-file-upload")
	// app        	= 	express(),
	fs         	= 	require('fs'),
	server		=	require('http').createServer(app),
    // io			=	require('socket.io').listen(server),
	argv		=	require('optimist').argv,
	phpjs		= 	require('phpjs'),
	Infinity	=	1e90,
	exec 		=	require('child_process').exec,
	Jimp		=	require('jimp'),
	svg2gcode	=	require('./lib/svg2gcode'),
	pic2gcode	=	require('./lib/pic2gcode'),
	serialport	=	require("serialport"),
	Vec2		=	require('vec2'),
	// sleep		=	require('sleep'),
	// sh 			= 	require('execSync'),
	five		=	require("johnny-five"),
	// Galileo		=	require("galileo-io"),
	// Raspi = require('raspi-io');
	// board		=	new five.Board({
	// 				io: new Raspi(),
	// 				repl: false,
	// 				debug: false,
	// 			}),
	// MJPG_Streamer=	require('./lib/mjpg_streamer'),
	// SerialPort	= 	serialport.SerialPort,	
	// serialPort	= 	new SerialPort("/dev/ttyS0", {
	// 				baudrate: 115200,
	// 				parser: serialport.parsers.readline("\n")
	// 			}),
	Deque 		= 	require("double-ended-queue");
var SVGcontent	=	"";

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

io.sockets.on('connection', function(socket){
  console.log('a user connected');
  var uploader = new siofu();
    uploader.dir = "./upload";
    uploader.listen(socket);
	uploader.on("start", function(event) {
		console.log("upload task starts");
		pic2gcode.clear();
		event.file.name = phpjs.str_replace("'", "", event.file.name);
		var file = event.file;
		var fileSize = file.size;
		if (fileSize > argv.maxFileSize) {
			socket.emit("error", {id: 3, message: "MAX FILE FILE is " + (settings.maxFileSize / 1024 / 1024) + "MB"});
			return false;
		}
	});
	var __upload_complete = function(file, content, filepath, isPic) {
		//addQueue(content);
		if (!isPic) {
			sendQueue();
			fs.unlink(filepath);
		} else
			sendImage(socket, filepath);
		if (sendLCDMessage)
			sendLCDMessage("Upload completed" + file.name);
	}
    uploader.on("complete", function(event){
		console.log("upload complete");
        var file = event.file;
		// sh.exec("cd ./upload && find ! -name '" + phpjs.str_replace(['\\', "'", 'upload/'], '', file.pathName) + "' -type f -exec rm -f {} +");		
		var filepath = './' + file.pathName;
		var re = /(?:\.([^.]+))?$/;
		var ext = re.exec(filepath)[1];
		if (ext)
			ext = phpjs.strtolower(ext);
		
		setTimeout(function() {
			SVGcontent = "";
			var isGCODEfile = (ext == 'gcode' || ext == 'sd' || ext == 'txt');
			var isPICfile = (ext == 'jpg' || ext == 'jpeg' || ext == 'bmp' || ext == 'png');
			canSendImage = isPICfile;
			var options = argv;			
			console.log(filepath);
			if (isPICfile) {
				// var imageSize = phpjs.explode("x", sh.exec('./bin/img_size/img_size \'' + filepath + '\'').stdout);
				var width = phpjs.intval(imageSize[0]) / px2mm;
				var height = phpjs.intval(imageSize[1]) / px2mm;
				console.log(width);
				console.log(height);
				if (width > argv.maxCoorX || height > argv.maxCoorY || width == 0 || height == 0) {
					io.sockets.emit('error', {
						id: 4,
						message: phpjs.sprintf('Only accept size less than %d x %d (px x px)', argv.maxCoorX * px2mm, argv.maxCoorY * px2mm)
					});
				} else {
					var image = new Jimp(filepath, function(e, image) {
						if (e) {
							return false;
							fs.unlink(filepath);
						}
						var check = pic2gcode.pic2gcode(image, options, {
							percent:	function(percent) {
								socket.emit("percent", percent);
							},
							complete: function(gcode) {
								__upload_complete(file, gcode, filepath, true);
							}
						});
					});
				}
			} else {
				var content = fs.readFileSync(filepath);
				socket.emit("percent");	
				if (!isGCODEfile) {
					SVGcontent = content.toString();
					content = svg2gcode.svg2gcode(SVGcontent, options, function(percent) {
						
					});
				} else 
					content = content.toString();
				if (ext != 'svg')
					SVGcontent = "";
				
				__upload_complete(file, content, filepath);
			}
		}, file.size / 1024 / 2);
		
    });
	// Error handler:
    uploader.on("error", function(event){
        console.log("Error from uploader", event);
    });

});

http.listen(3000, function(){
  console.log('listening on *:3000');
});