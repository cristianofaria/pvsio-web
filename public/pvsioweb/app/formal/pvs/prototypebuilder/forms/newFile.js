/**
 * User: Cristiano Faria
 * Date: 15-04-2013
 * Time: 11:43
 */
define(["./formBuilder"], function(formBuilder){
        var model = {
            legend:{value:"New File", classes:"header"},
            data:[{label:"File Name", name:"fileName", other:['required']}
            ]
        };

        return{
            create:function(){
                return formBuilder.create(model);
            }
        };
    }
);