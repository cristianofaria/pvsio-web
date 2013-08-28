/**
 * Created with JetBrains WebStorm.
 * User: Cristiano Faria
 * Date: 09-07-2013
 * Time: 17:00
 * To change this template use File | Settings | File Templates.
 */
define(["./formBuilder"], function(formBuilder,req){
    var model = {
        legend:{value:"Crop Image", classes:"header"},
        //legend:{value:"Do you really want to SAVE this changes? This can change the widget areas...", classes:"body"},
        data:[
            {label:"Do you really want to SAVE this changes? This can change the widget areas...", element:"label", name:"labelMessage",id:"validForm"}
        ]
    };

    return{
        create:function(){
            return formBuilder.create(model);
        }
    };
});