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
    const Variable = function(name, type) {
        this.class = 'variable';
        this.name = name;
        this.type = type;
        this.state = 0;
        this.value = `${name} (${type})`;
        this.dataset_urls = [];
    }
    const IOOSCategory = function(category) {
        this.class = 'IOOS category';
        this.ioos_category = category;
        this.value = category;
        this.state = 0;
        this.variables = [];
        this.dataset_urls = [];
    }
    const Year = function(year) {
        this.class = 'year';
        this.year = year;
        this.value = year;
        this.state = 1;
        this.dataset_urls = [];
    }

    const ExplorerDataset = function(dataset_url) {
        this.dataset_url = dataset_url;
        this.metadata = undefined;
        this._pinned = false;
        this.bounds = {
            overall: undefined,
            year: {}
        }
        this.fetchMetadataPromise = ErddapClient.politeFetchJsonp(dataset_url).then(data => {
            this.metadata = data.table.rows;
            let bounds = {
                lat: {},
                lon: {}
            }
            let p = 0;
            this.metadata.map(row => {
                let [rowType, variableName, attributeName, dataType, value] = row;
                if (variableName === "NC_GLOBAL") {
                    switch (attributeName) {
                        case "geospatial_lat_min":
                            bounds.lat.min = parseFloat(value);
                            p++;
                            break;
                        case "geospatial_lat_max":
                            bounds.lat.max = parseFloat(value);
                            p++;
                            break;
                        case "geospatial_lon_min":
                            bounds.lon.min = parseFloat(value);
                            p++
                            break;
                        case "geospatial_lon_max":
                            bounds.lon.max = parseFloat(value);
                            p++
                            break;
                    }
                }
            })
            if(p===4){
                this.bounds.overall = bounds;
            }
            return this;
        }).catch(e=>{
                //no bounds available
                this.metadata = [];
                return this;
            });
    }

    ExplorerDataset.prototype.fetchMetadata = function() {
        return this.fetchMetadataPromise;
    }

    ExplorerDataset.prototype.pin = function() {
        this._pinned = true;
    }

    ExplorerDataset.prototype.unpin = function() {
        this._pinned = false;
    }

    ExplorerDataset.prototype.pinned = function() {
        return this._pinned;
    }
    IOOSCategory.prototype.addVariable = function(variable) {
        if (this.variables.indexOf(variable) < 0) {
            this.variables.push(variable);
        }
    }

    const ErddapExplorer = function() {
        this.datasets = {};
        this.ioos_categories = {};
        this.callbacks = {
            categoriesChanged: [],
            datasetsIndexLoaded: [],
            datasetsIndexUpdated: [],
            selectedYearsChanged: []
        };
        this.timeouts = {};
        this.app_data = {};
        this.erddapClients = undefined;
        this.datasetsIndex = undefined;
        this.years = [];
        this.bounds = undefined;
        this.selectedYear = undefined;
    }

    ErddapExplorer.prototype.setErddapClients = function(erddapClients) {
        this.erddapClients = erddapClients;
        this.erddapClients.loadDatasetsIndex().then(datasetsIndex => {
            if (!datasetsIndex) {
                console.log("datasetsIndex not loaded");
                return;
            }
            this.datasetsIndex = datasetsIndex;
            this.years = this.datasetsIndex.years.map(year => new Year(year));
            this.setBounds(this.bounds);
            this._trigger("datasetsIndexLoaded", datasetsIndex);
        }).catch()
    }

    ErddapExplorer.prototype.setBounds = function(bounds) {
        this.bounds = bounds;
        if (!this.datasetsIndex) return;
        this.datasetsIndex.setBounds(bounds).then(yearmap => {
            this.years.forEach(year => {
                year.dataset_urls = yearmap[year.year];
            })
            this._trigger("datasetsIndexUpdated", this.datasetsIndex);
        })
    }

    ErddapExplorer.prototype.on = function(e, fn) {
        if (this.callbacks[e]) {
            this.callbacks[e].push(fn);
        } else {
            throw new Error(`There is no event for ${e}`);
        }
    }


    ErddapExplorer.prototype._trigger = function(type, e) {
        clearTimeout(this.timeouts[type]);
        this.timeouts[type] = setTimeout(() => {
            this.callbacks[type].map(cb => setTimeout(() => cb(e), 0));
        }, 400);
    }

    ErddapExplorer.prototype.addDataset = function(dataset_url) {
        if (this.datasets[dataset_url]) {
            return this.datasets[dataset_url];
        }
        let dataset = new ExplorerDataset(dataset_url);
        this.datasets[dataset_url] = dataset;
        dataset.fetchMetadata().then(() => this.updateIOOSCategories());
        this.erddapClients.loadDatasetsIndex().then(datasetsIndex => {
            if (datasetsIndex) {
                datasetsIndex.fetchBounds(dataset_url).then(bounds => {
                    dataset.bounds.year = bounds;
                    if(dataset.bounds.overall === undefined){
                        let overall = undefined;
                        Object.values(bounds).map(b=>{
                            overall = overall || b;
                            if(b.lat.min<overall.lat.min){
                                overall.lat.min = b.lat.min;
                            }
                            if(b.lat.max>overall.lat.max){
                                overall.lat.max = b.lat.max;
                            }
                            if(b.lon.min<overall.lon.min){
                                overall.lon.min = b.lon.min;
                            }
                            if(b.lon.max>overall.lon.max){
                                overall.lon.max = b.lon.max;
                            }
                        })
                        dataset.bounds.overall = overall;
                    }
                    this._trigger("datasetsIndexUpdated", this.datasetsIndex);
                })
            }
        })

        return dataset;
    }

    ErddapExplorer.prototype.getDataset = function(dataset_url) {
        return this.datasets[dataset_url];
    }
    ErddapExplorer.prototype.removeDataset = function(ds) {
        let dataset_url = ds.dataset_url || ds;
        this.datasets.delete(dataset_url)
        this.updateIOOSCategories();
    }

    ErddapExplorer.prototype.clear = function() {
        Object.values(this.datasets).map(ds => {
            if (!ds.pinned()) {
                delete this.datasets[ds.dataset_url];
            }
        });
        Object.values(category_variables).map(cat => {
            cat.state = 0;
            cat.dataset_urls = [];
        })
        this.updateIOOSCategories();
    }

    ErddapExplorer.prototype.updateIOOSCategories = function() {
        let ioos_categories = {};
        Object.values(this.datasets).map(dataset => {
            if (dataset.metadata) { // might not be in yet.
                let metadata = dataset.metadata;
                let dataset_url = dataset.dataset_url;
                let variableDataType = undefined;
                let variable = undefined;
                metadata.map(row => {
                    let [rowType, variableName, attributeName, dataType, value] = row;
                    if (attributeName === "") {
                        variableDataType = dataType;
                        variable = new Variable(variableName, variableDataType);
                    } else if (attributeName === 'ioos_category') {
                        let category = ioos_categories[value] = ioos_categories[value] || new IOOSCategory(value);
                        let varkey = `${value}:${variableName}:${variableDataType}`;
                        variable = category_variables[varkey] = category_variables[varkey] || variable;
                        category.addVariable(variable);
                        if ((category.dataset_urls).indexOf(dataset_url) < 0) category.dataset_urls.push(dataset_url);
                        if ((variable.dataset_urls).indexOf(dataset_url) < 0) variable.dataset_urls.push(dataset_url);
                    }
                })
            }
        });
        Object.values(this.ioos_categories).map(cat => {
            if (ioos_categories[cat.value]) {
                ioos_categories[cat.value].state = cat.state;
            }
        })
        this.ioos_categories = ioos_categories;
        this._trigger("categoriesChanged", ioos_categories);
    }
    return ErddapExplorer;
})));