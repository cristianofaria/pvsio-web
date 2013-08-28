#!/usr/bin/env node

/**
 * This file creates a connection to a pvsio process run locally or at specified host.
 * It also creates an express webserver to serve demo applications e.g. the infusion 
 * pump pvsio demo.
 * The websocket connection started by this process listens for 3 commands:
 * sendCommand: used to send a pvsio command to the processs
 * startProcess: used to start the pvsio process
 * getSourceCode: used to get the source code of the pvs code being executed
 * @author patrick
 * @date 28 Jul 2012 21:52:31
 * @updated Cristiano Faria
 * @date Aug 2013
 */

var pvsio = require("./pvsprocess"),
	wsbase = require("./websocketserver"),
    easyimg = require('easyimage'),
	util = require("util"),
	args = require("optimist")
			.usage("Start a PVSIO process")
			.alias({"host":"h", "workspace":"w", "port":"p"})
			.default({"host":"0.0.0.0", "port":"8080", "workspace":__dirname + "/public"})
			.demand(["host","workspace", "port"])
			.describe({"host":"The IP address to bind the server to - defaults to 0.0.0.0 to listen on all addresses",
						"port":"The port to listen at - defaults to 8080",
						"workspace":"The base directory of all your pvs source code."})
			.argv;
var http = require("http");
var fs = require("fs");
var express = require('express');
var webserver = express();
var procWrapper = require("./processwrapper");
var uploadDir = "/public/uploads";
var host = args.host, port = args.port, workspace = args.workspace;
var pvsioProcessMap = {};//each client should get his own process

var httpServer = http.createServer(webserver);
var p;
	
	//create the express static server and use public dir as the default serving directory
	webserver.use(express.static(__dirname + "/public"));
	webserver.use(express.bodyParser({ keepExtensions: true, uploadDir: __dirname + uploadDir}));

	//add image upload path
	webserver.all("/uploadfile", function(req, res){
		util.log(JSON.stringify(req.files));
		var fileName = req.files.file.path.split("/").slice(-1).join("");
		res.send({fileName:fileName});
	});
	
	webserver.all("/saveWidgetDefinition", function(req, res){
		var fileName = __dirname + "/public/projects/" + req.body.fileName, 
			fileContent = req.body.fileContent;
		fs.writeFile(fileName, fileContent, function(err){
			if(err){
				console.log(err);
				res.send({error:"Problem saving widget definition file", err:err});
			}else{
				res.send({success:"file saved", fileName:fileName});
			}
		});
	});
	
	webserver.all("/typecheck", function(req, res){
		//var file = req.body.file;
        var projectPath = __dirname + "/public/projects/" + req.body.projectName;
        var config = fs.readFileSync(projectPath + "/config.conf", "utf8");
        var fileName = config.split("|")[1].split(":")[1];
        var file = projectPath + "/" + fileName;
		procWrapper().exec({command:"proveit "  + file, 
			callBack:function(err, stdout, stderr){
				res.send({err:err, stdout:stdout, stderr:stderr});
			}
		});
	});
	
	webserver.all("/newProject", function(req, res){
		var pvsSpecName = req.files.pvsSpec.name;
        var pvsSpecFullPath = req.files.pvsSpec.path;
        var imageFullPath = req.files.prototypeImage.path;
		var prototypeImage = imageFullPath.split("/").slice(-1).join("");
		req.body.pvsSpecNameUpload = pvsSpecFullPath.split("/").slice(-1).join("");
        req.body.pvsSpecName = pvsSpecName;
		req.body.prototypeImage = prototypeImage;
		createProject(req, res);		
	});
	
	webserver.all("/openProject", function(req, res){
		var projects = listProjects();
		res.send(projects);
	});

    /*@Cristiano Faria
    *Get project pvs files
    */
    webserver.all("/getPvsFiles", listPVSFiles);
	
	webserver.all("/createProject", createProject);

    webserver.all("/openFileCode", openFileCode);

	webserver.all("/saveTempFile", saveTempFile);

    webserver.all("/saveCurrentFile", saveCurrentFile);
    
    webserver.all("/saveConfigFile", saveConfigFile);

/*@Cristiano Faria
 *Crop Image
 */
    webserver.all("/cropImage", function(req,res){
        var projectPath = __dirname + "/public/projects/" + req.body.projectName + "/";
        var imageType = req.body.image.split(".")[1];
        var imageSrc = projectPath + "image."+imageType;
        var imageDst = projectPath + "image."+imageType;
        var cropx = req.body.x;
        var cropy = req.body.y;
        var width = req.body.width;
        var height = req.body.height;
        var response = {
            "err": null,
            "success": null
        };
// Crop image
        easyimg.crop(
            {
                src:imageSrc, dst:imageDst,
                cropwidth:width, cropheight:height,
                gravity:'NorthWest',
                x:cropx, y:cropy
            },
            function(err, stdout, stderr) {
                if (err) {
                    response.err = err;
                    throw err;
                }else{
                    response.success = "Crop succefully done";
                    console.log('Cropped');
                }
            }
        );
        res.send(response);
    });

