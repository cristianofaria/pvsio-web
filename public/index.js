/**
 * Interactive prototype builder for PVSio based on the html map attribute
 * @author Patrick Oladimeji
 * @date Dec 3, 2012 : 4:42:55 PM
 * @updated Cristiano Faria
 * @date Aug, 2013
 "prototype": "https://ajax.googleapis.com/ajax/libs/prototype/1.7.0.0/prototype.js",
 "scriptaculous": "https://ajax.googleapis.com/ajax/libs/scriptaculous/1.9.0/scriptaculous.js",
 "cropper": "../lib/cropper"
 */
require.config({baseUrl: 'pvsioweb/app',
    paths: {
        "ace": "../lib/ace",
        "d3": "../lib/d3",
        "pvsioweb": "formal/pvs/prototypebuilder",
        "cropper": "../lib/cropper"
    }
});


require(['websockets/pvs/pvsiowebsocket', 'pvsioweb/displayManager',
    'pvsioweb/createOverlay',
    'ace/ace', 'pvsioweb/widgetMaps', 'util/shuffle',
    'pvsioweb/widgetEditor', 'pvsioweb/widgetEvents',
    'pvsioweb/buttonWidget', 'pvsioweb/displayWidget',
    'pvsioweb/displayMappings', "pvsioweb/forms/newProject",
    "pvsioweb/forms/events", "pvsioweb/forms/openProject",
    "pvsioweb/forms/saveProjectAs", "pvsioweb/forms/openFile",
    "pvsioweb/forms/chooseMainFile", "pvsioweb/forms/importFile",
    "pvsioweb/forms/newFile", 'd3/d3', "cropper/cropper"],
    function (pvsws, displayManager, overlayCreator, ace, widgetMaps, shuffle,
              widgetEditor, widgetEvents, buttonWidget, displayWidget, displayMappings,
              newProjectForm, formEvents, openProjectForm, saveProjectAs, openFileForm,
              chooseMainFileForm, importFileForm, newFileForm) {

        var currentProject = {name: ""}, sourceCodeChanged = false, currentFile = {name: ""};
        var tempImageName, tempSpecName, specFileName, specNameRegex = /(\w+)\s*:\s*THEORY\s+BEGIN/i;
        var filesOpened;
        var cropx1, cropx2, cropy1, cropy2, cropwidth, cropheight;
        var resizeValidation = false, cropValidation = false;
        var editor = ace.edit("editor");
        editor.getSession().setMode('ace/mode/text');

        editor.on("change", function (e) {
            sourceCodeChanged = true;
            var toplines = editor.getSession().getLines(0, Math.min(4, editor.getSession().getLength())).join("");
            var matches = toplines.match(specNameRegex);
            if (matches && matches.length > 1) {
                specFileName = matches[1];
                d3.select("#txtSpecFileName").property("value", specFileName);
            }
        });
        updateSourceCode("ui_th: THEORY BEGIN \r\n \r\nEND ui_th");
        d3.select("#header #txtProjectName").property("value", "");
        d3.select("#openFile").attr("disabled", true);
        d3.select("#importFile").attr("disabled", true);
        d3.select("#newFile").attr("disabled", true);
        d3.select("#saveFile").attr("disabled", true);
        d3.select("#crop").attr("disabled", true);
        d3.select("#resizeFull").attr("disabled", true);
        d3.select("#resizeSmall").attr("disabled", true);
        //d3.select("#test-abs").style("display","none");
//	d3.select("#header #txtProjectName").on("mousedown", function(){
//		var txt = this;
//		//show window to save current project as ..
//		saveProjectAs.create()
//			.addListener(formEvents.FormSubmitted, function(e){
//				txt.value = e.form.select("#projectName").property("value");
//				saveProject();
//				e.form.remove();
//			}).addListener(formEvents.FormCancelled, function(e){
//				e.form.remove();
//			});
//	});
        /**
         * utitlity function to pretty print pvsio output
         */
        function prettyPrint(msg) {
            return msg ? msg.toString().replace(/,,/g, ",") : msg;
        }

        /**
         * create pvs websocket connection
         * add listeners for pvs process events
         */
        var ws = pvsws()
            .addListener('ConnectionOpened',function (e) {
                log("connection to pvsio server established");
            }).addListener("ConnectionClosed",function (e) {
                log("connection to pvsio server closed");
            }).addListener("ServerReady",function (e) {
                log("pvsio process ready");
                //call get source code
                ws.getSourceCode();
            }).addListener("OutputUpdated",function (e) {
                var response = prettyPrint(e.data), tmp;
                console.log(response);
                pvsio_response_log(response);
                displayManager.updateDisplay(response);
            }).addListener("InputUpdated",function (e) {
                pvsio_commands_log(JSON.stringify(e.data));
            }).addListener("SourceCodeReceived",function (e) {
                updateSourceCode(e.data);
            }).addListener("SourceCodeSaved",function (e) {
                //need to restart the process with the correct filename
                this.startPVSProcess(e.data.fileName, currentProject.name);
            }).addListener("ProcessExited",function (e) {
                console.log("Server process exited -- server message was ...");
                console.log(e);
                log(JSON.stringify(e));
            }).logon();

        /**
         * log the message
         */
        function log(msg) {
            console.log(msg);
            d3.select("#console").insert('p', 'p').html(msg);
        }

        /**
         * add event listener for getting sourcecode
         */
        d3.select("#btnGetSpecification").on("click", function () {
            ws.getSourceCode();
        });
        /**
         * Add event listener for deleting a created mark
         */
        d3.select("body").on("keydown", function () {
            if (d3.event.which === 46) {
                d3.event.preventDefault();
                d3.selectAll(".mark.selected")
                    .each(function (d) {
                        widgetMaps.get(d3.select(this).attr("id")).remove();
                    });
            }
        });

        function saveSourceCode(project) {
            if (sourceCodeChanged) {
                ws.saveSourceCode({fileName: project.spec, fileContent: editor.getValue()});
                sourceCodeChanged = false;
            }
        }

        /**
         * Add event listener for toggling the prototyping layer and the interaction layer
         */
        d3.select("#btnBuilderView").classed("selected", true).on("click", function () {
            d3.select("img").style("z-index", -2);
            d3.selectAll("#controlsContainer button").classed("selected", false);
            d3.select(this).classed('selected', true);
        });

        d3.select("#btnSimulatorView").on("click", function () {
            d3.select("img").style("z-index", 2);
            d3.selectAll("#controlsContainer button").classed("selected", false);
            d3.select(this).classed('selected', true);
        });

        d3.select("#saveProject").on("click", function () {
            if(!resizeValidation && !cropValidation){
                saveProject(currentProject);
            }
        });

        function saveProject(project) {
            var imageName, pvsSpecName, fd;
            if (project.name && project.name.trim().length > 0) {
                //porject has already been created so save the widgets and the sourcecode if it has changed
                saveWidgetDefinition(project);
                saveSourceCode(project);
            } else {
                //prompt for a project name (this means they have not yet created a project)
                project.name = prompt("Enter a project name");
                if (project.name && project.name.trim().length > 0) {
                    //save the picture
                    imageName = "image." + tempImageName.split(".").slice(-1);
                    fd = new FormData();
                    fd.append("oldFileName", tempImageName);
                    fd.append("newFileName", imageName);
                    d3.xhr("/saveTempFile").post(fd, function (err, res) {
                        if (!err) {
                            res = JSON.parse(res.responseText);
                            //save the pvsspec
                            fd = new FormData();
                            pvsSpecName = d3.select("#txtSpecFileName").property("value") + ".pvs";
                            fd.append("newFileName", pvsSpecName);
                            fd.append("fileContent", editor.getValue());
                            d3.xhr("/saveTempFile").post(fd, function (err, res) {
                                if (!err) {
                                    res = JSON.parse(res.responseText);
                                    fd = new FormData();
                                    fd.append("projectName", project.name);
                                    fd.append("prototypeImage", imageName);
                                    fd.append("pvsSpecName", pvsSpecName);
                                    //create the project
                                    d3.xhr("/createProject").post(fd, function (err, res) {
                                        if (!err) {
                                            res = JSON.parse(res.responseText);
                                            //save the widgets defined if any
                                            saveWidgetDefinition(project);
                                            ///TODO maybe do a callback for changes to current project (res object should be current project)
                                            project.image = imageName;
                                            project.spec = pvsSpecName;
                                            updateProjectName(project.name);
                                            //start the pvsio process
                                            ws.startPVSProcess(project.spec.split(".pvs")[0], project.name);
                                        }
                                    });

                                }
                            });
                        }
                    });


                }
            }

        }

        d3.select("#openProject").on("click", function () {
            if(!resizeValidation && !cropValidation){
                openProject();
            }
        });

        d3.select("#newProject").on("click", function () {
            if(!resizeValidation && !cropValidation){
                newProjectForm.create().addListener(formEvents.FormCancelled,function (e) {
                    console.log(e);
                    e.form.remove();
                }).addListener(formEvents.FormSubmitted, function (e) {
                    console.log(e);
                    e.form.remove();
                    newProject(e.formData);
                });
            }
        });

        //@Cristiano Faria
        d3.select("#openFile").on("click", function () {
            openFile();
        });

        d3.select("#saveFile").on("click", function () {
            if (currentProject.name!==""){
                saveFile();
            } else {
                console.log("Project is not active");
            }
        });

        d3.select("#importFile").on("click", function () {
            if (currentProject.name !== "") {
                importFileForm.create().addListener(formEvents.FormCancelled,function (e) {
                    console.log(e);
                    e.form.remove();
                }).addListener(formEvents.FormSubmitted, function (e) {
                    console.log(e);
                    e.form.remove();
                    importFile(e.formData);
                });
            } else {
                console.log("Project is not active");
            }
        });

        d3.select("#newFile").on("click", function(){
            var newNameFile;
            if (currentProject.name!==""){
                newFileForm.create().addListener(formEvents.FormCancelled,function (e) {
                    console.log(e);
                    e.form.remove();
                    }).addListener(formEvents.FormDataChanged, function (e) {
                            console.log(e);
                            newNameFile = e.elementValue;
                    }).addListener(formEvents.FormSubmitted, function (e) {
                            console.log(e);
                            e.form.remove();
                            newFile(newNameFile);
                    });
            } else {
                console.log("Project is not active");
            }
        });

        //handle typecheck event
        d3.select("#btnTypeCheck").on("click", function () {
            var btn = d3.select(this).html("Typechecking ...").attr("disabled", true);
            //if (currentProject && currentProject.projectPath) {
            if (currentProject.name !== "") {
                var fd = new FormData();
                //var file = currentProject.specFullPath;
                //fd.append("file", file);
                fd.append("projectName",currentProject.name);
                d3.xhr("/typecheck").post(fd, function (err, res) {
                    btn.html("Typecheck").attr("disabled", null);
                    if (err) {
                        console.log(err);
                    } else {
                        res = JSON.parse(res.responseText);
                        console.log(res);
                        alert(res.stdout);
                    }
                });
            }
        });

        /**@Cristiano Faria
         * Resize image
         */
        //var resizeValidation = false;
        //var imgOriginal;
        var resizeIteration = 0;
        d3.select("#btnResizeSaveImage").style("display","none");
        d3.select("#btnResizeCancelImage").style("display","none");

        /**
         * Add event listener for toggling the save and cancel Resize image
         */
        d3.select("#btnResizeSaveImage").on("click", function () {
            d3.select("img").style("z-index", -2);
            d3.selectAll("#controlsContainer button").classed("selected", false);
            d3.select(this).classed('selected', true);
            var project = "../../projects/" + currentProject.name + "/";
            var img = d3.select("#image");
            var widthOriginal = img.property("naturalWidth");
            var heightOriginal = img.property("naturalHeight");
            var imgResizeWidth = widthOriginal + (widthOriginal * ((resizeIteration*5)/100));
            var imgResizeHeight = heightOriginal + (heightOriginal * ((resizeIteration*5)/100));

            var fd = new FormData();
            fd.append("projectName",currentProject.name);
            fd.append("image",currentProject.image);
            fd.append("width",imgResizeWidth);
            fd.append("height",imgResizeHeight);
            // CALL to Server for really resize! (on the server)
            //var imageFile = "image."+ currentProject.image.split(".")[1];

            d3.xhr("/resizeImage").post(fd, function (err, res) {
                if (res.err)
                    console.log(err);
                else {
                    currentProject.widgetDefinition = redefineAndSaveWidgetAreasResized();
                    console.log(res.success);
                }
                setTimeout(function(){
                    resizeIteration = 0;
                    resizeClean();
                    updateImage(project + currentProject.image + "#" + new Date().getTime());
                    loadWidgetDefinitions(currentProject.widgetDefinition);
                    d3.select("#image").style("display",null);
                    d3.select("#prototypeImage").style("display",null);
                },1000);
            });
        });



        d3.select("#btnResizeCancelImage").on("click", function () {
            d3.select("img").style("z-index", 2);
            d3.selectAll("#controlsContainer button").classed("selected", false);
            d3.select(this).classed('selected', true);
            resizeIteration = 0;
            resizeClean();
            d3.select("#image").style("display",null);
        });

        d3.select("#resizeSmall").on("click", function(){
            if(!cropValidation && currentProject.name !== ""){
                //var project = "../../projects/" + currentProject.name + "/";
                var img = d3.select("#image");
                var width = img.property("width");
                var height = img.property("height");
                var widthOriginal = img.property("naturalWidth");
                var heightOriginal = img.property("naturalHeight");
                resizeIteration = resizeIteration - 1;
                var imgResizeWidth = widthOriginal + (widthOriginal * ((resizeIteration*5)/100));
                var imgResizeHeight = heightOriginal + (heightOriginal * ((resizeIteration*5)/100));
                if (imgResizeHeight < 10 || imgResizeWidth < 10){
    //limits can be defined, for example: img cannot be smaller than 10% of it's original size
                    resizeIteration = resizeIteration + 1;
                    console.log("You can not put the picture smaller.");
                }else{
                    var style = "width:" + imgResizeWidth + "px;height:" + imgResizeHeight + "px;";
                    if(!resizeValidation){
                        resizeIntialization(img, style);
                        //imgOriginal = img;
                        resizeValidation = true;
                    }else{
                        d3.select("#imgResize_wrap").attr("style",style);
                        d3.select("#image").attr("style",style);
                    }
                }
            }
        });

        d3.select("#resizeFull").on("click", function(){
            if(!cropValidation && currentProject.name !== ""){
                //var project = "../../projects/" + currentProject.name + "/";
                var img = d3.select("#image");
                var width = img.property("width");
                var height = img.property("height");
                var widthOriginal = img.property("naturalWidth");
                var heightOriginal = img.property("naturalHeight");
                resizeIteration += 1;
                var imgResizeWidth = widthOriginal + (widthOriginal * ((resizeIteration*5)/100));
                var imgResizeHeight = heightOriginal + (heightOriginal * ((resizeIteration*5)/100));
                if (imgResizeWidth > 910 || imgResizeHeight > 1286){
    //limits can be defined, for example: max of the div -> 910px
                    resizeIteration = resizeIteration - 1;
                    console.log("You can not put the picture bigger.");
                }else{
                    var style = "width:" + imgResizeWidth + "px;height:" + imgResizeHeight + "px;";
                    if(!resizeValidation){
                        resizeIntialization(img, style);

                        resizeValidation = true;
                    }else{
                        d3.select("#imgResize_wrap").attr("style",style);
                        d3.select("#image").attr("style",style);
                    }
                }
            }
        });

        function resizeIntialization(img, style){
            d3.selectAll("#controlsContainer button").classed("selected",false);
            d3.select("#btnBuilderView").style("display","none");
            d3.select("#btnSimulatorView").style("display","none");
            d3.select("#btnResizeCancelImage").style("display",null);
            d3.select("#btnResizeSaveImage").style("display",null).classed("selected",true);
            //d3.select("#image").style("display",null);
            d3.select("#image").remove();
            d3.select("#imgDiv").append("div").attr("id","imgResize_wrap").attr("style",style);//.attr("style","width:"+img.width+"; height:"+img.height+";");
            d3.select("#imgResize_wrap").append("img").attr("id","image").attr("src",img.attr("src")).attr("style",style);

            //imageForCrop = new Cropper.Img( 'image', { onEndCrop: onEndCrop } );
            d3.select("#prototypeImage").style("display","none");
            d3.select("#crop").attr("disabled",true);
        }

        function resizeClean(){
            //go back into the state before resize call
            var project = "../../projects/" + currentProject.name + "/";
            d3.selectAll("#controlsContainer button").classed("selected",false);
            d3.select("#prototypeImage").style("display",null);
            d3.select("#btnBuilderView").style("display",null).classed("selected",true);
            d3.select("#btnSimulatorView").style("display",null);

            d3.select("#btnResizeCancelImage").style("display","none");
            d3.select("#btnResizeSaveImage").style("display","none");

            d3.select("#resizeFull").attr("disabled",null);
            d3.select("#resizeSmall").attr("disabled",null);
            d3.select("#imgResize_wrap").remove();
            d3.select("#imgDiv").append("img").attr("src", project + currentProject.image).attr("id","image")
                .attr("alt","image").attr("usemap","#prototypeMap").style("display","none");
            //var project = "../../projects/" + currentProject.name + "/";
            //updateImage(project + currentProject.image);
            //resizeImageDiv();
            resizeValidation=false;
           // resizeIteration = 0;

            d3.select("#crop").attr("disabled",null);

            d3.select("#prototypeImage").style("display",null);
        }

        function redefineAndSaveWidgetAreasResized(){
            //
            var safe = {};
            //var widgetM = widgetMaps.toJSON();
            //safe.widgetMaps = widgetMaps.toJSON();
            var regions = getRegionDefs();
            //safe.regionDefs = getRegionDefs();
            //console.log(safe);
            var left=0;
            var top=0;
            var right=0;
            var bottom=0;
            var oldCoords = new Array();
            var newCoords = new Array();
            for (i=0;i<regions.length;i++){
                var coords = regions[i].coords.replace(/^\s+|\s+$/g,"");
                console.log("old coords: " + coords);
                oldCoords = coords.split(",");
                left = parseFloat(oldCoords[0]) + (oldCoords[0] * resizeIteration*0.05);
                top = parseFloat(oldCoords[1]) + (oldCoords[1] * resizeIteration*0.05);
                right = parseFloat(oldCoords[2]) + (oldCoords[2] * resizeIteration*0.05);
                bottom = parseFloat(oldCoords[3]) + (oldCoords[3] * resizeIteration*0.05);
                console.log("new coords: "+left+","+top+","+right+","+bottom);
                regions[i].coords = left+","+top+","+right+","+bottom;
                newCoords.push(regions[i]);
            }
            safe.widgetMaps = widgetMaps.toJSON();
            safe.regionDefs = newCoords;
            //save to the user's drive
            var safeStr = JSON.stringify(safe, null, " ");
            var fd = new FormData();
            fd.append("fileName", currentProject.name + "/widgetDefinition.json");
            fd.append("fileContent", safeStr);

            saveWidgetDefinitionServer(fd);
            return safe;
        }

        /**@Cristiano Faria
         * Crop image
         */
        d3.select("#btnCropSaveImage").style("display","none");
        d3.select("#btnCropCancelImage").style("display","none");

        var imageForCrop;
        d3.select("#crop").on("click", function(){
            if(!resizeValidation && !cropValidation && currentProject.name !== ""){
                d3.selectAll("#controlsContainer button").classed("selected",false);

                d3.select("#btnBuilderView").style("display","none");
                d3.select("#btnSimulatorView").style("display","none");

                d3.select("#btnCropCancelImage").style("display",null);
                d3.select("#btnCropSaveImage").style("display",null).classed("selected",true);
                d3.select("#image").style("display",null);
                imageForCrop = new Cropper.Img( 'image', { onEndCrop: onEndCrop } );
                cropValidation = true;
                d3.select("#prototypeImage").style("display","none");
                //d3.select("#crop").attr("disabled",true);
                d3.select("#resizeFull").attr("disabled",true);
                d3.select("#resizeSmall").attr("disabled",true);
            }
        });

        /**
        * Add event listener for toggling the save and cancel crop image
        */
        d3.select("#btnCropSaveImage").on("click", function () {
            d3.select("img").style("z-index", -2);
            d3.selectAll("#controlsContainer button").classed("selected", false);
            d3.select(this).classed('selected', true);
            var project = "../../projects/" + currentProject.name + "/";

            var fd = new FormData();
            fd.append("projectName",currentProject.name);
            fd.append("image",currentProject.image);
            fd.append("x",cropx1);
            fd.append("y",cropy1);
            fd.append("width",cropwidth);
            fd.append("height",cropheight);
            // CALL to Server for really crop! (on the server)
            //var imageFile = "image."+ currentProject.image.split(".")[1];

            d3.xhr("/cropImage").post(fd, function (err, res) {
                if (res.err)
                    console.log(err);
                else {
                    currentProject.widgetDefinition = redefineAndSaveWidgetAreasCropped();
                    console.log(res.success);
                }
                setTimeout(function () {
                    cropClean();
                    updateImage(project + currentProject.image + "#" + new Date().getTime());
                    loadWidgetDefinitions(currentProject.widgetDefinition);
                    d3.select("#prototypeImage").style("display",null);
                }, 2000);

            });

        });

        d3.select("#btnCropCancelImage").on("click", function () {
            d3.select("img").style("z-index", 2);
            d3.selectAll("#controlsContainer button").classed("selected", false);
            d3.select(this).classed('selected', true);

            cropClean();
        });

        function redefineAndSaveWidgetAreasCropped(){
            //
            var safe = {};
            var widgetM = widgetMaps.toJSON();
            //safe.widgetMaps = widgetMaps.toJSON();
            var regions = getRegionDefs();
            //safe.regionDefs = getRegionDefs();
            //imageWidthHeight();
            console.log(safe);
            var left=0, top=0, right=0, botton=0;
            //var newCoords = new Array();

            for (i=0;i<regions.length;i++){
                //console.log("first: " + regions[i].coords);
                var oldCoords = regions[i].coords.split(",");
                left = oldCoords[0] - cropx1; //x- ...;
                top = oldCoords[1] - cropy1; //y- ...;
                right = oldCoords[2]- cropx1; //imgWidth- ...;
                botton = oldCoords[3]- cropy1; //imgHeight- ...;
                if((left>=0 && top>=0) && (right<=cropwidth && botton<=cropheight)){
                    regions[i].coords = left+","+top+","+right+","+botton;
                    //newCoords.push(left+","+top+","+right+","+botton);
                }else{
                    regions[i].coords = "";
                }
                //console.log("second: " + regions[i].coords);
            }

            var newCoords = new Array();
            //var newWidgetMaps = new Array();
            for (i=0;i<regions.length;i++){
                if(regions[i].coords!==""){
                    newCoords.push(regions[i]);
                 }
            }
            safe.widgetMaps = widgetMaps.toJSON();
            safe.regionDefs = newCoords;
            //save to the user's drive
            var safeStr = JSON.stringify(safe, null, " ");
            var fd = new FormData();
            fd.append("fileName", currentProject.name + "/widgetDefinition.json");
            fd.append("fileContent", safeStr);

            saveWidgetDefinitionServer(fd);
            return safe;
        }

        function cropClean(){
        //go back into the state before crop call
            d3.selectAll("#controlsContainer button").classed("selected",false);
            d3.select("#prototypeImage").style("display",null);
            d3.select("#btnBuilderView").style("display",null).classed("selected",true);
            d3.select("#btnSimulatorView").style("display",null);

            d3.select("#btnCropCancelImage").style("display","none");
            d3.select("#btnCropSaveImage").style("display","none");

            d3.select("#crop").attr("disabled",null);
            imageForCrop.remove();
            cropValidation = false;
            //var project = "../../projects/" + currentProject.name + "/";
            //updateImage(project + currentProject.image);
            //resizeImageDiv();

            d3.select("#resizeFull").attr("disabled",null);
            d3.select("#resizeSmall").attr("disabled",null);

            d3.select("#prototypeImage").style("display",null);
        }


        //create mouse actions for draging areas on top of the image
        var img = d3.select("#imageDiv img");
        var image = d3.select("#prototypeImage");
        var rect, drawing = false, moved = false;
        image.on('mousedown',function () {
            d3.event.stopPropagation();
            d3.event.preventDefault();
            drawing = true;
            rect = overlayCreator.createDiv(image);
        }).on("mouseup",function () {
                //add the area for the drawn rectangle into the map element
                if (moved) {
                    handleWidgetEdit(rect);
                    //add double click event listener to mark and
                    //set the font-size of the mark to be 80% of the height
                    rect.on('dblclick',function () {
                        handleWidgetEdit(d3.select(this));
                    }).style('font-size', (0.8 * parseFloat(rect.style('height'))) + "px");
                }
                else
                    rect.remove();
                //rect finished drawing
                drawing = moved = false;
            }).on('mousemove', function () {
                if (drawing) {
                    var bound = this.getBoundingClientRect();
                    var pad = 10, x = d3.event.clientX - bound.left - this.clientLeft + this.scrollLeft,
                        y = d3.event.clientY - bound.top - this.clientTop - this.scrollTop;
                    moved = true;
                    d3.event.preventDefault();
                    var starty = parseFloat(rect.attr("starty")),
                        startx = parseFloat(rect.attr("startx")),
                        h = Math.abs(starty - y),
                        w = Math.abs(startx - x);
                    //if the current y is less than the start y, then top style should be height - current top style
                    if (y < starty)
                        rect.style('top', (starty - h) + "px");
                    else
                        rect.style('top', starty + "px");
                    //if the current x is less than the startx then left style should be width - current left style
                    if (x < startx)
                        rect.style("left", (startx - w) + "px");
                    else
                        rect.style("left", startx + "px");
                    //update width and height of marker
                    rect.style("height", (h - pad) + "px").style("width", (w - pad) + "px");
                }
            });

        function handleWidgetEdit(mark) {
            widgetEditor.create(mark)
                .addListener(widgetEvents.WidgetSaved,function (e) {
                    e.mark.attr("id", e.widget.id());
                    e.formContainer.remove();
                    console.log(e);
                    overlayCreator.createInteractiveImageArea(e.mark, widgetMaps.get(e.widget.id()), ws);

                    //update the regex for this mark if its a display widget and give it a display class
                    if (e.widget.type() === "Display") {
                        e.mark.classed("display", true);
                        displayMappings.active[e.widget.id()] = {regex: e.widget.regex(), uiElement: e.widget.id()};
                    }
                }).addListener(widgetEvents.WidgetDeleted, function (e) {
                    if (e.widget.type() === "Display") {
                        delete displayMappings.active[e.widget.id()];
                    }
                    e.mark.attr("id", e.widget.id());
                    e.formContainer.remove();
                    console.log(e);
                    e.widget.remove();

                });
        }

        resizeImageDiv();

        function resizeImageDiv() {
            var img = d3.select('#imgDiv img');
            image.style("height", img.property("height") + "px")
                .style("width", img.property("width") + "px");
            d3.select("#imageDiv").style("width", img.property("width"));
            d3.select("#console").style("left", img.property('width') + 20)
                .style("height", img.property('height') - 17).style("width", 1130 - img.property("width") - 55);
        }

        /***
         * ##### dealing with logging input and output of pvs
         */
        function console_log(msg) {
            console.log(msg);
            var c = document.getElementById('console_log');
            c.innerHTML = msg + "<br>" + c.innerHTML;
        }

        function pvsio_commands_log(msg) {
            console.log(msg);
            var c = document.getElementById('pvsio_commands_log');
            c.innerHTML = msg + "<br>" + c.innerHTML;
        }

        function pvsio_response_log(msg) {
            console.log(msg);
            var c = document.getElementById('pvsio_response_log');
            c.innerHTML = msg + "<br>" + c.innerHTML;
        }

        function specification_log(msg) {
            console.log(msg);
            var c = document.getElementById('specification_log');
            c.innerHTML = msg + "<br>" + c.innerHTML;
        }

        preparePageForImageUpload();

        function preparePageForImageUpload() {
            var imageExts = 'png,jpg,jpeg'.split(",");
            //add listener for  upload button
            d3.selectAll("#btnLoadPicture").on("click", function () {
                if(!resizeValidation && !cropValidation){
                    d3.select("#btnSelectPicture").node().click();
                }
            });

            d3.select("#btnSelectPicture").on("change", function () {
                var files = d3.event.currentTarget.files;
                if (files && imageExts.indexOf(files[0].name.split(".").slice(-1).join("").toLowerCase()) > -1) {
                    uploadFiles(files, function (res) {
                        res = JSON.parse(res.responseText);
                        tempImageName = res.fileName;
                        var imagepath = "../../uploads/" + res.fileName;
                        updateImage(imagepath);
                        //hide the draganddrop stuff
                        d3.select("#imageDragAndDrop.dndcontainer").style("display", "none");
                    });
                }
            });

            d3.select("#btnLoadSpec").on("clik", function () {
                d3.select("#btnSelectSpec").node().click();
            });

            d3.select("#btnSelectSpec").on("change", function () {
                //check if file is valid pvs file
                var files = d3.event.currentTarget.files;
                if (file && files[0].name.split(".").slice(-1).join("").toLowerCase() === "pvs") {
                    uploadFiles(files, function (res) {
                        res = JSON.parse(res.responseText);
                        tempSpecName = res.fileName;
                        //load spec into workspace via json xhr req
                        d3.text("../../uploads/" + res.fileName, function (err, res) {
                            console.log(res);
                            //hide drag and drop stuff
                            d3.select("#specDragAndDrop.dndcontainer").style("display", "none");
                        });
                    });
                } else {
                    console.log("only files with .pvs extension are allowed");
                }

            });

            var c = document.getElementById("imageDiv");
            c.ondragover = function () {
                d3.select(c).style("border", "5px dashed black");
                return false;
            };
            c.ondragend = function (e) {
                d3.select(c).style("border", null);
                e.preventDefault();
                e.stopPropagation();
                return false;
            };
            c.ondrop = function (e) {
                d3.select(c).style("border", null);
                var files = e.dataTransfer.files;
                console.log(files);
                uploadFiles(files);
                e.preventDefault();
                e.stopPropagation();
                return false;
            };


            function uploadFiles(files, cb) {
                if (files.length > 0) {
                    var fd = new FormData();
                    for (var i = 0; i < files.length; i++) {
                        fd.append("file", files[i]);
                    }
                    var xhr = d3.xhr("/uploadfile", 'application/json');
                    xhr.post(fd)
                        .on('progress',function (e) {
                            console.log(e);
                        }).on('load', cb);
                }
            }
        }

        function updateImage(imagepath) {
            d3.select("#imgDiv img").attr("src", imagepath);
            d3.select("#prototypeImage")
                .style("background-image", "url(" + imagepath + ")");
            setTimeout(resizeImageDiv, 500);
        }

        function updateSourceCode(src) {
            sourceCodeChanged = false;
            editor.setValue(src);
            editor.clearSelection();
            editor.gotoLine(1);
            editor.moveCursorTo(0, 0);
            editor.scrollToLine(0, false, false, function () {
            });
        }

        function newProject(fd) {
            fd = fd || new FormData();
            d3.xhr("/newProject").post(fd).on("load", function (res) {
                //update the picture adn the pvs source file and trigger a restart of the pvsioprocess
                res = JSON.parse(res.responseText);
                //alert(JSON.stringify(res));
                if (!res.err) {
                    currentProject = res.data;
                    var project = "../../projects/" + currentProject.name + "/";
                    var selected = 0;
                    var imagePath = project + currentProject.image;
                    d3.select("#tabs_files").selectAll("a").remove();
                    updateImage(imagePath);
                    updateProjectName(currentProject.name);
                    ws.startPVSProcess(currentProject.spec.split(".pvs")[0], currentProject.name);
                    currentFile = {
                        name: currentProject.spec.split(".pvs")[0],
                        source: currentProject.sourceCode
                    };
                    filesOpened = new Array({name: currentFile.name, source: currentFile.source});
                    selected = filesOpened.length-1;
                    addTabFile(selected);
                    updateSourceCode(filesOpened[selected].source);
                    enablePictureToolbar();
                    enableFilesToolbar();
                    d3.select("#imageDragAndDrop.dndcontainer").style("display", "none");
                }else{
                    console.log(res.err);
                }
                d3.select("div#body").style("display", null);
            });
        }

        function updateProjectName(name) {
            document.title = "PVSio-Web -- " + name;
            d3.select("#header #txtProjectName").property("value", name);
        }

        function saveWidgetDefinition(project) {
            var safe = {};
            safe.widgetMaps = widgetMaps.toJSON();
            safe.regionDefs = getRegionDefs();
            //save to the user's drive
            var safeStr = JSON.stringify(safe, null, " ");
            var fd = new FormData();
            fd.append("fileName", project.name + "/widgetDefinition.json");
            fd.append("fileContent", safeStr);

            saveWidgetDefinitionServer(fd);
            /*
            d3.xhr("/saveWidgetDefinition").post(fd).on("load", function (res) {
                res = JSON.parse(res.responseText);
                console.log(res);
            });*/
        }

        function saveWidgetDefinitionServer(fd){
            d3.xhr("/saveWidgetDefinition").post(fd).on("load", function (res) {
                res = JSON.parse(res.responseText);
                console.log(res);
            });
        }

        function getRegionDefs() {
            var regionDefs = [];
            d3.selectAll("#prototypeMap area").each(function () {
                var region = {}, a = d3.select(this);
                region.class = a.attr("class");
                region.shape = a.attr("shape");
                region.coords = a.attr("coords");
                region.href = a.attr("href");
                regionDefs.push(region);
            });
            return regionDefs;
        }

/**@Cristiano Faria
* modified
*/
        function openProject() {
            editor.setReadOnly(true);
            d3.xhr("/openProject").post(function (err, res) {
                if (err)
                    console.log(err);
                else {
                    var selectedData;
                    res = JSON.parse(res.responseText);
                    res.unshift({name: ""});
                    openProjectForm.create(res,function (d) {
                        return d.name;
                    }).addListener(formEvents.FormSubmitted,function (e) {
                            var project = "../../projects/" + currentProject.name + "/";
                            console.log(e);
                            //only update the image and pvsfile if a real project was selected
                            if (currentProject.name !== "") {
                                //alert("regionsDefs "+currentProject.widgetDefinition);
                                console.log("regionsDefs " +currentProject.widgetDefinition);
                                //clean all file tabs
                                d3.select("#tabs_files").selectAll("a").remove();

                                var selectedFile = 0;
                                d3.select("div#body").style("display", null);

                                updateProjectName(currentProject.name);
                                updateImage(project + currentProject.image);

                                if (currentProject.specMain !== "") {
                                    //if the confige.conf file exists
                                    currentFile = {
                                        name: currentProject.specMain.split(".")[0],
                                        source: currentProject.specMainSource
                                    };

                                    //starts the PVS process
                                    ws.lastState("init(0)");
                                    //ws.startPVSProcess(currentProject.spec.split(".")[0], currentProject.name);
                                    ws.startPVSProcess(currentFile.name, currentProject.name);
                                    loadWidgetDefinitions(currentProject.widgetDefinition);
                                    //updateProjectName(currentProject.name);

                                    //initialize the array that will contain the opened files
                                    filesOpened = new Array({name: currentFile.name, source: currentFile.source});
                                    selectedFile = filesOpened.length - 1;

                                    //create a new tab that has a reference for the file
                                    addTabFile(selectedFile);

                                    updateSourceCode(currentFile.source);
                                    editor.setReadOnly(false);
                                } else {
                                    //if the confige.conf file doesn't exists
                                    //create a object with a list of files
                                    var optionsFiles = new Array({name: ""});
                                    var files = currentProject.spec.split("|");
                                    for (var i = 0; i < files.length - 1; i++) {
                                        optionsFiles.push({name: files[i]});
                                    }

                                    //create a form with a list of files for that the user can choose the main file
                                    chooseMainFileForm.create(optionsFiles,function (d) {
                                        return d.name;
                                    }).addListener(formEvents.FormSubmitted,function (e) {
                                            if (currentFile.name !== "") {
                                                ws.lastState("init(0)");
                                                ws.startPVSProcess(currentFile.name, currentProject.name);
                                                loadWidgetDefinitions(currentProject.widgetDefinition);

                                                //GETS THE SOURCE CODE OF THE SELECTED FILE
                                                var fd = new FormData();
                                                fd.append("projectName", currentProject.name);
                                                fd.append("fileName", currentFile.name.split(".")[0]);
                                                d3.xhr("/openFileCode").post(fd, function (err, res) {
                                                    if (err) {
                                                        console.log(err);
                                                    } else {
                                                        var sourceFile = res.responseText;
                                                        currentFile.source = sourceFile;
                                                        filesOpened = new Array({name: currentFile.name.split(".")[0], source: sourceFile});
                                                        selectedFile = filesOpened.length - 1;
                                                        changeCurrentFile(selectedFile);
                                                        updateSourceCode(currentFile.source);
                                                        addTabFile(selectedFile);
                                                        editor.setReadOnly(false);

                                                        //save configFile
                                                        fd.append("imageName", currentProject.image);
                                                        d3.xhr("/saveConfigFile").post(fd, function (err, res) {
                                                            if (err) {
                                                                console.log("Configurations file not saved...");
                                                            } else {
                                                                console.log("Configurations file successefully saved!");
                                                            }
                                                        });
                                                    }
                                                });
                                            }
                                            e.form.remove();
                                        }).addListener(formEvents.FormCancelled,function (e) {
                                            e.form.remove();
                                        }).addListener(formEvents.FormDataChanged, function (e) {
                                            console.log(e);
                                            currentFile = e.data; //actualize the data of the currentFile
                                        });
                                }
                                d3.select("#imageDragAndDrop.dndcontainer").style("display", "none");
                                enablePictureToolbar();
                                enableFilesToolbar();
                            } //else it is not possible to open that project, please try again in a few moments


                            e.form.remove();
                        }).addListener(formEvents.FormCancelled,function (e) {
                            e.form.remove();
                        }).addListener(formEvents.FormDataChanged, function (e) {
                            console.log(e);
                            currentProject = e.data;
                            document.title = "PVSio-Web -- " + currentProject.name;
                        });
                }
            });
            //d3.select("#imageDragAndDrop.dndcontainer").style("display", "none");
        }

        //@Cristiano Faria
        function openFile() {
            //var btn = d3.select(this).html("Typechecking ...").attr("disabled", true); || .attr("disabled", null);

            //updating the current file with the change on the editor
            if (currentProject.name !== "") {
                currentFile.source = editor.getValue();
                updateFilesInMemory(currentFile.source);

                var fd = new FormData();
                fd.append("projectName", currentProject.name);
                d3.xhr("/getPvsFiles").post(fd, function (err, res) {
                    if (err) {
                        console.log(err);
                    } else {
                        res = JSON.parse(res.responseText);
                        res.unshift({name: ""});
                        openFileForm.create(res,function (d) {
                            return d.name;
                        }).addListener(formEvents.FormSubmitted,function (e) {
                                //only update the pvsfile if a real project was selected
                                if (currentProject.name !== "") {
                                    //currentFile.name = d.name;
                                    d3.select("div#body").style("display", null);
                                    //fd = new FormData();
                                    fd.append("fileName", currentFile.name.split(".")[0]);
                                    var verifyExistence = false;
                                    var selected = 0;
                                    for (var i = 0; i < filesOpened.length; i++) {
                                        if (filesOpened[i].name == currentFile.name.split(".")[0]) {
                                            verifyExistence = true;
                                            selected = i;
                                        }
                                    }
                                    if (!verifyExistence) {
                                        d3.xhr("/openFileCode").post(fd, function (err, res) {
                                            if (err) {
                                                console.log(err);
                                            } else {
                                                currentFile.source = res.responseText;
                                                filesOpened.push({name: currentFile.name.split(".")[0], source: res.responseText});
                                                selected = filesOpened.length - 1;
                                                addTabFile(selected);
                                                updateSourceCode(res.responseText);
                                            }
                                        });
                                    } else {
                                        changeCurrentFile(selected);
                                        updateSourceCode(filesOpened[selected].source);
                                    }
                                } //else project is not activated

                                d3.select("#imageDragAndDrop.dndcontainer").style("display", "none");
                                e.form.remove();
                            }).addListener(formEvents.FormCancelled,function (e) {
                                e.form.remove();
                            }).addListener(formEvents.FormDataChanged, function (e) {
                                console.log(e);
                                currentFile = e.data;
                            });
                    }
                });
            } else {
                console.log("Project is not active");
            }
        }

        function saveFile() {
            var sourceEditor = editor.getValue();
            updateFilesInMemory(sourceEditor);
            //var source = currentFile.source;
            var fileName = currentFile.name.split(".")[0];
            //alert(currentFile.name);
            var fd = new FormData();
            fd.append("projectName", currentProject.name);
            fd.append("fileName", fileName);
            fd.append("sourceFile", sourceEditor);
            d3.xhr("/saveCurrentFile").post(fd, function (err, res) {
                if (err) {
                    console.log(err);
                } else {
                    console.log("File " + res.responseText + " saved");
                }
            });
        }

        function importFile(fd) {
            fd = fd || new FormData();
            var fdata = fd;
            fdata.append("projectName", currentProject.name);
            d3.xhr("/importFile").post(fdata).on("load", function (res) {
                currentFile.source = editor.getValue();
                updateFilesInMemory(currentFile.source);
                var selected = 0;
                //upload a pvs source file and put it to the editor, add to opened files.
                res = JSON.parse(res.responseText);
                if (!res.err) {
                    currentFile = res.data;
                    filesOpened.push({name: currentFile.name.split(".")[0], source: currentFile.source});
                    selected = filesOpened.length - 1;
                    addTabFile(selected);
                    updateSourceCode(currentFile.source);
                    editor.setReadOnly(false);
                    d3.select("div#body").style("display", null);
                }else{
                    console.log(res);
                }
            });
        }

        function newFile(name){
            currentFile.source = editor.getValue();
            updateFilesInMemory(currentFile.source);
            //Add a new file with a different name
            var fileName = name;
            var selected = 0;
            var fd = new FormData();
            fd.append("projectName",currentProject.name);
            fd.append("fileName",fileName);
            d3.xhr("/newFile").post(fd, function(err,res){
                res = JSON.parse(res.responseText);
                if(!res.err){
                    currentFile = res.data;
                    filesOpened.push({name: currentFile.name.split(".")[0], source: currentFile.source});
                    selected = filesOpened.length - 1;
                    addTabFile(selected);
                    updateSourceCode(currentFile.source);
                    editor.setReadOnly(false);
                    d3.select("div#body").style("display", null);
                }else{
                    console.log(res.err);
                }
            });
        }

        function addTabFile(selectedFile){
            var fileName = currentFile.name.split(".")[0];
            d3.select("#tabs_files").append("a").attr("id", fileName).text(fileName).on("click", function (d) {

                var sourceEditor = editor.getValue();
                updateFilesInMemory(sourceEditor);

                changeCurrentFile(selectedFile);
                updateSourceCode(filesOpened[selectedFile].source);
            });
        }

        function updateFilesInMemory(sourceEditor) {
            //update source in the array of files already loaded
            for (var i = 0; i < filesOpened.length; i++) {
                if (filesOpened[i].name == currentFile.name.split(".")[0]) {
                    filesOpened[i].source = sourceEditor;
                }
            }
        }

        function changeCurrentFile(arrayPosition) {
            currentFile = {
                name: filesOpened[arrayPosition].name,
                source: filesOpened[arrayPosition].source
            };
        }

        function enableFilesToolbar(){
            d3.select("#openFile").attr("disabled", null);
            d3.select("#importFile").attr("disabled", null);
            d3.select("#newFile").attr("disabled", null);
            d3.select("#saveFile").attr("disabled", null);
        }
        function enablePictureToolbar(){
            d3.select("#crop").attr("disabled", null);
            d3.select("#resizeFull").attr("disabled", null);
            d3.select("#resizeSmall").attr("disabled", null);
        }

        function loadWidgetDefinitions(defs) {
            //clear old widhget maps and area def
            widgetMaps.clear();
            d3.selectAll("#prototypeImage .mark, #prototypeMap area").remove();

            if (defs) {
                console.log(defs);
                var key, w, widget, property;
                for (key in defs.widgetMaps) {
                    w = defs.widgetMaps[key];
                    widget = w.type === "Button" ? buttonWidget() : displayWidget();
                    widget.id(key);
                    for (property in w)
                        widget[property](w[property]);

                    widgetMaps.add(widget);
                }
                //create div
                defs.regionDefs.forEach(function (d) {
                    widget = widgetMaps.get(d.class);
                    var coords = d.coords.split(",").map(function (d) {
                        return parseFloat(d);
                    });
                    var h = coords[3] - coords[1], w = coords[2] - coords[0];
                    var mark = overlayCreator.createDiv(image, coords[0], coords[1])
                        .style("height", h + "px").style("width", w + "px");
                    overlayCreator.createInteractiveImageArea(mark, widget, ws);
                    //set the font-size of the mark to be 80% of the height and the id of the mark
                    mark.on("dblclick",function () {
                        handleWidgetEdit(d3.select(this));
                    }).style('font-size', (0.8 * parseFloat(mark.style('height'))) + "px")
                        .attr("id", widget.id());

                    if (widget.type() === "Display") {
                        mark.classed("display", true);
                        displayMappings.active[widget.id()] = {regex: widget.regex(), uiElement: widget.id()};
                    }
                });
            }
        }

/**@Cristiano Faria
 * function needed to "capture" the values for image crop
*/
        function onEndCrop( coords, dimensions ) {

            cropx1 = coords.x1;
            cropy1 = coords.y1;
            cropx2 = coords.x2;
            cropy2 = coords.y2;
            cropwidth = dimensions.width;
            cropheight = dimensions.height;

            console.log("X1: " + cropx1, " Y1: " + cropy1 + " X2: " + cropx1, " Y2: " + cropy1 + " Width: " + cropwidth + " Height: " + cropheight);
        }
    });