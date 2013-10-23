/**
 * 
 * @author Patrick Oladimeji
 * @date Dec 29, 2012 : 1:24:55 PM
 */
define(['./baseWidget', './widgetType', 'util/property','./displayMappings'], 
	function(baseWidget, widgetType, property, displayMappings){
	var widgetTypes = [{value:widgetType.Button, label:widgetType.Button},{value:widgetType.Display, label:widgetType.Display}];

	function predefinedRegexes(){
		var res = [];
		for(var key in displayMappings.preset){
			res.push(displayMappings.preset[key]);
		}	
		return res;
	}
	
	return function(regex, label){
		var o = baseWidget(widgetType.Display);
		o.regex = property.call(o, regex || '');
		//o.label = property.call(o, label || '');
		o.predefinedRegex = property.call(o, "");
		o.prefix = property.call(o, "");	
		o.toJSON = function(){
			return {
				predefinedRegex:o.predefinedRegex(),
				regex:o.regex(),
				prefix:o.prefix(),
				type:o.type()
			};
		};
		
		o.getRenderData = function(){
            //alert(JSON.stringify(o));
			var res = [];
            //res.push({label:"Area Name Identifier",element:"textarea", inputType:"text", value:o.id(), name:"id", other:['readonly']});
            res.push({label:"Area Type", element:"select", value:o.type(), data:widgetTypes, name:'type'});
			res.push({label:"Value Type", element:"select", value:o.predefinedRegex(), data:predefinedRegexes(), name:"predefinedRegex", other:['required']});
			res.push({label:"Area Identifier", element: "input", inputType:"text", value:o.prefix(), name:"prefix", other:['required']});
			res.push({label:"Regex", element:"input", inputType:"text", value:o.regex(), name:'regex', other:['required']});
			//res.push({label:"Width", element:"input", inputType:"text", value: o.width(), name:"label"});
            res.push({label:"Top position",element:"input", inputType:"number", value: d3.select(".mark.selected").style("top").replace('px',''), name:"top", min:"0", step:"any", max:"910", other:['required']});
            res.push({label:"Left position",element:"input", inputType:"number", value: d3.select(".mark.selected").style("left").replace('px',''), name:"left", min:"0", step:"any", max:"910", other:['required']});
            res.push({label:"Width",element:"input", inputType:"number", value: d3.select(".mark.selected").style("width").replace('px',''), name:"width", min:"0", step:"any", max:"910", other:['required']});
            res.push({label:"Height",element:"input", inputType:"number", value: d3.select(".mark.selected").style("height").replace('px',''), name:"height", min:"0", step:"any", max:"910", other:['required']});

            return res;
		};

		return o;
	};	
	
});