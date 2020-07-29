/**
 * (c) Marine Institute
 *
 * Website: https://marine.ie/
 * Description: Data exploration for ERDDAP
 *
 * MIT License
 *
 */
;
(function(global, factory) {
    if (typeof(ErddapClient) === 'undefined') {
        console.log("erddap-client.js must be loaded before erddap-web-components.js");
    }
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
        typeof define === 'function' && define.amd ? define(factory) :
        global.ErddapExplorer = factory();
}(this, (function() {
    'use strict';
    const category_variables = {

    };
    const Variable = function(name,type){
        this.class = 'variable';
        this.name = name;
        this.type = type;
        this.state = 0;
        this.value = `${name} (${type})`;
        this.dataset_urls = [];
    }
    const IOOSCategory = function(category){
        this.class = 'IOOS category';
        this.ioos_category = category;
        this.value = category;
        this.state = 0;
        this.variables = [];
        this.dataset_urls = [];
    }
    IOOSCategory.prototype.addVariable = function(variable){
        if(this.variables.indexOf(variable)<0){
            this.variables.push(variable);
        }
    }
    const ErddapExplorer = function(){
        this.datasets = [];
        this.metadata = {};
        this.ioos_categories = {};
        this.callbacks = {
            categoriesChanged: []
        };
        this.timeouts = {};
        this.app_data = {};
    }
    ErddapExplorer.prototype.on = function(e,fn){
        if(this.callbacks[e]){
            this.callbacks[e].push(fn);
        }else{
            throw new Error(`There is no event for e`);
        }
    }
    ErddapExplorer.prototype._trigger = function(type,e){
        clearTimeout(this.timeouts[type]);
        this.timeouts[type] = setTimeout(()=>{
            this.callbacks[type].map(cb=>setTimeout(()=>cb(e),0));
        },400);
    }
    ErddapExplorer.prototype.addDataset = function(dataset_url){
        if(this.datasets.indexOf(dataset_url)<0){
            this.datasets.push(dataset_url);
            ErddapClient.politeFetchJsonp(dataset_url).then(data=>{
                this.metadata[dataset_url] = data.table.rows;
                this.updateIOOSCategories();
            });
        }
    }
    ErddapExplorer.prototype.removeDataset = function(dataset_url){
        this.datasets = this.datasets.filter(d => d !== dataset_url);
        delete this.metadata[dataset_url];
        this.updateIOOSCategories();
    }
    ErddapExplorer.prototype.clear = function(){
        this.datasets = [];
        this.metadata = {};
        Object.values(category_variables).map(cat=>{
            cat.state = 0;
            cat.dataset_urls = [];
        })
        this.updateIOOSCategories();
    }
    ErddapExplorer.prototype.updateIOOSCategories = function(){
        let ioos_categories = {};
        this.datasets.map(dataset_url => {
            let metadata = this.metadata[dataset_url];
            if(metadata){ // might not be in yet.
                let variableDataType = undefined;
                let variable = undefined;
                metadata.map(row=>{
                    let [rowType,variableName,attributeName,dataType,value] = row;
                    if(attributeName===""){
                        variableDataType = dataType;
                        variable = new Variable(variableName,variableDataType);
                    }else if(attributeName === 'ioos_category'){
                        let category = ioos_categories[value] = ioos_categories[value] || new IOOSCategory(value);
                        let varkey = `${value}:${variableName}:${variableDataType}`;
                        variable = category_variables[varkey] = category_variables[varkey] || variable;
                        category.addVariable(variable);
                        if((category.dataset_urls).indexOf(dataset_url)<0) category.dataset_urls.push(dataset_url);
                        if((variable.dataset_urls).indexOf(dataset_url)<0) variable.dataset_urls.push(dataset_url);
                    }
                })
            }
        });
        Object.values(this.ioos_categories).map(cat=>{
            if(ioos_categories[cat.value]){
                ioos_categories[cat.value].state = cat.state;
            }
        })
        this.ioos_categories = ioos_categories;
        this._trigger("categoriesChanged",ioos_categories);
    }
    return ErddapExplorer;
})));