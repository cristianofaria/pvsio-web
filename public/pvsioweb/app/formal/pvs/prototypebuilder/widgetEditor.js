/**
 * creates a form for making or editing widgets
 * @author Patrick Oladimeji
 * @date Dec 29, 2012 : 1:22:57 PM
 */

define(['./displayMappings','util/Timer','util/eventDispatcher', "./widgetEvents",
        "./buttonWidget", "./displayWidget", './widgetMaps','d3/d3'], 
      function(displayMappings,  timer, eventDispatcher, widgetEvents, buttonWidget, displayWidget, widgetMaps){
			var preventDefault = function(){d3.event.stopPropagation();};

			
			function create(mark){
				var widget = widgetMaps.get(mark.attr("id"))  || buttonWidget();
				var o = eventDispatcher({}), controls, el;
				var x = d3.event.pageX, y = d3.event.pageY;
				
				renderElements(widget);
				
				function renderElements(widget){
					var formMoving = false, sx, sy, sTop, sLeft;
					var form = createForm(x, y).on("mousedown", preventDefault)
						.on("mouseup", preventDefault)
						.on("mousemove", preventDefault);
					d3.select("div.detailsForm").on('mousedown', function(){
						if(d3.event.target === this){
							d3.event.preventDefault();
							formMoving = true;
							sx = d3.event.clientX, sy = d3.event.clientY;
							sTop = parseFloat(d3.select(this).style("top"));
							sLeft = parseFloat(d3.select(this).style("left"));
						}
					}).on('mouseup', function(){
						formMoving = false;
					}).on("mouseout", function(){
						formMoving = false;
					}).on("mousemove", function(){
						if(formMoving && d3.event.target === this){
							d3.event.preventDefault();
							var dx = sx - d3.event.clientX, dy = sy - d3.event.clientY;
							d3.select(this).style("top", (sTop - dy) + "px").style("left", (sLeft - dx) + "px");
						}
					});
					var data = widget.getRenderData();
					var controlgroups  = form.selectAll("div.control-group").data(data).enter()
						.append("div").attr("class", "control-group");
				
					controlgroups.each(function(d, i){
						d3.select(this).append("label")
							.attr("class", "control-label").attr("for", d.name).html(d.label);
						controls = d3.select(this).append("div").attr("class", "controls");
						el = controls.append(d.element).attr("id", d.name);
						if(d.inputType){
							el.attr("type", d.inputType).attr("value", d.value).attr("name", d.name);
							if(d.inputType === 'text'){
								el.property("value", d.value);
							}
						}
						
						if(d.other){
							d.other.forEach(function(d){
								el.attr(d, true);
							});
						}
						if(d.pattern){
							el.attr('pattern', d.pattern);
						}
                        if(d.min){
                            el.attr('min', d.min);
                        }
                        if(d.max){
                            el.attr('max', d.max);
                        }
                        if(d.step){
                            el.attr('step', d.step);
                        }
						if(d.data){
							if(d.element === "select") {
								el.selectAll("option").data(d.data).enter()
									.append("option")
										.html(function(d){
											return d.label;
										}).attr("value", function(d){
											return d.value;
										}).attr("selected", function(o){
											return d.value === o.value ? "selected" : null;
										});
							}else if(d.inputType === "checkbox"){
								el.remove();
								controls.selectAll("label.checkbox").data(d.data).enter()
									.append("label").attr("class", "checkbox").html(function(d){
											return d.label;
										})
										.append("input").attr("type", "checkbox").property("value", function(d){
											return d.value;
										}).attr("name", d.name)
										.attr("checked", function(){
											return d.value.indexOf(this.value) > -1 ? true : null;
										});
							}
						}
					});//end foreach row
					//add row for delete/save
					controls = form.append("div").attr("class", "buttons control-group")
						.append("div").attr("class", "controls");
					//delete handler for widget
					controls.append("button").attr("type", "button").html("Delete").attr("class", "btn btn-danger left")
						.on("click", function(){
							var event = {type:widgetEvents.WidgetDeleted, mark:mark, widget:widget,
									formContainer:d3.select("div.detailsForm")};
							o.fire(event);
						});
					//close window handler
					controls.append("button").attr("type", "button").html("Cancel").attr("class", "btn")
						.style("margin", "0 10px 0 10px")
						.on("click", function(){
							d3.select("div.detailsForm").remove();
						});
					//save handler for widget
					controls.append("button").attr("type","submit").attr("class", "btn btn-success right").html("Save")
						.on("click", function(){
                            var validateOldArea = false;
							if(validate(form)){	
								d3.select(this).attr("type", "button");
								var width, height, top, left, name;
								var res = data.map(function(d){
									var el = d3.select("#" + d.name), value = el.empty() ? null : el.property("value")|| el.text();
									value = value ? value.trim() : value;
									///for checkboxes add list of items selected

									if(d.data && d.inputType === 'checkbox'){
										value = [];
										d3.selectAll("input[type=checkbox][name=events]").each(function(d,i){
											if(this.checked){
												value.push(this.value);
											}
										});
									}
                                    if (d.name==="width"){
                                        width = value;
                                        console.log("coords " + width);
                                        validateOldArea = true;
                                        return null;
                                    }else if (d.name==="height"){
                                        height = value;
                                        console.log("coords " + height);
                                        validateOldArea = true;
                                        return null;
                                    } else if (d.name==="top"){
                                        top = value;
                                        console.log("coords " + top);
                                        validateOldArea = true;
                                        return null;
                                    } else if (d.name==="left"){
                                        left = value;
                                        console.log("coords " + left);
                                        validateOldArea = true;
                                        return null;
                                    }else{
                                        console.log(" return ");
									    return {key:d.name, value:value};
                                    }
								}).filter(function(d){return d!== null;});
                                //res.removeItem("width");
                                //res = res.filter(function(f){return f!== null;});
                                if (validateOldArea){
                                    d3.select(".mark.selected").attr("startx",left+"px");
                                    d3.select(".mark.selected").attr("starty",top+"px");
                                    d3.select(".mark.selected").style("top",top+"px");
                                    d3.select(".mark.selected").style("left",left+"px");
                                    d3.select(".mark.selected").style("width",width+"px");
                                    d3.select(".mark.selected").style("height",height+"px");

                                    if(d3.select(".mark.selected").attr("id")!==null){
                                        var heightSize = parseFloat(height) + parseFloat(top);
                                        var widthSize = parseFloat(width) + parseFloat(left);
                                        var coords = left + "," + top + "," + (widthSize) + "," + (heightSize);
                                        d3.select("#prototypeMap area." + d3.select(".mark.selected").attr("id")).attr("coords",coords);
                                    }
                                   /* d3.select("#"+name).attr("startx",left+"px");
                                    d3.select("#"+name).attr("starty",top+"px");
                                    d3.select("#"+name).style("top",top+"px");
                                    d3.select("#"+name).style("left",left+"px");
                                    d3.select("#"+name).style("width",width+"px");
                                    d3.select("#"+name).style("height",height+"px");
                                    /*d3.selectAll("#prototypeMap area").each(function () {
                                        var a = d3.select(this);
                                        if (a.attr("class") === name){
                                            a.attr("coords",top+","+widthSize+left+","+heightSize);
                                        }
                                    });*/
                                }

                                var w = widgetMaps.get(name);

                                console.log("widget: "+ JSON.stringify(w));

								widget = dataToWidget(res, widget);

								widgetMaps.add(widget);
								var event = {type:widgetEvents.WidgetSaved, mark:mark, 
										formContainer:d3.select("div.detailsForm"), formData:res, widget:widget};
								o.fire(event);
							}
							
						});
					
					//if the type of widget changes update the widget and recreate the form
					d3.select("select#type").on("change", function(d){
						widget = changeWidget(widget, this.value);
						widgetMaps.add(widget);
						renderElements(widget);
					});
					//bind listener to function text to automatically update the boundfunction text
					d3.select("#functionText").on("keyup", function(){
						updateBoundFunctionsLabel();
					});
					//bind listener for checkchanged events
					d3.selectAll("input[type=checkbox][name=events]").on("change", function(){
						updateBoundFunctionsLabel();
					});
					
					d3.select("select#predefinedRegex").on('change', function(){
						updateRegex();
					});
					d3.select("#prefix").on("keyup", function(){
						updateRegex();
					});
					
					if(widget.type() === "Button") {
						updateBoundFunctionsLabel();
					}else{
						updateRegex();
					}
				}
				return o;
			}
			
			function validate(o){
				var res = true;
				o.selectAll("select,input,textarea").each(function(d){
					res = res && this.checkValidity();
				});
				return res;
			}
			
			function updateRegex(){
				var r = "", predefined = d3.select("#predefinedRegex").property("value"), prefix = d3.select("#prefix").property("value");
				r = prefix + " := (" + predefined + ")";
				d3.select("#regex").property("value", r);
			}
			
			function updateBoundFunctionsLabel(){
				var f = d3.select("#functionText").property("value"), str = "", events = [];
				d3.selectAll("input[type=checkbox][name=events]").each(function(){
					if(this.checked)
						events = events.concat(this.value.split("/"));
				});
				str = events.map(function(d){
					return d + "_" + f;
				}).join(", ");
				d3.select("#boundFunction").text( str);
			}
			
			function dataToWidget(data, w){
				data.forEach(function(d){
					w[d.key](d.value);
				});
				return w;				
			}
			
			function changeWidget(w, newtype){
				var res;
				if(newtype === "Display") {
					res = displayWidget();
					res.__olddata = w;
				}else if(newtype === "Button"){
					res = buttonWidget();
					res.__olddata = w;
				}
				
				if(w.__olddata){
					for(var key in w.__olddata){
						res[key] = w.__olddata[key];
					}
				}
				return res;
			}
			
			function createForm(x, y){
				d3.select("div.detailsForm.shadow").remove();
				var form = d3.select("body").append("div").attr("class", "detailsForm shadow")
					.style("top", y + "px").style("left", x + "px")
						.append("form").attr("class", "");
				form.append("legend").html("Edit User Interface Area");
				return form;
			}
			
			return{
				create:function(mark){
					return create(mark);
				}
			};
		});