/*@Cristiano Faria
 *Resize Image
 */
webserver.all("/resizeImage", function(req,res){
    var projectPath = __dirname + "/public/projects/" + req.body.projectName + "/";
    var imageSrc = projectPath + req.body.image;
    var imageDst = projectPath + req.body.image;
    var width = req.body.width;
    var height = req.body.height;
    var response = {
        "err": null,
        "success": null
    };
//  Resize image
    easyimg.resize({src:imageSrc, dst:imageDst, width:width, height:height}, function(err, stdout, stderr) {
        if (err) {
            response.err = err;
            throw err;
        }else{
            response.success = "Resize succefully done";
            console.log('Cropped');
        }
        console.log('Resized to '+ width +'x' + height);
    });
    res.send(response);
});

    webserver.all("/importFile", function(req,res){
        var pvsSpecName = req.files.pvsSpec.name;
        var pvsSpecFullPath = req.files.pvsSpec.path;
        var projectName =  req.body.projectName;
        req.body.pvsSpecNameUpload = pvsSpecFullPath.split("/").slice(-1).join("");
        req.body.projectName = projectName;
        req.body.pvsSpecName = pvsSpecName;
        saveImportFile(req, res);
    });

/*@Cristiano Faria
 *Create/save a New File .pvs
 */
    webserver.all("/newFile", function(req,res){
        var response = {type:"newFileCreated"};
        var fileName = req.body.fileName;
        var pvsFileName = fileName.split(".pvs")[0] + ".pvs";
        var projectName = req.body.projectName;
        var projectPath = __dirname + "/public/projects/" + projectName;
        try{
            if(fs.existsSync(projectPath + "/" + pvsFileName)){
                response.err = "File with the same name exists. Please choose a different name. Old file name was " + pvsFileName;
            }else{
                //Create a file and save with a default source code
                var sourceCode = pvsFileName+": THEORY \r\n BEGIN \r\n \r\n END "+pvsFileName;
                fs.writeFileSync(projectPath + "/" + pvsFileName, sourceCode);
                util.log(pvsFileName + " file has been created and saved.");
                //var sourceCode = fs.readFileSync(projectPath + "/" + pvsFileName,'utf8');
                var obj = {};
                obj.name = pvsFileName;
                obj.source = sourceCode;
                response.data = obj;
            }
        }catch(err){
            response.err = err;
        }
        res.send(response);
    });
/*@Cristiano Faria
 *modified, to include the config file.
 */
	function listProjects(){
		var imageExts = "jpg,jpeg,png".split(","),
			confExts = ["conf"],
			specExts = ["pvs"];
		var projectDir = __dirname + "/public/projects/";
		var res = fs.readdirSync(projectDir).map(function(d, i){
			var p = {name:d, projectPath:projectDir + d, other:[]};
			var stat = fs.statSync(projectDir + d);
			if(stat.isDirectory()){
				p.spec="";
				p.specMain="";
				fs.readdirSync(projectDir + d).forEach(function(f){
					stat = fs.statSync(projectDir + d + "/" + f);
					if(stat.isFile()){
						var ext = f.indexOf(".") > -1 ? f.split(".")[1].toLowerCase() : "";
						if(imageExts.indexOf(ext) > -1){
							p.image = f;
							p.imageFullPath = projectDir + d + "/" + f;
						}else if(specExts.indexOf(ext) > -1){
							p.spec = p.spec + f + "|";
							//p.specFullPath = projectDir + d + "/" + f;
							//console.log("specs" + p.spec);
						}
						else if(f === "widgetDefinition.json") {
							p.widgetDefinition = JSON.parse(fs.readFileSync(projectDir + d + "/" + f, "utf8"));
						}
						else if(confExts.indexOf(ext) > -1) {
							p.conf = f;
							p.confFullPath = projectDir + d + "/" + f;
							var fileText = fs.readFileSync(projectDir + d + "/" + f, "utf8");
							//console.log("texto do file "+fileText);
							if (fileText !== ""){
								var linhas = fileText.split("|");
								if (linhas.length==2){
									p.imageMain = linhas[0].split(":")[1];
									p.imageFullPathMain = projectDir + d + "/" + p.image;
									p.specMain = linhas[1].split(":")[1];
									p.specFullPathMain = projectDir + d + "/" + p.spec;
									var source = fs.readFileSync(projectDir + d + "/" + p.specMain, "utf8");
									if (source !== null){
										p.specMainSource = source;
									}
								}else{
									p.specMain = "";
								}
							}
							console.log("config added");
						}else{
							p.other.push(f);
						}
					}
				});
				return p;
			}else{
				return null;
			}
		}).filter(function(d){return d!== null;});
		return res;
	}
	httpServer.listen(8081);


	
