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
    const Year = function(year){
        this.class = 'year';
        this.year = year;
        this.value = year;
        this.state = 1;
        this.dataset_urls = [];
    }

    const ExplorerDataset = function(dataset_url){
        this.dataset_url = dataset_url;
        this.metadata = undefined;
        this._pinned = false;
        this.fetchMetadataPromise = ErddapClient.politeFetchJsonp(dataset_url).then(data=>{
                this.metadata = data.table.rows;
                return this;
            });
    }

    ExplorerDataset.prototype.fetchMetadata = function(){
        return this.fetchMetadataPromise;
    }

    ExplorerDataset.prototype.pin = function(){
        this._pinned = true;
    }

    ExplorerDataset.prototype.unpin = function(){
        this._pinned = false;
    }

    ExplorerDataset.prototype.pinned = function(){
        return this._pinned;
    }

    IOOSCategory.prototype.addVariable = function(variable){
        if(this.variables.indexOf(variable)<0){
            this.variables.push(variable);
        }
    }

    const ErddapExplorer = function(){
        this.datasets = {};
        this.ioos_categories = {};
        this.callbacks = {
            categoriesChanged: [],
            datasetsIndexLoaded: [],
            datasetsIndexUpdated: []
        };
        this.timeouts = {};
        this.app_data = {};
        this.erddapClients = undefined;
        this.datasetsIndex = undefined;
        this.years = [];
        this.yearsMode = "any";
        this.bounds = undefined;
    }

    ErddapExplorer.prototype.setErddapClients = function(erddapClients){
        this.erddapClients = erddapClients;
        this.erddapClients.loadDatasetsIndex().then(datasetsIndex=>{
            if(!datasetsIndex){
                console.log("datasetsIndex not loaded");
                return;
            }
            this.datasetsIndex = datasetsIndex;
            this.years = this.datasetsIndex.years.map(year=>new Year(year));
            this.setBounds(this.bounds);
            this._trigger("datasetsIndexLoaded",datasetsIndex);
        })
    }

    ErddapExplorer.prototype.setBounds = function(bounds){
        this.bounds = bounds;
        this.datasetsIndex.setBounds(bounds).then(yearmap=>{
            this.years.forEach(year=>{
                year.dataset_urls = yearmap[year.year];
            })
            this._trigger("datasetsIndexUpdated",this.datasetsIndex);
        })
    }

    ErddapExplorer.prototype.on = function(e,fn){
        if(this.callbacks[e]){
            this.callbacks[e].push(fn);
        }else{
            throw new Error(`There is no event for ${e}`);
        }
    }

    ErddapExplorer.prototype._trigger = function(type,e){
        clearTimeout(this.timeouts[type]);
        this.timeouts[type] = setTimeout(()=>{
            this.callbacks[type].map(cb=>setTimeout(()=>cb(e),0));
        },400);
    }

    ErddapExplorer.prototype.addDataset = function(dataset_url){
        if(this.datasets[dataset_url]){
            return this.datasets[dataset_url];
        }
        let dataset = new ExplorerDataset(dataset_url);
        this.datasets[dataset_url] = dataset;
        dataset.fetchMetadata().then(()=>this.updateIOOSCategories());
        return dataset;
    }

    ErddapExplorer.prototype.removeDataset = function(ds){
        let dataset_url = ds.dataset_url || ds;
        this.datasets.delete(dataset_url)
        this.updateIOOSCategories();
    }

    ErddapExplorer.prototype.clear = function(){
        Object.values(this.datasets).map(ds=>{
            if(!ds.pinned()){
                delete this.datasets[ds.dataset_url];
            }
        });
        Object.values(category_variables).map(cat=>{
            cat.state = 0;
            cat.dataset_urls = [];
        })
        this.updateIOOSCategories();
    }

    ErddapExplorer.prototype.updateIOOSCategories = function(){
        let ioos_categories = {};
        Object.values(this.datasets).map(dataset => {
            if(dataset.metadata){ // might not be in yet.
                let metadata = dataset.metadata;
                let dataset_url = dataset.dataset_url;
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