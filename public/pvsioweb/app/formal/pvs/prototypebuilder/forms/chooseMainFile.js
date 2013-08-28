/**
 * User: Cristiano Faria
 * Data: 17-05-2013
 */
define(["./formBuilder"], function(formBuilder){
        return {
            create:function(options, labelFunc){
                labelFunc = labelFunc || function(d){
                    return d.label;
                };

                var model = {
                    legend:{value:"Choose the main file", classes:"header"},
                    data:[{label:"Select File", name:"fileName", element:"select",
                        options:options, labelFunction:labelFunc, other:['required']}]
                };
                return formBuilder.create(model);
            }
        };
    }
);