var wsServer = wsbase("PVSIO")
	.bind("sendCommand", function(token, socket, socketid){
		p = pvsioProcessMap[socketid];
		p.sendCommand(token.data.command);
	}).bind("startProcess", function(token, socket, socketid){
		util.log("Calling start process for client... " + socketid);
		p = pvsioProcessMap[socketid];
		if(p){
			p.close();
			delete pvsioProcessMap[socketid];
		}
		//create the pvsio process
		p = pvsio();
		//set the workspace dir and start the pvs process with a callback for processing any responses from
		//the process
		p.workspaceDir(__dirname + "/public/projects/" + token.data.projectName)
		.start(token.data.fileName, function(tok){
			//called when any data is recieved from pvs process
			//if the type of the token is 'processExited' then close the socket if it is still open
			tok.socketId = socketid;
			processCallback(tok, socket);
		});
		//add to map
		pvsioProcessMap[socketid] = p;
		
		//hsndle close event of socket to release resources
		socket.on("close", onsocketClose(socketid));
		
		/**
		 * handler for socket closed event
		 * @param sid
		 * @returns
		 */
		function onsocketClose(sid){
			return function(e){
				util.log("closing websocket client " + sid);
				p = pvsioProcessMap[sid];
				if(p)
					p.close();
				delete pvsioProcessMap[sid];
			};
		}
		
	}).bind("getSourceCode", function(token, socket, socketid){
		p = pvsioProcessMap[socketid];
		p.getSourceCode(function(res){
			socket.send(JSON.stringify(res));
		});
	}).bind("saveSourceCode", function(token, socket, socketid){
		p = pvsioProcessMap[socketid];
		p.saveSourceCode(token.data, function(token){
			//sourcecode has been saved so restart the server
			if(token.type === "sourceCodeSaved") {
				util.log("Source code has been saved. Closing process ... " + socketid);
				p.close();
				delete pvsioProcessMap[socketid];
				socket.send(JSON.stringify(token));
			}else{
				socket.send(JSON.stringify(token));
			}
		});
	})/*.bind("createProject", function(token, socket, socketid){
		createProject(token, socket);
	}).bind("saveTempFile", function(token, socket, socketid){
		saveTempFile(token, socket);
	})*/;
	
//set the port
wsServer.port  = port;
wsServer.start({server:httpServer});	


	function processCallback(tok, socket){
		//called when any data is recieved from pvs process
		//if the type of the token is 'processExited' then send message to client if the socket is still open
		if(tok.type === 'processExited') {
			if(socket.readyState === 1)
				socket.send(JSON.stringify(tok));
		}else{//send the message normally
			socket.send(JSON.stringify(tok));
		}
	}
	
	/**
	 * save the file described in request parameter into the uploads directory
	 * @param req
	 * @param res
	 * @returns
	 */
	function saveTempFile(req, res){
		var fileContent = req.body.fileContent;
		var fileName = req.body.newFileName;
		var oldFileName = req.body.oldFileName, oldFilePath = __dirname + uploadDir + "/" + oldFileName;
		var destName = __dirname + uploadDir + "/" + fileName;
		if(fileContent && fileName){
			fs.writeFileSync(destName, fileContent);
		}else if(oldFileName && fileName){
			fs.renameSync(oldFilePath, destName);
		}
		
		res.send({fileName: fileName});
	}
	
	/**
	 * 
	 * @param req
	 * @param res
	 * @returns
	 */
/*@Cristiano Faria
 *modified, to include the config file.
 */
	function createProject(req, res){
		var pvsFileName = req.body.pvsSpecName, pvsSpecFullPath = __dirname + uploadDir + "/" + req.body.pvsSpecNameUpload;
		var projectName = req.body.projectName;
		var prototypeImage = req.body.prototypeImage;
		var imageFullPath = __dirname + uploadDir + "/" + prototypeImage;
		util.log(JSON.stringify(req.body));
		var projectPath = __dirname + "/public/projects/" + projectName;
		var response = {type:"projectCreated"};
		try{
			if(fs.existsSync(projectPath)){
				response.err = "Project with the same name exists. Please choose a different name. Old project name was " + projectPath;
			}else{
				//create a project folder
                var imageName = "image." + prototypeImage.split(".")[1];
				fs.mkdirSync(projectPath);
				fs.renameSync(imageFullPath, projectPath + "/image." + prototypeImage.split(".")[1]);
				//copy sourcecode to the project directory
				var data = fs.readFileSync(pvsSpecFullPath,'utf8');
				fs.writeFileSync(projectPath + "/" + pvsFileName, data);
				var obj = {};
				obj.image = "image." + prototypeImage.split(".")[1];
				obj.projectPath = projectPath;
				obj.imageFullPath = obj.projectPath + "/" + obj.image;
				obj.name = projectName;
                obj.spec = pvsFileName;
                obj.specFullPath = obj.projectPath + "/" + obj.spec;
				obj.sourceCode = data;

                util.log("Source code has been saved.");
				response.data = obj;
                var configFileName = "config.conf";
                var configFileSource = "imageMain:"+ imageName + "|specMain:" + pvsFileName;
                fs.writeFileSync(projectPath + "/" + configFileName, configFileSource);
			}
		}catch(err){
			response.err = err;
		}
		var result = JSON.stringify(response);
		util.log(result);
		res.send(response);
		
	}

