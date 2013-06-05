/**
 * User: Cristiano Faria
 * Date: 21-05-2013
 */
define(["./formBuilder"], function(formBuilder){
    var model = {
        legend:{value:"Import File", classes:"header"},
        data:[
            {label:"PVS Spec", name:"pvsSpec", inputType:"file", other:['required']}
        ]
    };

    return{
        create:function(){
            return formBuilder.create(model);
        }
    };
});