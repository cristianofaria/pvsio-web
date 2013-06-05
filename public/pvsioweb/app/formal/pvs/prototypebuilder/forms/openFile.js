/**
 * Created with JetBrains WebStorm.
 * User: Cristiano Faria
 * Date: 15-04-2013
 * Time: 16:28
 */
define(["./formBuilder"], function(formBuilder){
        return {
            create:function(options, labelFunc){
                labelFunc = labelFunc || function(d){
                    return d.label;
                };

                var model = {
                    legend:{value:"Open File", classes:"header"},
                    data:[{label:"Select File", name:"fileName", element:"select",
                        options:options, labelFunction:labelFunc, other:['required']}]
                };
                return formBuilder.create(model);
            }
        };
    }
);