/*@Cristiano Faria
 *The objective is to take/list all pvs files from the current project
 */
    function listPVSFiles(req, res){

        var currentProject = req.body.projectName;

        console.log("projecto: " + currentProject);
        var specExts = ["pvs"];
        //var fileDir = __dirname + "/public/projects/AlarisGH_AsenaCC"; //takes the directory path of the current project
        var fileDir = __dirname + "/public/projects/" + currentProject; //takes the directory path of the current project
        var response;
        response = fs.readdirSync(fileDir).map(function(f, i){ //This is for map the files into the dir
            stat = fs.statSync(fileDir + "/" + f);//selecting a element
            if(stat.isFile()){
                var ext = f.indexOf(".") > -1 ? f.split(".")[1].toLowerCase() : "";

                if(specExts.indexOf(ext) > -1){ //if it is .pvs file, it will be mapped
                    var p = {name:f, filePath:fileDir, other:[]};
                    p.spec = f;
                    p.specFullPath = fileDir + "/" + f;
                    return p;
                }else{
                    return null
                }
            }else{
                return null;
            }
        });
        response = response.filter(function(f){return f!== null;});
        res.send(response);
    }

/*@Cristiano Faria
 *Open a requested pvs files, from the current project
 */
    function openFileCode(req, res){
        var projectDir = __dirname + "/public/projects/";
        var project = req.body.projectName;
        var file = req.body.fileName + ".pvs";
        var response;
        response = fs.readFileSync(projectDir + project + "/" + file,'utf8');
        res.send(response);
    }

/*@Cristiano Faria
 *Save the current pvs files being edited, from the current project
 */
    function saveCurrentFile(req,res){
        var projectDir = __dirname + "/public/projects/";
        var project = req.body.projectName;
        var file = req.body.fileName + ".pvs";
        var source = req.body.sourceFile;

        fs.writeFileSync(projectDir + "/" + project + "/" + file, source);

        res.send(file);
    }

/*@Cristiano Faria
 *Create/Save a configuration file, that saves the name of the main pvs file and image of the project
 */
	function saveConfigFile(req,res){
		var projectDir = __dirname + "/public/projects/";
        var project = req.body.projectName;
        var file = req.body.fileName + ".pvs";
        var image = req.body.imageName;
        var configFileName = "config.conf";
		var configeFileSource = "imageMain:"+image+"|specMain:"+file
		
        fs.writeFileSync(projectDir + "/" + project + "/" + configFileName, configeFileSource);

        res.send(configFileName);
	}

/*@Cristiano Faria
 *Save pvs file imported to the editor, from the current project
 */
    function saveImportFile(req,res){
        var pvsFileName = req.body.pvsSpecName, pvsSpecFullPath = __dirname + uploadDir + "/" + req.body.pvsSpecNameUpload;
        var projectName = req.body.projectName;
        var projectPath = __dirname + "/public/projects/" + projectName;
        var response = {type:"fileImported"};
        console.log("filename: "+pvsFileName);
        console.log("path: "+pvsSpecFullPath);
        console.log("projectname: "+projectName);
        try{
            if(fs.existsSync(projectPath + "/" + pvsFileName)){
                response.err = "File with the same name exists. Please choose a different name. Old file name was " + pvsFileName;
            }else{
                //copy sourcecode to the project directory
                var data = fs.readFileSync(pvsSpecFullPath,'utf8');
                fs.writeFileSync(projectPath + "/" + pvsFileName, data);
                util.log("Source code has been saved.");
                var sourceCode = fs.readFileSync(projectPath + "/" + pvsFileName,'utf8');
                var obj = {};
                obj.name = pvsFileName;
                obj.source = sourceCode;
                response.data = obj;
                //console.log(obj.name);
            }
        }catch(err){
            response.err = err;
        }
        var result = JSON.stringify(response);
        //util.log(result);
        res.send(response);
    }
