/**
	Now we load the websocket library to use for connection to the pvsio webserver
	for more info on this see http://requirejs.org
*/
var ws;

// variables linked to the UI model state fields; they are used to render the field state.
var bullet = "&#8226;"
var light = 0;
var pvsio_response;
var light_field = new RegExp("light := [0-9\/.\/-]+");
var prettyprintPVSioOutput = function(obj) {
  return obj.toString().replace(new RegExp(",,", "g"), ", ");
}


function adjust_brightness(val) {
	// for each element:
        // 1. restore the original brightness
	// 2. set absolute brightness level
        var b = [ "b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8", "b9", "b10",
	          "b11", "b12", "b13", "b14", "b15", "b16", "b17", "b18", "b19", "b20",
	          "b21", "b22", "b23"];

        for(var i=0; i<23; i++) {
		var img = document.getElementById(b[i]);
		Pixastic.revert(img);
		img = document.getElementById(b[i]);
		Pixastic.process(img,"brightness",{brightness:val});
	}
}


function log(msg){
	console.log(msg);
	var c = document.getElementById('console');
	c.innerHTML = msg + "<br>" + c.innerHTML;
}

require(['pvsiowebsocketclient_dist'], function(){
	var pvsws = require('websockets/pvs/pvsiowebsocket');
	ws = pvsws()
//		.serverUrl("ws://192.168.43.158:8081") //edit the server url here if not using ws://localhost:8080
		.addListener('ConnectionOpened', function(e){
			log("connection to server established");
			this.startPVSProcess();
		}).addListener("ConnectionClosed", function(e){
			log("connection to server closed");
		}).addListener("ServerReady", function(e){
			log("pvsio process ready");
			log("------------------------------");
			log("current state = normal");
		}).addListener("OutputUpdated", function(e){
			pvsio_response = prettyprintPVSioOutput(e.data);
			pvsio_response_log(pvsio_response);
			light = light_field.exec(pvsio_response).toString().substring(
				      light_field.exec(pvsio_response).toString().indexOf(":= ") + 3);
			adjust_brightness(light * 50);
			if(light == -2) { log("current state = sleep"); }
			else if(light == -1) { log("current state = dark"); }
			else if(light == 0) { log("current state = normal"); }
			else //if(light == 1) 
                           { log("current state = bright"); }
		}).addListener("InputUpdated", function(e){
			pvsio_commands_log(JSON.stringify(e.data));
		}).addListener("SourceCodeReceived", function(e){
			var spec = JSON.stringify(e.data).replace(/(\\n)/g, "<br />");
			specification_log(spec);
		}).logon();
	/**
	* write code to bind ui elements to calls to pvs process
	  i would normally used a library to bind ui elements to functions
	  but this does not require any library
	  e.g
	  var btnUp = document.getElementById("btnUp");
	  btnUp.onclick(function(e){
		 ws.sendGuiAction("click_UP(init(3))"); 
	  });
	*/	
});



function console_log(msg){
	console.log(msg);
	var c = document.getElementById('console_log');
	c.innerHTML = msg + "<br>" + c.innerHTML;
}

function pvsio_commands_log(msg){
	console.log(msg);
	var c = document.getElementById('pvsio_commands_log');
	c.innerHTML = msg + "<br>" + c.innerHTML;
}

function pvsio_response_log(msg){
	console.log(msg);
	var c = document.getElementById('pvsio_response_log');
	c.innerHTML = msg + "<br>" + c.innerHTML;
}

function specification_log(msg){
	console.log(msg);
	var c = document.getElementById('specification_log');
	c.innerHTML = msg + "<br>" + c.innerHTML;
}


