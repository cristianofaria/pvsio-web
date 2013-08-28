/**
 * Created with JetBrains WebStorm.
 * User: Cristiano Faria
 * Date: 03-07-2013
 * Time: 15:49
 * To change this template use File | Settings | File Templates.
 */
define(["./formBuilder"], function(formBuilder){
var model = {
    legend:{value:"Crop Image", classes:"header"},
    data:[
        {img:"image",name:"image", src:"image.jpg"},
        {label:"X1", name:"X1", other:['required']},
        {label:"Y1", name:"X1", other:['required']},
        {label:"X2", name:"X2", other:['required']},
        {label:"Y2", name:"Y2", other:['required']},
        {label:"Width", name:"Width", other:['required']},
        {label:"Height", name:"Height", other:['required']}
    ]
};

return{
    create:function(){
        return formBuilder.create(model);
    }
};
});
