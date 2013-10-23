/**
 * defines the button widget
 * @author Patrick Oladimeji
 * @date Dec 29, 2012 : 1:24:37 PM
 */

define(['./baseWidget', 'util/property','./widgetType'], function(baseWidget, property, widgetType){
	var defaultEvents = [{value:'click', label:"Click"},{value:"press/release", label:"Press/Release"}];
	var widgetTypes = [{value:widgetType.Button, label:widgetType.Button},{value:widgetType.Display, label:widgetType.Display}];
	return function(f, events){
		var o = baseWidget();
		o.functionText = property.call(o, f||  "");
		o.events = property.call(o, events || []);
		o.recallRate = property.call(o, 250);
		o.boundFunction = function(){
			var res = o.events().map(function(d){
				if(d.indexOf("/") > -1){
					return  d.split("/").map(function(a){
						return a + "_" + o.functionText();
					}).join(", ");
					
				}else{
					return d + "_" + o.functionText();
				}
			}).join(", ");
			
		};
		
		o.toJSON = function(){
			return {
				functionText:o.functionText(),
				events:o.events(),
				type: o.type(),
				recallRate:o.recallRate()
			};
		};
		
		o.getRenderData = function(){
			var res = [];
            //res.push({label:"Area Name Identifier",element:"textarea", inputType:"text", value:o.id(), name:"id", other:['readonly']});
            res.push({label:"Area Type", element:"select", value:o.type(), data:widgetTypes, name:"type"});
            res.push({label:"Area Identifier",element:"input", inputType:"text", value:o.functionText(), name:"functionText",other:['required']});
            res.push({label:"Bind", element:'input', inputType:"checkbox", data:defaultEvents, value:o.events(), name:"events"});
            res.push({label:"Recall Rate",element:"input", inputType:"text", pattern:"\\d{2,5}", value:o.recallRate(), name:"recallRate", other:['required']});
            res.push({label:"",element:"textarea", inputType:"text", value:o.boundFunction(), name:"boundFunction", other:['readonly']});
            res.push({label:"Top position",element:"input", inputType:"number", value: d3.select(".mark.selected").style("top").replace('px',''), name:"top", min:"0", step:"any", max:"910", other:['required']});
            res.push({label:"Left position",element:"input", inputType:"number", value: d3.select(".mark.selected").style("left").replace('px',''), name:"left", min:"0", step:"any", max:"910", other:['required']});
            res.push({label:"Width",element:"input", inputType:"number", value: d3.select(".mark.selected").style("width").replace('px',''), name:"width", min:"0", step:"any", max:"910", other:['required']});
            res.push({label:"Height",element:"input", inputType:"number", value: d3.select(".mark.selected").style("height").replace('px',''), name:"height", min:"0", step:"any", max:"910", other:['required']});

			return res;
		};
		return o;
	};
});