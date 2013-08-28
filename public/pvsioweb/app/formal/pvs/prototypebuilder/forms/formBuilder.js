/**
 * reponsible for building forms and emitting events for data change etc
 * @author Patrick Oladimeji
 * @date Jan 3, 2013 : 12:56:30 PM
 */

define(['util/eventDispatcher', "./events", "util/property","d3/d3"], 

	function(eventDispatcher, events, property){
		
		function create(form){
			var f = eventDispatcher({}), controls, el, rows, event;
			form.id = form.id || "form" + new Date().getTime();
			
			
			var o = d3.select("#" + form.id);
			if(!o.empty())
				o.html("");
			
			o = d3.select("body").append("div").attr("class", "overlay").attr("id", form.id).append("form")
				.attr("class", "center dialog shadow form-horizontal").attr("onsubmit", "return false");
			if(form.legend)
				o.append("legend").html(form.legend.value).classed(form.legend.classes, true);
			//add input elements
			if(form.data){
				rows = o.selectAll(".control-group").data(form.data).enter()
					.append("div").attr("class", "control-group");
				rows.each(function(d, i){
					d.element = d.element || "input";
					d.inputType = d.inputType || "text";
					d.value = d.value || "";
					
					d3.select(this).append("label").attr("class", "control-label").attr("for", d.name).html(d.label);
					controls = d3.select(this).append("div").attr("class", "controls");
					el = controls.append(d.element).attr("id", d.name).attr('class', "formelement");
					
					if(d.inputType){
						el.attr("type", d.inputType).attr("value", d.value).attr("name", d.name);
						if(d.inputType === "text"){
							el.property("value", d.value);
						}
					}
					
					if(d.element === "select" && d.options){
						el.selectAll("options").data(d.options).enter()
							.append("option").attr("value", d.labelFunction)
								.html(d.labelFunction);
					}
                    if(d.element === "label"){
                        el.remove("labelMessage");

                        var message=el.select("validForm").text();
                        el.select("control-group").selectAll().remove();
                        el.select("control-group").append("label",message);
                    }

					if(d.other){
						d.other.forEach(function(a){
							el.attr(a, true);
						});
					}
					//add event listener for form
					el.on("change", function(d){
						var data = d.options ? d.options[this.selectedIndex] : d;
						event = {type:events.FormDataChanged, elementid:d3.select(this).attr("id"), elementValue:this.value, data:data};
						f.fire(event);
					});
				});
			}
			//add submit and cancle button
			var buttons = o.append("div").attr("class", "control-group")
				.append("div").attr("class", "controls");
			buttons.append("button").attr("type","button").html("Cancel").attr("class", "btn btn-danger left").on("click", function(){
				event = {type:events.FormCancelled, formId:form.id, form:d3.select("#" + form.id)};
				f.fire(event);
			});
			
			buttons.append("button").attr("type","submit").html("OK").attr("class", "btn btn-success right").on("click", function(){
				//check all the elements are valid before emmitting event
				if(validate(o)){
					d3.select(this).attr("type", "button");
					event = {type:events.FormSubmitted, formId:form.id, formData:getFormData(form.id), form:d3.select("#" + form.id)};
					f.fire(event);
				}			
			});
			
			return f;
		}
		
		function getFormData(id){
			var res = new FormData();
			d3.select("#" + id).selectAll(".formelement").each(function(){
				var el = d3.select(this);
				if(el.attr("type") === "file"){
					res.append(el.attr("id"), el.property("files")[0]);
				}else{
					res.append(el.attr("id"), (el.property("value") || el.text()));
				}
			});
			return res;
		}
		
		function validate(o){
			var res = true;
			o.selectAll("select,input,textarea").each(function(d){
				res = res && this.checkValidity();
			});
			return res;
		}
		
		return{
			create:function(form){
				return create(form);
			}
		};
});