function getLastState() { return ws.lastState(); }

document.getElementById("inc_light").onclick = 
function(){
	ws.sendGuiAction("click_up(" + prettyprintPVSioOutput(getLastState()) + ");");
}
document.getElementById("dec_light").onclick = 
function(){
	ws.sendGuiAction("click_down(" + prettyprintPVSioOutput(getLastState()) + ");");
}
document.getElementById("poweroff").onclick = 
function(){
	ws.sendGuiAction("click_off(" + prettyprintPVSioOutput(getLastState()) + ");");
}
